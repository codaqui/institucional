import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import EmailsCampaignsTab from "../EmailsCampaignsTab";
import { renderWithMui } from "../../../../../test/render-mui";

const authState = vi.hoisted(() => ({
  isAdmin: true,
  authFetch: vi.fn(),
}));

vi.mock("../../../../../lib/use-auth", () => ({
  useAuth: () => ({
    user: { sub: "admin-1", handle: "admin", email: "admin@codaqui.dev" },
    ready: true,
    isLoggedIn: true,
    isAdmin: authState.isAdmin,
    isFinanceAnalyzer: !authState.isAdmin,
    authFetch: authState.authFetch,
  }),
}));

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const sampleCampaign = {
  id: "camp-1",
  name: "Boletim Mensal",
  subject: "Novidades para {{name}}",
  bodyMarkdown: "Olá **{{name}}**!",
  templateId: null,
  purpose: "promotional" as const,
  status: "draft" as const,
  segmentType: "all_opted_in_members" as const,
  segmentConfig: {},
  scheduledAt: null,
  startedAt: null,
  completedAt: null,
  createdAt: "2026-11-11T10:00:00Z",
  metrics: {
    total: 2,
    pending: 1,
    sending: 0,
    sent: 0,
    failed: 1,
    skipped: 0,
    suppressed: 0,
  },
};

const sampleDetail = {
  ...sampleCampaign,
  status: "preview" as const,
  recipients: [
    {
      id: "rec-1",
      memberId: "m-1",
      email: "ana@codaqui.dev",
      name: "Ana",
      status: "pending" as const,
      attempts: 0,
      lastError: null,
      sentAt: null,
    },
    {
      id: "rec-2",
      memberId: "m-2",
      email: "falha@codaqui.dev",
      name: "Bruno",
      status: "failed" as const,
      attempts: 3,
      lastError: "SMTP timeout",
      sentAt: null,
    },
  ],
  renderedPreview: {
    subject: "Novidades para Membro Codaqui",
    html: "<p>Olá <strong>Membro Codaqui</strong>!</p>",
    text: "Olá Membro Codaqui!",
  },
};

describe("EmailsCampaignsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.isAdmin = true;
    authState.authFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.startsWith("/campaigns?page=")) {
        return jsonResponse({
          data: [sampleCampaign],
          total: 1,
          page: 1,
          totalPages: 1,
        });
      }
      if (url === "/communities/public") {
        return jsonResponse([{ id: "comm-1", name: "DevParaná", slug: "devparana" }]);
      }
      if (url === "/campaigns/suppressions" && (!init || !init.method || init.method === "GET")) {
        return jsonResponse([
          {
            id: "sup-1",
            emailNormalized: "unsub@codaqui.dev",
            reason: "Descadastro",
            source: "unsubscribe",
            createdAt: "2026-11-11T10:00:00Z",
          },
        ]);
      }
      if (url === "/campaigns" && init?.method === "POST") {
        return jsonResponse(sampleCampaign);
      }
      if (url === "/campaigns/camp-1") {
        return jsonResponse(sampleDetail);
      }
      if (url === "/campaigns/camp-1/preview" && init?.method === "POST") {
        return jsonResponse({
          campaignId: "camp-1",
          status: "preview",
          includedCount: 1,
          excludedCount: 3,
          included: [{ memberId: "m-1", email: "ana@codaqui.dev", name: "Ana" }],
          excluded: [],
          exclusionsByReason: {
            suppressed: 1,
            inactiveRole: 1,
            invalidEmail: 0,
            noOptIn: 1,
            duplicate: 0,
          },
          rendered: sampleDetail.renderedPreview,
        });
      }
      if (url === "/campaigns/camp-1/test" && init?.method === "POST") {
        return jsonResponse({ ok: true, to: "admin@codaqui.dev", status: "sent" });
      }
      if (url === "/campaigns/camp-1/confirm" && init?.method === "POST") {
        return jsonResponse({ ...sampleCampaign, status: "sending" });
      }
      if (url === "/campaigns/camp-1/recipients/rec-2/retry" && init?.method === "POST") {
        return jsonResponse({ id: "rec-2", status: "pending", attempts: 0 });
      }
      return jsonResponse({}, { status: 200 });
    });
  });

  it("executa a jornada completa: criação de rascunho, prévia congelada, teste, confirmação e retry", async () => {
    renderWithMui(<EmailsCampaignsTab />);

    expect(await screen.findByText("Boletim Mensal")).toBeInTheDocument();
    expect(
      await screen.findByText(/Apenas o titular pode reativar/i),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText(/Nome interno da campanha/i),
      { target: { value: "Nova Campanha" } },
    );
    fireEvent.change(
      screen.getByLabelText(/Assunto do e-mail/i),
      { target: { value: "Assunto {{name}}" } },
    );
    fireEvent.change(
      screen.getByLabelText(/Corpo em Markdown/i),
      { target: { value: "Texto da campanha" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Salvar rascunho da campanha/i }),
    );

    expect(
      await screen.findByText(/Campanha: Boletim Mensal/i),
    ).toBeInTheDocument();

    // Gera prévia congelada
    fireEvent.click(
      screen.getByRole("button", { name: /Gerar prévia congelada/i }),
    );
    expect(
      await screen.findByText(/Resumo da prévia congelada:/i),
    ).toBeInTheDocument();

    // Envia e-mail de teste para si
    fireEvent.click(
      screen.getByRole("button", { name: /Enviar teste para mim/i }),
    );
    expect(
      await screen.findByText(/E-mail de teste disparado para admin@codaqui.dev/i),
    ).toBeInTheDocument();

    // Retry em recipient com falha
    fireEvent.click(
      screen.getByRole("button", { name: /Tentar novamente/i }),
    );
    await waitFor(() => {
      expect(authState.authFetch).toHaveBeenCalledWith(
        "/campaigns/camp-1/recipients/rec-2/retry",
        expect.objectContaining({ method: "POST" }),
      );
    });

    // Confirma disparo da campanha
    fireEvent.click(
      screen.getByRole("button", { name: /Confirmar disparo da campanha/i }),
    );
    expect(
      await screen.findByText(/Campanha confirmada e adicionada à fila/i),
    ).toBeInTheDocument();
  });

  it("oculta formulário de criação e PII de destinatários para finance-analyzer", async () => {
    authState.isAdmin = false;
    authState.authFetch.mockImplementation(async (url: string) => {
      if (url.startsWith("/campaigns?page=")) {
        return jsonResponse({
          data: [sampleCampaign],
          total: 1,
          page: 1,
          totalPages: 1,
        });
      }
      if (url === "/campaigns/camp-1") {
        return jsonResponse({
          ...sampleDetail,
          recipients: [
            {
              id: "rec-1",
              memberId: "m-1",
              email: null,
              name: null,
              status: "sent",
              attempts: 1,
              lastError: null,
              sentAt: "2026-11-11T10:05:00Z",
            },
          ],
        });
      }
      return jsonResponse({});
    });

    renderWithMui(<EmailsCampaignsTab />);

    expect(await screen.findByText("Boletim Mensal")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Salvar rascunho da campanha/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Inspecionar/i }));
    expect(
      await screen.findByText(/Campanha: Boletim Mensal/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("ana@codaqui.dev")).not.toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import EmailsApp from "../EmailsApp";
import { renderWithMui } from "../../../../../test/render-mui";

const authState = vi.hoisted(() => ({
  ready: false,
  isLoggedIn: false,
  isAdmin: false,
  authFetch: vi.fn(),
}));

vi.mock("../../../../../lib/use-auth", () => ({
  useAuth: () => ({
    user: null,
    ready: authState.ready,
    isLoggedIn: authState.isLoggedIn,
    isAdmin: authState.isAdmin,
    isFinanceAnalyzer: false,
    login: vi.fn(),
    logout: vi.fn(),
    authFetch: authState.authFetch,
  }),
}));

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

function mockAdmin() {
  authState.ready = true;
  authState.isLoggedIn = true;
  authState.isAdmin = true;
}

function stubLocation() {
  const replace = vi.fn();
  vi.stubGlobal("location", { replace });
  return replace;
}

const failedLog = {
  id: "log-1",
  to: "participante@example.com",
  template: "event-confirmation",
  eventId: "evt-1",
  registrationId: "registration-1" as string | null,
  status: "failed",
  error: "SMTP timeout",
  createdAt: "2026-07-20T10:00:00.000Z",
};

const sentLog = {
  id: "log-2",
  to: "outro@example.com",
  template: "event-reminder",
  eventId: "evt-1",
  registrationId: null,
  status: "sent",
  error: null,
  createdAt: "2026-07-19T10:00:00.000Z",
};

const skippedLog = {
  id: "log-3",
  to: "ignorado@example.com",
  template: "event-reminder",
  eventId: "evt-1",
  registrationId: "registration-3",
  status: "skipped",
  error: "SMTP_NOT_CONFIGURED",
  createdAt: "2026-07-18T10:00:00.000Z",
};

const listResponse = {
  items: [failedLog, sentLog, skippedLog],
  total: 3,
  summary: {
    sent: 9,
    failed: 1,
    skipped: 4,
    byTemplate: {
      "event-confirmation": { sent: 7, failed: 1, skipped: 2 },
      "event-reminder": { sent: 2, failed: 0, skipped: 2 },
    },
  },
};

function mockEmailEndpoints(
  { configured = true, response = listResponse } = {},
) {
  authState.authFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/notifications/status") return jsonResponse({ configured });
    if (url.includes("/notifications/emails/log-1/resend") && init?.method === "POST") {
      return jsonResponse({ ...failedLog, status: "sent", error: null });
    }
    if (url.includes("/notifications/emails/log-3/resend") && init?.method === "POST") {
      return jsonResponse({ ...skippedLog, status: "sent", error: null });
    }
    if (url.includes("/notifications/emails?")) return jsonResponse(response);
    return jsonResponse(null, { ok: false, status: 404 });
  });
}

describe("/admin/emails", () => {
  beforeEach(() => {
    authState.ready = false;
    authState.isLoggedIn = false;
    authState.isAdmin = false;
    authState.authFetch = vi.fn();
    vi.clearAllMocks();
  });

  it("redireciona para home quando não é admin", async () => {
    const replace = stubLocation();
    try {
      authState.ready = true;
      authState.isLoggedIn = true;
      renderWithMui(<EmailsApp />);

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/");
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("carrega os três status e inclui skipped nos totais sem somá-lo a failed", async () => {
    mockEmailEndpoints();
    mockAdmin();

    renderWithMui(<EmailsApp />);

    expect(await screen.findByText("participante@example.com")).toBeInTheDocument();
    expect(screen.getByText("ignorado@example.com")).toBeInTheDocument();
    expect(screen.getByText("Ignorados")).toBeInTheDocument();
    expect(screen.getByText("Ignorados").previousSibling).toHaveTextContent("4");
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(
      screen.getByText("event-confirmation: 7 enviados · 1 falhas · 2 ignorados"),
    ).toBeInTheDocument();
    expect(authState.authFetch).toHaveBeenCalledWith("/notifications/status");
    expect(authState.authFetch).toHaveBeenCalledWith(
      expect.stringContaining("page=1&pageSize=20"),
    );
  });

  it("mostra banner e esconde reenvios quando o módulo está desligado", async () => {
    mockEmailEndpoints({ configured: false });
    mockAdmin();

    renderWithMui(<EmailsApp />);

    expect(
      await screen.findByText(/Envios de e-mail estão desativados/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reenviar/i })).not.toBeInTheDocument();
  });

  it("oferece o filtro skipped", async () => {
    mockEmailEndpoints();
    mockAdmin();

    renderWithMui(<EmailsApp />);
    await screen.findByText("participante@example.com");

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Status" }));
    fireEvent.click(await screen.findByRole("option", { name: "Ignorados" }));

    await waitFor(() => {
      expect(authState.authFetch).toHaveBeenCalledWith(
        expect.stringContaining("status=skipped"),
      );
    });
  });

  it("reenvia e-mail com falha e exibe feedback de sucesso", async () => {
    mockEmailEndpoints();
    mockAdmin();

    renderWithMui(<EmailsApp />);

    const resendButtons = await screen.findAllByRole("button", { name: /Reenviar/i });
    fireEvent.click(resendButtons[0]);

    expect(
      await screen.findByText(/E-mail reenviado com sucesso para participante@example.com/i),
    ).toBeInTheDocument();
    expect(authState.authFetch).toHaveBeenCalledWith(
      expect.stringContaining("/notifications/emails/log-1/resend"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("oferece reenvio somente para logs vinculados a uma inscrição", async () => {
    mockEmailEndpoints({
      response: {
        ...listResponse,
        items: [
          { ...failedLog, registrationId: null },
          { ...failedLog, id: "log-4", registrationId: "registration-4" },
        ],
        total: 2,
      },
    });
    mockAdmin();

    renderWithMui(<EmailsApp />);

    expect(await screen.findAllByRole("button", { name: /Reenviar/i })).toHaveLength(1);
  });

  it("também permite reenviar um e-mail skipped quando o módulo está configurado", async () => {
    mockEmailEndpoints({
      response: { ...listResponse, items: [skippedLog], total: 1 },
    });
    mockAdmin();

    renderWithMui(<EmailsApp />);

    fireEvent.click(await screen.findByRole("button", { name: /Reenviar/i }));

    expect(
      await screen.findByText(/E-mail reenviado com sucesso para ignorado@example.com/i),
    ).toBeInTheDocument();
    expect(authState.authFetch).toHaveBeenCalledWith(
      expect.stringContaining("/notifications/emails/log-3/resend"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("filtra logs por destinatário, período e campanha, e exibe a aba Campanhas", async () => {
    mockEmailEndpoints();
    mockAdmin();

    renderWithMui(<EmailsApp />);
    await screen.findByText("participante@example.com");

    expect(screen.getByRole("tab", { name: "Campanhas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Logs" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Templates" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Destinatário"), {
      target: { value: "participante@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Campanha (ID)"), {
      target: { value: "camp-123" },
    });

    await waitFor(() => {
      expect(authState.authFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "recipient=participante%40example.com&campaignId=camp-123",
        ),
      );
    });
  });
});

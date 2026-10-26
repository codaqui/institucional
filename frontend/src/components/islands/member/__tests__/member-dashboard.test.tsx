/**
 * Testes do dashboard do membro (`/membro`) — conversão de
 * `src/pages/membro/__tests__/index.test.tsx` (jest) para Vitest.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import MemberDashboardApp from "../dashboard/MemberDashboardApp";
import { renderWithMui } from "../../../../test/render-mui";
import type { AuthUser } from "../../../../lib/auth-client";

// Estado mutável compartilhado com a fábrica do mock — cada teste ajusta
// os campos que precisa no beforeEach/corpo (mesmo padrão do AppNavIsland).
const authState = vi.hoisted(() => ({
  user: null as AuthUser | null,
  ready: false,
  isLoggedIn: false,
  authFetch: vi.fn(),
}));

vi.mock("../../../../lib/use-auth", () => ({
  useAuth: () => ({
    user: authState.user,
    ready: authState.ready,
    isLoggedIn: authState.isLoggedIn,
    isAdmin: authState.user?.roles.includes("admin") ?? false,
    isFinanceAnalyzer: authState.user?.roles.includes("finance-analyzer") ?? false,
    logout: vi.fn(),
    authFetch: authState.authFetch,
  }),
}));

function jsonResponse(body: unknown, options: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    sub: "user-1",
    githubId: "gh-1",
    name: "Mentoria Codaqui",
    handle: "mentoriacodaqui",
    avatarUrl: "https://example.com/avatar.png",
    roles: ["member"],
    ...overrides,
  };
}

function mockLoggedIn(user: AuthUser, authFetch: ReturnType<typeof vi.fn>) {
  authState.user = user;
  authState.ready = true;
  authState.isLoggedIn = true;
  authState.authFetch = authFetch;
}

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(jsonResponse([]))),
  );
}

describe("/membro", () => {
  beforeEach(() => {
    authState.user = null;
    authState.ready = false;
    authState.isLoggedIn = false;
    authState.authFetch = vi.fn();
    vi.clearAllMocks();
    stubFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redireciona quando usuário não está logado", async () => {
    authState.ready = true;
    authState.isLoggedIn = false;
    const replace = vi.fn();
    vi.stubGlobal("location", { replace });

    renderWithMui(<MemberDashboardApp />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
  });

  it("exibe distinção pessoal x business em doações e assinaturas em abas separadas", async () => {
    const authFetch = vi.fn(async (url: string) => {
      if (url.includes("/stripe/my-donations?page=1&limit=10")) {
        return jsonResponse({
          items: [
            {
              id: "d-1",
              amount: 100,
              description: "Doação pessoal",
              community: "Tesouro Codaqui",
              referenceId: "ref-1",
              createdAt: "2026-05-18T10:00:00.000Z",
            },
            {
              id: "d-2",
              amount: 200,
              description: "Doação empresa Business",
              community: "Tesouro Codaqui",
              referenceId: "ref-2",
              createdAt: "2026-05-19T10:00:00.000Z",
            },
          ],
          total: 2,
          page: 1,
          limit: 10,
        });
      }
      if (url.includes("/stripe/my-subscriptions?page=1&limit=10")) {
        return jsonResponse({
          items: [
            {
              id: "s-1",
              status: "active",
              interval: "month",
              amount: 1000,
              currency: "brl",
              communityId: "tesouro-geral",
              entityType: "member",
              companyId: null,
              currentPeriodEnd: 1_800_000_000,
              cancelAtPeriodEnd: false,
            },
            {
              id: "s-2",
              status: "active",
              interval: "month",
              amount: 2000,
              currency: "brl",
              communityId: "tesouro-geral",
              entityType: "business",
              companyId: "company-1",
              currentPeriodEnd: 1_800_000_000,
              cancelAtPeriodEnd: false,
            },
          ],
          total: 2,
          page: 1,
          limit: 10,
        });
      }
      if (url.includes("/reimbursements/my")) return jsonResponse([]);
      return jsonResponse(null, { status: 404 });
    });

    mockLoggedIn(makeUser(), authFetch);

    renderWithMui(<MemberDashboardApp />);

    expect(await screen.findByText(/1 pessoal · 1 business/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Histórico de Doações/i }));

    expect(await screen.findAllByText("Pessoal")).toHaveLength(1);
    expect(await screen.findAllByText("Business")).toHaveLength(1);
    expect(screen.queryByText("Mensal")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Assinaturas Recorrentes/i }));
    expect(await screen.findAllByText("Mensal")).toHaveLength(2);
    expect(await screen.findAllByText("Pessoal")).toHaveLength(1);
    expect(await screen.findAllByText("Business")).toHaveLength(1);
  });

  it("dispara carregamento paginado ao trocar página de assinaturas e doações nas abas corretas", async () => {
    const authFetch = vi.fn(async (url: string) => {
      if (url.includes("/stripe/my-donations?page=1&limit=10")) {
        return jsonResponse({ items: [], total: 20, page: 1, limit: 10 });
      }
      if (url.includes("/stripe/my-subscriptions?page=1&limit=10")) {
        return jsonResponse({ items: [], total: 20, page: 1, limit: 10 });
      }
      if (url.includes("/stripe/my-donations?page=2&limit=10")) {
        return jsonResponse({ items: [], total: 20, page: 2, limit: 10 });
      }
      if (url.includes("/stripe/my-subscriptions?page=2&limit=10")) {
        return jsonResponse({ items: [], total: 20, page: 2, limit: 10 });
      }
      if (url.includes("/reimbursements/my")) return jsonResponse([]);
      return jsonResponse(null, { status: 404 });
    });

    mockLoggedIn(makeUser(), authFetch);

    renderWithMui(<MemberDashboardApp />);

    fireEvent.click(await screen.findByRole("tab", { name: /Histórico de Doações/i }));
    fireEvent.click(await screen.findByRole("tab", { name: /Assinaturas Recorrentes/i }));

    fireEvent.click(await screen.findByRole("button", { name: /go to page 2/i }));
    fireEvent.click(screen.getByRole("tab", { name: /Histórico de Doações/i }));
    fireEvent.click(await screen.findByRole("button", { name: /go to page 2/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/stripe/my-subscriptions?page=2&limit=10"),
      );
      expect(authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/stripe/my-donations?page=2&limit=10"),
      );
    });
  });

  it("carrega histórico de eventos sob demanda ao abrir a aba e expande QR de check-in", async () => {
    const futureStart = new Date(Date.now() + 86_400_000).toISOString();
    const authFetch = vi.fn(async (url: string) => {
      if (url.includes("/stripe/my-donations")) return jsonResponse({ items: [], total: 0 });
      if (url.includes("/stripe/my-subscriptions")) return jsonResponse({ items: [], total: 0 });
      if (url.includes("/reimbursements/my")) return jsonResponse([]);
      if (url.includes("/events/my-registrations")) {
        return jsonResponse([
          {
            id: "reg-1",
            status: "confirmed",
            checkedInAt: null,
            checkinToken: "token-abc",
            attendeeName: "Mentoria Codaqui",
            event: {
              id: "evt-1",
              title: "Encontro DevParaná",
              startAt: futureStart,
              location: "Maringá",
              status: "scheduled",
            },
            ticketType: { name: "Gratuito", kind: "free", priceCents: 0 },
          },
        ]);
      }
      return jsonResponse(null, { status: 404 });
    });

    mockLoggedIn(makeUser(), authFetch);

    renderWithMui(<MemberDashboardApp />);

    // Sob demanda: ainda não chamou antes de abrir a aba
    expect(authFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/events/my-registrations"),
    );

    fireEvent.click(await screen.findByRole("tab", { name: /Eventos/i }));

    expect(await screen.findByText("Encontro DevParaná")).toBeInTheDocument();
    expect(screen.getByText("Confirmada")).toBeInTheDocument();
    expect(screen.getByText("Gratuito")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancelar inscrição/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /QR de check-in/i }));
    expect(
      await screen.findByText(/Apresente este QR Code na entrada do evento/i),
    ).toBeInTheDocument();
  });

  it("emite certificado somente com presença confirmada e abre dialog imprimível", async () => {
    const pastStart = new Date(Date.now() - 86_400_000).toISOString();
    const authFetch = vi.fn(async (url: string) => {
      if (url.includes("/stripe/my-donations")) return jsonResponse({ items: [], total: 0 });
      if (url.includes("/stripe/my-subscriptions")) return jsonResponse({ items: [], total: 0 });
      if (url.includes("/reimbursements/my")) return jsonResponse([]);
      if (url.includes("/events/registrations/reg-2/certificate")) {
        return jsonResponse({
          attendeeName: "Mentoria Codaqui",
          eventTitle: "Workshop GitHub",
          eventStartAt: pastStart,
          eventEndAt: pastStart,
          workloadMinutes: 240,
          verificationCode: "ABCD-1234",
          issuedAt: new Date().toISOString(),
        });
      }
      if (url.includes("/events/my-registrations")) {
        return jsonResponse([
          {
            id: "reg-2",
            status: "confirmed",
            checkedInAt: pastStart,
            checkinToken: "token-xyz",
            attendeeName: "Mentoria Codaqui",
            memberId: "user-1",
            event: {
              id: "evt-2",
              title: "Workshop GitHub",
              startAt: pastStart,
              location: null,
              status: "completed",
            },
            ticketType: { name: "Gratuito", kind: "free", priceCents: 0 },
          },
        ]);
      }
      return jsonResponse(null, { status: 404 });
    });

    mockLoggedIn(makeUser(), authFetch);

    renderWithMui(<MemberDashboardApp />);

    fireEvent.click(await screen.findByRole("tab", { name: /Eventos/i }));
    expect(await screen.findByText("Meus eventos")).toBeInTheDocument();

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(expect.stringContaining("/events/my-registrations"));
    });

    fireEvent.click(await screen.findByRole("tab", { name: /^Histórico$/i }));
    expect(await screen.findByText("Workshop GitHub")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: /Emitir certificado/i }));

    expect(await screen.findByText("CERTIFICADO DE PARTICIPAÇÃO")).toBeInTheDocument();
    expect(screen.getByText("ABCD-1234", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Imprimir/i })).toBeInTheDocument();
  });

  it.each([
    { roles: ["member"], visible: false, label: "membro comum" },
    { roles: ["member", "event_organizer"], visible: false, label: "organizador de eventos" },
    { roles: ["member", "event_host"], visible: false, label: "anfitrião de evento" },
    { roles: ["member", "event_checker"], visible: false, label: "credenciador" },
    { roles: ["member", "event_finance"], visible: false, label: "financeiro de eventos" },
    { roles: ["member", "finance-analyzer"], visible: true, label: "finance analyzer" },
    { roles: ["member", "admin"], visible: true, label: "admin" },
  ])("mostra Painel de Reembolsos apenas para quem tem permissão ($label)", async ({ roles, visible }) => {
    const authFetch = vi.fn(async (url: string) => {
      if (url.includes("/stripe/my-donations")) return jsonResponse({ items: [], total: 0 });
      if (url.includes("/stripe/my-subscriptions")) return jsonResponse({ items: [], total: 0 });
      if (url.includes("/reimbursements/my")) return jsonResponse([]);
      return jsonResponse(null, { status: 404 });
    });

    mockLoggedIn(makeUser({ roles }), authFetch);

    renderWithMui(<MemberDashboardApp />);

    await screen.findByText("Mentoria Codaqui");

    const button = screen.queryByRole("link", { name: /Painel de Reembolsos/i });
    if (visible) {
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("href", "/admin/reembolsos");
    } else {
      expect(button).not.toBeInTheDocument();
    }
  });
});

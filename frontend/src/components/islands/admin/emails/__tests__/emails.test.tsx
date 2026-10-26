import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import EmailsApp from "../EmailsApp";
import { renderWithMui } from "../../../../../test/render-mui";

// Estado mutável compartilhado com a fábrica do mock — cada teste ajusta os
// campos que precisa no beforeEach/corpo.
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
  status: "failed",
  error: "SMTP timeout",
  createdAt: "2026-07-20T10:00:00.000Z",
};

const sentLog = {
  id: "log-2",
  to: "outro@example.com",
  template: "event-reminder",
  eventId: "evt-1",
  status: "sent",
  error: null,
  createdAt: "2026-07-19T10:00:00.000Z",
};

const listResponse = {
  items: [failedLog, sentLog],
  total: 2,
  summary: {
    sent: 9,
    failed: 1,
    byTemplate: {
      "event-confirmation": { sent: 7, failed: 1 },
      "event-reminder": { sent: 2, failed: 0 },
    },
  },
};

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
      authState.isLoggedIn = true; // membro comum, sem role admin
      renderWithMui(<EmailsApp />);

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/");
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("carrega resumo e tabela paginada de e-mails", async () => {
    authState.authFetch.mockImplementation(async (url: string) => {
      if (url.includes("/notifications/emails?")) return jsonResponse(listResponse);
      return jsonResponse(null, { ok: false, status: 404 });
    });
    mockAdmin();

    renderWithMui(<EmailsApp />);

    expect(await screen.findByText("participante@example.com")).toBeInTheDocument();
    expect(screen.getByText("outro@example.com")).toBeInTheDocument();
    expect(screen.getByText("Enviados")).toBeInTheDocument();
    expect(screen.getByText("Falhas")).toBeInTheDocument();
    expect(authState.authFetch).toHaveBeenCalledWith(
      expect.stringContaining("page=1&pageSize=20"),
    );
  });

  it("reenvia e-mail com falha e exibe feedback de sucesso", async () => {
    authState.authFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/notifications/emails/log-1/resend") && init?.method === "POST") {
        return jsonResponse({ ...failedLog, status: "sent", error: null });
      }
      if (url.includes("/notifications/emails?")) return jsonResponse(listResponse);
      return jsonResponse(null, { ok: false, status: 404 });
    });
    mockAdmin();

    renderWithMui(<EmailsApp />);

    fireEvent.click(await screen.findByRole("button", { name: /Reenviar/i }));

    expect(
      await screen.findByText(/E-mail reenviado com sucesso para participante@example.com/i),
    ).toBeInTheDocument();
    expect(authState.authFetch).toHaveBeenCalledWith(
      expect.stringContaining("/notifications/emails/log-1/resend"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

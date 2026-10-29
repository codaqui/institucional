/**
 * Testes do hub /admin — conversão de
 * `src/pages/admin/__tests__/index.test.tsx` (jest) para vitest.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import AdminHubApp from "../AdminHubApp";
import { renderWithMui } from "../../../../../test/render-mui";
import type { AuthUser } from "../../../../../lib/auth-client";

// Estado mutável compartilhado com a fábrica do mock — cada teste ajusta
// os campos que precisa no beforeEach/corpo.
const authState = vi.hoisted(() => ({
  user: null as AuthUser | null,
  ready: false,
  isLoggedIn: false,
  isAdmin: false,
  isFinanceAnalyzer: false,
  authFetch: vi.fn(),
}));

vi.mock("../../../../../lib/use-auth", () => ({
  useAuth: () => ({
    user: authState.user,
    ready: authState.ready,
    isLoggedIn: authState.isLoggedIn,
    isAdmin: authState.isAdmin,
    isFinanceAnalyzer: authState.isFinanceAnalyzer,
    authFetch: authState.authFetch,
  }),
}));

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function makeUser(roles: string[]): AuthUser {
  return {
    sub: "sub-1",
    githubId: "github-1",
    handle: "octocat",
    name: "Monalisa Octocat",
    avatarUrl: "https://avatars.githubusercontent.com/octocat",
    roles,
  };
}

function mockLoggedIn(roles: string[], sub = "sub-1") {
  const user = makeUser(roles);
  user.sub = sub;
  authState.user = user;
  authState.ready = true;
  authState.isLoggedIn = true;
  authState.isAdmin = roles.includes("admin");
  authState.isFinanceAnalyzer = roles.includes("finance-analyzer");
}

function buildMember(idx: number, roles: string[] = ["membro"]) {
  return {
    id: `m-${idx}`,
    name: `Member ${idx}`,
    githubHandle: `member${idx}`,
    avatarUrl: `https://example.com/${idx}.png`,
    roles,
    isActive: true,
    joinedAt: "2026-01-10T10:00:00.000Z",
  };
}

function stubLocation() {
  const replace = vi.fn();
  vi.stubGlobal("location", { replace });
  return replace;
}

describe("/admin (hub)", () => {
  beforeEach(() => {
    authState.user = null;
    authState.ready = false;
    authState.isLoggedIn = false;
    authState.isAdmin = false;
    authState.isFinanceAnalyzer = false;
    authState.authFetch = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({}, { status: 404 }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redireciona membro comum para a home", async () => {
    const replace = stubLocation();
    try {
      mockLoggedIn(["membro"]);

      renderWithMui(<AdminHubApp />);

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/");
      });
      expect(authState.authFetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("permite acesso do finance-analyzer sem listar membros", async () => {
    mockLoggedIn(["membro", "finance-analyzer"], "fa-1");

    renderWithMui(<AdminHubApp />);

    expect(
      await screen.findByText(/A gestão de membros permanece restrita a administradores/i),
    ).toBeInTheDocument();
    expect(authState.authFetch).not.toHaveBeenCalled();
  });

  it("lista membros com paginação e filtro de busca", async () => {
    const members = Array.from({ length: 25 }, (_, i) => buildMember(i + 1));
    authState.authFetch = vi.fn(async (url: string) => {
      if (url.endsWith("/admin/members")) {
        return jsonResponse(members);
      }
      return jsonResponse({}, { status: 404 });
    });
    mockLoggedIn(["membro", "admin"], "admin-1");

    renderWithMui(<AdminHubApp />);

    expect(await screen.findByText(/Membros \(25\)/i)).toBeInTheDocument();
    expect(screen.getByText("Member 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /go to page 2/i }));
    expect(await screen.findByText("Member 21")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por nome/i), {
      target: { value: "member 24" },
    });

    expect(await screen.findByText(/Membros \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText("Member 24")).toBeInTheDocument();
  });

  it("abre confirmação e atualiza status ativo/inativo do membro", async () => {
    authState.authFetch = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith("/admin/members") && !options) {
        return jsonResponse([buildMember(1)]);
      }
      if (url.endsWith("/admin/members/m-1") && options?.method === "PATCH") {
        return jsonResponse({ ok: true });
      }
      return jsonResponse({}, { status: 404 });
    });
    mockLoggedIn(["membro", "admin"], "admin-1");

    renderWithMui(<AdminHubApp />);

    await screen.findByText("Member 1");
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(await screen.findByRole("button", { name: /^Desativar$/i }));

    await waitFor(() => {
      expect(authState.authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/admin/members/m-1"),
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  it("filtra membros por permissão", async () => {
    const members = [
      buildMember(1, ["membro"]),
      buildMember(2, ["membro", "event_organizer"]),
      buildMember(3, ["membro", "finance-analyzer"]),
    ];
    authState.authFetch = vi.fn(async (url: string) => {
      if (url.endsWith("/admin/members")) {
        return jsonResponse(members);
      }
      return jsonResponse({}, { status: 404 });
    });
    mockLoggedIn(["membro", "admin"], "admin-1");

    renderWithMui(<AdminHubApp />);

    expect(await screen.findByText(/Membros \(3\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Organizador de eventos/i }));

    expect(await screen.findByText(/Membros \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText("Member 2")).toBeInTheDocument();
    expect(screen.queryByText("Member 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Member 3")).not.toBeInTheDocument();
  });

  it("renderiza membro com múltiplas permissões sem quebrar a tabela", async () => {
    const member = buildMember(1, [
      "membro",
      "admin",
      "finance-analyzer",
      "event_organizer",
      "event_finance",
      "event_host",
      "event_checker",
    ]);
    authState.authFetch = vi.fn(async (url: string) => {
      if (url.endsWith("/admin/members")) {
        return jsonResponse([member]);
      }
      return jsonResponse({}, { status: 404 });
    });
    mockLoggedIn(["membro", "admin"], "admin-1");

    renderWithMui(<AdminHubApp />);

    await screen.findByText("Member 1");
    // Garante que todos os chips de role aparecem (sem quebrar a tabela)
    const chips = screen.getAllByRole("button", { name: /Admin/i });
    expect(chips.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /Credenciador/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});

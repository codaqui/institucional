import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FornecedoresApp from "../FornecedoresApp";
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

function mockLoggedIn(roles: string[]) {
  authState.user = makeUser(roles);
  authState.ready = true;
  authState.isLoggedIn = true;
  authState.isAdmin = roles.includes("admin");
  authState.isFinanceAnalyzer = roles.includes("finance-analyzer");
}

const VENDOR = {
  id: "v1",
  name: "Gráfica Central",
  document: "12345678000190",
  website: "https://grafica.example.com",
  isActive: true,
  accountId: "acc-1",
  account: { id: "acc-1", name: "Banco - Gráfica Central", type: "EXTERNAL" },
  createdAt: "2026-01-01T00:00:00.000Z",
  paymentCount: 2,
  receiptCount: 1,
};

function stubLocation() {
  const replace = vi.fn();
  vi.stubGlobal("location", { replace });
  return replace;
}

function mockVendorsGet(list: unknown[], overrides?: Response) {
  authState.authFetch = vi.fn(async (url: string) => {
    if (url === "/vendors/with-counters") return overrides ?? jsonResponse(list);
    return jsonResponse({}, { status: 404 });
  });
}

describe("/admin/fornecedores", () => {
  beforeEach(() => {
    authState.user = null;
    authState.ready = false;
    authState.isLoggedIn = false;
    authState.isAdmin = false;
    authState.isFinanceAnalyzer = false;
    mockVendorsGet([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redireciona membro comum para a home", async () => {
    const replace = stubLocation();
    try {
      mockLoggedIn(["membro"]);

      renderWithMui(<FornecedoresApp />);

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/");
      });
      expect(authState.authFetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("permite acesso a admin e finance analyzer", async () => {
    mockLoggedIn(["membro", "admin"]);

    renderWithMui(<FornecedoresApp />);

    await waitFor(() => {
      expect(authState.authFetch).toHaveBeenCalledWith("/vendors/with-counters");
    });
    expect(
      screen.getByRole("button", { name: /novo fornecedor/i }),
    ).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há fornecedores", async () => {
    mockLoggedIn(["membro", "admin"]);

    renderWithMui(<FornecedoresApp />);

    expect(
      await screen.findByText("Nenhum fornecedor cadastrado."),
    ).toBeInTheDocument();
  });

  it("exibe erro quando o carregamento falha (HTTP 500)", async () => {
    mockLoggedIn(["membro", "admin"]);
    mockVendorsGet([], jsonResponse({}, { status: 500 }));

    renderWithMui(<FornecedoresApp />);

    expect(
      await screen.findByText(/Erro ao carregar dados \(HTTP 500\)/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Nenhum fornecedor cadastrado."),
    ).not.toBeInTheDocument();
  });

  it("exibe aviso de sessão expirada em 401", async () => {
    mockLoggedIn(["membro", "admin"]);
    mockVendorsGet([], jsonResponse({}, { status: 401 }));

    renderWithMui(<FornecedoresApp />);

    expect(
      await screen.findByText(/Sessão expirada — faça login novamente/),
    ).toBeInTheDocument();
  });

  it("cria fornecedor via POST /vendors com o payload correto", async () => {
    mockLoggedIn(["membro", "admin"]);
    let vendors: unknown[] = [];
    authState.authFetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/vendors/with-counters") return jsonResponse(vendors);
      if (url === "/vendors" && init?.method === "POST") {
        vendors = [
          {
            ...VENDOR,
            id: "v2",
            name: "Gráfica Nova",
            website: "https://nova.example.com",
          },
        ];
        return jsonResponse(vendors[0], { status: 201 });
      }
      return jsonResponse({}, { status: 404 });
    });

    renderWithMui(<FornecedoresApp />);

    await screen.findByText("Nenhum fornecedor cadastrado.");

    await userEvent.click(
      screen.getByRole("button", { name: /novo fornecedor/i }),
    );
    await userEvent.type(screen.getByLabelText(/nome/i), "Gráfica Nova");
    await userEvent.type(
      screen.getByLabelText(/cnpj \/ cpf/i),
      "12345678000190",
    );
    await userEvent.type(
      screen.getByLabelText(/website/i),
      "https://nova.example.com",
    );
    await userEvent.click(screen.getByRole("button", { name: /^salvar$/i }));

    await waitFor(() => {
      expect(authState.authFetch).toHaveBeenCalledWith(
        "/vendors",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const [, init] = authState.authFetch.mock.calls.find(
      ([url, i]) => url === "/vendors" && (i as RequestInit).method === "POST",
    )!;
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      name: "Gráfica Nova",
      document: "12345678000190",
      website: "https://nova.example.com",
    });

    // a lista é recarregada após salvar
    expect(await screen.findByText("Gráfica Nova")).toBeInTheDocument();
  });

  it("desativa fornecedor via ModalConfirm (DELETE /vendors/:id)", async () => {
    mockLoggedIn(["membro", "admin"]);
    mockVendorsGet([VENDOR]);

    renderWithMui(<FornecedoresApp />);

    await screen.findByText("Gráfica Central");

    await userEvent.click(screen.getByRole("button", { name: /desativar/i }));

    // ModalConfirm pede confirmação antes de executar o DELETE
    expect(await screen.findByText("Desativar fornecedor?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => {
      expect(authState.authFetch).toHaveBeenCalledWith(
        "/vendors/v1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });
});

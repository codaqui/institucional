/**
 * Testes da página "Minha Empresa" (`/membros/empresa`) — port da seção
 * MyCompanySection (Docusaurus) para a ilha `company/MyCompanyApp`.
 *
 * Cobre: carregamento via `/companies/me` + recursos da empresa, estado sem
 * empresa (CTA informativo), colaboradores add/remove e distribuição de
 * SortCoins (POST com payload validado).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import MyCompanyApp from "../company/MyCompanyApp";
import { renderWithMui } from "../../../../test/render-mui";
import type { AuthUser } from "../../../../lib/auth-client";

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

vi.mock("../../../../lib/config", () => ({
  API_URL: "https://api.test",
  STRIPE_PUBLISHABLE_KEY: "",
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

const company = {
  id: "company-1",
  name: "Acme Ltda",
  tradeName: "Acme",
  cnpj: "44593429000105",
  logoUrl: null,
  websiteUrl: "https://acme.example.com",
  status: "active",
  responsibleMemberId: "user-1",
  subscriptionAmountCents: 20000,
};

const collaborator = {
  id: "cm-1",
  memberId: "octocat",
  addedAt: "2026-01-15T10:00:00.000Z",
};

const supportSummary = {
  totalSupportedReais: 2400,
  supportCount: 12,
  monthsSupporting: 12,
};

const wallet = { id: "w1", balances: { sort_coin: 150 }, frozenTypes: [] };

const transactionsPage = {
  items: [
    {
      id: "tx-1",
      coinType: "sort_coin",
      amount: 100,
      source: "club_credit",
      referenceId: null,
      description: "Crédito CLUB",
      createdAt: "2026-10-01T10:00:00.000Z",
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
};

/** authFetch padrão: empresa do usuário + todos os recursos. */
function authFetchWithCompany() {
  return vi.fn(async (url: string) => {
    if (url.includes("/companies/me")) return jsonResponse(company);
    if (url.includes("/companies/my-collaborations")) return jsonResponse([company]);
    if (url.includes("/companies/company-1/wallet/transactions")) {
      return jsonResponse(transactionsPage);
    }
    if (url.includes("/companies/company-1/wallet")) return jsonResponse(wallet);
    if (url.includes("/companies/company-1/members")) return jsonResponse([collaborator]);
    if (url.includes("/companies/company-1/support-summary")) return jsonResponse(supportSummary);
    return jsonResponse(null, { status: 404 });
  });
}

function mockLoggedIn(authFetch: ReturnType<typeof vi.fn>) {
  authState.user = makeUser();
  authState.ready = true;
  authState.isLoggedIn = true;
  authState.authFetch = authFetch;
}

describe("/membros/empresa", () => {
  beforeEach(() => {
    authState.user = null;
    authState.ready = false;
    authState.isLoggedIn = false;
    authState.authFetch = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redireciona para / quando o usuário não está logado", async () => {
    authState.ready = true;
    authState.isLoggedIn = false;
    const replace = vi.fn();
    vi.stubGlobal("location", { replace });

    renderWithMui(<MyCompanyApp />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
  });

  it("carrega /companies/me e renderiza dados, carteira, colaboradores, apoio e transações", async () => {
    const authFetch = authFetchWithCompany();
    mockLoggedIn(authFetch);

    renderWithMui(<MyCompanyApp />);

    expect(await screen.findByText("Acme Ltda")).toBeInTheDocument();
    expect(screen.getByText(/CNPJ: 44\.593\.429\/0001-05/)).toBeInTheDocument();
    expect(screen.getByText("150 SortCoins")).toBeInTheDocument();
    expect(screen.getByText("Recorrência configurada: R$ 200/mês")).toBeInTheDocument();

    const receipt = screen.getByRole("link", { name: /Baixar comprovante de doação/i });
    expect(receipt).toHaveAttribute("href", "https://api.test/companies/company-1/receipt");

    // Resumo de apoio — plural correto de "mês" é "meses"
    expect(screen.getByText("R$ 2.400 apoiados")).toBeInTheDocument();
    expect(screen.getByText("12 apoios")).toBeInTheDocument();
    expect(screen.getByText("12 meses apoiando")).toBeInTheDocument();

    // Colaboradores
    expect(screen.getByText("@octocat")).toBeInTheDocument();

    // Histórico da carteira
    expect(screen.getByText("Crédito CLUB")).toBeInTheDocument();
    expect(screen.getByText("+100 sort_coin")).toBeInTheDocument();

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith("/companies/me");
    });
  });

  it("mostra CTA informativo quando não há empresa vinculada ao perfil", async () => {
    const authFetch = vi.fn(async (url: string) => {
      if (url.includes("/companies/me")) return jsonResponse({ message: "not found" }, { status: 404 });
      if (url.includes("/companies/my-collaborations")) return jsonResponse([]);
      return jsonResponse(null, { status: 404 });
    });
    mockLoggedIn(authFetch);

    renderWithMui(<MyCompanyApp />);

    expect(
      await screen.findByText(/Nenhuma empresa vinculada ao seu perfil no momento/i),
    ).toBeInTheDocument();
  });

  it("adiciona colaborador via POST /members com githubHandle e recarrega a lista", async () => {
    const authFetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/companies/company-1/members") && init?.method === "POST") {
        return jsonResponse({ id: "cm-2", memberId: "novacat", addedAt: "2026-10-20T10:00:00.000Z" });
      }
      if (url.includes("/companies/me")) return jsonResponse(company);
      if (url.includes("/companies/my-collaborations")) return jsonResponse([company]);
      if (url.includes("/companies/company-1/wallet/transactions")) {
        return jsonResponse(transactionsPage);
      }
      if (url.includes("/companies/company-1/wallet")) return jsonResponse(wallet);
      if (url.includes("/companies/company-1/members")) {
        return jsonResponse([
          collaborator,
          { id: "cm-2", memberId: "novacat", addedAt: "2026-10-20T10:00:00.000Z" },
        ]);
      }
      if (url.includes("/companies/company-1/support-summary")) return jsonResponse(supportSummary);
      return jsonResponse(null, { status: 404 });
    });
    mockLoggedIn(authFetch);

    renderWithMui(<MyCompanyApp />);

    fireEvent.change(await screen.findByLabelText(/GitHub handle do colaborador/i), {
      target: { value: "novacat" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Adicionar$/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        "/companies/company-1/members",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ githubHandle: "novacat" }),
        }),
      );
    });
    expect(await screen.findByText("@novacat")).toBeInTheDocument();
  });

  it("remove colaborador via DELETE /members/:memberId", async () => {
    const authFetch = authFetchWithCompany();
    mockLoggedIn(authFetch);

    renderWithMui(<MyCompanyApp />);

    fireEvent.click(await screen.findByRole("button", { name: /remover colaborador/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        "/companies/company-1/members/cm-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  it("distribui SortCoins igualmente com payload validado", async () => {
    const authFetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/companies/company-1/wallet/distribute") && init?.method === "POST") {
        return jsonResponse({ distributed: 100, recipients: 2 });
      }
      if (url.includes("/companies/me")) return jsonResponse(company);
      if (url.includes("/companies/my-collaborations")) return jsonResponse([company]);
      if (url.includes("/companies/company-1/wallet/transactions")) {
        return jsonResponse(transactionsPage);
      }
      if (url.includes("/companies/company-1/wallet")) return jsonResponse(wallet);
      if (url.includes("/companies/company-1/members")) return jsonResponse([collaborator]);
      if (url.includes("/companies/company-1/support-summary")) return jsonResponse(supportSummary);
      return jsonResponse(null, { status: 404 });
    });
    mockLoggedIn(authFetch);

    renderWithMui(<MyCompanyApp />);

    fireEvent.change(await screen.findByLabelText(/Total a dividir/i), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Distribuir$/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        "/companies/company-1/wallet/distribute",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            distributions: [
              { githubHandle: "mentoriacodaqui", amount: 50 },
              { githubHandle: "octocat", amount: 50 },
            ],
          }),
        }),
      );
    });
    expect(await screen.findByText(/100 SortCoins distribuídos para 2 colaborador/i)).toBeInTheDocument();
  });
});

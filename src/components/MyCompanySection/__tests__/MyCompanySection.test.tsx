import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MyCompanySection from "../index";
import { useAuth } from "../../../hooks/useAuth";

jest.mock("../../../hooks/useAuth");

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

type MockResponse = Pick<Response, "ok" | "status" | "json">;

function jsonResponse(data: unknown, ok = true, status = 200): MockResponse {
  return {
    ok,
    status,
    json: async () => data,
  };
}

const company = {
  id: "company-1",
  name: "Kodak",
  cnpj: "44593429000105",
  status: "active",
  responsibleMemberId: "owner-1",
  websiteUrl: "https://codaqui.dev",
  subscriptionAmountCents: 50000,
};

const baseAuth = {
  ready: true,
  isLoggedIn: true,
  isAdmin: false,
  isFinanceAnalyzer: false,
  refreshUser: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
};

describe("MyCompanySection", () => {
  it("carrega empresa via fallback de colaborações e renderiza histórico", async () => {
    const authFetch = jest.fn(async (url: string) => {
      if (url.includes("/companies/me")) return jsonResponse(null, false, 404);
      if (url.includes("/companies/my-collaborations")) return jsonResponse([company]);
      if (url.includes(`/companies/${company.id}/wallet/transactions`)) {
        return jsonResponse({
          items: [
            {
              id: "tx-1",
              coinType: "sort_coin",
              amount: 100,
              source: "stripe_invoice",
              referenceId: "ref-1",
              description: "Assinatura mensal empresarial",
              createdAt: "2026-05-18T10:00:00.000Z",
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
        });
      }
      if (url.includes(`/companies/${company.id}/wallet`)) {
        return jsonResponse({ id: "w-1", balances: { sort_coin: 300 }, frozenTypes: [] });
      }
      if (url.includes(`/companies/${company.id}/members`)) {
        return jsonResponse([{ id: "m-1", memberId: "mentoriacodaqui", addedAt: "2026-05-18T10:00:00.000Z" }]);
      }
      if (url.includes(`/companies/${company.id}/support-summary`)) {
        return jsonResponse({ totalSupportedReais: 500, supportCount: 1, monthsSupporting: 2 });
      }
      return jsonResponse(null, false, 404);
    });

    mockUseAuth.mockReturnValue({
      ...baseAuth,
      user: { sub: "collab-1", handle: "mentoriacodaqui" } as any,
      authFetch: authFetch as any,
    } as any);

    render(<MyCompanySection />);

    expect(await screen.findByText("Kodak")).toBeInTheDocument();
    expect(screen.getByText(/Assinatura mensal empresarial/i)).toBeInTheDocument();
    expect(screen.getByText(/Colaboradores podem ver o saldo/i)).toBeInTheDocument();
  });

  it("renderiza aviso quando não há empresa vinculada", async () => {
    const authFetch = jest.fn(async (url: string) => {
      if (url.includes("/companies/me")) return jsonResponse(null, false, 404);
      if (url.includes("/companies/my-collaborations")) return jsonResponse([]);
      return jsonResponse(null, false, 404);
    });

    mockUseAuth.mockReturnValue({
      ...baseAuth,
      user: { sub: "collab-1", handle: "mentoriacodaqui" } as any,
      authFetch: authFetch as any,
    } as any);

    render(<MyCompanySection />);

    expect(
      await screen.findByText(/Nenhuma empresa vinculada ao seu perfil no momento/i),
    ).toBeInTheDocument();
  });

  it("solicita nova página de transações ao trocar a paginação", async () => {
    const authFetch = jest.fn(async (url: string) => {
      if (url.includes("/companies/me")) return jsonResponse(company);
      if (url.includes("/companies/my-collaborations")) return jsonResponse([]);
      if (url.includes(`/companies/${company.id}/wallet/transactions?page=1&limit=20`)) {
        return jsonResponse({
          items: [
            {
              id: "tx-1",
              coinType: "sort_coin",
              amount: 100,
              source: "stripe_invoice",
              referenceId: "ref-1",
              description: "Página 1",
              createdAt: "2026-05-18T10:00:00.000Z",
            },
          ],
          total: 40,
          page: 1,
          limit: 20,
        });
      }
      if (url.includes(`/companies/${company.id}/wallet/transactions?page=2&limit=20`)) {
        return jsonResponse({
          items: [
            {
              id: "tx-2",
              coinType: "sort_coin",
              amount: 50,
              source: "stripe_invoice",
              referenceId: "ref-2",
              description: "Página 2",
              createdAt: "2026-05-19T10:00:00.000Z",
            },
          ],
          total: 40,
          page: 2,
          limit: 20,
        });
      }
      if (url.includes(`/companies/${company.id}/wallet`)) {
        return jsonResponse({ id: "w-1", balances: { sort_coin: 300 }, frozenTypes: [] });
      }
      if (url.includes(`/companies/${company.id}/members`)) return jsonResponse([]);
      if (url.includes(`/companies/${company.id}/support-summary`)) {
        return jsonResponse({ totalSupportedReais: 500, supportCount: 5, monthsSupporting: 2 });
      }
      return jsonResponse(null, false, 404);
    });

    mockUseAuth.mockReturnValue({
      ...baseAuth,
      user: { sub: "owner-1", handle: "owner" } as any,
      authFetch: authFetch as any,
    } as any);

    render(<MyCompanySection />);

    await screen.findByText("Página 1");
    fireEvent.click(screen.getByRole("button", { name: /go to page 2/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(expect.stringContaining("page=2&limit=20"));
    });
    expect(await screen.findByText("Página 2")).toBeInTheDocument();
  });
});

const ownerUser = { sub: "owner-1", handle: "owner" };

interface RouterOverrides {
  me?: MockResponse;
  transactions?: MockResponse;
  wallet?: MockResponse;
  members?: MockResponse;
  support?: MockResponse;
  onPatchCompany?: MockResponse;
  onPostMembers?: MockResponse;
  onDistribute?: MockResponse;
}

function buildRouter(overrides: RouterOverrides = {}) {
  return jest.fn(async (url: string, options?: RequestInit) => {
    if (url.includes(`/companies/${company.id}/wallet/distribute`)) {
      return overrides.onDistribute ?? jsonResponse({ distributed: 100, recipients: 2 });
    }
    if (url.includes(`/companies/${company.id}/wallet/transactions`)) {
      return overrides.transactions ?? jsonResponse({ items: [], total: 0, page: 1, limit: 20 });
    }
    if (url.includes(`/companies/${company.id}/wallet`)) {
      return overrides.wallet ?? jsonResponse({ id: "w-1", balances: { sort_coin: 300 }, frozenTypes: [] });
    }
    if (url.includes(`/companies/${company.id}/members`) && options?.method === "POST") {
      return overrides.onPostMembers ?? jsonResponse({ id: "m-2" });
    }
    if (url.includes(`/companies/${company.id}/members`) && options?.method === "DELETE") {
      return jsonResponse({});
    }
    if (url.includes(`/companies/${company.id}/members`)) {
      return (
        overrides.members ??
        jsonResponse([{ id: "m-1", memberId: "mentoriacodaqui", addedAt: "2026-05-18T10:00:00.000Z" }])
      );
    }
    if (url.includes(`/companies/${company.id}/support-summary`)) {
      return overrides.support ?? jsonResponse({ totalSupportedReais: 500, supportCount: 5, monthsSupporting: 2 });
    }
    if (url.endsWith(`/companies/${company.id}`) && options?.method === "PATCH") {
      return overrides.onPatchCompany ?? jsonResponse(company);
    }
    if (url.includes("/companies/me")) return overrides.me ?? jsonResponse(company);
    if (url.includes("/companies/my-collaborations")) return jsonResponse([]);
    if (url.endsWith(`/companies/${company.id}`)) return jsonResponse(company);
    return jsonResponse(null, false, 404);
  });
}

function mockOwner(authFetch: jest.Mock, user: { sub: string; handle: string } = ownerUser) {
  mockUseAuth.mockReturnValue({
    ...baseAuth,
    user: user as any,
    authFetch: authFetch as any,
  } as any);
}

describe("MyCompanySection — carregamento e formatos de resposta", () => {
  it("carrega empresa diretamente via companyId (modo colaborador)", async () => {
    const authFetch = buildRouter();
    mockOwner(authFetch, { sub: "collab-1", handle: "mentoriacodaqui" });

    render(<MyCompanySection companyId="company-1" />);

    expect(await screen.findByText("Kodak")).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith(expect.stringMatching(/\/companies\/company-1$/));
    expect(authFetch).not.toHaveBeenCalledWith(expect.stringContaining("/companies/my-collaborations"));
  });

  it("aceita colaborações no formato paginado { items }", async () => {
    const authFetch = jest.fn(async (url: string) => {
      if (url.includes("/companies/me")) return jsonResponse(null, false, 404);
      if (url.includes("/companies/my-collaborations")) return jsonResponse({ items: [company] });
      if (url.includes(`/companies/${company.id}/wallet/transactions`)) {
        return jsonResponse({ items: [], total: 0, page: 1, limit: 20 });
      }
      if (url.includes(`/companies/${company.id}/wallet`)) {
        return jsonResponse({ id: "w-1", balances: {}, frozenTypes: [] });
      }
      if (url.includes(`/companies/${company.id}/members`)) return jsonResponse([]);
      if (url.includes(`/companies/${company.id}/support-summary`)) {
        return jsonResponse({ totalSupportedReais: 0, supportCount: 0, monthsSupporting: 0 });
      }
      return jsonResponse(null, false, 404);
    });
    mockOwner(authFetch, { sub: "collab-1", handle: "mentoriacodaqui" });

    render(<MyCompanySection />);

    expect(await screen.findByText("Kodak")).toBeInTheDocument();
  });

  it("tolera JSON inválido em /companies/me e cai no fallback de colaborações", async () => {
    const authFetch = jest.fn(async (url: string) => {
      if (url.includes("/companies/me")) {
        return { ok: true, status: 200, json: async () => Promise.reject(new Error("bad json")) };
      }
      if (url.includes("/companies/my-collaborations")) return jsonResponse([company]);
      if (url.includes(`/companies/${company.id}/wallet/transactions`)) {
        return jsonResponse({ items: [], total: 0, page: 1, limit: 20 });
      }
      if (url.includes(`/companies/${company.id}/wallet`)) {
        return jsonResponse({ id: "w-1", balances: {}, frozenTypes: [] });
      }
      if (url.includes(`/companies/${company.id}/members`)) return jsonResponse([]);
      if (url.includes(`/companies/${company.id}/support-summary`)) {
        return jsonResponse({ totalSupportedReais: 0, supportCount: 0, monthsSupporting: 0 });
      }
      return jsonResponse(null, false, 404);
    });
    mockOwner(authFetch, { sub: "collab-1", handle: "mentoriacodaqui" });

    render(<MyCompanySection />);

    expect(await screen.findByText("Kodak")).toBeInTheDocument();
  });

  it("mostra aviso quando colaborações vêm em formato inesperado", async () => {
    const authFetch = jest.fn(async (url: string) => {
      if (url.includes("/companies/me")) return jsonResponse(null, false, 404);
      if (url.includes("/companies/my-collaborations")) return jsonResponse({ unexpected: true });
      return jsonResponse(null, false, 404);
    });
    mockOwner(authFetch, { sub: "collab-1", handle: "mentoriacodaqui" });

    render(<MyCompanySection />);

    expect(
      await screen.findByText(/Nenhuma empresa vinculada ao seu perfil no momento/i),
    ).toBeInTheDocument();
  });

  it("mostra alerta de erro quando a conexão falha no carregamento", async () => {
    const authFetch = jest.fn(async () => Promise.reject(new Error("network down")));
    mockOwner(authFetch);

    render(<MyCompanySection />);

    expect(await screen.findByText("Erro de conexão.")).toBeInTheDocument();
    expect(
      screen.queryByText(/Nenhuma empresa vinculada ao seu perfil no momento/i),
    ).not.toBeInTheDocument();
  });

  it("mostra alerta de erro quando /companies/me falha com erro HTTP", async () => {
    const authFetch = jest.fn(async (url: string) => {
      if (url.includes("/companies/me")) return jsonResponse(null, false, 500);
      return jsonResponse(null, false, 404);
    });
    mockOwner(authFetch);

    render(<MyCompanySection />);

    expect(await screen.findByText("Erro ao carregar empresa.")).toBeInTheDocument();
    expect(
      screen.queryByText(/Nenhuma empresa vinculada ao seu perfil no momento/i),
    ).not.toBeInTheDocument();
  });

  it("renderiza histórico quando transactions vem como array simples", async () => {
    const authFetch = buildRouter({
      transactions: jsonResponse([
        {
          id: "tx-arr",
          coinType: "sort_coin",
          amount: -25,
          source: "distribution",
          referenceId: null,
          description: null,
          createdAt: "2026-05-18T10:00:00.000Z",
        },
      ]),
    });
    mockOwner(authFetch);

    render(<MyCompanySection />);

    expect(await screen.findByText("Movimentação de carteira")).toBeInTheDocument();
    expect(screen.getByText("-25 sort_coin")).toBeInTheDocument();
  });

  it("mostra mensagem de histórico vazio quando a busca de transações falha", async () => {
    const authFetch = buildRouter({
      transactions: jsonResponse(null, false, 500),
    });
    mockOwner(authFetch);

    render(<MyCompanySection />);

    expect(
      await screen.findByText(/Nenhuma transação registrada até o momento/i),
    ).toBeInTheDocument();
  });

  it("mostra empresa pendente com edição e distribuição bloqueadas", async () => {
    const authFetch = buildRouter({ me: jsonResponse({ ...company, status: "pending" }) });
    mockOwner(authFetch);

    render(<MyCompanySection />);

    expect(await screen.findByText(/aguardando ativação/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Editar dados/i })).toBeDisabled();
    expect(screen.queryByText(/Distribuir SortCoins/i)).not.toBeInTheDocument();
  });
});

describe("MyCompanySection — edição de dados", () => {
  it("edita dados da empresa como owner e salva via PATCH", async () => {
    const authFetch = buildRouter({
      onPatchCompany: jsonResponse({ ...company, name: "Kodak Nova" }),
    });
    mockOwner(authFetch);

    render(<MyCompanySection />);

    await screen.findByText("Kodak");
    fireEvent.click(screen.getByRole("button", { name: /Editar dados/i }));

    const nameField = screen.getByLabelText("Nome da empresa");
    expect(nameField).toHaveValue("Kodak");
    fireEvent.change(nameField, { target: { value: "Kodak Nova" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/companies\/company-1$/),
        expect.objectContaining({ method: "PATCH" }),
      );
    });
    const patchCall = authFetch.mock.calls.find(
      ([url, options]) => typeof url === "string" && url.endsWith("/companies/company-1") && (options as RequestInit)?.method === "PATCH",
    );
    expect(JSON.parse((patchCall?.[1] as RequestInit).body as string)).toEqual({
      name: "Kodak Nova",
      websiteUrl: "https://codaqui.dev",
    });
    expect(await screen.findByText("Kodak Nova")).toBeInTheDocument();
  });

  it("exibe erro da API ao salvar e permite cancelar a edição", async () => {
    const authFetch = buildRouter({
      onPatchCompany: jsonResponse({ message: "Nome inválido" }, false, 400),
    });
    mockOwner(authFetch);

    render(<MyCompanySection />);

    await screen.findByText("Kodak");
    fireEvent.click(screen.getByRole("button", { name: /Editar dados/i }));
    fireEvent.click(screen.getByRole("button", { name: /Salvar/i }));

    expect(await screen.findByText("Nome inválido")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(screen.queryByLabelText("Nome da empresa")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Editar dados/i })).toBeInTheDocument();
  });
});

describe("MyCompanySection — colaboradores", () => {
  it("adiciona colaborador como owner", async () => {
    const authFetch = buildRouter();
    mockOwner(authFetch);

    render(<MyCompanySection />);

    await screen.findByText("Kodak");
    fireEvent.change(screen.getByLabelText(/GitHub handle do colaborador/i), {
      target: { value: "newdev" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/companies/${company.id}/members`),
        expect.objectContaining({ method: "POST" }),
      );
    });
    const postCall = authFetch.mock.calls.find(
      ([url, options]) => typeof url === "string" && url.includes("/members") && (options as RequestInit)?.method === "POST",
    );
    expect(JSON.parse((postCall?.[1] as RequestInit).body as string)).toEqual({
      githubHandle: "newdev",
    });
  });

  it("exibe erro da API ao adicionar colaborador", async () => {
    const authFetch = buildRouter({
      onPostMembers: jsonResponse({ message: "Membro não encontrado" }, false, 404),
    });
    mockOwner(authFetch);

    render(<MyCompanySection />);

    await screen.findByText("Kodak");
    fireEvent.change(screen.getByLabelText(/GitHub handle do colaborador/i), {
      target: { value: "ghost" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/i }));

    expect(await screen.findByText("Membro não encontrado")).toBeInTheDocument();
  });

  it("remove colaborador via DELETE", async () => {
    const authFetch = buildRouter();
    mockOwner(authFetch);

    render(<MyCompanySection />);

    await screen.findByText("@mentoriacodaqui");
    fireEvent.click(screen.getByRole("button", { name: "remover colaborador" }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/companies/${company.id}/members/m-1`),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });
});

describe("MyCompanySection — distribuição de SortCoins", () => {
  it("distribui igualmente entre owner e colaboradores", async () => {
    const authFetch = buildRouter();
    mockOwner(authFetch);

    render(<MyCompanySection />);

    await screen.findByText(/Distribuir SortCoins/i);
    fireEvent.change(screen.getByLabelText(/Total a dividir/i), { target: { value: "100" } });
    expect(screen.getByText(/≈ 50 por pessoa/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Distribuir$/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/companies/${company.id}/wallet/distribute`),
        expect.objectContaining({ method: "POST" }),
      );
    });
    const call = authFetch.mock.calls.find(
      ([url]) => typeof url === "string" && url.includes("/wallet/distribute"),
    );
    expect(JSON.parse((call?.[1] as RequestInit).body as string)).toEqual({
      distributions: [
        { githubHandle: "owner", amount: 50 },
        { githubHandle: "mentoriacodaqui", amount: 50 },
      ],
    });
    expect(
      await screen.findByText(/100 SortCoins distribuídos para 2 colaborador\(es\)!/i),
    ).toBeInTheDocument();
  });

  it("valida total positivo e valor por pessoa no modo igual", async () => {
    const authFetch = buildRouter();
    mockOwner(authFetch);

    render(<MyCompanySection />);

    await screen.findByText(/Distribuir SortCoins/i);
    const totalField = screen.getByLabelText(/Total a dividir/i);

    fireEvent.change(totalField, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /^Distribuir$/i }));
    expect(await screen.findByText("Informe um valor total positivo.")).toBeInTheDocument();

    fireEvent.change(totalField, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /^Distribuir$/i }));
    expect(
      await screen.findByText("Valor por pessoa seria 0. Aumente o total."),
    ).toBeInTheDocument();

    expect(authFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/wallet/distribute"),
      expect.anything(),
    );
  });

  it("distribui valores personalizados e valida entradas vazias", async () => {
    const authFetch = buildRouter();
    mockOwner(authFetch);

    render(<MyCompanySection />);

    await screen.findByText(/Distribuir SortCoins/i);
    fireEvent.click(screen.getByRole("button", { name: "Valor personalizado" }));

    expect(screen.getByText("★ @owner")).toBeInTheDocument();
    const customInputs = screen.getAllByPlaceholderText("coins");
    expect(customInputs).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /^Distribuir$/i }));
    expect(
      await screen.findByText("Informe pelo menos um valor positivo."),
    ).toBeInTheDocument();

    fireEvent.change(customInputs[0], { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: /^Distribuir$/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/wallet/distribute"),
        expect.objectContaining({ method: "POST" }),
      );
    });
    const call = authFetch.mock.calls.find(
      ([url]) => typeof url === "string" && url.includes("/wallet/distribute"),
    );
    expect(JSON.parse((call?.[1] as RequestInit).body as string)).toEqual({
      distributions: [{ githubHandle: "owner", amount: 30 }],
    });
  });

  it("exibe erro da API ao distribuir", async () => {
    const authFetch = buildRouter({
      onDistribute: jsonResponse({ message: "Saldo insuficiente" }, false, 400),
    });
    mockOwner(authFetch);

    render(<MyCompanySection />);

    await screen.findByText(/Distribuir SortCoins/i);
    fireEvent.change(screen.getByLabelText(/Total a dividir/i), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: /^Distribuir$/i }));

    expect(await screen.findByText("Saldo insuficiente")).toBeInTheDocument();
  });
});

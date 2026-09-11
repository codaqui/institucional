/**
 * Tests para src/components/DonationFlow/index.tsx (+ useDonationFlow.ts).
 *
 * Estratégia: usa o hook real `useDonationFlow` para cobrir componente e hook
 * juntos, mockando apenas as bordas externas:
 *  - `@site/src/hooks/useAuth` (estado de auth + authFetch)
 *  - `../StripeEmbeddedCheckoutDialog` (stub leve, evita carregar Stripe.js)
 *  - `globalThis.fetch` (saldos de /ledger/community-balances)
 *  - router mock de `@docusaurus/router` (controla ?status= da URL)
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DonationFlow from "../index";
import { useAuth } from "@site/src/hooks/useAuth";
import * as docusaurusRouter from "@docusaurus/router";

jest.mock("@site/src/hooks/useAuth");

jest.mock("../../StripeEmbeddedCheckoutDialog", () => ({
  __esModule: true,
  default: ({
    open,
    clientSecret,
    onClose,
    onComplete,
  }: {
    open: boolean;
    clientSecret: string | null;
    onClose: () => void;
    onComplete?: () => void;
  }) =>
    open ? (
      <div data-testid="checkout-dialog" data-secret={clientSecret ?? ""}>
        <button onClick={onClose}>fechar-checkout</button>
        <button onClick={onComplete}>completar-checkout</button>
      </div>
    ) : null,
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

type RouterMock = {
  __resetRouterMocks: () => void;
  __setMockSearch: (search: string) => void;
};

// O import direto resolve (via moduleNameMapper) para a MESMA instância do
// mock usada pelo componente — jest.requireMock retornaria outra instância.
const routerMock = docusaurusRouter as unknown as RouterMock;

type MockResponse = Pick<Response, "ok" | "status" | "json">;

function jsonResponse(data: unknown, ok = true, status = 200): MockResponse {
  return { ok, status, json: async () => data };
}

type AuthFetchMock = jest.MockedFunction<(...args: any[]) => Promise<MockResponse>>;

const loginMock = jest.fn();

function givenAuth(opts: { loggedIn?: boolean; authFetch?: AuthFetchMock } = {}): AuthFetchMock {
  const user = opts.loggedIn
    ? {
        sub: "u-1",
        githubId: "1",
        handle: "luiza",
        name: "Luiza",
        avatarUrl: "https://example.com/avatar.png",
        roles: ["membro"],
      }
    : null;
  const authFetch = opts.authFetch ?? jest.fn(async () => jsonResponse({}));
  mockUseAuth.mockReturnValue({
    user,
    ready: true,
    isLoggedIn: !!opts.loggedIn,
    login: loginMock,
    logout: jest.fn(),
    refreshUser: jest.fn(async () => user),
    authFetch,
  } as any);
  return authFetch;
}

function checkoutBody(authFetch: AuthFetchMock): Record<string, unknown> {
  const init = authFetch.mock.calls[0][1] as RequestInit;
  return JSON.parse(init.body as string);
}

describe("DonationFlow", () => {
  beforeEach(() => {
    routerMock.__resetRouterMocks();
    loginMock.mockReset();
    mockUseAuth.mockReset();
    (globalThis.fetch as any) = jest.fn(async () =>
      jsonResponse([
        { id: "w-1", projectKey: "tesouro-geral", name: "Tesouro Codaqui", balance: 123.45 },
      ]),
    );
  });

  it("renderiza carteiras, formulário e saldos para visitante deslogado", async () => {
    givenAuth();
    render(<DonationFlow />);

    expect(screen.getByText("Carteiras")).toBeInTheDocument();
    expect(screen.getAllByText(/Tesouro Codaqui/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /Apoiar com R\$ 25\/mês/i }),
    ).toBeInTheDocument();

    // Saldo carregado via endpoint público do ledger
    expect(await screen.findByText(/123,45/)).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/ledger/community-balances"),
    );
  });

  it("visitante vê prompt de auth, opta por anônimo e pode voltar ao login", () => {
    givenAuth();
    render(<DonationFlow />);

    expect(screen.getByText("Como você quer doar?")).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Prefiro doar anonimamente/i));
    expect(
      screen.getByText(/Doação anônima — limitado a R\$ 100/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Como você quer doar?")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(loginMock).toHaveBeenCalledWith({ returnTo: "/", communitySlug: null });
  });

  it("usuário logado vê identidade, aciona CTA de empresa e conclui doação via checkout embutido", async () => {
    const authFetch = jest.fn(async () => jsonResponse({ clientSecret: "cs_test_123" }));
    givenAuth({ loggedIn: true, authFetch });
    const onCompanyClick = jest.fn();
    render(<DonationFlow onCompanyClick={onCompanyClick} />);

    expect(screen.getByText(/Doando como @luiza/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Sou empresa e quero apoiar/i }));
    expect(onCompanyClick).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Apoiar com R\$ 25\/mês/i }));

    const dialog = await screen.findByTestId("checkout-dialog");
    expect(dialog).toHaveAttribute("data-secret", "cs_test_123");
    expect(authFetch).toHaveBeenCalledWith(
      expect.stringContaining("/stripe/checkout-session"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(checkoutBody(authFetch)).toMatchObject({
      amount: 2500,
      communityId: "tesouro-geral",
      uiMode: "embedded_page",
      recurring: { interval: "month" },
    });

    fireEvent.click(screen.getByText("completar-checkout"));
    expect(await screen.findByText(/Doação realizada!/i)).toBeVisible();
  });

  it("exibe estado de carregamento enquanto cria a sessão de checkout", async () => {
    let resolveFetch: (value: MockResponse) => void = () => {};
    const authFetch = jest.fn(
      () =>
        new Promise<MockResponse>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    givenAuth({ loggedIn: true, authFetch });
    render(<DonationFlow />);

    fireEvent.click(screen.getByRole("button", { name: /Apoiar com R\$ 25\/mês/i }));

    expect(
      await screen.findByRole("button", { name: /Redirecionando…/i }),
    ).toBeDisabled();

    resolveFetch(jsonResponse({ clientSecret: "cs_loading" }));
    expect(await screen.findByTestId("checkout-dialog")).toBeInTheDocument();
  });

  it("alterna frequência entre mensal, única e anual com dicas e impacto", () => {
    givenAuth({ loggedIn: true });
    render(<DonationFlow />);

    // Padrão: mensal com projeção de impacto anual
    expect(screen.getByText(/\/ano de impacto contínuo/i)).toBeInTheDocument();

    // Doação única: exibe dica para tornar mensal
    fireEvent.click(screen.getByRole("button", { name: "Única" }));
    expect(screen.getByText(/Tornar mensal/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Apoiar com R\$ 25$/i }),
    ).toBeInTheDocument();

    // Anual: label e texto de impacto específicos
    fireEvent.click(screen.getByRole("button", { name: "Anual" }));
    expect(screen.getByText(/\/ano de apoio contínuo para a comunidade/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Apoiar com R\$ 25\/ano/i }),
    ).toBeInTheDocument();

    // Volta para mensal pela dica do modo "única"
    fireEvent.click(screen.getByRole("button", { name: "Única" }));
    fireEvent.click(screen.getByText(/Tornar mensal/i));
    expect(
      screen.getByRole("button", { name: /Apoiar com R\$ 25\/mês/i }),
    ).toBeInTheDocument();
  });

  it("valor acima de R$ 100 sem login exige autenticação", () => {
    givenAuth();
    render(<DonationFlow />);

    fireEvent.click(screen.getByRole("button", { name: "R$ 200" }));

    expect(
      screen.getByText(/Doações acima de R\$ 100 requerem login/i),
    ).toBeInTheDocument();

    // Em modo recorrente o label de frequência tem prioridade no botão;
    // no modo "Única" o CTA vira login.
    fireEvent.click(screen.getByRole("button", { name: "Única" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Entrar com GitHub para continuar/i }),
    );
    expect(loginMock).toHaveBeenCalledWith({ returnTo: "/", communitySlug: null });

    fireEvent.click(screen.getByText(/Entrar agora →/i));
    expect(loginMock).toHaveBeenCalledTimes(2);
  });

  it("exibe erro quando o backend falha ao criar a sessão", async () => {
    const authFetch = jest.fn(async () => jsonResponse({}, false, 500));
    givenAuth({ loggedIn: true, authFetch });
    render(<DonationFlow />);

    fireEvent.click(screen.getByRole("button", { name: /Apoiar com R\$ 25\/mês/i }));

    expect(
      await screen.findByText("Falha ao criar sessão de pagamento."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("checkout-dialog")).not.toBeInTheDocument();
  });

  it("exibe erro de autenticação quando o backend responde 401", async () => {
    const authFetch = jest.fn(async () => jsonResponse({}, false, 401));
    givenAuth({ loggedIn: true, authFetch });
    render(<DonationFlow />);

    fireEvent.click(screen.getByRole("button", { name: /Apoiar com R\$ 25\/mês/i }));

    expect(
      await screen.findByText("Login com GitHub é necessário para continuar."),
    ).toBeInTheDocument();
  });

  it("exibe alerta de sucesso via ?status=success e limpa a URL ao fechar", () => {
    routerMock.__setMockSearch("?status=success");
    givenAuth({ loggedIn: true });
    const replaceState = jest
      .spyOn(globalThis.history, "replaceState")
      .mockImplementation(() => {});
    render(<DonationFlow />);

    expect(screen.getByText(/Doação realizada!/i)).toBeVisible();

    fireEvent.click(screen.getAllByLabelText("Close")[0]);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/");

    replaceState.mockRestore();
  });

  it("exibe alerta informativo via ?status=cancelled e limpa a URL ao fechar", () => {
    routerMock.__setMockSearch("?status=cancelled");
    givenAuth();
    const replaceState = jest
      .spyOn(globalThis.history, "replaceState")
      .mockImplementation(() => {});
    render(<DonationFlow />);

    expect(screen.getByText(/Pagamento cancelado/i)).toBeVisible();

    // O alerta de cancelamento é o segundo Collapse da página
    fireEvent.click(screen.getAllByLabelText("Close")[1]);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/");

    replaceState.mockRestore();
  });

  it("lockedTargetId esconde a coluna de carteiras e trava o destino", async () => {
    const authFetch = jest.fn(async () => jsonResponse({ clientSecret: "cs_locked" }));
    givenAuth({ loggedIn: true, authFetch });
    render(<DonationFlow lockedTargetId="devparana" />);

    expect(screen.queryByText("Carteiras")).not.toBeInTheDocument();
    expect(screen.getAllByText(/DevParaná/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Apoiar com R\$ 25\/mês/i }));
    await screen.findByTestId("checkout-dialog");
    expect(checkoutBody(authFetch).communityId).toBe("devparana");
  });

  it("hideWallets esconde a coluna sem travar o destino padrão", () => {
    givenAuth({ loggedIn: true });
    render(<DonationFlow hideWallets />);

    expect(screen.queryByText("Carteiras")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Tesouro Codaqui/).length).toBeGreaterThan(0);
  });

  it("disableAuth bloqueia doações acima de R$ 100 sem chamar o backend", async () => {
    const authFetch = jest.fn(async () => jsonResponse({}));
    givenAuth({ authFetch });
    render(<DonationFlow disableAuth />);

    fireEvent.click(screen.getByRole("button", { name: "R$ 200" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Apoiar com R\$ 200\/mês/i }),
    );
    expect(
      await screen.findByText(/só estão disponíveis em codaqui.dev/i),
    ).toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalled();
  });

  it("disableAuth suprime UI de auth e exibe aviso de limite no formulário", () => {
    givenAuth();
    render(<DonationFlow disableAuth />);

    expect(screen.queryByText("Como você quer doar?")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "R$ 200" }));
    expect(
      screen.getByText(/acima de R\$ 100, acesse a página principal/i),
    ).toBeInTheDocument();
  });

  it("permite trocar a carteira de destino clicando no card", async () => {
    const authFetch = jest.fn(async () => jsonResponse({ clientSecret: "cs_wallet" }));
    givenAuth({ loggedIn: true, authFetch });
    render(<DonationFlow />);

    fireEvent.click(screen.getByText("Elas no Código"));
    fireEvent.click(screen.getByRole("button", { name: /Apoiar com R\$ 25\/mês/i }));

    await screen.findByTestId("checkout-dialog");
    expect(checkoutBody(authFetch).communityId).toBe("elasnocodigo");
  });

  it("fecha o checkout embutido sem completar", async () => {
    const authFetch = jest.fn(async () => jsonResponse({ clientSecret: "cs_close" }));
    givenAuth({ loggedIn: true, authFetch });
    render(<DonationFlow />);

    fireEvent.click(screen.getByRole("button", { name: /Apoiar com R\$ 25\/mês/i }));
    await screen.findByTestId("checkout-dialog");

    fireEvent.click(screen.getByText("fechar-checkout"));
    await waitFor(() => {
      expect(screen.queryByTestId("checkout-dialog")).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/Doação realizada!/i)).not.toBeVisible();
  });
});

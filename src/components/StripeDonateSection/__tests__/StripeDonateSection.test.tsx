/**
 * Tests para src/components/StripeDonateSection/index.tsx
 *
 * Mocka apenas `useAuth` (auth + authFetch) e usa os dados reais de
 * `src/data/communities.ts`. Cobre seleção de comunidade/valor, lock de
 * comunidade, gates de auth (login e disableAuth) e submissão ao endpoint
 * /stripe/checkout-session.
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import StripeDonateSection from "../index";
import { useAuth } from "../../../hooks/useAuth";

jest.mock("../../../hooks/useAuth");

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

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

describe("StripeDonateSection", () => {
  beforeEach(() => {
    loginMock.mockReset();
    mockUseAuth.mockReset();
  });

  it("renderiza seletor de comunidades, valores e resumo padrão", () => {
    givenAuth();
    render(<StripeDonateSection />);

    expect(screen.getByText("Doe para uma comunidade")).toBeInTheDocument();
    expect(screen.getByText("1 · Comunidade")).toBeInTheDocument();
    expect(screen.getByText("2 · Valor")).toBeInTheDocument();
    expect(screen.getAllByText("DevParaná").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Elas no Código").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CamposTech").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /Apoiar com R\$ 25/i }),
    ).toBeInTheDocument();
  });

  it("seleciona comunidade e valor e submete para o endpoint correto", async () => {
    const authFetch: AuthFetchMock = jest.fn(async () =>
      jsonResponse({ url: "https://checkout.stripe.com/pay/test" }),
    );
    givenAuth({ authFetch });
    // jsdom não implementa navegação (location.href = url) — silencia o log
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    render(<StripeDonateSection />);
    fireEvent.click(screen.getByText("Elas no Código"));
    fireEvent.click(screen.getByRole("button", { name: "R$ 50" }));
    fireEvent.click(screen.getByRole("button", { name: /Apoiar com R\$ 50/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        "http://localhost:3001/stripe/checkout-session",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const init = authFetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      amount: 5000,
      communityId: "elasnocodigo",
    });

    consoleSpy.mockRestore();
  });

  it("lockedCommunityId esconde o seletor e trava a comunidade", () => {
    givenAuth();
    render(<StripeDonateSection lockedCommunityId="tisocial" />);

    expect(screen.queryByText("1 · Comunidade")).not.toBeInTheDocument();
    expect(screen.getByText("1 · Valor")).toBeInTheDocument();
    expect(screen.getByText("TI Social")).toBeInTheDocument();
    expect(screen.queryByText("Elas no Código")).not.toBeInTheDocument();
  });

  it("lockedCommunityId inválido cai para a primeira comunidade", () => {
    givenAuth();
    render(<StripeDonateSection lockedCommunityId="nao-existe" />);

    expect(screen.queryByText("1 · Comunidade")).not.toBeInTheDocument();
    expect(screen.getByText("DevParaná")).toBeInTheDocument();
  });

  it("valor acima de R$ 100 sem login exige autenticação", () => {
    const authFetch = givenAuth();
    render(<StripeDonateSection />);

    fireEvent.click(screen.getByRole("button", { name: "R$ 200" }));

    expect(
      screen.getByText(/Doações acima de R\$ 100 requerem login/i),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Entrar com GitHub para continuar/i }),
    );
    expect(loginMock).toHaveBeenCalled();
    expect(authFetch).not.toHaveBeenCalled();

    // Botão do banner também dispara o login
    fireEvent.click(screen.getByRole("button", { name: "Entrar com GitHub" }));
    expect(loginMock).toHaveBeenCalledTimes(2);
  });

  it("disableAuth bloqueia doações acima de R$ 100 com erro suave", async () => {
    const authFetch = givenAuth();
    render(<StripeDonateSection disableAuth />);

    fireEvent.click(screen.getByRole("button", { name: "R$ 200" }));
    expect(
      screen.getByText(/acima de R\$ 100, acesse a página principal/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Apoiar com R\$ 200/i }));
    expect(
      await screen.findByText(/só estão disponíveis em codaqui.dev/i),
    ).toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalled();
  });

  it("exibe erro quando o backend falha ao criar a sessão", async () => {
    const authFetch = jest.fn(async () => jsonResponse({}, false, 500));
    givenAuth({ authFetch });
    render(<StripeDonateSection />);

    fireEvent.click(screen.getByRole("button", { name: /Apoiar com R\$ 25/i }));

    expect(
      await screen.findByText("Falha ao criar sessão de pagamento."),
    ).toBeInTheDocument();
  });

  it("exibe erro de login quando o backend responde 401", async () => {
    const authFetch = jest.fn(async () => jsonResponse({}, false, 401));
    givenAuth({ loggedIn: true, authFetch });
    render(<StripeDonateSection />);

    fireEvent.click(screen.getByRole("button", { name: /Apoiar com R\$ 25/i }));

    expect(
      await screen.findByText(
        /É necessário fazer login com GitHub para doações acima de R\$ 100/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe a mensagem da exceção quando authFetch lança", async () => {
    const authFetch = jest.fn(async () => {
      throw new Error("network down");
    });
    givenAuth({ authFetch });
    render(<StripeDonateSection />);

    fireEvent.click(screen.getByRole("button", { name: /Apoiar com R\$ 25/i }));

    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("exibe estado de carregamento enquanto aguarda o backend", async () => {
    let resolveFetch: (value: MockResponse) => void = () => {};
    const authFetch = jest.fn(
      () =>
        new Promise<MockResponse>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    givenAuth({ authFetch });
    render(<StripeDonateSection />);

    fireEvent.click(screen.getByRole("button", { name: /Apoiar com R\$ 25/i }));

    expect(
      await screen.findByRole("button", { name: /Redirecionando…/i }),
    ).toBeDisabled();

    // Resposta sem url: fluxo termina sem navegar e o botão volta ao normal
    resolveFetch(jsonResponse({}));
    expect(
      await screen.findByRole("button", { name: /Apoiar com R\$ 25/i }),
    ).toBeEnabled();
  });

  it("exibe chip de identidade quando o usuário está logado", () => {
    givenAuth({ loggedIn: true });
    render(<StripeDonateSection />);

    expect(screen.getByText(/Doando como @luiza/i)).toBeInTheDocument();
  });

  it("disableAuth suprime chip de identidade mesmo logado", () => {
    givenAuth({ loggedIn: true });
    render(<StripeDonateSection disableAuth />);

    expect(screen.queryByText(/Doando como/i)).not.toBeInTheDocument();
  });
});

/**
 * Menu da conta no header (NavbarAuth) — restore do port do Docusaurus.
 * Cobre: visibilidade do Painel Admin por papel (href por role), item
 * Minha Empresa (hasCompany via /companies/me + my-collaborations, tolerante
 * a erro), Trocar conta (login switchAccount), Sair (logout) e a variante
 * inline do drawer mobile.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import NavbarAuth from "../NavbarAuth";
import { renderWithMui } from "../../../test/render-mui";
import type { AuthUser } from "../../../lib/auth-client";

const state = vi.hoisted(() => ({
  user: null as AuthUser | null,
  ready: true,
  isLoggedIn: false,
  isAdmin: false,
  isFinanceAnalyzer: false,
  isEventOrganizer: false,
  isEventFinance: false,
  isEventHost: false,
  isEventChecker: false,
  login: vi.fn(),
  logout: vi.fn(),
  authFetch: vi.fn(),
}));

vi.mock("../../../lib/use-auth", () => ({
  useAuth: () => ({
    user: state.user,
    ready: state.ready,
    isLoggedIn: state.isLoggedIn,
    isAdmin: state.isAdmin,
    isFinanceAnalyzer: state.isFinanceAnalyzer,
    isEventOrganizer: state.isEventOrganizer,
    isEventFinance: state.isEventFinance,
    isEventHost: state.isEventHost,
    isEventChecker: state.isEventChecker,
    login: state.login,
    logout: state.logout,
    authFetch: state.authFetch,
  }),
}));

function makeUser(roles: string[]): AuthUser {
  return {
    sub: "sub-1",
    githubId: "gh-1",
    handle: "octocat",
    name: "Monalisa Octocat",
    avatarUrl: "https://avatars.githubusercontent.com/octocat",
    roles,
  };
}

function mockLoggedIn(roles: string[] = ["membro"]) {
  state.user = makeUser(roles);
  state.isLoggedIn = true;
  state.isAdmin = roles.includes("admin");
  state.isFinanceAnalyzer = roles.includes("finance-analyzer");
  state.isEventOrganizer = roles.includes("event_organizer");
  state.isEventFinance = roles.includes("event_finance");
  state.isEventHost = roles.includes("event_host");
  state.isEventChecker = roles.includes("event_checker");
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

/** Sem empresa: /companies/me 404 e colaborações vazia. */
function stubNoCompany() {
  state.authFetch.mockImplementation((url: string) =>
    Promise.resolve(
      url.includes("/companies/me")
        ? jsonResponse({ message: "not found" }, { status: 404 })
        : jsonResponse([]),
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.user = null;
  state.ready = true;
  state.isLoggedIn = false;
  state.isAdmin = false;
  state.isFinanceAnalyzer = false;
  state.isEventOrganizer = false;
  state.isEventFinance = false;
  state.isEventHost = false;
  state.isEventChecker = false;
  stubNoCompany();
});

describe("NavbarAuth — estado de autenticação", () => {
  it("loading: skeleton enquanto não está pronto", () => {
    state.ready = false;
    const { container } = renderWithMui(<NavbarAuth />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("deslogado: botão Entrar com GitHub chama login()", () => {
    renderWithMui(<NavbarAuth />);
    fireEvent.click(screen.getByRole("button", { name: /entrar com github/i }));
    expect(state.login).toHaveBeenCalledTimes(1);
  });
});

describe("NavbarAuth — dropdown desktop", () => {
  it("logado: avatar abre o menu com cabeçalho @handle e itens do port", async () => {
    mockLoggedIn();
    renderWithMui(<NavbarAuth />);

    fireEvent.click(screen.getByRole("button", { name: /menu da conta @octocat/i }));

    expect(await screen.findByText("@octocat")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /meu perfil/i })).toHaveAttribute("href", "/membro");
    expect(screen.getByRole("menuitem", { name: /meu clube/i })).toHaveAttribute("href", "/clube");
    expect(screen.getByRole("menuitem", { name: /fazer uma doação/i })).toHaveAttribute(
      "href",
      "/participe/apoiar",
    );
    expect(screen.getByRole("menuitem", { name: /trocar conta/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /sair/i })).toBeInTheDocument();
  });

  it("usuário comum não vê Painel Admin nem Minha Empresa", async () => {
    mockLoggedIn(["membro"]);
    renderWithMui(<NavbarAuth />);
    fireEvent.click(screen.getByRole("button", { name: /menu da conta/i }));

    await screen.findByText("@octocat");
    expect(screen.queryByRole("menuitem", { name: /painel admin/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /minha empresa/i })).not.toBeInTheDocument();
  });

  it("admin vê Painel Admin com href /admin", async () => {
    mockLoggedIn(["admin"]);
    renderWithMui(<NavbarAuth />);
    fireEvent.click(screen.getByRole("button", { name: /menu da conta/i }));

    expect(await screen.findByRole("menuitem", { name: /painel admin/i })).toHaveAttribute(
      "href",
      "/admin",
    );
  });

  it("finance-analyzer vê Painel Admin com href /admin", async () => {
    mockLoggedIn(["finance-analyzer"]);
    renderWithMui(<NavbarAuth />);
    fireEvent.click(screen.getByRole("button", { name: /menu da conta/i }));

    expect(await screen.findByRole("menuitem", { name: /painel admin/i })).toHaveAttribute(
      "href",
      "/admin",
    );
  });

  it("event_organizer vê Painel Admin com href /admin/eventos", async () => {
    mockLoggedIn(["event_organizer"]);
    renderWithMui(<NavbarAuth />);
    fireEvent.click(screen.getByRole("button", { name: /menu da conta/i }));

    expect(await screen.findByRole("menuitem", { name: /painel admin/i })).toHaveAttribute(
      "href",
      "/admin/eventos",
    );
  });

  it("event_host vê Painel Admin com href /admin/eventos-checkin", async () => {
    mockLoggedIn(["event_host"]);
    renderWithMui(<NavbarAuth />);
    fireEvent.click(screen.getByRole("button", { name: /menu da conta/i }));

    expect(await screen.findByRole("menuitem", { name: /painel admin/i })).toHaveAttribute(
      "href",
      "/admin/eventos-checkin",
    );
  });

  it("event_checker vê Painel Admin com href /admin/eventos-checkin", async () => {
    mockLoggedIn(["event_checker"]);
    renderWithMui(<NavbarAuth />);
    fireEvent.click(screen.getByRole("button", { name: /menu da conta/i }));

    expect(await screen.findByRole("menuitem", { name: /painel admin/i })).toHaveAttribute(
      "href",
      "/admin/eventos-checkin",
    );
  });

  it("Minha Empresa aparece quando /companies/me é 200", async () => {
    mockLoggedIn();
    state.authFetch.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("/companies/me")
          ? jsonResponse({ id: "c1", tradeName: "ACME" })
          : jsonResponse([]),
      ),
    );
    renderWithMui(<NavbarAuth />);
    fireEvent.click(screen.getByRole("button", { name: /menu da conta/i }));

    expect(await screen.findByRole("menuitem", { name: /minha empresa/i })).toHaveAttribute(
      "href",
      "/membros/empresa",
    );
    expect(state.authFetch).toHaveBeenCalledWith("/companies/me");
    expect(state.authFetch).toHaveBeenCalledWith("/companies/my-collaborations");
  });

  it("Minha Empresa aparece quando há colaborações (mesmo sem empresa própria)", async () => {
    mockLoggedIn();
    state.authFetch.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("/companies/me")
          ? jsonResponse({ message: "not found" }, { status: 404 })
          : jsonResponse([{ id: "c1" }]),
      ),
    );
    renderWithMui(<NavbarAuth />);
    fireEvent.click(screen.getByRole("button", { name: /menu da conta/i }));

    expect(await screen.findByRole("menuitem", { name: /minha empresa/i })).toBeInTheDocument();
  });

  it("erro nas consultas de empresa não quebra o menu", async () => {
    mockLoggedIn();
    state.authFetch.mockRejectedValue(new Error("network down"));
    renderWithMui(<NavbarAuth />);
    fireEvent.click(screen.getByRole("button", { name: /menu da conta/i }));

    await screen.findByText("@octocat");
    expect(screen.getByRole("menuitem", { name: /meu perfil/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /minha empresa/i })).not.toBeInTheDocument();
  });

  it("Trocar conta chama login({ switchAccount: true })", async () => {
    mockLoggedIn();
    renderWithMui(<NavbarAuth />);
    fireEvent.click(screen.getByRole("button", { name: /menu da conta/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /trocar conta/i }));

    await waitFor(() =>
      expect(state.login).toHaveBeenCalledWith({ switchAccount: true }),
    );
  });

  it("Sair chama logout({ returnTo: '/' })", async () => {
    mockLoggedIn();
    renderWithMui(<NavbarAuth />);
    fireEvent.click(screen.getByRole("button", { name: /menu da conta/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /^sair$/i }));

    await waitFor(() => expect(state.logout).toHaveBeenCalledWith({ returnTo: "/" }));
  });
});

describe("NavbarAuth — variante inline (drawer mobile)", () => {
  it("renderiza a lista expandida como links de navegação (sem botão de menu)", async () => {
    mockLoggedIn(["admin"]);
    renderWithMui(<NavbarAuth variant="inline" />);

    // sem trigger de dropdown
    expect(screen.queryByRole("button", { name: /menu da conta/i })).not.toBeInTheDocument();
    // itens como links diretos
    expect(screen.getByRole("link", { name: /meu perfil/i })).toHaveAttribute("href", "/membro");
    expect(screen.getByRole("link", { name: /painel admin/i })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: /fazer uma doação/i })).toHaveAttribute(
      "href",
      "/participe/apoiar",
    );
    expect(screen.getByRole("button", { name: /^sair$/i })).toBeInTheDocument();
    expect(screen.getByText("@octocat")).toBeInTheDocument();
    // sem role="menu" — é navegação (guia `menu`)
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("inline: Sair chama logout", async () => {
    mockLoggedIn();
    renderWithMui(<NavbarAuth variant="inline" />);
    fireEvent.click(screen.getByRole("button", { name: /^sair$/i }));
    await waitFor(() => expect(state.logout).toHaveBeenCalledWith({ returnTo: "/" }));
  });
});

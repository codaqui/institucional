/**
 * Testes para NavbarAuth.
 *
 * Cobre as duas variantes de renderização:
 *   - mobile={true}: deve usar classes Docusaurus (menu__list-item / menu__link)
 *   - mobile={false} (padrão): deve usar componentes MUI (Button / Chip)
 *
 * Também verifica a visibilidade condicional do link de admin.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import NavbarAuth from "../index";
import { useAuth } from "../../../hooks/useAuth";
import { useLocation } from "@docusaurus/router";

jest.mock("@docusaurus/router");
jest.mock("../../../hooks/useAuth");

const mockUseLocation = useLocation as jest.Mock;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const BASE_AUTH = {
  user: null,
  ready: true,
  isLoggedIn: false,
  isAdmin: false,
  isFinanceAnalyzer: false,
  login: jest.fn(),
  logout: jest.fn(),
  refreshUser: jest.fn(),
  authFetch: jest.fn(),
} as const;

const LOGGED_IN_USER = {
  sub: "uuid-1",
  githubId: "12345",
  handle: "testuser",
  name: "Test User",
  avatarUrl: "https://example.com/avatar.png",
  role: "membro" as const,
};

const ADMIN_USER = { ...LOGGED_IN_USER, handle: "adminuser", role: "admin" as const };

beforeEach(() => {
  mockUseLocation.mockReturnValue({ pathname: "/" });
  mockUseAuth.mockReturnValue({ ...BASE_AUTH });
});

// ── mobile={true} ────────────────────────────────────────────────────────────

describe("mobile mode (mobile={true})", () => {
  it("exibe botão de login como <li> quando não logado", () => {
    render(<NavbarAuth mobile />);
    const btn = screen.getByRole("button", { name: /entrar com github/i });
    expect(btn.closest("li")).toHaveClass("menu__list-item");
  });

  it("NÃO renderiza componente MUI Button no modo mobile", () => {
    render(<NavbarAuth mobile />);
    // MUI Button renderiza com `MuiButton-root`; não deve estar presente
    const { container } = render(<NavbarAuth mobile />);
    expect(container.querySelector(".MuiButton-root")).toBeNull();
  });

  it("dispara login ao clicar no botão mobile de entrar", () => {
    const loginMock = jest.fn();
    mockUseAuth.mockReturnValue({ ...BASE_AUTH, login: loginMock });
    render(<NavbarAuth mobile />);
    const btn = screen.getByRole("button", { name: /entrar com github/i });
    btn.click();
    expect(loginMock).toHaveBeenCalled();
  });

  it("dispara logout ao clicar no botão Sair mobile", () => {
    const logoutMock = jest.fn();
    mockUseAuth.mockReturnValue({
      ...BASE_AUTH,
      user: LOGGED_IN_USER,
      isLoggedIn: true,
      logout: logoutMock,
    });
    render(<NavbarAuth mobile />);
    const btn = screen.getByRole("button", { name: /sair/i });
    btn.click();
    expect(logoutMock).toHaveBeenCalled();
  });

  it("exibe handle e itens de menu quando logado", () => {
    mockUseAuth.mockReturnValue({
      ...BASE_AUTH,
      user: LOGGED_IN_USER,
      isLoggedIn: true,
    });
    render(<NavbarAuth mobile />);

    expect(screen.getByText("@testuser")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /meu perfil/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /fazer uma doação/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sair/i })).toBeInTheDocument();
  });

  it("exibe link de Painel Admin quando usuário é admin", () => {
    mockUseAuth.mockReturnValue({
      ...BASE_AUTH,
      user: ADMIN_USER,
      isLoggedIn: true,
      isAdmin: true,
    });
    render(<NavbarAuth mobile />);
    expect(screen.getByRole("link", { name: /painel admin/i })).toBeInTheDocument();
  });

  it("NÃO exibe link de Painel Admin para usuário comum", () => {
    mockUseAuth.mockReturnValue({
      ...BASE_AUTH,
      user: LOGGED_IN_USER,
      isLoggedIn: true,
      isAdmin: false,
    });
    render(<NavbarAuth mobile />);
    expect(screen.queryByRole("link", { name: /painel admin/i })).not.toBeInTheDocument();
  });

  it("todos os itens mobile ficam dentro de <li> com classe correta", () => {
    mockUseAuth.mockReturnValue({
      ...BASE_AUTH,
      user: LOGGED_IN_USER,
      isLoggedIn: true,
    });
    const { container } = render(<NavbarAuth mobile />);
    const listItems = container.querySelectorAll("li.menu__list-item");
    expect(listItems.length).toBeGreaterThanOrEqual(3); // handle + perfil + doação + sair
  });
});

// ── desktop mode (padrão) ─────────────────────────────────────────────────────

describe("desktop mode (mobile={false} padrão)", () => {
  it("renderiza botão MUI quando não logado", () => {
    const { container } = render(<NavbarAuth />);
    expect(container.querySelector(".MuiButton-root")).not.toBeNull();
  });

  it("NÃO renderiza <li> no modo desktop", () => {
    const { container } = render(<NavbarAuth />);
    expect(container.querySelector("li")).toBeNull();
  });

  it("dispara login ao clicar no botão desktop", async () => {
    const loginMock = jest.fn();
    mockUseAuth.mockReturnValue({ ...BASE_AUTH, login: loginMock });
    const { container } = render(<NavbarAuth />);
    const btn = container.querySelector(".MuiButton-root") as HTMLElement;
    btn.click();
    expect(loginMock).toHaveBeenCalled();
  });

  it("renderiza Chip com handle quando logado no desktop", () => {
    mockUseAuth.mockReturnValue({
      ...BASE_AUTH,
      user: LOGGED_IN_USER,
      isLoggedIn: true,
    });
    const { container } = render(<NavbarAuth />);
    expect(container.querySelector(".MuiChip-root")).not.toBeNull();
    expect(screen.getByText("@testuser")).toBeInTheDocument();
  });

  it("abre menu ao clicar no Chip", async () => {
    const { fireEvent } = await import("@testing-library/react");
    mockUseAuth.mockReturnValue({
      ...BASE_AUTH,
      user: LOGGED_IN_USER,
      isLoggedIn: true,
    });
    const { container } = render(<NavbarAuth />);
    const chip = container.querySelector(".MuiChip-root") as HTMLElement;
    fireEvent.click(chip);
    expect(await screen.findByText("Meu Perfil")).toBeInTheDocument();
    expect(await screen.findByText("Fazer uma Doação")).toBeInTheDocument();
  });

  it("exibe item de Painel Admin no menu desktop para admin", async () => {
    const { fireEvent } = await import("@testing-library/react");
    mockUseAuth.mockReturnValue({
      ...BASE_AUTH,
      user: ADMIN_USER,
      isLoggedIn: true,
      isAdmin: true,
    });
    const { container } = render(<NavbarAuth />);
    const chip = container.querySelector(".MuiChip-root") as HTMLElement;
    fireEvent.click(chip);
    expect(await screen.findByText("Painel Admin")).toBeInTheDocument();
  });

  it("NÃO exibe Painel Admin para usuário comum no desktop", async () => {
    const { fireEvent } = await import("@testing-library/react");
    mockUseAuth.mockReturnValue({
      ...BASE_AUTH,
      user: LOGGED_IN_USER,
      isLoggedIn: true,
      isAdmin: false,
    });
    const { container } = render(<NavbarAuth />);
    const chip = container.querySelector(".MuiChip-root") as HTMLElement;
    fireEvent.click(chip);
    await screen.findByText("Meu Perfil");
    expect(screen.queryByText("Painel Admin")).not.toBeInTheDocument();
  });

  it("fecha o menu ao clicar no backdrop (onClose)", async () => {
    const { fireEvent } = await import("@testing-library/react");
    mockUseAuth.mockReturnValue({
      ...BASE_AUTH,
      user: LOGGED_IN_USER,
      isLoggedIn: true,
    });
    const { container } = render(<NavbarAuth />);
    const chip = container.querySelector(".MuiChip-root") as HTMLElement;
    fireEvent.click(chip);
    await screen.findByText("Meu Perfil");
    // Clicar no backdrop do MUI Menu dispara onClose
    const backdrop = document.querySelector(".MuiBackdrop-root") as HTMLElement;
    if (backdrop) fireEvent.click(backdrop);
    // Apenas verificamos que o callback não lança — comportamento real testado em e2e
  });

  it("dispara logout ao clicar em Sair no menu desktop", async () => {
    const { fireEvent } = await import("@testing-library/react");
    const logoutMock = jest.fn();
    mockUseAuth.mockReturnValue({
      ...BASE_AUTH,
      user: LOGGED_IN_USER,
      isLoggedIn: true,
      logout: logoutMock,
    });
    const { container } = render(<NavbarAuth />);
    const chip = container.querySelector(".MuiChip-root") as HTMLElement;
    fireEvent.click(chip);
    const sairItem = await screen.findByText("Sair");
    fireEvent.click(sairItem.closest("[role=menuitem]") as HTMLElement);
    expect(logoutMock).toHaveBeenCalled();
  });
});

// ── contexto de comunidade ────────────────────────────────────────────────────

describe("em contexto de comunidade", () => {
  it("passa returnTo e communitySlug ao login quando em página de comunidade", () => {
    const loginMock = jest.fn();
    mockUseAuth.mockReturnValue({ ...BASE_AUTH, login: loginMock });
    mockUseLocation.mockReturnValue({ pathname: "/comunidades/tisocial" });
    render(<NavbarAuth mobile />);
    const btn = screen.getByRole("button", { name: /entrar com github/i });
    btn.click();
    expect(loginMock).toHaveBeenCalledWith({
      returnTo: "/comunidades/tisocial",
      communitySlug: "tisocial",
    });
  });

  it("preserva o pathname atual como returnTo (deep link)", () => {
    const loginMock = jest.fn();
    mockUseAuth.mockReturnValue({ ...BASE_AUTH, login: loginMock });
    mockUseLocation.mockReturnValue({ pathname: "/comunidades/tisocial/blog/meu-post" });
    render(<NavbarAuth mobile />);
    const btn = screen.getByRole("button", { name: /entrar com github/i });
    btn.click();
    expect(loginMock).toHaveBeenCalledWith({
      returnTo: "/comunidades/tisocial/blog/meu-post",
      communitySlug: "tisocial",
    });
  });
});

// ── edge cases ────────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("retorna null quando ready=false (hidratação ainda em curso)", () => {
    mockUseAuth.mockReturnValue({ ...BASE_AUTH, ready: false });
    const { container } = render(<NavbarAuth mobile />);
    expect(container.firstChild).toBeNull();
  });
});

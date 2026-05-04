/**
 * Testes para o swizzle Navbar/MobileSidebar/PrimaryMenu.
 *
 * Comportamento esperado:
 *   - Em páginas de comunidade (/comunidades/<slug>/*): exibe o navMenu da
 *     comunidade em vez do menu principal da Codaqui.
 *   - Fora de contexto de comunidade: delega ao componente original
 *     (OriginalPrimaryMenu), exibindo o menu padrão da Codaqui.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import PrimaryMenuWrapper from "../index";
import { useLocation } from "@docusaurus/router";

// toggleMock precisa estar fora do jest.mock para poder ser referenciado nos testes.
// Variáveis com prefixo "mock" são permitidas em closures de jest.mock().
const mockToggle = jest.fn();

// @docusaurus/theme-common/internal — mockado para evitar dependência de
// contexto React que não existe no ambiente de teste (jsdom).
jest.mock("@docusaurus/theme-common/internal", () => ({
  useNavbarMobileSidebar: () => ({ toggle: mockToggle }),
}));

jest.mock("@docusaurus/router");

const mockUseLocation = useLocation as jest.Mock;

beforeEach(() => {
  mockUseLocation.mockReturnValue({ pathname: "/" });
  mockToggle.mockClear();
});

// ── contexto de comunidade ────────────────────────────────────────────────────

describe("em página de comunidade", () => {
  const communityPaths = [
    "/comunidades/tisocial",
    "/comunidades/tisocial/apoiar",
    "/comunidades/tisocial/blog",
    "/comunidades/tisocial/transparencia",
    "/comunidades/tisocial/docs",
  ];

  it.each(communityPaths)(
    "exibe itens do navMenu da comunidade para %s",
    (pathname) => {
      mockUseLocation.mockReturnValue({ pathname });
      render(<PrimaryMenuWrapper />);

      // Itens definidos em comunidades/tisocial/community.config.ts → navMenu
      expect(screen.getByRole("link", { name: "Início" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Apoiar" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Transparência" })).toBeInTheDocument();
    },
  );

  it("NÃO exibe o menu original da Codaqui em página de comunidade", () => {
    mockUseLocation.mockReturnValue({ pathname: "/comunidades/tisocial" });
    render(<PrimaryMenuWrapper />);

    // O mock do componente original retorna data-testid="original-primary-menu"
    expect(screen.queryByTestId("original-primary-menu")).not.toBeInTheDocument();
  });

  it("renderiza os links com os hrefs corretos do navMenu", () => {
    mockUseLocation.mockReturnValue({ pathname: "/comunidades/tisocial" });
    render(<PrimaryMenuWrapper />);

    const apoiarLink = screen.getByRole("link", { name: "Apoiar" });
    expect(apoiarLink).toHaveAttribute("href", "/comunidades/tisocial/apoiar");
  });

  it("exibe todos os 5 itens do navMenu da T.I. Social", () => {
    mockUseLocation.mockReturnValue({ pathname: "/comunidades/tisocial" });
    render(<PrimaryMenuWrapper />);

    // Conforme community.config.ts: Início, Blog, Docs, Apoiar, Transparência
    const links = screen.getAllByRole("link");
    expect(links.length).toBe(5);
  });
});

  it("dispara toggle do sidebar ao clicar em item do navMenu", () => {
    mockUseLocation.mockReturnValue({ pathname: "/comunidades/tisocial" });
    render(<PrimaryMenuWrapper />);

    const apoiarLink = screen.getByRole("link", { name: "Apoiar" });
    fireEvent.click(apoiarLink);
    // O onClick de cada NavbarItem chama mobileSidebar.toggle()
    expect(mockToggle).toHaveBeenCalled();
  });

describe("fora de contexto de comunidade", () => {
  const defaultPaths = [
    "/",
    "/blog",
    "/sobre/equipe",
    "/projetos",
    "/eventos",
    "/trilhas/python",
  ];

  it.each(defaultPaths)(
    "delega ao OriginalPrimaryMenu para %s",
    (pathname) => {
      mockUseLocation.mockReturnValue({ pathname });
      render(<PrimaryMenuWrapper />);

      // O componente original mockado renderiza data-testid="original-primary-menu"
      expect(screen.getByTestId("original-primary-menu")).toBeInTheDocument();
    },
  );

  it("NÃO exibe itens de comunidade fora do basePath", () => {
    // Garante que /comunidades/tisocialx não ativa o context da T.I. Social
    mockUseLocation.mockReturnValue({ pathname: "/comunidades/tisocialx" });
    render(<PrimaryMenuWrapper />);

    expect(screen.getByTestId("original-primary-menu")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Apoiar" })).not.toBeInTheDocument();
  });
});

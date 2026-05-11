/**
 * Testes para o swizzle Navbar/Logo.
 *
 * Comportamento esperado:
 *   - Em páginas de comunidade (/comunidades/<slug>/*): renderiza logo + nome da
 *     comunidade, com link apontando para o basePath, respeitando o color mode.
 *   - Fora de contexto de comunidade: delega ao componente original (OriginalLogo).
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import LogoWrapper from "../index";
import { useLocation } from "@docusaurus/router";
import { useColorMode } from "@docusaurus/theme-common";

jest.mock("@docusaurus/router");
// @docusaurus/theme-common is mapped to the auto-mock via moduleNameMapper.
// jest.mock() is still needed to allow per-test overrides with mockReturnValue.
jest.mock("@docusaurus/theme-common");

const mockUseLocation = useLocation as jest.Mock;
const mockUseColorMode = useColorMode as jest.Mock;

beforeEach(() => {
  mockUseLocation.mockReturnValue({ pathname: "/" });
  mockUseColorMode.mockReturnValue({ colorMode: "light" });
});

// ── fora de contexto de comunidade ───────────────────────────────────────────

describe("fora de contexto de comunidade", () => {
  it("delega ao OriginalLogo quando fora de comunidade", () => {
    render(<LogoWrapper />);
    expect(screen.getByTestId("original-logo")).toBeInTheDocument();
  });

  it("NÃO renderiza logo de comunidade fora de contexto", () => {
    render(<LogoWrapper />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

// ── em contexto de comunidade ─────────────────────────────────────────────────

describe("em contexto de comunidade", () => {
  beforeEach(() => {
    mockUseLocation.mockReturnValue({ pathname: "/comunidades/tisocial" });
  });

  it("renderiza o logo da comunidade com alt acessível", () => {
    render(<LogoWrapper />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "alt",
      expect.stringContaining("T.I. Social"),
    );
  });

  it("exibe o nome curto da comunidade", () => {
    render(<LogoWrapper />);
    expect(screen.getByText("T.I. Social")).toBeInTheDocument();
  });

  it("usa logoUrl no modo claro", () => {
    mockUseColorMode.mockReturnValue({ colorMode: "light" });
    render(<LogoWrapper />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/img/tisocial.png");
  });

  it("usa logoUrlDark no modo escuro quando disponível", () => {
    mockUseColorMode.mockReturnValue({ colorMode: "dark" });
    render(<LogoWrapper />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/img/tisocial-white.png");
  });

  it("link aponta para o basePath da comunidade", () => {
    render(<LogoWrapper />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/comunidades/tisocial");
  });

  it("NÃO renderiza OriginalLogo em contexto de comunidade", () => {
    render(<LogoWrapper />);
    expect(screen.queryByTestId("original-logo")).not.toBeInTheDocument();
  });

  it("funciona para sub-rotas da comunidade", () => {
    mockUseLocation.mockReturnValue({ pathname: "/comunidades/tisocial/apoiar" });
    render(<LogoWrapper />);
    expect(screen.getByText("T.I. Social")).toBeInTheDocument();
  });
});

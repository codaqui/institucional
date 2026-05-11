/**
 * Testes para o swizzle Footer.
 *
 * Comportamento esperado:
 *   - Em páginas de comunidade (/comunidades/<slug>/*): renderiza rodapé
 *     whitelabel com branding da comunidade, navMenu e links para a Codaqui.
 *   - Fora de contexto de comunidade: delega ao OriginalFooter.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import FooterWrapper from "../index";
import { useLocation } from "@docusaurus/router";

jest.mock("@docusaurus/router");

const mockUseLocation = useLocation as jest.Mock;

beforeEach(() => {
  mockUseLocation.mockReturnValue({ pathname: "/" });
});

// ── fora de contexto de comunidade ───────────────────────────────────────────

describe("fora de contexto de comunidade", () => {
  it("delega ao OriginalFooter quando fora de comunidade", () => {
    render(<FooterWrapper />);
    expect(screen.getByTestId("original-footer")).toBeInTheDocument();
  });

  it("NÃO renderiza branding de comunidade fora de contexto", () => {
    render(<FooterWrapper />);
    expect(screen.queryByText("T.I. Social")).not.toBeInTheDocument();
  });
});

// ── em contexto de comunidade ─────────────────────────────────────────────────

describe("em contexto de comunidade", () => {
  beforeEach(() => {
    mockUseLocation.mockReturnValue({ pathname: "/comunidades/tisocial" });
  });

  it("renderiza o nome curto da comunidade no rodapé", () => {
    render(<FooterWrapper />);
    expect(screen.getByText("T.I. Social")).toBeInTheDocument();
  });

  it("renderiza links do navMenu no rodapé", () => {
    render(<FooterWrapper />);
    // navMenu inclui Início, Blog, Docs, Apoiar, Transparência
    expect(screen.getByText("Apoiar")).toBeInTheDocument();
    expect(screen.getByText("Transparência")).toBeInTheDocument();
  });

  it("exibe link de retorno ao site da Codaqui", () => {
    render(<FooterWrapper />);
    expect(screen.getByText(/Site da Codaqui/i)).toBeInTheDocument();
  });

  it("exibe link para transparência geral da Codaqui", () => {
    render(<FooterWrapper />);
    expect(screen.getByText(/Transparência geral/i)).toBeInTheDocument();
  });

  it("NÃO renderiza OriginalFooter em contexto de comunidade", () => {
    render(<FooterWrapper />);
    expect(screen.queryByTestId("original-footer")).not.toBeInTheDocument();
  });

  it("funciona para sub-rotas da comunidade", () => {
    mockUseLocation.mockReturnValue({ pathname: "/comunidades/tisocial/blog" });
    render(<FooterWrapper />);
    expect(screen.getByText("T.I. Social")).toBeInTheDocument();
  });
});

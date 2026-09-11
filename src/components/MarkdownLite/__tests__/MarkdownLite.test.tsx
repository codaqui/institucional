import React from "react";
import { render, screen } from "@testing-library/react";
import MarkdownLite from "../index";

describe("MarkdownLite", () => {
  it("renderiza parágrafos separados por linha em branco", () => {
    const { container } = render(<MarkdownLite text={"Primeiro parágrafo.\n\nSegundo parágrafo."} />);
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toHaveTextContent("Primeiro parágrafo.");
    expect(paragraphs[1]).toHaveTextContent("Segundo parágrafo.");
  });

  it("converte quebra de linha simples em <br>", () => {
    const { container } = render(<MarkdownLite text={"linha um\nlinha dois"} />);
    const paragraph = container.querySelector("p");
    expect(paragraph?.querySelectorAll("br")).toHaveLength(1);
    expect(paragraph).toHaveTextContent("linha um");
    expect(paragraph).toHaveTextContent("linha dois");
  });

  it("renderiza **negrito** como <strong>", () => {
    render(<MarkdownLite text="texto com **destaque** aqui" />);
    const strong = screen.getByText("destaque");
    expect(strong.tagName).toBe("STRONG");
  });

  it("renderiza *itálico* como <em>", () => {
    render(<MarkdownLite text="texto com *ênfase* aqui" />);
    const em = screen.getByText("ênfase");
    expect(em.tagName).toBe("EM");
  });

  it("renderiza _itálico_ como <em>", () => {
    render(<MarkdownLite text="texto com _ênfase_ aqui" />);
    const em = screen.getByText("ênfase");
    expect(em.tagName).toBe("EM");
  });

  it("renderiza link http/https com target blank e rel noopener", () => {
    render(<MarkdownLite text="acesse [o site](https://codaqui.dev) agora" />);
    const link = screen.getByRole("link", { name: "o site" });
    expect(link).toHaveAttribute("href", "https://codaqui.dev");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
  });

  it("renderiza link com URL javascript: como texto literal", () => {
    const { container } = render(
      <MarkdownLite text="clique [aqui](javascript:alert(1)) agora" />,
    );
    expect(container.querySelector("a")).not.toBeInTheDocument();
    expect(container).toHaveTextContent("[aqui](javascript:alert(1))");
  });

  it("renderiza link com URL relativa como texto literal", () => {
    const { container } = render(<MarkdownLite text="clique [aqui](/pagina) agora" />);
    expect(container.querySelector("a")).not.toBeInTheDocument();
    expect(container).toHaveTextContent("[aqui](/pagina)");
  });

  it("renderiza lista de itens consecutivos como ul/li", () => {
    const { container } = render(
      <MarkdownLite text={"- primeiro\n- segundo com **negrito**\n- terceiro"} />,
    );
    const list = container.querySelector("ul");
    expect(list).toBeInTheDocument();
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(3);
    expect(items[1].querySelector("strong")).toHaveTextContent("negrito");
  });

  it("renderiza título ## como heading", () => {
    render(<MarkdownLite text="## Programação" />);
    expect(screen.getByRole("heading", { level: 2, name: "Programação" })).toBeInTheDocument();
  });

  it("renderiza título ### como heading nível 3", () => {
    render(<MarkdownLite text="### Detalhes" />);
    expect(screen.getByRole("heading", { level: 3, name: "Detalhes" })).toBeInTheDocument();
  });

  it("sintaxe desconhecida vira texto literal", () => {
    const { container } = render(<MarkdownLite text="# título h1 não suportado" />);
    expect(container.querySelector("h1")).not.toBeInTheDocument();
    expect(container).toHaveTextContent("# título h1 não suportado");
  });

  it("aninhamento inválido não quebra e vira texto", () => {
    const { container } = render(
      <MarkdownLite text="**negrito com *itálico* dentro**" />,
    );
    // `[^*]+` não casa o aninhamento: renderiza literalmente, sem crash
    expect(container).toHaveTextContent("itálico");
  });

  it("markdown incompleto não quebra", () => {
    const { container } = render(<MarkdownLite text="texto com **aberto e [link(ruim" />);
    expect(container).toHaveTextContent("texto com **aberto e [link(ruim");
  });

  it("bloco misto com linha '- ' não vira lista", () => {
    const { container } = render(<MarkdownLite text={"texto normal\n- não é lista"} />);
    expect(container.querySelector("ul")).not.toBeInTheDocument();
    expect(container).toHaveTextContent("- não é lista");
  });
});

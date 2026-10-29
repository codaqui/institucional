import { describe, expect, it } from "vitest";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { remarkAdmonitions } from "./remark-admonitions";

async function render(markdown: string): Promise<string> {
  const processor = await createMarkdownProcessor({
    remarkPlugins: [remarkAdmonitions],
    syntaxHighlight: false,
  });
  const { code } = await processor.render(markdown);
  return code;
}

describe("remark-admonitions", () => {
  it.each(["info", "note", "tip", "warning"] as const)(
    "renderiza :::tipo[Título] como div admonition (%s)",
    async (type) => {
      const html = await render(
        `Antes\n\n:::${type}[Título do bloco]\nConteúdo do bloco.\n\n:::\n\nDepois`,
      );
      expect(html).toContain(`<div class="admonition admonition-${type}">`);
      expect(html).toContain('<p class="admonition-title">Título do bloco</p>');
      expect(html).toContain("<p>Conteúdo do bloco.</p>");
      expect(html).not.toContain(":::");
    },
  );

  it("omite o <p class=\"admonition-title\"> quando não há título", async () => {
    const html = await render(":::warning\nCuidado com isso.\n\n:::");
    expect(html).toContain('<div class="admonition admonition-warning">');
    expect(html).not.toContain("admonition-title");
    expect(html).not.toContain(":::");
  });

  it("aceita título em texto plano, sem colchetes (trilhas/index.md)", async () => {
    const html = await render(
      ":::tip Curadoria em vez de criação\nNosso objetivo principal não é criar novos conteúdos do zero, mas sim curar o que já existe.\n:::",
    );
    expect(html).toContain('<div class="admonition admonition-tip">');
    expect(html).toContain(
      '<p class="admonition-title">Curadoria em vez de criação</p>',
    );
    expect(html).toContain("<p>Nosso objetivo principal");
    expect(html).not.toContain(":::");
  });

  it("mantém markdown interno parseado (heading + code fence) em bloco multi-nó", async () => {
    const html = await render(
      [
        ":::info[Exemplos de nomes válidos e inválidos]",
        "### Nomes Válidos",
        "",
        "```python",
        "idade = 25",
        "```",
        "",
        "Texto final antes do fechamento.",
        ":::",
      ].join("\n"),
    );
    expect(html).toContain('<div class="admonition admonition-info">');
    expect(html).toContain('<p class="admonition-title">Exemplos de nomes válidos e inválidos</p>');
    // children intactos: heading e code continuam parseados
    expect(html).toContain("<h3");
    expect(html).toContain("Nomes Válidos");
    expect(html).toContain('class="language-python"');
    expect(html).toContain("idade = 25");
    expect(html).toContain("Texto final antes do fechamento.");
    expect(html).not.toContain(":::");
  });

  it("fecha o título no primeiro `]` (edge case trilhas/python/page-9.md:168)", async () => {
    const html = await render(
      ":::tip[O bloco `if __name__ == \\]\nQuando um módulo é executado diretamente.\n:::",
    );
    expect(html).toContain('<div class="admonition admonition-tip">');
    // comportamento Docusaurus: `]` encerra o título cedo; o restante da
    // linha é descartado e o raw `__name__`/`\]` sobrevive no título
    expect(html).toContain(
      '<p class="admonition-title">O bloco `if __name__ == \\</p>',
    );
    expect(html).toContain("Quando um módulo é executado diretamente.");
    expect(html).not.toContain(":::");
  });

  it("inclui lista irmã e remove o `:::` grudado no último item", async () => {
    const html = await render(
      ":::info[Objetivos de Aprendizado]\n- **Entender** o básico\n- **Praticar** com exercícios\n:::",
    );
    expect(html).toContain('<div class="admonition admonition-info">');
    expect(html).toContain("<ul>");
    expect(html).toContain("<strong>Entender</strong>");
    expect(html).toContain("<li>");
    expect(html).not.toContain(":::");
  });

  it("preserva markdown inline do conteúdo que compartilha o parágrafo de abertura", async () => {
    const html = await render(
      ":::info[Tipagem Dinâmica]\nPython é uma linguagem de **tipagem dinâmica**, o que significa inferência.\n:::",
    );
    expect(html).toContain('<div class="admonition admonition-info">');
    expect(html).toContain("<strong>tipagem dinâmica</strong>");
    expect(html).not.toContain(":::");
  });

  it("bloco sem fechamento permanece literal (não engole o documento)", async () => {
    const html = await render(":::info[Sem fechamento]\nConteúdo solto.\n\nParágrafo seguinte.");
    expect(html).not.toContain("admonition");
    expect(html).toContain(":::info[Sem fechamento]");
  });

  it("não toca em `:::` dentro de code fence", async () => {
    const html = await render("```md\n:::info[Não vira bloco]\n```");
    expect(html).not.toContain('class="admonition');
    expect(html).toContain(":::info[Não vira bloco]");
  });
});

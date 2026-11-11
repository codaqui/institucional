import { describe, expect, it } from "vitest";
import { buildBadgeSnippets } from "./badge-snippet";

describe("buildBadgeSnippets", () => {
  it("gera Markdown com alt fixo e links públicos", () => {
    expect(buildBadgeSnippets("https://codaqui.dev", "endersonmenezes").markdown).toBe(
      "[![Selo Codaqui](https://codaqui.dev/badges/endersonmenezes.svg)](https://codaqui.dev/@endersonmenezes)",
    );
  });

  it("gera HTML sem interpolar o nome do membro", () => {
    expect(buildBadgeSnippets("https://codaqui.dev", "endersonmenezes").html).toBe(
      '<a href="https://codaqui.dev/@endersonmenezes"><img src="https://codaqui.dev/badges/endersonmenezes.svg" alt="Selo Codaqui"></a>',
    );
  });

  it("usa a origem local sem duplicar a barra", () => {
    expect(buildBadgeSnippets("http://localhost:3000/", "ana").markdown).toBe(
      "[![Selo Codaqui](http://localhost:3000/badges/ana.svg)](http://localhost:3000/@ana)",
    );
  });

  it("rejeita handle que poderia alterar URL ou markup", () => {
    expect(() => buildBadgeSnippets("https://codaqui.dev", 'ana"><script>')).toThrow(
      "Handle GitHub inválido.",
    );
  });
});

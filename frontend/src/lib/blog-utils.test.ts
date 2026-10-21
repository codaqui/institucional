import { describe, expect, it } from "vitest";
import {
  postUrl,
  postDate,
  resolveAuthors,
  readingTimeMinutes,
  plainExcerpt,
  contentAssetUrl,
  sortPostsDesc,
  postCardProps,
  collectByTag,
} from "./blog-utils";

describe("postUrl", () => {
  it("monta URL a partir do slug legado", () => {
    expect(postUrl({ data: { slug: "2024/07/22/meu-post" } })).toBe("/blog/2024/07/22/meu-post");
  });
});

describe("postDate", () => {
  it("usa a data do frontmatter quando presente", () => {
    const d = new Date("2026-03-30T00:00:00Z");
    expect(postDate({ id: "2020-01-01-x", data: { date: d } })).toBe(d);
  });
  it("cai na data do nome do arquivo quando ausente", () => {
    const d = postDate({ id: "2024-07-22-meu-post", data: {} });
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(22);
  });
  it("cai na data do slug quando o glob loader o usa como id", () => {
    const d = postDate({ id: "2022/10/14/hello-world", data: {} });
    expect(d.getFullYear()).toBe(2022);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(14);
  });
  it("lança erro para id fora do padrão sem data", () => {
    expect(() => postDate({ id: "sem-data", data: {} })).toThrow(/sem data/i);
  });
});

describe("resolveAuthors", () => {
  it("resolve chave do authors.yml", () => {
    const [a] = resolveAuthors(["endersonmenezes"]);
    expect(a.name).toBe("Enderson Menezes");
    expect(a.url).toBe("https://github.com/endersonmenezes");
  });
  it("mantém autor inline", () => {
    const [a] = resolveAuthors([{ name: "Fulana", url: "https://x.dev" }]);
    expect(a.name).toBe("Fulana");
  });
  it("chave desconhecida vira autor só com nome", () => {
    expect(resolveAuthors(["desconhecido"])[0]).toEqual({ name: "desconhecido" });
  });
});

describe("readingTimeMinutes", () => {
  it("300 palavras por minuto, mínimo 1", () => {
    expect(readingTimeMinutes("")).toBe(1);
    expect(readingTimeMinutes(Array(300).fill("palavra").join(" "))).toBe(1);
    expect(readingTimeMinutes(Array(301).fill("palavra").join(" "))).toBe(2);
  });
});

describe("plainExcerpt", () => {
  it("corta no marcador truncate", () => {
    expect(plainExcerpt("Resumo aqui.\n\n<!-- truncate -->\n\nResto do post")).toBe("Resumo aqui.");
  });
  it("corta no marcador truncate em formato MDX (cópias patchadas)", () => {
    expect(plainExcerpt("Resumo aqui.\n\n{/* truncate */}\n\nResto do post")).toBe("Resumo aqui.");
  });
  it("remove marcação markdown do texto", () => {
    expect(plainExcerpt("# Título\n\nTexto com **negrito** e [link](https://x.dev).", 200)).toBe(
      "Título Texto com negrito e link."
    );
  });
  it("trunca em palavra inteira com reticências", () => {
    const longo = Array(50).fill("palavra").join(" ");
    const out = plainExcerpt(longo, 40);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(41);
  });
});

describe("contentAssetUrl", () => {
  it("rewrites de blog", () => {
    expect(contentAssetUrl("./img/2022_10_14_hello_world/x.png")).toBe("/blog-assets/img/2022_10_14_hello_world/x.png");
    expect(contentAssetUrl("img/pasta/y.gif")).toBe("/blog-assets/img/pasta/y.gif");
  });
  it("rewrite de trilhas", () => {
    expect(contentAssetUrl("./assets/demo.webm")).toBe("/trilhas-assets/github/assets/demo.webm");
  });
});

describe("postCardProps", () => {
  it("monta props do card", () => {
    const card = postCardProps({
      id: "2024-07-22-x",
      body: "Resumo.\n\n<!-- truncate -->\n\nResto",
      data: { slug: "2024/07/22/x", title: "Título", tags: ["história"] },
    });
    expect(card.url).toBe("/blog/2024/07/22/x");
    expect(card.excerpt).toBe("Resumo.");
    expect(card.tags[0].url).toBe("/blog/category/historia");
  });
});

describe("collectByTag", () => {
  const post = (id: string, tags: string[]) => ({ id, data: { tags } });

  it("agrupa posts pelo slug da tag", () => {
    const posts = [post("a", ["comunidade"]), post("b", ["comunidade", "eventos"]), post("c", ["eventos"])];
    const byTag = collectByTag(posts);
    expect(byTag.get("comunidade")?.posts.map((p) => p.id)).toEqual(["a", "b"]);
    expect(byTag.get("eventos")?.posts.map((p) => p.id)).toEqual(["b", "c"]);
    expect(byTag.size).toBe(2);
  });

  it("mantém o label da primeira ocorrência quando labels distintos geram o mesmo slug", () => {
    const byTag = collectByTag([post("a", ["DevParaná"]), post("b", ["devparana"])]);
    expect(byTag.size).toBe(1);
    expect(byTag.get("devparana")?.label).toBe("DevParaná");
    expect(byTag.get("devparana")?.posts.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("retorna mapa vazio sem posts", () => {
    expect(collectByTag([]).size).toBe(0);
  });
});

describe("sortPostsDesc", () => {
  it("ordena por data efetiva desc", () => {
    const posts = [
      { id: "2022-01-01-a", data: {} },
      { id: "2024-01-01-b", data: {} },
      { id: "2023-01-01-c", data: {} },
    ];
    expect(sortPostsDesc(posts).map((p) => p.id)).toEqual(["2024-01-01-b", "2023-01-01-c", "2022-01-01-a"]);
  });
});

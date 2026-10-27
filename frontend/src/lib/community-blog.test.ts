import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Step 1 do blog das comunidades: o symlink
// src/content/community-blog/tisocial → comunidades/tisocial/blog carrega os
// 10 posts com os slugs legados e o frontmatter `authors: [tisocial]`
// preservado. Lê os arquivos pelo mesmo caminho que o glob loader usa, sem
// depender do astro:content (módulo virtual, indisponível no Vitest).
import {
  collectCommunityPostsByTag,
  communityPostDescription,
  communityPostUrl,
  communityTagUrl,
  groupCommunityPostsByYear,
  publishedCommunityPosts,
  sortCommunityPosts,
} from "./community-blog";

const CONTENT_DIR = fileURLToPath(
  new URL("../content/community-blog/tisocial", import.meta.url),
);

// Slugs observados no build Docusaurus de referência
// (build/comunidades/tisocial/blog/<slug>.html).
const EXPECTED_SLUGS = [
  "batalha-contra-o-frio-2025",
  "cestou-2025",
  "dia-das-criancas-2025",
  "dia-mundial-limpeza-2025",
  "level-up-careers-2025",
  "no-shave-november-2025",
  "pascoa-2025",
  "pascoa-2026",
  "pet-fevereiro-2026",
  "workshop-seguranca-digital-2025",
];

interface FrontmatterSample {
  slug: string;
  title: string;
  authors: string[];
  tags: string[];
  date: string;
}

/** Frontmatter mínimo (YAML flat) dos posts da T.I. Social. */
function readFrontmatter(file: string): FrontmatterSample {
  const raw = readFileSync(file, "utf8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error(`Frontmatter ausente em ${file}`);
  const fm = match[1];
  const scalar = (key: string) => fm.match(new RegExp(`^${key}:\\s*"?([^"\\n]+)"?\\s*$`, "m"))?.[1];
  const list = (key: string) =>
    fm.match(new RegExp(`^${key}:\\s*\\[([^\\]]*)\\]`, "m"))?.[1]?.split(",").map((s) => s.trim()) ?? [];
  return {
    slug: scalar("slug") ?? "",
    title: scalar("title") ?? "",
    authors: list("authors"),
    tags: list("tags"),
    date: scalar("date") ?? "",
  };
}

describe("communityBlog — carregamento do conteúdo (symlink tisocial)", () => {
  const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md")).sort();

  it("carrega os 10 posts do tisocial", () => {
    expect(files).toHaveLength(10);
  });

  it("preserva os slugs legados do frontmatter", () => {
    const slugs = files.map((f) => readFrontmatter(`${CONTENT_DIR}/${f}`).slug).sort();
    expect(slugs).toEqual(EXPECTED_SLUGS);
  });

  it("preserva authors: [tisocial] em todos os posts", () => {
    for (const f of files) {
      expect(readFrontmatter(`${CONTENT_DIR}/${f}`).authors).toEqual(["tisocial"]);
    }
  });
});

describe("community-blog helpers", () => {
  const post = (slug: string, date: string, tags: string[], body = "") => ({
    id: slug,
    body,
    data: { slug, title: slug, date: new Date(date), authors: ["tisocial"], tags },
  });
  const posts = publishedCommunityPosts(
    sortCommunityPosts([
      post("pascoa-2026", "2026-03-15", ["campanhas", "resultados"], "Abertura.\n\n## Resultados\n- 464 caixas"),
      post("pet-2026", "2026-02-15", ["campanhas", "pet"], "Pet abertura.\n\n## Detalhes\nração"),
      post("pascoa-2025", "2025-04-15", ["campanhas"], "Páscoa 2025.\n\n## Impacto"),
    ]),
  );

  it("ordena por data desc e monta URLs com basePath", () => {
    expect(posts.map((p) => p.data.slug)).toEqual(["pascoa-2026", "pet-2026", "pascoa-2025"]);
    expect(communityPostUrl(posts[0], "/comunidades/tisocial/blog")).toBe(
      "/comunidades/tisocial/blog/pascoa-2026",
    );
    expect(communityPostUrl(posts[0], "/blog")).toBe("/blog/pascoa-2026");
  });

  it("agrupa por ano (desc) para sidebar e arquivo", () => {
    const groups = groupCommunityPostsByYear(posts);
    expect(groups.map((g) => g.year)).toEqual([2026, 2025]);
    expect(groups[0].posts).toHaveLength(2);
  });

  it("coleta posts por tag com label preservado", () => {
    const byTag = collectCommunityPostsByTag(posts);
    expect(byTag.get("campanhas")?.posts).toHaveLength(3);
    expect(byTag.get("pet")?.label).toBe("pet");
    expect(communityTagUrl("campanhas", "/blog")).toBe("/blog/tags/campanhas");
  });

  it("descrição = primeiro parágrafo (antes do primeiro heading)", () => {
    expect(communityPostDescription(posts[0])).toBe("Abertura.");
  });

  it("exclui rascunhos (draft)", () => {
    const withDraft = publishedCommunityPosts([
      ...posts,
      { ...post("rascunho", "2026-01-01", []), data: { ...post("rascunho", "2026-01-01", []).data, draft: true } },
    ]);
    expect(withDraft.map((p) => p.data.slug)).not.toContain("rascunho");
  });
});

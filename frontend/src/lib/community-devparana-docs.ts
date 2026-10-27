import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  createMarkdownProcessor,
  parseFrontmatter,
} from "@astrojs/markdown-remark";
import { remarkContentAssets } from "./remark-content-assets";
import {
  normalizeRfcFrontmatter,
  type RfcFrontmatter,
} from "./community-devparana";

/**
 * Leitura em build time dos docs canônicos do DevParaná
 * (`comunidades/devparana/docs/`, READ-ONE — fonte também consumida pelo
 * site Docusaurus até a 0.6). O frontmatter é extraído com o parser oficial
 * do Astro (`@astrojs/markdown-remark`) e normalizado pelos helpers de
 * `community-devparana.ts`.
 *
 * Os arquivos `.mdx` dos RFCs não são compilados aqui: eles importam MUI e os
 * componentes React originais (`@site/...`), indisponíveis no app Astro. O
 * corpo dos RFCs é portado 1:1 para a rota `docs/[...slug].astro` (componentes
 * `Rfc*` em `src/components/astro/community/devparana/`); da fonte MDX se
 * extrai apenas o frontmatter (rfcId, status, authors, approvers, datas,
 * timeline), que é o dado canônico compartilhado com a listagem `/rfcs`.
 */

/** Slugs das rotas de docs geradas (1:1 com os arquivos fonte). */
export const DEVPARANA_DOC_SLUGS = [
  "index",
  "rfcs/projeto-embaixadores",
  "rfcs/devparana-na-estrada-2026",
] as const;

export type DevparanaDocSlug = (typeof DEVPARANA_DOC_SLUGS)[number];

function docsDirCandidates(): string[] {
  return [
    fileURLToPath(new URL("../../../comunidades/devparana/docs", import.meta.url)),
    resolve(process.cwd(), "..", "comunidades", "devparana", "docs"),
    resolve(process.cwd(), "comunidades", "devparana", "docs"),
  ];
}

/** Diretório canônico dos docs no repo (mesma estratégia de fallback de `events.ts`). */
export function devparanaDocsDir(): string {
  const dir = docsDirCandidates().find((p) => existsSync(p));
  if (!dir) {
    throw new Error(
      `Docs do DevParaná não encontrados. Tentados: ${docsDirCandidates().join(", ")}`,
    );
  }
  return dir;
}

export interface DevparanaDocIndex {
  /** Título do frontmatter (`title`), usado no <title> da página. */
  title: string;
  /** Corpo markdown renderizado para HTML (frontmatter removido). */
  html: string;
}

let processorPromise: ReturnType<typeof createMarkdownProcessor> | null = null;

/** Markdown→HTML com o mesmo remark pipeline do site (astro.config.mjs). */
function markdownProcessor() {
  processorPromise ??= createMarkdownProcessor({
    remarkPlugins: [remarkContentAssets],
  });
  return processorPromise;
}

/**
 * Página inicial da documentação (`docs/index.md`): título do frontmatter +
 * corpo como HTML. Links internos (`/comunidades/devparana/...`) ficam como
 * estão — no build tenant o `_redirects` resolve para a rota limpa.
 */
export async function loadDevparanaDocIndex(): Promise<DevparanaDocIndex> {
  const source = readFileSync(resolve(devparanaDocsDir(), "index.md"), "utf-8");
  const { frontmatter: parsed, content } = parseFrontmatter(source);
  const frontmatter = (parsed ?? {}) as Record<string, unknown>;
  const processor = await markdownProcessor();
  const { code } = await processor.render(content);
  return {
    title: typeof frontmatter.title === "string" ? frontmatter.title : "Docs",
    html: code,
  };
}

export interface DevparanaRfcDoc {
  /** Slug da rota (`rfcs/<slug do frontmatter>`). */
  slug: string;
  /** Caminho do arquivo-fonte relativo à raiz do repo (link "Editar"). */
  editPath: string;
  frontmatter: RfcFrontmatter;
}

/**
 * Frontmatters dos RFCs (`docs/rfcs/*.mdx`), na ordem alfabética dos arquivos
 * (001, 002, ...). Os slugs das rotas vêm do frontmatter `slug`, como no
 * plugin docs do Docusaurus.
 */
export function loadDevparanaRfcDocs(): DevparanaRfcDoc[] {
  const rfcsDir = resolve(devparanaDocsDir(), "rfcs");
  return readdirSync(rfcsDir)
    .filter((file) => file.endsWith(".mdx"))
    .sort()
    .map((file) => {
      const source = readFileSync(resolve(rfcsDir, file), "utf-8");
      const { frontmatter: parsed } = parseFrontmatter(source);
      const raw = (parsed ?? {}) as Record<string, unknown>;
      const frontmatter = normalizeRfcFrontmatter(raw);
      const slug =
        typeof raw.slug === "string" && raw.slug
          ? raw.slug
          : file.replace(/^\d+-/, "").replace(/\.mdx$/, "");
      return {
        slug: `rfcs/${slug}`,
        editPath: `comunidades/devparana/docs/rfcs/${file}`,
        frontmatter,
      };
    });
}

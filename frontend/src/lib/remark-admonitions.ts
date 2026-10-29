import type { Html, List, Parent, Root, RootContent, Text } from "mdast";

/**
 * Admonitions estilo Docusaurus (`:::info[Título]` … `:::`, 68 blocos nas
 * trilhas). As fontes canônicas (trilhas/*.md) NÃO são reescritas: este
 * transformer mdast converte os blocos em `<div class="admonition">` cru,
 * que o rehype-raw do Astro (allowDangerousHtml) transforma em elemento real.
 *
 * Semântica replicada do Docusaurus v2 (block tokenizer):
 * - `:::tipo[Título]` — o título fecha no PRIMEIRO `]` (page-9.md:168 tem
 *   backtick+`]` interno; o restante da linha é descartado). O título é
 *   extraído da linha BRUTA do fonte (position offset), preservando o que o
 *   parse inline consumiria (`__name__`, `\]`);
 * - `:::tipo Título em texto plano` — sem colchetes (trilhas/index.md);
 * - conteúdo interno continua parseado (headings, code, listas): os nós já
 *   parseados são movidos intocados; o conteúdo das linhas de fronteira
 *   (parágrafo de abertura e de fechamento) é fatiado do SOURCE BRUTO e
 *   re-parseado — idêntico ao tokenizeBlock do Docusaurus e imune ao
 *   markdown inline já consumido pelo parse (`**negrito**`, backticks que
 *   cruzam a fronteira título/conteúdo em page-9.md);
 * - `:::` de fechamento sozinho numa linha — inclusive grudado no último
 *   item de uma lista (sem blank line, o `:::` vira parte do item);
 * - sem fechamento → bloco inteiro fica literal (sinaliza bug de autoria em
 *   vez de engolir o documento).
 */

export const ADMONITION_TYPES = ["info", "note", "tip", "warning"] as const;

// Abertura parseada SEM regex super-linear (S8786): prefixo linear + string
// ops para o título. `CLOSING_LINE_RE`/`LIST_ITEM_CLOSE_RE` não têm
// quantificadores aninhados e seguem como regex.
const OPENING_PREFIX_RE = /^:::([A-Za-z]+)/;
const CLOSING_LINE_RE = /(?:^|\n):::[ \t]*(?=\n|$)/;
const LIST_ITEM_CLOSE_RE = /\n:::[ \t]*$/;

/** O processor do unified expõe `.parse()` — duck-typing para não depender do pacote `unified`. */
interface ParseCapable {
  parse(doc: string): Root;
}

interface Opening {
  type: string;
  title: string | null;
}

function parseOpening(line: string): Opening | null {
  const match = OPENING_PREFIX_RE.exec(line);
  if (!match) return null;
  const type = match[1].toLowerCase();
  if (!(ADMONITION_TYPES as readonly string[]).includes(type)) return null;
  const rest = line.slice(match[0].length);
  let title: string;
  if (rest.startsWith("[")) {
    // Título fecha no PRIMEIRO `]` (page-9.md:168 tem backtick+`]` interno);
    // depois do `]` só whitespace é aceito (a regex antiga exigia `\s*$`).
    const close = rest.indexOf("]");
    if (close === -1) return null;
    if (rest.slice(close + 1).trim() !== "") return null;
    title = rest.slice(1, close);
  } else {
    // Sem colchetes a regex antiga exigia ` +` (espaço) — `:::tip\tTítulo`
    // (tab) ficava literal; só `:::tip`/`:::tip texto` abrem bloco.
    if (rest !== "" && !rest.startsWith(" ")) return null;
    title = rest;
  }
  return { type, title: title.trim() || null };
}

/** Texto integral de um nó (folhas `value` concatenadas em ordem; os `\n` vivem nos text nodes). */
function nodeText(node: Parent): string {
  let out = "";
  const walk = (children: Parent["children"]): void => {
    for (const child of children) {
      if ("value" in child && typeof child.value === "string") out += child.value;
      if ("children" in child) walk(child.children as Parent["children"]);
    }
  };
  walk(node.children);
  return out;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function openHtml({ type, title }: Opening): Html {
  const titleHtml = title
    ? `<p class="admonition-title">${escapeHtml(title)}</p>`
    : "";
  return {
    type: "html",
    value: `<div class="admonition admonition-${type}">${titleHtml}`,
  };
}

function closeHtml(): Html {
  return { type: "html", value: "</div>" };
}

/** Procura `:::` de fechamento no texto e devolve os intervalos ao redor. */
function closingSpans(text: string): { beforeEnd: number; afterStart: number } | null {
  const match = CLOSING_LINE_RE.exec(text);
  if (!match) return null;
  const lineStart = match[0].startsWith("\n") ? match.index + 1 : match.index;
  return {
    beforeEnd: text[lineStart - 1] === "\n" ? lineStart - 1 : lineStart,
    afterStart: match.index + match[0].length,
  };
}

/** Remove um `:::` de fechamento grudado no fim do último item da lista. */
function findLastText(node: Parent): Text | null {
  let last: Text | null = null;
  const walk = (children: Parent["children"]): void => {
    for (const child of children) {
      if (child.type === "text") last = child as Text;
      if ("children" in child) walk(child.children as Parent["children"]);
    }
  };
  walk(node.children);
  return last;
}

function stripListItemClose(list: List): boolean {
  const lastItem = list.children[list.children.length - 1];
  if (!lastItem) return false;
  const lastText = findLastText(lastItem);
  if (!lastText || !LIST_ITEM_CLOSE_RE.test(lastText.value)) return false;
  lastText.value = lastText.value.replace(LIST_ITEM_CLOSE_RE, "");
  return true;
}

export function remarkAdmonitions(this: unknown) {
  const processor = this as ParseCapable;
  // Fonte bruta inteira do documento (positions dos nós apontam para ela).
  let source = "";
  const parseBlocks = (text: string): RootContent[] =>
    text.trim() ? (processor.parse(text).children as RootContent[]) : [];

  const rawOf = (node: RootContent): string => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    // Sem positions (não ocorre com remark-parse): degrada para o texto já parseado.
    return start === undefined || end === undefined ? nodeText(node as Parent) : source.slice(start, end);
  };

  /** Linha bruta de abertura do parágrafo (do source; fallback pro texto parseado). */
  const openingLineOf = (node: RootContent): string => {
    const start = node.position?.start.offset;
    if (start === undefined) return nodeText(node as Parent).split("\n", 1)[0];
    const lineEnd = source.indexOf("\n", start);
    const sliceEnd = lineEnd === -1 ? undefined : lineEnd;
    return source.slice(start, sliceEnd);
  };

  const openingOf = (node: RootContent): Opening | null => {
    // Children[0] como text garante que o fonte começa literalmente com
    // `:::` (protege `` `:::info` `` em inline code). Título da linha bruta.
    if (node.type !== "paragraph" || node.children[0]?.type !== "text") return null;
    return parseOpening(openingLineOf(node));
  };

  /**
   * Varre os nós irmãos após a abertura até o `:::` de fechamento, acumulando
   * o conteúdo. Devolve o texto à direita do fechamento e quantos nós foram
   * consumidos, ou `null` quando não há fechamento (não transforma).
   */
  const collectUntilClose = (
    children: RootContent[],
    start: number,
    content: RootContent[],
  ): { trailing: string; consumed: number } | null => {
    for (let j = start + 1; j < children.length; j++) {
      const node = children[j];
      if (node.type === "paragraph") {
        const nodeRaw = rawOf(node);
        const spans = closingSpans(nodeRaw);
        if (spans) {
          content.push(...parseBlocks(nodeRaw.slice(0, spans.beforeEnd)));
          return {
            trailing: nodeRaw.slice(spans.afterStart).replace(/^\n/, ""),
            consumed: j - start + 1,
          };
        }
      }
      content.push(node);
      if (node.type === "list" && stripListItemClose(node)) {
        return { trailing: "", consumed: j - start + 1 };
      }
    }
    return null; // sem `:::` de fechamento — não transforma
  };

  const buildAdmonition = (
    opening: Opening,
    content: RootContent[],
    trailing: string | null,
    consumed: number,
  ): { nodes: RootContent[]; consumed: number } => {
    const nodes: RootContent[] = [openHtml(opening), ...content, closeHtml()];
    if (trailing && trailing.trim() !== "") {
      nodes.push({
        type: "paragraph",
        children: [{ type: "text", value: trailing }],
      });
    }
    return { nodes, consumed };
  };

  const collect = (
    children: RootContent[],
    start: number,
    opening: Opening,
  ): { nodes: RootContent[]; consumed: number } | null => {
    const content: RootContent[] = [];
    const openingRaw = rawOf(children[start]);
    const firstLineEnd = openingRaw.indexOf("\n");
    let consumed = 1;
    let trailing: string | null = null;

    // Conteúdo que já vive no parágrafo de abertura (bloco de parágrafo único).
    const openingClose =
      firstLineEnd === -1 ? null : closingSpans(openingRaw.slice(firstLineEnd + 1));
    if (firstLineEnd !== -1) {
      const from = firstLineEnd + 1;
      const to = openingClose ? firstLineEnd + 1 + openingClose.beforeEnd : openingRaw.length;
      content.push(...parseBlocks(openingRaw.slice(from, to)));
    }

    if (openingClose) {
      trailing =
        openingRaw.slice(firstLineEnd + 1 + openingClose.afterStart).replace(/^\n/, "");
    } else {
      const closed = collectUntilClose(children, start, content);
      if (!closed) return null;
      trailing = closed.trailing;
      consumed = closed.consumed;
    }

    return buildAdmonition(opening, content, trailing, consumed);
  };

  const transform = (parent: Parent): void => {
    // Profundidade primeiro: containers originais (blockquote, listItem…).
    for (const child of parent.children) {
      if (Array.isArray((child as Parent).children)) transform(child as Parent);
    }
    const children = parent.children as RootContent[];
    let i = 0;
    while (i < children.length) {
      const opening = openingOf(children[i]);
      const result = opening && collect(children, i, opening);
      if (!result) {
        i++;
        continue;
      }
      children.splice(i, result.consumed, ...result.nodes);
      i += result.nodes.length;
    }
  };

  return (tree: Root, file: { toString(): string }) => {
    source = file.toString();
    transform(tree);
  };
}

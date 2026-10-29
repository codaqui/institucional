// Port de `src/components/MarkdownLite` (Docusaurus) — renderer markdown
// próprio, SEM dependências, com sanitização fail-safe: qualquer sintaxe fora
// do subconjunto abaixo é renderizada como texto literal.
import type { JSX, ReactNode } from "react";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";

interface MarkdownLiteProps {
  readonly text: string;
}

// Subconjunto seguro de markdown: parágrafos, quebras de linha, **negrito**,
// *itálico* / _itálico_, [links](http|https), listas "- " e títulos ## / ###.
// Qualquer outra sintaxe é renderizada como texto literal (fail-safe).

// O parsing inline é uma varredura por delimitadores (indexOf/slice) em vez de
// uma regex com alternância de quantificadores (Sonar S8786 — sem regex no hot
// path). Mantém a semântica do regex original: posição mais à esquerda e, nela,
// prioridade `**` > `*` > `_` > `[texto](url)`; conteúdos não podem conter o
// próprio delimitador e o URL corta no primeiro `)` sem whitespace.
const SAFE_URL_RE = /^https?:\/\/\S+$/i;

type InlineToken =
  | { kind: "bold"; content: string; end: number }
  | { kind: "em"; content: string; end: number }
  | { kind: "link"; label: string; url: string; end: number };

/** Tenta casar um token inline em `line[i]`; retorna null se não houver match. */
function parseInlineAt(line: string, i: number): InlineToken | null {
  const ch = line[i];
  if (ch === "*") {
    if (line[i + 1] === "*") {
      // **negrito**: fecha no primeiro `**`; um `*` solto antes dele impede o
      // match (`[^*]+` não cruza o delimitador), como no regex original.
      const close = line.indexOf("*", i + 2);
      if (close !== -1 && close > i + 2 && line[close + 1] === "*") {
        return { kind: "bold", content: line.slice(i + 2, close), end: close + 2 };
      }
      return null;
    }
    const close = line.indexOf("*", i + 1);
    if (close !== -1 && close > i + 1) {
      return { kind: "em", content: line.slice(i + 1, close), end: close + 1 };
    }
    return null;
  }
  if (ch === "_") {
    const close = line.indexOf("_", i + 1);
    if (close !== -1 && close > i + 1) {
      return { kind: "em", content: line.slice(i + 1, close), end: close + 1 };
    }
    return null;
  }
  if (ch === "[") {
    const bracketClose = line.indexOf("]", i + 1);
    if (bracketClose === -1 || bracketClose === i + 1) return null; // rótulo 1+
    if (line[bracketClose + 1] !== "(") return null;
    const parenClose = line.indexOf(")", bracketClose + 2);
    if (parenClose === -1 || parenClose === bracketClose + 2) return null; // URL 1+
    const url = line.slice(bracketClose + 2, parenClose);
    if (/\s/.test(url)) return null; // classe [^)\s] do regex original
    return {
      kind: "link",
      label: line.slice(i + 1, bracketClose),
      url,
      end: parenClose + 1,
    };
  }
  return null;
}

function renderInline(line: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let textStart = 0;
  let i = 0;

  while (i < line.length) {
    const token = parseInlineAt(line, i);
    if (token === null) {
      i += 1;
      continue;
    }
    if (i > textStart) {
      nodes.push(line.slice(textStart, i));
    }
    const key = `${keyPrefix}-${i}`;
    if (token.kind === "bold") {
      nodes.push(<strong key={key}>{token.content}</strong>);
    } else if (token.kind === "em") {
      nodes.push(<em key={key}>{token.content}</em>);
    } else if (SAFE_URL_RE.test(token.url)) {
      nodes.push(
        <Link
          key={key}
          href={token.url}
          target="_blank"
          rel="noopener noreferrer"
          color="primary"
        >
          {token.label}
        </Link>,
      );
    } else {
      // URL fora do subconjunto seguro: a sintaxe inteira vira texto literal.
      nodes.push(line.slice(i, token.end));
    }
    i = token.end;
    textStart = i;
  }

  if (textStart < line.length) {
    nodes.push(line.slice(textStart));
  }
  return nodes;
}

function renderParagraph(block: string, key: string): JSX.Element {
  const lines = block.split("\n");
  return (
    <Typography
      key={key}
      variant="body1"
      component="p"
      sx={{ mb: 1.5, "&:last-child": { mb: 0 } }}
    >
      {lines.flatMap((line, i) => [
        ...(i > 0 ? [<br key={`${key}-br-${i}`} />] : []),
        ...renderInline(line, `${key}-l${i}`),
      ])}
    </Typography>
  );
}

function renderBlock(block: string, index: number): JSX.Element {
  const key = `b${index}`;
  const lines = block.split("\n");

  if (lines.every((line) => line.startsWith("- "))) {
    return (
      <Box
        key={key}
        component="ul"
        sx={{ pl: 3, my: 0, mb: 1.5, "&:last-child": { mb: 0 } }}
      >
        {lines.map((line, i) => (
          <Box key={`${key}-li-${i}`} component="li" sx={{ mb: 0.5 }}>
            {renderInline(line.slice(2), `${key}-li-${i}`)}
          </Box>
        ))}
      </Box>
    );
  }

  if (lines.length === 1 && block.startsWith("### ")) {
    return (
      <Typography
        key={key}
        variant="subtitle1"
        component="h3"
        sx={{ mb: 1.5, fontWeight: 700, "&:last-child": { mb: 0 } }}
      >
        {renderInline(block.slice(4), key)}
      </Typography>
    );
  }

  if (lines.length === 1 && block.startsWith("## ")) {
    return (
      <Typography
        key={key}
        variant="h6"
        component="h2"
        sx={{ mb: 1.5, "&:last-child": { mb: 0 } }}
      >
        {renderInline(block.slice(3), key)}
      </Typography>
    );
  }

  return renderParagraph(block, key);
}

export default function MarkdownLite({
  text,
}: Readonly<MarkdownLiteProps>): JSX.Element {
  const blocks = text.split(/\n{2,}/).filter((block) => block.trim().length > 0);
  return (
    <Box sx={{ color: "text.secondary" }}>
      {blocks.map((block, index) => renderBlock(block, index))}
    </Box>
  );
}

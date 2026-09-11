import React from "react";
import { Box, Link as MuiLink, Typography } from "@mui/material";

interface MarkdownLiteProps {
  text: string;
}

// Subconjunto seguro de markdown: parágrafos, quebras de linha, **negrito**,
// *itálico* / _itálico_, [links](http|https), listas "- " e títulos ## / ###.
// Qualquer outra sintaxe é renderizada como texto literal (fail-safe).

const SAFE_URL_RE = /^https?:\/\/\S+$/i;
const INLINE_RE =
  /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(_([^_]+)_)|(\[([^\]]+)\]\(([^)\s]+)\))/g;

function renderInline(line: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;

  while ((match = INLINE_RE.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(line.slice(lastIndex, match.index));
    }
    const key = `${keyPrefix}-${match.index}`;
    if (match[1] !== undefined) {
      nodes.push(<strong key={key}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      nodes.push(<em key={key}>{match[4]}</em>);
    } else if (match[5] !== undefined) {
      nodes.push(<em key={key}>{match[6]}</em>);
    } else if (match[7] !== undefined) {
      const url = match[9];
      if (SAFE_URL_RE.test(url)) {
        nodes.push(
          <MuiLink
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            color="primary"
          >
            {match[8]}
          </MuiLink>,
        );
      } else {
        nodes.push(match[7]);
      }
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    nodes.push(line.slice(lastIndex));
  }
  return nodes;
}

function renderParagraph(block: string, key: string): React.JSX.Element {
  const lines = block.split("\n");
  return (
    <Typography key={key} variant="body1" component="p" sx={{ mb: 1.5, "&:last-child": { mb: 0 } }}>
      {lines.flatMap((line, i) => [
        ...(i > 0 ? [<br key={`${key}-br-${i}`} />] : []),
        ...renderInline(line, `${key}-l${i}`),
      ])}
    </Typography>
  );
}

function renderBlock(block: string, index: number): React.JSX.Element {
  const key = `b${index}`;
  const lines = block.split("\n");

  if (lines.every((line) => line.startsWith("- "))) {
    return (
      <Box key={key} component="ul" sx={{ pl: 3, my: 0, mb: 1.5, "&:last-child": { mb: 0 } }}>
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
      <Typography key={key} variant="subtitle1" fontWeight={700} component="h3" sx={{ mb: 1.5, "&:last-child": { mb: 0 } }}>
        {renderInline(block.slice(4), key)}
      </Typography>
    );
  }

  if (lines.length === 1 && block.startsWith("## ")) {
    return (
      <Typography key={key} variant="h6" component="h2" sx={{ mb: 1.5, "&:last-child": { mb: 0 } }}>
        {renderInline(block.slice(3), key)}
      </Typography>
    );
  }

  return renderParagraph(block, key);
}

export default function MarkdownLite({ text }: Readonly<MarkdownLiteProps>): React.JSX.Element {
  const blocks = text.split(/\n{2,}/).filter((block) => block.trim().length > 0);
  return (
    <Box sx={{ color: "text.secondary" }}>
      {blocks.map((block, index) => renderBlock(block, index))}
    </Box>
  );
}

/**
 * Mini-editor de markdown para a descrição do evento (Escrever /
 * Pré-visualizar com toolbar de sintaxe). Port de
 * `src/pages/admin/eventos.tsx` (Docusaurus) — preview via `MarkdownLite`.
 */

import { useCallback, useRef, useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import LinkIcon from "@mui/icons-material/Link";
import TitleIcon from "@mui/icons-material/Title";
import MarkdownLite from "../events/MarkdownLite";

type MarkdownWrapAction = { prefix: string; suffix: string; placeholder: string };

function applyMarkdownWrap(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  action: MarkdownWrapAction,
): { next: string; cursorStart: number; cursorEnd: number } {
  const selected = value.slice(selectionStart, selectionEnd) || action.placeholder;
  const next =
    value.slice(0, selectionStart) +
    action.prefix +
    selected +
    action.suffix +
    value.slice(selectionEnd);
  const cursorStart = selectionStart + action.prefix.length;
  return { next, cursorStart, cursorEnd: cursorStart + selected.length };
}

const MARKDOWN_ACTIONS = {
  bold: { prefix: "**", suffix: "**", placeholder: "texto em negrito" },
  italic: { prefix: "*", suffix: "*", placeholder: "texto em itálico" },
  link: { prefix: "[", suffix: "](https://exemplo.com)", placeholder: "texto do link" },
  list: { prefix: "- ", suffix: "", placeholder: "item da lista" },
  heading: { prefix: "## ", suffix: "", placeholder: "Título da seção" },
} satisfies Record<string, MarkdownWrapAction>;

export default function DescriptionMarkdownEditor({
  value,
  onChange,
}: Readonly<{ value: string; onChange: (next: string) => void }>): React.JSX.Element {
  const [tab, setTab] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const applyAction = useCallback(
    (action: MarkdownWrapAction) => {
      const el = textareaRef.current;
      const start = el?.selectionStart ?? value.length;
      const end = el?.selectionEnd ?? value.length;
      const { next, cursorStart, cursorEnd } = applyMarkdownWrap(value, start, end, action);
      onChange(next);
      if (el) {
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(cursorStart, cursorEnd);
        });
      }
    },
    [value, onChange],
  );

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1, minHeight: 36 }}>
        <Tab label="Escrever" sx={{ minHeight: 36, py: 0.5, textTransform: "none" }} />
        <Tab label="Pré-visualizar" sx={{ minHeight: 36, py: 0.5, textTransform: "none" }} />
      </Tabs>
      {tab === 0 ? (
        <>
          <Stack direction="row" spacing={0.5} sx={{ mb: 1 }}>
            <Tooltip title="Negrito">
              <IconButton
                size="small"
                aria-label="negrito"
                onClick={() => applyAction(MARKDOWN_ACTIONS.bold)}
              >
                <FormatBoldIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Itálico">
              <IconButton
                size="small"
                aria-label="itálico"
                onClick={() => applyAction(MARKDOWN_ACTIONS.italic)}
              >
                <FormatItalicIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Link">
              <IconButton
                size="small"
                aria-label="inserir link"
                onClick={() => applyAction(MARKDOWN_ACTIONS.link)}
              >
                <LinkIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Lista">
              <IconButton
                size="small"
                aria-label="lista"
                onClick={() => applyAction(MARKDOWN_ACTIONS.list)}
              >
                <FormatListBulletedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Título">
              <IconButton
                size="small"
                aria-label="título"
                onClick={() => applyAction(MARKDOWN_ACTIONS.heading)}
              >
                <TitleIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <TextField
            label="Descrição (opcional)"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            size="small"
            fullWidth
            multiline
            minRows={6}
            inputRef={textareaRef}
          />
        </>
      ) : (
        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            p: 2,
            minHeight: 140,
          }}
        >
          {value.trim() ? (
            <MarkdownLite text={value} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Nada para pré-visualizar.
            </Typography>
          )}
        </Box>
      )}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 0.5 }}
      >
        Texto longo exibido na página pública do evento. Suporta **negrito**, *itálico*,
        [links](https://…), listas e títulos ##.
      </Typography>
    </Box>
  );
}

// Controles de paginação reutilizáveis (SET padronizado) — botões
// primeira/anterior/janela de páginas/próxima/última. Qualquer listagem
// paginada deve usar este componente + os helpers de src/lib/pagination.ts.
import React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import FirstPageIcon from "@mui/icons-material/FirstPage";
import LastPageIcon from "@mui/icons-material/LastPage";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { pageWindow } from "../../../lib/pagination";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  /** Rótulo do item para aria-label contextual (ex: "página de membros"). */
  itemLabel?: string;
}

export default function PaginationControls({
  page,
  totalPages,
  onChange,
  itemLabel = "resultados",
}: Readonly<PaginationControlsProps>): React.JSX.Element | null {
  if (totalPages <= 1) return null;

  const clamped = Math.min(Math.max(1, page), totalPages);
  const window = pageWindow(clamped, totalPages);

  return (
    <Stack
      component="nav"
      aria-label={`Paginação de ${itemLabel}`}
      direction="row"
      spacing={0.5}
      useFlexGap
      sx={{ flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}
    >
      <IconButton
        aria-label="Primeira página"
        size="small"
        disabled={clamped <= 1}
        onClick={() => onChange(1)}
      >
        <FirstPageIcon fontSize="small" />
      </IconButton>
      <IconButton
        aria-label="Página anterior"
        size="small"
        disabled={clamped <= 1}
        onClick={() => onChange(clamped - 1)}
      >
        <ChevronLeftIcon fontSize="small" />
      </IconButton>

      <Box component="span" sx={{ display: "inline-flex", gap: 0.5, mx: 0.5 }}>
        {window.map((p) => (
          <Button
            key={p}
            size="small"
            variant={p === clamped ? "contained" : "outlined"}
            aria-label={`Ir para a página ${p} de ${totalPages}`}
            aria-current={p === clamped ? "page" : undefined}
            onClick={() => onChange(p)}
            sx={{ minWidth: 36 }}
          >
            {p}
          </Button>
        ))}
      </Box>

      <IconButton
        aria-label="Próxima página"
        size="small"
        disabled={clamped >= totalPages}
        onClick={() => onChange(clamped + 1)}
      >
        <ChevronRightIcon fontSize="small" />
      </IconButton>
      <IconButton
        aria-label="Última página"
        size="small"
        disabled={clamped >= totalPages}
        onClick={() => onChange(totalPages)}
      >
        <LastPageIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

/**
 * Port de `ExternalEventAutocomplete` (embutido em `src/pages/admin/overrides`)
 * — seletor de evento externo usado nas abas 1 e 3.
 */
import { useMemo, useState } from "react";
import type { JSX } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { formatEventDate, type EventSummary } from "./shared";

const EVENT_SEARCH_MAX_RESULTS = 30;
const EVENT_DEFAULT_OPTIONS = 10;

interface ExternalEventAutocompleteProps {
  readonly events: EventSummary[];
  readonly sourceLabel: (sourceKey: string) => string;
  readonly value: EventSummary | null;
  readonly onChange: (event: EventSummary | null) => void;
}

export default function ExternalEventAutocomplete({
  events,
  sourceLabel,
  value,
  onChange,
}: ExternalEventAutocompleteProps): JSX.Element {
  const [inputValue, setInputValue] = useState("");

  const options = useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    let filtered: EventSummary[];
    if (q.length < 2) {
      // Sem busca: apenas os próximos eventos futuros (mais próximos primeiro).
      filtered = events
        .filter((e) => e.status !== "completed")
        .sort((a, b) => a.startAt.localeCompare(b.startAt))
        .slice(0, EVENT_DEFAULT_OPTIONS);
    } else {
      // Busca por título, fonte ou local — mais recentes primeiro, com cap.
      filtered = events
        .filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            (e.location ?? "").toLowerCase().includes(q) ||
            sourceLabel(e.sourceKey).toLowerCase().includes(q) ||
            e.sourceKey.toLowerCase().includes(q),
        )
        .sort((a, b) => b.startAt.localeCompare(a.startAt))
        .slice(0, EVENT_SEARCH_MAX_RESULTS);
    }
    // Mantém o valor selecionado nas opções mesmo fora do filtro atual.
    if (value && !filtered.some((e) => e.sourceKey === value.sourceKey && e.id === value.id)) {
      filtered = [value, ...filtered];
    }
    return filtered;
  }, [events, inputValue, value, sourceLabel]);

  return (
    <Autocomplete
      options={options}
      value={value}
      inputValue={inputValue}
      onInputChange={(_, v, reason) => {
        if (reason === "input") setInputValue(v);
      }}
      onChange={(_, v) => onChange(v)}
      filterOptions={(x) => x}
      groupBy={(option) => sourceLabel(option.sourceKey)}
      getOptionLabel={(option) => option.title}
      isOptionEqualToValue={(a, b) => a.sourceKey === b.sourceKey && a.id === b.id}
      noOptionsText={
        inputValue.trim().length < 2
          ? "Digite para buscar por título, fonte ou local"
          : "Nenhum evento encontrado"
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label="Evento externo"
          placeholder="Digite para buscar por título, fonte ou local..."
        />
      )}
      renderOption={(props, option) => {
        const { key, ...liProps } = props;
        return (
          <li key={key} {...liProps}>
            <Box sx={{ display: "flex", flexDirection: "column" }}>
              <Typography variant="body2">{option.title}</Typography>
              <Typography variant="caption" color="text.secondary">
                {sourceLabel(option.sourceKey)} · {formatEventDate(option.startAt)}
              </Typography>
            </Box>
          </li>
        );
      }}
    />
  );
}

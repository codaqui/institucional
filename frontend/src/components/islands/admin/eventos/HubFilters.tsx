/**
 * Busca e chips de filtro da lista unificada do hub.
 * Port de `src/pages/admin/eventos.tsx` (Docusaurus).
 */

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { COMMUNITY_OPTIONS } from "./types";

interface HubFiltersProps {
  search: string;
  showInternos: boolean;
  showExternos: boolean;
  onlyOverride: boolean;
  onlyEditable: boolean;
  onlyFeatures: boolean;
  communityFilter: string;
  onSearchChange: (value: string) => void;
  onToggleInternos: () => void;
  onToggleExternos: () => void;
  onToggleOverride: () => void;
  onToggleEditable: () => void;
  onToggleFeatures: () => void;
  onCommunityChange: (value: string) => void;
}

export default function HubFilters({
  search,
  showInternos,
  showExternos,
  onlyOverride,
  onlyEditable,
  onlyFeatures,
  communityFilter,
  onSearchChange,
  onToggleInternos,
  onToggleExternos,
  onToggleOverride,
  onToggleEditable,
  onToggleFeatures,
  onCommunityChange,
}: Readonly<HubFiltersProps>): React.JSX.Element {
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent sx={{ pb: "16px !important" }}>
        <TextField
          size="small"
          fullWidth
          label="Buscar por título"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          sx={{ mb: 1.5 }}
        />
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ flexWrap: "wrap", alignItems: "center" }}
        >
          <Chip
            label="Internos"
            clickable
            color={showInternos ? "primary" : "default"}
            variant={showInternos ? "filled" : "outlined"}
            onClick={onToggleInternos}
          />
          <Chip
            label="Externos"
            clickable
            color={showExternos ? "primary" : "default"}
            variant={showExternos ? "filled" : "outlined"}
            onClick={onToggleExternos}
          />
          <Chip
            label="Com override"
            clickable
            color={onlyOverride ? "primary" : "default"}
            variant={onlyOverride ? "filled" : "outlined"}
            onClick={onToggleOverride}
          />
          <Chip
            label="Posso editar"
            clickable
            color={onlyEditable ? "primary" : "default"}
            variant={onlyEditable ? "filled" : "outlined"}
            onClick={onToggleEditable}
          />
          <Chip
            label="Com features ativas"
            clickable
            color={onlyFeatures ? "primary" : "default"}
            variant={onlyFeatures ? "filled" : "outlined"}
            onClick={onToggleFeatures}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="community-filter-label">Comunidade</InputLabel>
            <Select
              labelId="community-filter-label"
              value={communityFilter}
              label="Comunidade"
              onChange={(e) => onCommunityChange(e.target.value)}
            >
              <MenuItem value="">Todas</MenuItem>
              {COMMUNITY_OPTIONS.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </CardContent>
    </Card>
  );
}

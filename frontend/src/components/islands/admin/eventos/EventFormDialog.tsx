/**
 * Dialog de criar/editar evento interno (managed). Port de
 * `src/pages/admin/eventos.tsx` (Docusaurus) — com o mini-editor de
 * descrição em markdown; MUI v9 (`slotProps.inputLabel`).
 */

import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import DescriptionMarkdownEditor from "./DescriptionMarkdownEditor";
import {
  COMMUNITY_OPTIONS,
  TIMEZONE_OPTIONS,
  type EventDialogState,
  type EventForm,
} from "./types";

interface EventFormDialogProps {
  eventDialog: EventDialogState;
  onClose: () => void;
  eventForm: EventForm;
  setEventForm: React.Dispatch<React.SetStateAction<EventForm>>;
  eventSaving: boolean;
  eventError: string;
  onSave: () => Promise<void>;
}

export default function EventFormDialog({
  eventDialog,
  onClose,
  eventForm,
  setEventForm,
  eventSaving,
  eventError,
  onSave,
}: Readonly<EventFormDialogProps>): React.JSX.Element {
  const theme = useTheme();
  const eventDialogFullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Dialog
      open={!!eventDialog}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={eventDialogFullScreen}
    >
      <DialogTitle>
        {eventDialog?.mode === "edit"
          ? `Editar evento — ${eventDialog.event.title}`
          : "Novo evento"}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Slug"
            value={eventForm.slug}
            onChange={(e) => setEventForm((f) => ({ ...f, slug: e.target.value }))}
            size="small"
            fullWidth
            required
            disabled={eventDialog?.mode === "edit"}
            helperText={
              eventDialog?.mode === "edit"
                ? "O slug não pode ser alterado após a criação."
                : "Identificador único usado nas URLs (ex.: devpr-conf-2026)"
            }
          />
          <TextField
            label="Título"
            value={eventForm.title}
            onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
            size="small"
            fullWidth
            required
          />
          <TextField
            label="Resumo"
            value={eventForm.summary}
            onChange={(e) => setEventForm((f) => ({ ...f, summary: e.target.value }))}
            size="small"
            fullWidth
            required
            multiline
            minRows={2}
          />
          <DescriptionMarkdownEditor
            value={eventForm.description}
            onChange={(next) => setEventForm((f) => ({ ...f, description: next }))}
          />
          <TextField
            label="URL da imagem (opcional)"
            value={eventForm.imageUrl}
            onChange={(e) => setEventForm((f) => ({ ...f, imageUrl: e.target.value }))}
            size="small"
            fullWidth
          />
          <TextField
            label="Local"
            value={eventForm.location}
            onChange={(e) => setEventForm((f) => ({ ...f, location: e.target.value }))}
            size="small"
            fullWidth
            required
          />
          <TextField
            label="Início"
            type="datetime-local"
            value={eventForm.startAt}
            onChange={(e) => setEventForm((f) => ({ ...f, startAt: e.target.value }))}
            size="small"
            fullWidth
            required
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Fim (opcional)"
            type="datetime-local"
            value={eventForm.endAt}
            onChange={(e) => setEventForm((f) => ({ ...f, endAt: e.target.value }))}
            size="small"
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Autocomplete
            freeSolo
            options={TIMEZONE_OPTIONS}
            value={eventForm.timezone}
            onChange={(_, value) => setEventForm((f) => ({ ...f, timezone: value ?? "" }))}
            onInputChange={(_, value) => setEventForm((f) => ({ ...f, timezone: value }))}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Fuso horário"
                size="small"
                helperText="Padrão: America/Sao_Paulo"
              />
            )}
          />
          <FormControl size="small" fullWidth>
            <InputLabel id="event-community-label">Comunidade</InputLabel>
            <Select
              labelId="event-community-label"
              label="Comunidade"
              value={eventForm.communityProjectKey}
              onChange={(e) =>
                setEventForm((f) => ({ ...f, communityProjectKey: e.target.value }))
              }
            >
              {COMMUNITY_OPTIONS.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Capacidade (opcional)"
            value={eventForm.capacity}
            onChange={(e) => setEventForm((f) => ({ ...f, capacity: e.target.value }))}
            size="small"
            fullWidth
            slotProps={{ htmlInput: { inputMode: "numeric" } }}
          />
          <TextField
            label="Carga horária em minutos (opcional)"
            value={eventForm.workloadMinutes}
            onChange={(e) =>
              setEventForm((f) => ({
                ...f,
                workloadMinutes: e.target.value.replace(/[^\d]/g, ""),
              }))
            }
            size="small"
            fullWidth
            slotProps={{ htmlInput: { inputMode: "numeric" } }}
            helperText="0–1000. Deixe em branco para calcular automaticamente pela duração do evento (início → fim) — usado nos certificados."
          />
          {eventError && <Alert severity="error">{eventError}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={eventSaving}>
          Voltar
        </Button>
        <Button
          variant="contained"
          onClick={onSave}
          disabled={eventSaving}
          startIcon={eventSaving ? <CircularProgress size={14} /> : undefined}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

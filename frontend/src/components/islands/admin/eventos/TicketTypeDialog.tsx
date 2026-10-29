/**
 * Dialog de criar/editar tipo de ingresso. Port de
 * `src/pages/admin/eventos.tsx` (Docusaurus) — MUI v9
 * (`slotProps.inputLabel`, `slotProps.htmlInput`).
 */

import Alert from "@mui/material/Alert";
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
import { KIND_LABEL, type TicketDialogState, type TicketForm, type TicketKind } from "./types";

interface TicketTypeDialogProps {
  ticketDialog: TicketDialogState;
  onClose: () => void;
  ticketForm: TicketForm;
  setTicketForm: React.Dispatch<React.SetStateAction<TicketForm>>;
  ticketSaving: boolean;
  ticketError: string;
  onSave: () => Promise<void>;
}

export default function TicketTypeDialog({
  ticketDialog,
  onClose,
  ticketForm,
  setTicketForm,
  ticketSaving,
  ticketError,
  onSave,
}: Readonly<TicketTypeDialogProps>): React.JSX.Element {
  return (
    <Dialog open={!!ticketDialog} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {ticketDialog?.mode === "edit"
          ? "Editar tipo de ingresso"
          : `Novo tipo de ingresso — ${ticketDialog?.event.title ?? ""}`}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Nome"
            value={ticketForm.name}
            onChange={(e) => setTicketForm((f) => ({ ...f, name: e.target.value }))}
            size="small"
            fullWidth
            required
            helperText='Ex.: "Lote 1 — Early bird", "Comunitário"'
          />
          <FormControl size="small" fullWidth>
            <InputLabel id="ticket-kind-label">Tipo</InputLabel>
            <Select
              labelId="ticket-kind-label"
              label="Tipo"
              value={ticketForm.kind}
              disabled={ticketDialog?.mode === "edit"}
              onChange={(e) =>
                setTicketForm((f) => ({ ...f, kind: e.target.value as TicketKind }))
              }
            >
              {(Object.keys(KIND_LABEL) as TicketKind[]).map((kind) => (
                <MenuItem key={kind} value={kind}>
                  {KIND_LABEL[kind]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Preço (R$)"
            value={ticketForm.price}
            onChange={(e) => setTicketForm((f) => ({ ...f, price: e.target.value }))}
            size="small"
            fullWidth
            slotProps={{ htmlInput: { inputMode: "decimal" } }}
            helperText="Deixe em branco ou 0 para gratuito"
            disabled={ticketForm.kind === "free"}
          />
          <TextField
            label="Quantidade total"
            value={ticketForm.quantityTotal}
            onChange={(e) => setTicketForm((f) => ({ ...f, quantityTotal: e.target.value }))}
            size="small"
            fullWidth
            required
            slotProps={{ htmlInput: { inputMode: "numeric" } }}
          />
          <TextField
            label="Início das vendas (opcional)"
            type="datetime-local"
            value={ticketForm.salesStartAt}
            onChange={(e) => setTicketForm((f) => ({ ...f, salesStartAt: e.target.value }))}
            size="small"
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Fim das vendas (opcional)"
            type="datetime-local"
            value={ticketForm.salesEndAt}
            onChange={(e) => setTicketForm((f) => ({ ...f, salesEndAt: e.target.value }))}
            size="small"
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Máx. por pedido (opcional)"
            value={ticketForm.maxPerOrder}
            onChange={(e) => setTicketForm((f) => ({ ...f, maxPerOrder: e.target.value }))}
            size="small"
            fullWidth
            slotProps={{ htmlInput: { inputMode: "numeric" } }}
            helperText="Padrão do backend: 4"
          />
          {ticketError && <Alert severity="error">{ticketError}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={ticketSaving}>
          Voltar
        </Button>
        <Button
          variant="contained"
          onClick={onSave}
          disabled={ticketSaving}
          startIcon={ticketSaving ? <CircularProgress size={14} /> : undefined}
        >
          {ticketDialog?.mode === "edit" ? "Salvar" : "Criar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

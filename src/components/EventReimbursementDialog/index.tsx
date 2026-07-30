import React, { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { parseAuthJson, extractErrorMessage } from "../../hooks/authFetchHelpers";

interface CommunityBalance {
  id: string;
  projectKey: string;
  name: string;
  balance: number;
}

interface EventReimbursementDialogProps {
  open: boolean;
  onClose: () => void;
  apiUrl: string;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
  title: string;
  /** Para eventos internos: eventId. Para externos: deixe undefined e passe eventKey. */
  eventId?: string;
  /** Para eventos externos: eventKey (source:sourceId:eventId). */
  eventKey?: string;
  /** communityProjectKey sugerida — pré-seleciona a conta correspondente quando encontrada. */
  communityProjectKey?: string;
  onCreated?: () => void;
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function EventReimbursementDialog({
  open,
  onClose,
  apiUrl,
  authFetch,
  title,
  eventId,
  eventKey,
  communityProjectKey,
  onCreated,
}: EventReimbursementDialogProps): React.JSX.Element {
  const [balances, setBalances] = useState<CommunityBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoadError("");
    setBalancesLoading(true);
    fetch(`${apiUrl}/ledger/community-balances`)
      .then(async (res) => {
        const data = await parseAuthJson<CommunityBalance[]>(res, setLoadError);
        setBalances(Array.isArray(data) ? data : []);
      })
      .catch(() => setLoadError("Erro ao carregar contas."))
      .finally(() => setBalancesLoading(false));
  }, [open, apiUrl]);

  useEffect(() => {
    if (!open) {
      setAccountId("");
      setAmount("");
      setDescription("");
      setReceiptUrl("");
      setError("");
      setSuccess("");
      return;
    }
    if (communityProjectKey && balances.length > 0 && !accountId) {
      const match = balances.find((b) => b.projectKey === communityProjectKey);
      if (match) setAccountId(match.id);
    }
  }, [open, communityProjectKey, balances, accountId]);

  const selectedBalance = useMemo(
    () => balances.find((b) => b.id === accountId)?.balance ?? null,
    [balances, accountId]
  );

  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    if (!accountId) {
      setError("Selecione a conta da comunidade.");
      return;
    }
    const amountValue = Number.parseFloat(amount.replace(",", "."));
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    if (!description.trim()) {
      setError("Informe a descrição da despesa.");
      return;
    }
    if (!receiptUrl.trim()) {
      setError("Informe o link do comprovante.");
      return;
    }

    const endpoint = eventId
      ? `${apiUrl}/events/${eventId}/reimbursements`
      : `${apiUrl}/events/external/${encodeURIComponent(eventKey ?? "")}/reimbursements`;

    setSaving(true);
    try {
      const res = await authFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          accountId,
          amount: amountValue,
          description: description.trim(),
          receiptUrl: receiptUrl.trim(),
        }),
      });
      if (!res.ok) {
        setError(await extractErrorMessage(res, "Erro ao lançar despesa."));
        return;
      }
      const data = (await res.json()) as { id: string; status: string };
      setSuccess(`Despesa lançada. Solicitação #${data.id.slice(0, 8)} — status: ${data.status}.`);
      setTimeout(() => {
        onClose();
        onCreated?.();
      }, 1200);
    } catch {
      setError("Erro inesperado ao lançar despesa.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Lançar despesa — {title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {loadError && <Alert severity="error">{loadError}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}

          <FormControl size="small" fullWidth disabled={balancesLoading}>
            <InputLabel id="event-reimbursement-account-label">Conta da comunidade</InputLabel>
            <Select
              labelId="event-reimbursement-account-label"
              label="Conta da comunidade"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {balances.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.name} ({formatBRL(b.balance)})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedBalance !== null && (
            <Typography variant="caption" color="text.secondary">
              Saldo disponível: {formatBRL(selectedBalance)}
            </Typography>
          )}

          <TextField
            label="Valor (R$)"
            size="small"
            fullWidth
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start">R$</InputAdornment>,
            }}
          />

          <TextField
            label="Descrição"
            size="small"
            fullWidth
            multiline
            minRows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <TextField
            label="Link do comprovante"
            size="small"
            fullWidth
            value={receiptUrl}
            onChange={(e) => setReceiptUrl(e.target.value)}
            helperText="URL pública do comprovante (Drive, Dropbox, OneDrive, Imgur...)"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Voltar
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving || balancesLoading}
          startIcon={saving ? <CircularProgress size={14} /> : undefined}
        >
          Lançar despesa
        </Button>
      </DialogActions>
    </Dialog>
  );
}

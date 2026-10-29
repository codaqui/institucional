/**
 * Aba "Lançamento direto" de /admin/lancamento — formulário de dupla partida
 * com confirmação via ModalConfirm + diálogo de criação de conta externa.
 * Port de `src/pages/admin/lancamento.tsx` (Docusaurus).
 */
import { useState, type SyntheticEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import AddCircleOutlinedIcon from "@mui/icons-material/AddCircleOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ModalConfirm from "../ui/ModalConfirm";
import { useAuth } from "../../../../lib/use-auth";
import { extractErrorMessage } from "../../../../lib/auth-fetch-helpers";
import type { Account } from "./types";

interface DirectExpenseFormProps {
  readonly accounts: Account[];
  /** Recarrega contas/transferências após mutações. */
  readonly onChanged: () => Promise<void>;
}

const EMPTY_FORM = {
  sourceAccountId: "",
  destinationAccountId: "",
  amount: "",
  description: "",
  referenceId: "",
};

export default function DirectExpenseForm({
  accounts,
  onChanged,
}: DirectExpenseFormProps): React.JSX.Element {
  const { authFetch } = useAuth();

  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  const [externalDialogOpen, setExternalDialogOpen] = useState(false);
  const [externalAccountName, setExternalAccountName] = useState("");
  const [externalProjectKey, setExternalProjectKey] = useState("");
  const [externalAccountError, setExternalAccountError] = useState("");
  const [externalAccountLoading, setExternalAccountLoading] = useState(false);

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccess(false);
    if (
      !form.sourceAccountId ||
      !form.destinationAccountId ||
      !form.amount ||
      !form.description
    ) {
      setSubmitError("Preencha os campos obrigatórios.");
      return;
    }
    if (form.sourceAccountId === form.destinationAccountId) {
      setSubmitError("A conta de origem e destino não podem ser a mesma.");
      return;
    }
    const amountValue = Number.parseFloat(form.amount.replace(",", "."));
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setSubmitError("O valor deve ser um número positivo.");
      return;
    }
    setSubmitError("");
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    setSubmitLoading(true);
    setSubmitError("");
    try {
      const amountValue = Number.parseFloat(form.amount.replace(",", "."));
      const payload = {
        sourceAccountId: form.sourceAccountId,
        destinationAccountId: form.destinationAccountId,
        amount: amountValue,
        description: form.description,
        ...(form.referenceId && { referenceId: form.referenceId }),
      };

      const res = await authFetch("/ledger/transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(
          await extractErrorMessage(res, "Falha ao registrar lançamento."),
        );
      }

      setSuccess(true);
      setForm(EMPTY_FORM);
      await onChanged();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "Falha ao registrar lançamento.",
      );
    } finally {
      setSubmitLoading(false);
      setConfirmOpen(false);
    }
  };

  const createExternalAccount = async () => {
    setExternalAccountLoading(true);
    setExternalAccountError("");
    try {
      if (!externalAccountName.trim()) {
        setExternalAccountError("Informe o nome da conta externa.");
        setExternalAccountLoading(false);
        return;
      }
      const res = await authFetch("/ledger/accounts", {
        method: "POST",
        body: JSON.stringify({
          name: externalAccountName.trim(),
          type: "EXTERNAL",
          ...(externalProjectKey.trim() && {
            projectKey: externalProjectKey.trim(),
          }),
        }),
      });

      if (!res.ok) {
        setExternalAccountError(
          await extractErrorMessage(
            res,
            "Não foi possível criar a conta externa.",
          ),
        );
        setExternalAccountLoading(false);
        return;
      }

      setExternalDialogOpen(false);
      setExternalAccountName("");
      setExternalProjectKey("");
      await onChanged();
    } catch {
      setExternalAccountError("Erro inesperado ao criar conta externa.");
    } finally {
      setExternalAccountLoading(false);
    }
  };

  return (
    <Card
      elevation={0}
      sx={{ border: "1px solid", borderColor: "divider", p: 2 }}
    >
      <CardContent>
        {success && (
          <Alert
            severity="success"
            icon={<CheckCircleIcon />}
            sx={{ mb: 3 }}
            onClose={() => setSuccess(false)}
          >
            Transação registrada com sucesso no Ledger! Saldos atualizados em
            tempo real.
          </Alert>
        )}

        {submitError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {submitError}
          </Alert>
        )}

        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<AddCircleOutlinedIcon />}
            onClick={() => {
              setExternalAccountError("");
              setExternalDialogOpen(true);
            }}
          >
            Criar conta externa
          </Button>
        </Box>

        <form onSubmit={handleSubmit}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Box
              sx={{
                display: "flex",
                gap: 2,
                flexWrap: { xs: "wrap", md: "nowrap" },
              }}
            >
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Conta de Origem (Sai dinheiro)
                </Typography>
                <Select
                  fullWidth
                  size="small"
                  value={form.sourceAccountId}
                  onChange={(event) =>
                    setForm({ ...form, sourceAccountId: event.target.value })
                  }
                  displayEmpty
                >
                  <MenuItem value="" disabled>
                    Selecione a origem
                  </MenuItem>
                  {accounts.map((account) => (
                    <MenuItem key={account.id} value={account.id}>
                      {account.name}
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.disabled"
                        sx={{ ml: 1 }}
                      >
                        ({account.type})
                      </Typography>
                    </MenuItem>
                  ))}
                </Select>
              </Box>

              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Conta de Destino (Entra dinheiro)
                </Typography>
                <Select
                  fullWidth
                  size="small"
                  value={form.destinationAccountId}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      destinationAccountId: event.target.value,
                    })
                  }
                  displayEmpty
                >
                  <MenuItem value="" disabled>
                    Selecione o destino
                  </MenuItem>
                  {accounts.map((account) => (
                    <MenuItem key={account.id} value={account.id}>
                      {account.name}
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.disabled"
                        sx={{ ml: 1 }}
                      >
                        ({account.type})
                      </Typography>
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Valor (R$)
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Ex: 150.00"
                value={form.amount}
                onChange={(event) =>
                  setForm({ ...form, amount: event.target.value })
                }
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">R$</InputAdornment>
                    ),
                  },
                }}
              />
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Descrição da Movimentação
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Ex: Patrocínio empresa XYZ, Ajuste caixa..."
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                ID de Referência Externa (Opcional)
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Ex: evt_live_xxx, PIX-123"
                value={form.referenceId}
                onChange={(event) =>
                  setForm({ ...form, referenceId: event.target.value })
                }
              />
            </Box>

            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              sx={{ fontWeight: "bold", mt: 1 }}
            >
              Revisar lançamento
            </Button>
          </Box>
        </form>
      </CardContent>

      <ModalConfirm
        open={confirmOpen}
        title="Confirmar lançamento"
        description={
          <Box>
            <Typography gutterBottom>
              Deseja efetuar o lançamento definitivo?
            </Typography>
            <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 1, mt: 2 }}>
              <Typography variant="body2">
                <strong>Valor:</strong> R$ {form.amount}
              </Typography>
              <Typography variant="body2">
                <strong>Origem:</strong>{" "}
                {
                  accounts.find(
                    (account) => account.id === form.sourceAccountId,
                  )?.name
                }
              </Typography>
              <Typography variant="body2">
                <strong>Destino:</strong>{" "}
                {
                  accounts.find(
                    (account) => account.id === form.destinationAccountId,
                  )?.name
                }
              </Typography>
              <Typography variant="body2">
                <strong>Descrição:</strong> {form.description}
              </Typography>
            </Box>
          </Box>
        }
        confirmLabel="Confirmar lançamento"
        variant="info"
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        loading={submitLoading}
      />

      <Dialog
        open={externalDialogOpen}
        onClose={() => setExternalDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Criar conta externa</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="Nome da conta"
              value={externalAccountName}
              onChange={(event) => setExternalAccountName(event.target.value)}
              placeholder="Ex: Gateway PIX Manual"
              fullWidth
              required
            />
            <TextField
              label="Project key (opcional)"
              value={externalProjectKey}
              onChange={(event) => setExternalProjectKey(event.target.value)}
              placeholder="Ex: pix-manual-codaqui"
              fullWidth
            />
            {externalAccountError && (
              <Alert severity="error">{externalAccountError}</Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setExternalDialogOpen(false)}
            color="inherit"
            disabled={externalAccountLoading}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={createExternalAccount}
            disabled={externalAccountLoading}
          >
            Criar conta
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

import React, { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import CallReceivedIcon from "@mui/icons-material/CallReceived";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PaymentIcon from "@mui/icons-material/Payment";
import ModalConfirm from "../ModalConfirm";
import { vendorLabel } from "../../utils/vendorFormat";

interface VendorOption {
  id: string;
  name: string;
  document: string | null;
}
interface AccountOption {
  id: string;
  name: string;
  type: string;
}

export interface VendorTxFormValues {
  vendorId: string;
  accountId: string;
  amount: string;
  description: string;
  receiptUrl: string;
  internalReceiptUrl: string;
}

export const emptyVendorTxForm: VendorTxFormValues = {
  vendorId: "",
  accountId: "",
  amount: "",
  description: "",
  receiptUrl: "",
  internalReceiptUrl: "",
};

interface VendorTransactionFormProps {
  direction: "payment" | "receipt";
  vendors: VendorOption[];
  accounts: AccountOption[];
  authFetch: typeof fetch;
  apiUrl: string;
  onSuccess: () => void;
  initialValues?: VendorTxFormValues;
  initialKey?: number;
}

const CONFIG = {
  payment: {
    apiPath: "/vendors/payments",
    accountFieldLabel: "Conta de Origem *",
    accountFieldHelper: "Conta da comunidade que vai pagar",
    vendorLabel: "Fornecedor *",
    descriptionPlaceholder: "Ex: Hospedagem AWS — janeiro/2026",
    apiBodyAccountKey: "sourceAccountId",
    successMessage: "Pagamento registrado e lançado no ledger!",
    buttonColor: "primary" as const,
    buttonLabel: "Registrar Pagamento",
    referenceTag: "vendor-payment",
    successAlertColor: "success" as const,
    confirmAction: "pagará",
    confirmDirection: "para",
    confirmVariant: "info" as const,
    confirmTitle: "Confirmar pagamento",
    Icon: PaymentIcon,
    errorPrefix: "Erro ao registrar pagamento.",
  },
  receipt: {
    apiPath: "/vendors/receipts",
    accountFieldLabel: "Conta de Destino *",
    accountFieldHelper: "Conta da comunidade que vai receber o valor",
    vendorLabel: "Fornecedor / Origem do recebimento *",
    descriptionPlaceholder: "Ex: Repasse de venda de ingressos do evento X",
    apiBodyAccountKey: "destinationAccountId",
    successMessage: "Recebimento registrado e lançado no ledger!",
    buttonColor: "success" as const,
    buttonLabel: "Registrar Recebimento",
    referenceTag: "vendor-receipt",
    successAlertColor: "success" as const,
    confirmAction: "repassará",
    confirmDirection: "para a conta",
    confirmVariant: "success" as const,
    confirmTitle: "Confirmar recebimento",
    Icon: CallReceivedIcon,
    errorPrefix: "Erro ao registrar recebimento.",
  },
} as const;

/**
 * Form compartilhado para lançar payment ou receipt de fornecedor.
 * Encapsula campos, validação, fetch POST, modal de confirmação e alertas.
 */
export default function VendorTransactionForm({
  direction,
  vendors,
  accounts,
  authFetch,
  apiUrl,
  onSuccess,
  initialValues,
  initialKey,
}: Readonly<VendorTransactionFormProps>) {
  const cfg = CONFIG[direction];
  const [form, setForm] = useState<VendorTxFormValues>(emptyVendorTxForm);
  const [submitError, setSubmitError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (initialValues) setForm(initialValues);
    setSuccess(false);
    setSubmitError("");
  }, [initialValues, initialKey]);

  const selectedVendor = vendors.find((v) => v.id === form.vendorId);
  const selectedAccount = accounts.find((a) => a.id === form.accountId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    setSubmitError("");
    if (!form.vendorId || !form.accountId || !form.amount || !form.description) {
      setSubmitError("Preencha todos os campos obrigatórios.");
      return;
    }
    const amountCents = Math.round(Number.parseFloat(form.amount) * 100);
    if (Number.isNaN(amountCents) || amountCents <= 0) {
      setSubmitError("Valor inválido.");
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    setConfirmOpen(false);
    setSubmitLoading(true);
    setSubmitError("");
    const amountCents = Math.round(Number.parseFloat(form.amount) * 100);
    try {
      const body: Record<string, unknown> = {
        vendorId: form.vendorId,
        [cfg.apiBodyAccountKey]: form.accountId,
        amount: amountCents,
        description: form.description,
      };
      if (form.receiptUrl.trim()) body.receiptUrl = form.receiptUrl.trim();
      if (form.internalReceiptUrl.trim()) body.internalReceiptUrl = form.internalReceiptUrl.trim();

      const res = await authFetch(`${apiUrl}${cfg.apiPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || cfg.errorPrefix);
      }
      setSuccess(true);
      setForm(emptyVendorTxForm);
      onSuccess();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const Icon = cfg.Icon;

  return (
    <>
      <form onSubmit={handleSubmit}>
        <Autocomplete
          options={vendors}
          getOptionLabel={vendorLabel}
          value={selectedVendor ?? null}
          onChange={(_, v) => setForm({ ...form, vendorId: v?.id ?? "" })}
          renderInput={(params) => <TextField {...params} label={cfg.vendorLabel} margin="normal" />}
          isOptionEqualToValue={(opt, val) => opt.id === val.id}
        />

        <TextField
          select
          fullWidth
          label={cfg.accountFieldLabel}
          value={form.accountId}
          onChange={(e) => setForm({ ...form, accountId: e.target.value })}
          margin="normal"
          helperText={cfg.accountFieldHelper}
        >
          <MenuItem value="">Selecione...</MenuItem>
          {accounts
            .filter((a) => a.type !== "EXTERNAL")
            .map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.name} ({a.type})
              </MenuItem>
            ))}
        </TextField>

        <TextField
          fullWidth
          label="Valor (R$) *"
          type="number"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          margin="normal"
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start">R$</InputAdornment>,
              inputProps: { min: 0.01, step: 0.01 },
            },
          }}
        />

        <TextField
          fullWidth
          label="Descrição *"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          margin="normal"
          multiline
          rows={2}
          placeholder={cfg.descriptionPlaceholder}
        />

        <TextField
          fullWidth
          label="URL do Comprovante (original)"
          value={form.receiptUrl}
          onChange={(e) => setForm({ ...form, receiptUrl: e.target.value })}
          margin="normal"
          placeholder="https://..."
        />

        <TextField
          fullWidth
          label="URL do Comprovante (cópia interna / Drive)"
          value={form.internalReceiptUrl}
          onChange={(e) => setForm({ ...form, internalReceiptUrl: e.target.value })}
          margin="normal"
          placeholder="https://drive.google.com/..."
        />

        {submitError && <Alert severity="error" sx={{ mt: 1 }}>{submitError}</Alert>}
        {success && (
          <Alert severity={cfg.successAlertColor} icon={<CheckCircleIcon />} sx={{ mt: 1 }}>
            {cfg.successMessage}
          </Alert>
        )}

        <Box mt={2} display="flex" gap={2}>
          <Button
            type="submit"
            variant="contained"
            color={cfg.buttonColor}
            disabled={submitLoading}
            startIcon={submitLoading ? <CircularProgress size={18} /> : <Icon />}
          >
            {cfg.buttonLabel}
          </Button>
        </Box>
      </form>

      <ModalConfirm
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={cfg.confirmTitle}
        description={
          <>
            <strong>{selectedVendor?.name ?? "?"}</strong> {cfg.confirmAction}{" "}
            <strong>{form.amount ? `R$ ${form.amount}` : "?"}</strong> {cfg.confirmDirection}{" "}
            <strong>{selectedAccount?.name ?? "?"}</strong>. A movimentação será registrada no ledger
            com referência <code>{cfg.referenceTag}:&lt;id&gt;</code>.
          </>
        }
        variant={cfg.confirmVariant}
        confirmLabel="Registrar"
        onConfirm={handleConfirm}
      />
    </>
  );
}

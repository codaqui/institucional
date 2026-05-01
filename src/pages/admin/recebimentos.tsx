import React, { useEffect, useState, useCallback } from "react";
import Layout from "@theme/Layout";
import { useHistory } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CallReceivedIcon from "@mui/icons-material/CallReceived";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useAuth } from "../../hooks/useAuth";
import ModalConfirm from "../../components/ModalConfirm";
import VendorTransactionCard from "../../components/VendorTransactionCard";
import { formatCurrencyCents, vendorLabel } from "../../utils/vendorFormat";

interface Account {
  id: string;
  name: string;
  type: string;
}

interface Vendor {
  id: string;
  name: string;
  document: string | null;
  website: string | null;
  accountId: string;
}

interface VendorReceipt {
  id: string;
  vendorId: string;
  destinationAccountId: string;
  amount: number;
  description: string;
  receiptUrl: string | null;
  internalReceiptUrl: string | null;
  registeredByUserId: string;
  occurredAt: string;
  createdAt: string;
  vendor?: Vendor;
  destinationAccount?: Account;
  registeredBy?: { name: string; avatarUrl: string; githubHandle: string };
}

interface ReceiptForm {
  vendorId: string;
  destinationAccountId: string;
  amount: string;
  description: string;
  receiptUrl: string;
  internalReceiptUrl: string;
}

const emptyForm: ReceiptForm = {
  vendorId: "",
  destinationAccountId: "",
  amount: "",
  description: "",
  receiptUrl: "",
  internalReceiptUrl: "",
};

export default function RecebimentosPage(): React.JSX.Element {
  const { ready, isLoggedIn, isAdmin, authFetch } = useAuth();
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";
  const history = useHistory();

  const [tab, setTab] = useState(0);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [receipts, setReceipts] = useState<VendorReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState<ReceiptForm>(emptyForm);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [vRes, aRes, rRes] = await Promise.all([
        authFetch(`${apiUrl}/vendors`),
        authFetch(`${apiUrl}/ledger/accounts`),
        authFetch(`${apiUrl}/vendors/receipts`),
      ]);
      const unauthorized = [vRes, aRes, rRes].find((r) => r.status === 401);
      if (unauthorized) {
        setError("Sessão expirada — faça login novamente.");
        return;
      }
      const failed = [vRes, aRes, rRes].find((r) => !r.ok);
      if (failed) throw new Error(`HTTP ${failed.status}`);
      const [vData, aData, rData] = await Promise.all([
        vRes.json(),
        aRes.json(),
        rRes.json(),
      ]);
      setVendors(Array.isArray(vData) ? vData : []);
      setAccounts(Array.isArray(aData) ? aData : []);
      setReceipts(Array.isArray(rData) ? rData : []);
      setError("");
    } catch {
      setError("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, authFetch]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !isAdmin) {
      history.replace("/");
      return;
    }
    fetchAll();
  }, [ready, isLoggedIn, isAdmin, history, fetchAll]);

  const reuseReceipt = (r: VendorReceipt) => {
    setForm({
      vendorId: r.vendorId,
      destinationAccountId: r.destinationAccountId,
      amount: (r.amount / 100).toFixed(2),
      description: r.description,
      receiptUrl: r.receiptUrl ?? "",
      internalReceiptUrl: r.internalReceiptUrl ?? "",
    });
    setSuccess(false);
    setSubmitError("");
    setTab(0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    setSubmitError("");

    if (!form.vendorId || !form.destinationAccountId || !form.amount || !form.description) {
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
        destinationAccountId: form.destinationAccountId,
        amount: amountCents,
        description: form.description,
      };
      if (form.receiptUrl.trim()) body.receiptUrl = form.receiptUrl.trim();
      if (form.internalReceiptUrl.trim()) body.internalReceiptUrl = form.internalReceiptUrl.trim();

      const res = await authFetch(`${apiUrl}/vendors/receipts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao registrar recebimento.");
      }

      setSuccess(true);
      setForm(emptyForm);
      fetchAll();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await authFetch(`${apiUrl}/vendors/receipts/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDeleteId(null);
      fetchAll();
    } catch {
      setError("Não foi possível excluir o recebimento.");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!ready || loading) {
    return (
      <Layout title="Recebimentos">
        <Container maxWidth="md" sx={{ py: 6, textAlign: "center" }}>
          <CircularProgress />
        </Container>
      </Layout>
    );
  }

  const selectedVendor = vendors.find((v) => v.id === form.vendorId);
  const selectedAccount = accounts.find((a) => a.id === form.destinationAccountId);

  return (
    <Layout title="Recebimentos de Fornecedores" description="Registrar recebimentos vindos de fornecedores ou parceiros">
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          <CallReceivedIcon sx={{ mr: 1, verticalAlign: "middle", color: "success.main" }} />
          Recebimentos de Fornecedores
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Registre repasses vindos de fornecedores/parceiros (ex: Sympla, plataformas de eventos, parcerias).
        </Typography>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab label="Novo Recebimento" />
          <Tab label={`Histórico (${receipts.length})`} />
        </Tabs>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* ── Tab 0: Novo Recebimento ── */}
        {tab === 0 && (
          <Card variant="outlined">
            <CardContent>
              <form onSubmit={handleSubmit}>
                <Autocomplete
                  options={vendors}
                  getOptionLabel={vendorLabel}
                  value={vendors.find((v) => v.id === form.vendorId) ?? null}
                  onChange={(_, v) => setForm({ ...form, vendorId: v?.id ?? "" })}
                  renderInput={(params) => (
                    <TextField {...params} label="Fornecedor / Origem do recebimento *" margin="normal" />
                  )}
                  isOptionEqualToValue={(opt, val) => opt.id === val.id}
                />

                <TextField
                  select
                  fullWidth
                  label="Conta de Destino *"
                  value={form.destinationAccountId}
                  onChange={(e) => setForm({ ...form, destinationAccountId: e.target.value })}
                  margin="normal"
                  helperText="Conta da comunidade que vai receber o valor"
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
                  placeholder="Ex: Repasse de venda de ingressos do evento X"
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
                  <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 1 }}>
                    Recebimento registrado e lançado no ledger!
                  </Alert>
                )}

                <Box mt={2} display="flex" gap={2}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="success"
                    disabled={submitLoading}
                    startIcon={submitLoading ? <CircularProgress size={18} /> : <CallReceivedIcon />}
                  >
                    Registrar Recebimento
                  </Button>
                </Box>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── Tab 1: Histórico ── */}
        {tab === 1 && (
          <Box>
            {receipts.length === 0 ? (
              <Alert severity="info">Nenhum recebimento registrado.</Alert>
            ) : (
              receipts.map((r) => (
                <VendorTransactionCard
                  key={r.id}
                  tx={r}
                  direction="receipt"
                  accountLabel={r.destinationAccount?.name ?? r.destinationAccountId}
                  onReuse={() => reuseReceipt(r)}
                  onDelete={() => setDeleteId(r.id)}
                />
              ))
            )}
          </Box>
        )}
      </Container>

      {/* ── Confirm submit ── */}
      <ModalConfirm
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirmar recebimento"
        description={
          <>
            <strong>{selectedVendor?.name ?? "?"}</strong> repassará{" "}
            <strong>{form.amount ? `R$ ${form.amount}` : "?"}</strong> para a conta{" "}
            <strong>{selectedAccount?.name ?? "?"}</strong>. A movimentação será registrada no ledger
            com referência <code>vendor-receipt:&lt;id&gt;</code>.
          </>
        }
        variant="success"
        confirmLabel="Registrar"
        onConfirm={handleConfirm}
      />

      {/* ── Confirm delete ── */}
      <ModalConfirm
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Excluir recebimento?"
        description="Será criado um lançamento reverso (estorno) no ledger e o registro será removido."
        variant="error"
        confirmLabel="Excluir"
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
      />
    </Layout>
  );
}

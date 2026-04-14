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
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import PaymentIcon from "@mui/icons-material/Payment";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import { useAuth } from "../../hooks/useAuth";
import ModalConfirm from "../../components/ModalConfirm";

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

interface Template {
  id: string;
  name: string;
  sourceAccountId: string;
  vendorId: string;
  amount: number;
  description: string;
  vendor?: Vendor;
  sourceAccount?: Account;
}

interface VendorPayment {
  id: string;
  vendorId: string;
  sourceAccountId: string;
  amount: number;
  description: string;
  receiptUrl: string | null;
  internalReceiptUrl: string | null;
  paidByUserId: string;
  paidAt: string;
  createdAt: string;
  vendor?: Vendor;
  sourceAccount?: Account;
  paidBy?: { name: string; avatarUrl: string; githubHandle: string };
}

interface PaymentForm {
  vendorId: string;
  sourceAccountId: string;
  amount: string;
  description: string;
  receiptUrl: string;
  internalReceiptUrl: string;
}

const emptyForm: PaymentForm = {
  vendorId: "",
  sourceAccountId: "",
  amount: "",
  description: "",
  receiptUrl: "",
  internalReceiptUrl: "",
};

export default function PagamentosPage(): React.JSX.Element {
  const { ready, isLoggedIn, isAdmin, authFetch } = useAuth();
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";
  const history = useHistory();

  const [tab, setTab] = useState(0);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form state
  const [form, setForm] = useState<PaymentForm>(emptyForm);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  // Template form state
  const [tplDialogOpen, setTplDialogOpen] = useState(false);
  const [tplForm, setTplForm] = useState({ name: "", vendorId: "", sourceAccountId: "", amount: "", description: "" });
  const [tplSubmitLoading, setTplSubmitLoading] = useState(false);
  const [tplSubmitError, setTplSubmitError] = useState("");
  const [tplDeleteId, setTplDeleteId] = useState<string | null>(null);
  const [tplDeleteLoading, setTplDeleteLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [vRes, aRes, tRes, pRes] = await Promise.all([
        authFetch(`${apiUrl}/vendors`),
        authFetch(`${apiUrl}/ledger/accounts`),
        authFetch(`${apiUrl}/vendors/templates`),
        authFetch(`${apiUrl}/vendors/payments`),
      ]);
      const [vData, aData, tData, pData] = await Promise.all([
        vRes.json(),
        aRes.json(),
        tRes.json(),
        pRes.json(),
      ]);
      setVendors(Array.isArray(vData) ? vData : []);
      setAccounts(Array.isArray(aData) ? aData : []);
      setTemplates(Array.isArray(tData) ? tData : []);
      setPayments(Array.isArray(pData) ? pData : []);
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

  const applyTemplate = (t: Template) => {
    setForm({
      vendorId: t.vendorId,
      sourceAccountId: t.sourceAccountId,
      amount: (t.amount / 100).toFixed(2),
      description: t.description,
      receiptUrl: "",
      internalReceiptUrl: "",
    });
    setSuccess(false);
    setSubmitError("");
    setTab(0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    setSubmitError("");

    if (!form.vendorId || !form.sourceAccountId || !form.amount || !form.description) {
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
        sourceAccountId: form.sourceAccountId,
        amount: amountCents,
        description: form.description,
      };
      if (form.receiptUrl.trim()) body.receiptUrl = form.receiptUrl.trim();
      if (form.internalReceiptUrl.trim()) body.internalReceiptUrl = form.internalReceiptUrl.trim();

      const res = await authFetch(`${apiUrl}/vendors/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao registrar pagamento.");
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

  const formatCurrency = (cents: number) =>
    `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (!ready || loading) {
    return (
      <Layout title="Pagamentos">
        <Container maxWidth="md" sx={{ py: 6, textAlign: "center" }}>
          <CircularProgress />
        </Container>
      </Layout>
    );
  }

  return (
    <Layout title="Pagamentos a Fornecedores" description="Registrar pagamentos a fornecedores">
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          <PaymentIcon sx={{ mr: 1, verticalAlign: "middle" }} />
          Pagamentos a Fornecedores
        </Typography>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab label="Novo Pagamento" />
          <Tab label={`Histórico (${payments.length})`} />
          <Tab label={`Templates (${templates.length})`} />
        </Tabs>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* ── Tab 0: Novo Pagamento ── */}
        {tab === 0 && (
          <Card variant="outlined">
            <CardContent>
              {templates.length > 0 && (
                <Box mb={3}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Preencher com template:
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {templates.map((t) => (
                      <Chip
                        key={t.id}
                        label={`${t.name} — ${formatCurrency(t.amount)}`}
                        onClick={() => applyTemplate(t)}
                        clickable
                        color="primary"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                  <Divider sx={{ mt: 2 }} />
                </Box>
              )}

              <form onSubmit={handleSubmit}>
                <Autocomplete
                  options={vendors}
                  getOptionLabel={(v) => `${v.name}${v.document ? ` (${v.document})` : ""}`}
                  value={vendors.find((v) => v.id === form.vendorId) ?? null}
                  onChange={(_, v) => setForm({ ...form, vendorId: v?.id ?? "" })}
                  renderInput={(params) => (
                    <TextField {...params} label="Fornecedor *" margin="normal" />
                  )}
                  isOptionEqualToValue={(opt, val) => opt.id === val.id}
                />

                <TextField
                  select
                  fullWidth
                  label="Conta de Origem *"
                  value={form.sourceAccountId}
                  onChange={(e) => setForm({ ...form, sourceAccountId: e.target.value })}
                  margin="normal"
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
                    Pagamento registrado e lançado no ledger!
                  </Alert>
                )}

                <Box mt={2} display="flex" gap={2}>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={submitLoading}
                    startIcon={submitLoading ? <CircularProgress size={18} /> : <PaymentIcon />}
                  >
                    Registrar Pagamento
                  </Button>
                </Box>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── Tab 1: Histórico ── */}
        {tab === 1 && (
          <Box>
            {payments.length === 0 ? (
              <Alert severity="info">Nenhum pagamento registrado.</Alert>
            ) : (
              payments.map((p) => (
                <Card key={p.id} variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700}>
                          {p.vendor?.name ?? "Fornecedor desconhecido"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {p.description}
                        </Typography>
                      </Box>
                      <Typography variant="h6" fontWeight={700} color="error.main">
                        {formatCurrency(p.amount)}
                      </Typography>
                    </Box>
                    <Box display="flex" gap={1} mt={1} flexWrap="wrap" alignItems="center">
                      {p.paidBy && (
                        <Tooltip title={`Registrado por @${p.paidBy.githubHandle}`}>
                          <Chip
                            size="small"
                            avatar={<Avatar src={p.paidBy.avatarUrl} alt={p.paidBy.name} />}
                            label={`@${p.paidBy.githubHandle}`}
                            variant="outlined"
                          />
                        </Tooltip>
                      )}
                      <Chip
                        size="small"
                        label={p.sourceAccount?.name ?? p.sourceAccountId}
                        variant="outlined"
                      />
                      <Chip size="small" label={formatDate(p.paidAt)} variant="outlined" />
                      {p.receiptUrl && (
                        <Chip
                          size="small"
                          icon={<ReceiptLongIcon />}
                          label="Comprovante"
                          component="a"
                          href={p.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          clickable
                        />
                      )}
                      {p.internalReceiptUrl && (
                        <Chip
                          size="small"
                          icon={<ReceiptLongIcon />}
                          label="Cópia interna"
                          component="a"
                          href={p.internalReceiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          clickable
                          color="primary"
                        />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              ))
            )}
          </Box>
        )}

        {/* ── Tab 2: Templates ── */}
        {tab === 2 && (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="subtitle2" color="text.secondary">
                Templates são atalhos para preencher o formulário de pagamento rapidamente.
              </Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => {
                  setTplForm({ name: "", vendorId: "", sourceAccountId: "", amount: "", description: "" });
                  setTplSubmitError("");
                  setTplDialogOpen(true);
                }}
              >
                Novo Template
              </Button>
            </Box>

            {templates.length === 0 ? (
              <Alert severity="info">Nenhum template cadastrado. Crie um para agilizar pagamentos recorrentes.</Alert>
            ) : (
              templates.map((t) => (
                <Card key={t.id} variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700}>
                          {t.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t.vendor?.name ?? "?"} — {t.description}
                        </Typography>
                        {t.sourceAccount && (
                          <Typography variant="caption" color="text.disabled">
                            Conta: {t.sourceAccount.name}
                          </Typography>
                        )}
                      </Box>
                      <Box textAlign="right" display="flex" alignItems="center" gap={1}>
                        <Typography variant="h6" fontWeight={700}>
                          {formatCurrency(t.amount)}
                        </Typography>
                        <Button size="small" variant="outlined" onClick={() => applyTemplate(t)}>
                          Usar
                        </Button>
                        <IconButton
                          size="small"
                          aria-label="Excluir template"
                          color="error"
                          onClick={() => setTplDeleteId(t.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))
            )}

            {/* Dialog de criação de template */}
            <Dialog open={tplDialogOpen} onClose={() => setTplDialogOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Novo Template de Pagamento</DialogTitle>
              <DialogContent>
                <TextField
                  fullWidth
                  label="Nome do template *"
                  value={tplForm.name}
                  onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })}
                  margin="normal"
                  placeholder='Ex: "Contador mensal", "Hosting DigitalOcean"'
                />
                <Autocomplete
                  options={vendors}
                  getOptionLabel={(v) => `${v.name}${v.document ? ` (${v.document})` : ""}`}
                  value={vendors.find((v) => v.id === tplForm.vendorId) ?? null}
                  onChange={(_, v) => setTplForm({ ...tplForm, vendorId: v?.id ?? "" })}
                  renderInput={(params) => (
                    <TextField {...params} label="Fornecedor *" margin="normal" />
                  )}
                  isOptionEqualToValue={(opt, val) => opt.id === val.id}
                />
                <TextField
                  select
                  fullWidth
                  label="Conta de Origem *"
                  value={tplForm.sourceAccountId}
                  onChange={(e) => setTplForm({ ...tplForm, sourceAccountId: e.target.value })}
                  margin="normal"
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
                  label="Valor padrão (R$) *"
                  type="number"
                  value={tplForm.amount}
                  onChange={(e) => setTplForm({ ...tplForm, amount: e.target.value })}
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
                  label="Descrição padrão *"
                  value={tplForm.description}
                  onChange={(e) => setTplForm({ ...tplForm, description: e.target.value })}
                  margin="normal"
                  multiline
                  rows={2}
                />
                {tplSubmitError && <Alert severity="error" sx={{ mt: 1 }}>{tplSubmitError}</Alert>}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setTplDialogOpen(false)} disabled={tplSubmitLoading}>
                  Cancelar
                </Button>
                <Button
                  variant="contained"
                  disabled={tplSubmitLoading}
                  onClick={async () => {
                    if (!tplForm.name.trim() || !tplForm.vendorId || !tplForm.sourceAccountId || !tplForm.amount || !tplForm.description.trim()) {
                      setTplSubmitError("Preencha todos os campos.");
                      return;
                    }
                    const amountCents = Math.round(Number.parseFloat(tplForm.amount) * 100);
                    if (Number.isNaN(amountCents) || amountCents <= 0) {
                      setTplSubmitError("Valor inválido.");
                      return;
                    }
                    setTplSubmitLoading(true);
                    setTplSubmitError("");
                    try {
                      const res = await authFetch(`${apiUrl}/vendors/templates`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name: tplForm.name.trim(),
                          vendorId: tplForm.vendorId,
                          sourceAccountId: tplForm.sourceAccountId,
                          amount: amountCents,
                          description: tplForm.description.trim(),
                        }),
                      });
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.message || "Erro ao criar template.");
                      }
                      setTplDialogOpen(false);
                      fetchAll();
                    } catch (err: unknown) {
                      setTplSubmitError(err instanceof Error ? err.message : "Erro desconhecido.");
                    } finally {
                      setTplSubmitLoading(false);
                    }
                  }}
                >
                  {tplSubmitLoading ? <CircularProgress size={20} /> : "Criar Template"}
                </Button>
              </DialogActions>
            </Dialog>

            {/* Confirmação de exclusão de template */}
            <ModalConfirm
              open={!!tplDeleteId}
              title="Excluir template?"
              description="O template será desativado e não aparecerá mais na lista."
              onConfirm={async () => {
                if (!tplDeleteId) return;
                setTplDeleteLoading(true);
                try {
                  await authFetch(`${apiUrl}/vendors/templates/${tplDeleteId}`, { method: "DELETE" });
                  setTplDeleteId(null);
                  fetchAll();
                } catch {
                  setTplDeleteId(null);
                } finally {
                  setTplDeleteLoading(false);
                }
              }}
              onClose={() => setTplDeleteId(null)}
              loading={tplDeleteLoading}
            />
          </Box>
        )}

        {/* Confirmação */}
        <ModalConfirm
          open={confirmOpen}
          title="Confirmar pagamento?"
          description={`Registrar pagamento de R$ ${form.amount} para ${vendors.find((v) => v.id === form.vendorId)?.name ?? "fornecedor"}? Esta ação criará um lançamento no ledger.`}
          onConfirm={handleConfirm}
          onClose={() => setConfirmOpen(false)}
          loading={submitLoading}
        />
      </Container>
    </Layout>
  );
}

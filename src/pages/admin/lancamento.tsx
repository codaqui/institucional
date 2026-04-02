import React, { useEffect, useState, useCallback } from "react";
import Layout from "@theme/Layout";
import { useHistory } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import InputAdornment from "@mui/material/InputAdornment";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PostAddIcon from "@mui/icons-material/PostAdd";
import { useAuth } from "../../hooks/useAuth";
import ModalConfirm from "../../components/ModalConfirm";

interface Account {
  id: string;
  name: string;
  type: string;
  projectKey: string | null;
}

export default function LançamentoPage(): React.JSX.Element {
  const { ready, isLoggedIn, isAdmin, authFetch } = useAuth();
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://api.localhost:8000";
  const history = useHistory();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    sourceAccountId: "",
    destinationAccountId: "",
    amount: "",
    description: "",
    referenceId: "",
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  const fetchAccounts = useCallback(() => {
    authFetch(`${apiUrl}/ledger/accounts`)
      .then((r) => r.json())
      .then((data) => {
        setAccounts(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError("Não foi possível carregar as contas contábeis.");
        setLoading(false);
      });
  }, [apiUrl, authFetch]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !isAdmin) {
      history.replace("/");
      return;
    }
    fetchAccounts();
  }, [ready, isLoggedIn, isAdmin, history, fetchAccounts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    if (!form.sourceAccountId || !form.destinationAccountId || !form.amount || !form.description) {
      setSubmitError("Preencha os campos obrigatórios.");
      return;
    }
    if (form.sourceAccountId === form.destinationAccountId) {
      setSubmitError("A conta de origem e destino não podem ser a mesma.");
      return;
    }
    const amountVal = parseFloat(form.amount.replace(",", "."));
    if (isNaN(amountVal) || amountVal <= 0) {
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
      const amountVal = parseFloat(form.amount.replace(",", "."));
      const payload = {
        sourceAccountId: form.sourceAccountId,
        destinationAccountId: form.destinationAccountId,
        amount: amountVal,
        description: form.description,
        ...(form.referenceId && { referenceId: form.referenceId }),
      };

      const res = await authFetch(`${apiUrl}/ledger/transactions`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Falha ao registrar lançamento.");
      }

      setSuccess(true);
      setForm({
        sourceAccountId: "",
        destinationAccountId: "",
        amount: "",
        description: "",
        referenceId: "",
      });
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitLoading(false);
      setConfirmOpen(false);
    }
  };

  if (!ready || !isLoggedIn || !isAdmin) return <Layout><Box /></Layout>;

  return (
    <Layout title="Lançamento Manual" description="Painel Admin">
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={800} gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <PostAddIcon color="primary" fontSize="large" />
            Lançamento Manual
          </Typography>
          <Typography color="text.secondary">
            Registre movimentações que fugiram do webhook ou ajustes de conciliação bancária de dupla partida.
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ textAlign: "center", py: 4 }}><CircularProgress /></Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", p: 2 }}>
            <CardContent>
              {success && (
                <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }} onClose={() => setSuccess(false)}>
                  Transação registrada com sucesso no Ledger! Saldos atualizados em tempo real.
                </Alert>
              )}

              {submitError && <Alert severity="error" sx={{ mb: 3 }}>{submitError}</Alert>}

              <form onSubmit={handleSubmit}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  
                  {/* Contas */}
                  <Box sx={{ display: "flex", gap: 2, flexWrap: { xs: "wrap", md: "nowrap" } }}>
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <Typography variant="subtitle2" gutterBottom>Conta de Origem (Sai dinheiro)</Typography>
                      <Select
                        fullWidth size="small"
                        value={form.sourceAccountId}
                        onChange={(e) => setForm({ ...form, sourceAccountId: e.target.value })}
                        displayEmpty
                      >
                        <MenuItem value="" disabled>Selecione a origem</MenuItem>
                        {accounts.map(acc => (
                          <MenuItem key={acc.id} value={acc.id}>
                            {acc.name} <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 1 }}>({acc.type})</Typography>
                          </MenuItem>
                        ))}
                      </Select>
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <Typography variant="subtitle2" gutterBottom>Conta de Destino (Entra dinheiro)</Typography>
                      <Select
                        fullWidth size="small"
                        value={form.destinationAccountId}
                        onChange={(e) => setForm({ ...form, destinationAccountId: e.target.value })}
                        displayEmpty
                      >
                        <MenuItem value="" disabled>Selecione o destino</MenuItem>
                        {accounts.map(acc => (
                          <MenuItem key={acc.id} value={acc.id}>
                            {acc.name} <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 1 }}>({acc.type})</Typography>
                          </MenuItem>
                        ))}
                      </Select>
                    </Box>
                  </Box>

                  {/* Valor */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>Valor (R$)</Typography>
                    <TextField
                      fullWidth size="small"
                      placeholder="Ex: 150.00"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      slotProps={{
                        input: { startAdornment: <InputAdornment position="start">R$</InputAdornment> }
                      }}
                    />
                  </Box>

                  {/* Descrição */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>Descrição da Movimentação</Typography>
                    <TextField
                      fullWidth size="small"
                      placeholder="Ex: Patrocínio empresa XYZ, Ajuste caixa..."
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </Box>

                  {/* Referência (Opcional) */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>ID de Referência Externa (Opcional)</Typography>
                    <TextField
                      fullWidth size="small"
                      placeholder="Ex: evt_live_xxx, PIX-123"
                      value={form.referenceId}
                      onChange={(e) => setForm({ ...form, referenceId: e.target.value })}
                    />
                  </Box>

                  <Button
                    type="submit" variant="contained" color="primary" size="large"
                    sx={{ fontWeight: "bold", mt: 1 }}
                  >
                    Revisar Lançamento
                  </Button>
                </Box>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Modal de Confirmação */}
        <ModalConfirm
          open={confirmOpen}
          title="Confirmar Lançamento"
          description={
            <Box>
              <Typography gutterBottom>Deseja efetuar o lançamento definitivo? Operações no banco não podem ser apagadas nativamente!</Typography>
              <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 1, mt: 2 }}>
                <Typography variant="body2"><strong>Valor:</strong> R$ {form.amount}</Typography>
                <Typography variant="body2"><strong>Origem:</strong> {accounts.find(a => a.id === form.sourceAccountId)?.name}</Typography>
                <Typography variant="body2"><strong>Destino:</strong> {accounts.find(a => a.id === form.destinationAccountId)?.name}</Typography>
                <Typography variant="body2"><strong>Descrição:</strong> {form.description}</Typography>
              </Box>
            </Box>
          }
          confirmLabel="Confirmar Lançamento"
          variant="info"
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleConfirm}
          loading={submitLoading}
        />
      </Container>
    </Layout>
  );
}

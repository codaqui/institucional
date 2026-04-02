import React, { useEffect, useState, useCallback } from "react";
import Layout from "@theme/Layout";
import { useHistory } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import EditIcon from "@mui/icons-material/Edit";
import GitHubIcon from "@mui/icons-material/GitHub";
import LogoutIcon from "@mui/icons-material/Logout";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useAuth } from "../../hooks/useAuth";

interface Donation {
  id: string;
  amount: number;
  description: string;
  community: string;
  referenceId: string;
  createdAt: string;
}

interface ReimbursementRequest {
  id: string;
  account: { name: string };
  amount: number;
  description: string;
  receiptUrl: string;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  createdAt: string;
}

interface CommunityBalance {
  id: string;
  projectKey: string;
  name: string;
  balance: number;
}

interface Subscription {
  id: string;
  status: string;
  interval: string;
  amount: number;
  currency: string;
  communityId: string;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const reimbursementStatusConfig = {
  pending: { label: "Pendente", color: "warning" as const, icon: <HourglassEmptyIcon fontSize="small" /> },
  approved: { label: "Aprovado", color: "success" as const, icon: <CheckCircleIcon fontSize="small" /> },
  rejected: { label: "Rejeitado", color: "error" as const, icon: <CancelIcon fontSize="small" /> },
};

export default function MembroPage(): React.JSX.Element {
  const { user, ready, isLoggedIn, logout, authFetch } = useAuth();
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://api.localhost:8000";
  const history = useHistory();

  const [donations, setDonations] = useState<Donation[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [cancelSubId, setCancelSubId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reimbursements, setReimbursements] = useState<ReimbursementRequest[]>([]);
  const [reimbLoading, setReimbLoading] = useState(true);
  const [accounts, setAccounts] = useState<CommunityBalance[]>([]);

  // Reimbursement form state
  const [reimbDialog, setReimbDialog] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const fetchReimbursements = useCallback(() => {
    setReimbLoading(true);
    authFetch(`${apiUrl}/reimbursements/my`)
      .then((r) => r.json())
      .then((data) => setReimbursements(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setReimbLoading(false));
  }, [apiUrl, authFetch]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn) { history.replace("/"); return; }

    // Doações via Stripe
    authFetch(`${apiUrl}/stripe/my-donations`)
      .then((r) => r.json())
      .then((data) => setDonations(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setTxLoading(false));

    // Assinaturas recorrentes
    authFetch(`${apiUrl}/stripe/my-subscriptions`)
      .then((r) => r.json())
      .then((data) => setSubscriptions(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setSubsLoading(false));

    // Reembolsos
    fetchReimbursements();

    // Contas disponíveis para reembolso
    fetch(`${apiUrl}/ledger/community-balances`)
      .then((r) => r.json())
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [ready, isLoggedIn, apiUrl, authFetch, history, fetchReimbursements]);

  const handleSubmitReimbursement = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await authFetch(`${apiUrl}/reimbursements`, {
        method: "POST",
        body: JSON.stringify({
          accountId,
          amount: Math.round(parseFloat(amount)),
          description,
          receiptUrl,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSubmitError(data.message ?? "Erro ao enviar solicitação.");
        return;
      }
      setReimbDialog(false);
      setAccountId(""); setAmount(""); setDescription(""); setReceiptUrl("");
      fetchReimbursements();
    } catch {
      setSubmitError("Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!cancelSubId) return;
    setCancelling(true);
    try {
      const res = await authFetch(`${apiUrl}/stripe/subscriptions/${cancelSubId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Falha ao cancelar assinatura.");
      // Atualiza estado local — marca como cancelAtPeriodEnd
      setSubscriptions((prev) =>
        prev.map((s) => s.id === cancelSubId ? { ...s, cancelAtPeriodEnd: true } : s)
      );
    } catch (e) {
      console.error(e);
    } finally {
      setCancelling(false);
      setCancelSubId(null);
    }
  };

  if (!ready || !isLoggedIn) {
    return (
      <Layout title="Área do Membro">
        <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title="Área do Membro" description="Perfil e histórico de doações">
      <Container maxWidth="md" sx={{ py: 6 }}>
        {/* Perfil */}
        <Card variant="outlined" sx={{ mb: 4 }}>
          <CardContent sx={{ display: "flex", gap: 3, alignItems: "flex-start", flexWrap: "wrap" }}>
            <Avatar src={user!.avatarUrl} alt={user!.name} sx={{ width: 80, height: 80 }} />
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5, flexWrap: "wrap" }}>
                <Typography variant="h5" fontWeight={800}>{user!.name}</Typography>
                <Chip
                  label={user!.role === "admin" ? "Organização" : user!.role === "finance-analyzer" ? "Finance Analyzer" : "Membro"}
                  color={user!.role === "admin" ? "primary" : user!.role === "finance-analyzer" ? "secondary" : "default"}
                  size="small"
                  variant="outlined"
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                <GitHubIcon sx={{ fontSize: "0.9rem", mr: 0.5, verticalAlign: "middle" }} />
                @{user!.handle}
              </Typography>
              <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                <Button variant="outlined" size="small" startIcon={<EditIcon />} href="/membro/editar">
                  Editar perfil
                </Button>
                {(user!.role === "admin" || user!.role === "finance-analyzer") && (
                  <Button variant="outlined" size="small" color="secondary" href="/admin/reembolsos">
                    Painel de Reembolsos
                  </Button>
                )}
                <Button
                  variant="text" size="small" color="inherit" startIcon={<LogoutIcon />}
                  onClick={logout} sx={{ color: "text.secondary" }}
                >
                  Sair
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Divider sx={{ my: 4 }} />

        {/* ── Reembolsos ── */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
          <Typography variant="h6" fontWeight={700}>Minhas Solicitações de Reembolso</Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<ReceiptLongIcon />}
            onClick={() => { setReimbDialog(true); setSubmitError(""); }}
          >
            Solicitar Reembolso
          </Button>
        </Box>

        {reimbLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={28} /></Box>
        ) : reimbursements.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Nenhuma solicitação ainda.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 4 }}>
            {reimbursements.map((r) => {
              const sc = reimbursementStatusConfig[r.status];
              return (
                <Card key={r.id} variant="outlined">
                  <CardContent sx={{ py: "12px !important" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1 }}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{r.description}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {r.account?.name} · {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Chip icon={sc.icon} label={sc.label} color={sc.color} size="small" variant="outlined" />
                        <Typography variant="body1" fontWeight={700} color="primary.main">
                          {formatBRL(r.amount)}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap", alignItems: "center" }}>
                      <Button size="small" variant="text" endIcon={<OpenInNewIcon />} href={r.receiptUrl} target="_blank" rel="noopener noreferrer">
                        Comprovante
                      </Button>
                    </Box>
                    {r.reviewNote && (
                      <Alert severity={r.status === "approved" ? "success" : "error"} sx={{ mt: 1 }}>
                        {r.reviewNote}
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}

        <Divider sx={{ my: 4 }} />

        {/* ── Assinaturas Recorrentes ── */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <AutorenewIcon color="info" />
            <Typography variant="h6" fontWeight={700}>Minhas Assinaturas</Typography>
          </Box>
          <Button variant="outlined" size="small" href="/participe/apoiar">
            + Nova assinatura
          </Button>
        </Box>

        {subsLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={28} /></Box>
        ) : subscriptions.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 3, mb: 2 }}>
            <Typography variant="body2" color="text.secondary">Nenhuma assinatura ativa.</Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 4 }}>
            {subscriptions.map((sub) => (
              <Card key={sub.id} variant="outlined" sx={{
                borderColor: sub.cancelAtPeriodEnd ? "warning.main" : "primary.main",
                borderWidth: sub.cancelAtPeriodEnd ? 1 : 1,
              }}>
                <CardContent sx={{ py: "12px !important" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                    <Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                        <AutorenewIcon fontSize="small" color={sub.cancelAtPeriodEnd ? "warning" : "info"} />
                        <Typography variant="body2" fontWeight={700}>
                          {sub.communityId === "tesouro-geral" ? "Tesouro Codaqui" : sub.communityId}
                        </Typography>
                        <Chip
                          label={sub.interval === "month" ? "Mensal" : "Anual"}
                          size="small"
                          color="info"
                          variant="outlined"
                        />
                        {sub.cancelAtPeriodEnd && (
                          <Chip label="Encerra em breve" size="small" color="warning" variant="outlined" />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {sub.cancelAtPeriodEnd
                          ? `Ativa até ${new Date(sub.currentPeriodEnd * 1000).toLocaleDateString("pt-BR")}`
                          : `Próxima cobrança: ${new Date(sub.currentPeriodEnd * 1000).toLocaleDateString("pt-BR")}`
                        }
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Typography variant="body1" fontWeight={700} color="primary.main">
                        {formatBRL(sub.amount / 100)}/{sub.interval === "month" ? "mês" : "ano"}
                      </Typography>
                      {!sub.cancelAtPeriodEnd && (
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          startIcon={<CancelIcon />}
                          onClick={() => setCancelSubId(sub.id)}
                        >
                          Cancelar
                        </Button>
                      )}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}

        <Typography variant="h6" fontWeight={700} gutterBottom>Minhas Doações</Typography>
        {txLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={32} /></Box>
        ) : donations.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Nenhuma doação registrada ainda.
            </Typography>
            <Button variant="contained" href="/participe/apoiar">Fazer uma doação</Button>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {donations.map((tx) => (
              <Card key={tx.id} variant="outlined">
                <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: "12px !important" }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{tx.community}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(tx.createdAt).toLocaleDateString("pt-BR")}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <ArrowUpwardIcon fontSize="small" sx={{ color: "success.main" }} />
                    <Typography variant="body1" fontWeight={700} color="success.main">
                      {formatBRL(tx.amount)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Container>

      {/* ── Dialog: Confirmar cancelamento de assinatura ── */}
      <Dialog open={!!cancelSubId} onClose={() => !cancelling && setCancelSubId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 700 }}>
          <CancelIcon color="error" />
          Cancelar assinatura?
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            A assinatura <strong>não será cancelada imediatamente</strong>. Ela continuará ativa
            até o final do período já pago e só então será encerrada.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            Você pode criar uma nova assinatura a qualquer momento em{" "}
            <strong>/participe/apoiar</strong>.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCancelSubId(null)} disabled={cancelling} color="inherit">
            Manter assinatura
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={cancelling}
            onClick={handleCancelSubscription}
            startIcon={cancelling ? <CircularProgress size={16} color="inherit" /> : <CancelIcon />}
          >
            {cancelling ? "Cancelando…" : "Confirmar cancelamento"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Reimbursement Dialog ── */}
      <Dialog open={reimbDialog} onClose={() => setReimbDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Solicitar Reembolso</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
            <Alert severity="info">
              O comprovante deve ser uma URL pública (Google Drive, Dropbox etc.).
              Após a aprovação, ele será arquivado internamente pela equipe financeira.
            </Alert>

            <FormControl fullWidth required>
              <InputLabel>Conta (carteira comunitária)</InputLabel>
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} label="Conta (carteira comunitária)">
                {accounts.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.name} ({formatBRL(a.balance)})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Valor (R$)"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              inputProps={{ min: 1, step: 1 }}
            />

            <TextField
              label="Descrição"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              multiline
              rows={2}
              placeholder="Ex: Compra de materiais para o evento de outubro"
            />

            <TextField
              label="URL do comprovante (obrigatório)"
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              required
              placeholder="https://drive.google.com/file/d/..."
              type="url"
              helperText="Use um link público para que a equipe financeira possa verificar."
            />

            {submitError && <Alert severity="error">{submitError}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReimbDialog(false)} color="inherit">Cancelar</Button>
          <Button
            variant="contained"
            disabled={!accountId || !amount || !description.trim() || !receiptUrl.trim() || submitting}
            onClick={handleSubmitReimbursement}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <ReceiptLongIcon />}
          >
            Enviar Solicitação
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}

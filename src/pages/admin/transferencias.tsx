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
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import { useAuth } from "../../hooks/useAuth";
import { parseAuthJson, extractErrorMessage } from "../../hooks/authFetchHelpers";
import ModalConfirm from "../../components/ModalConfirm";

interface TransferRequest {
  id: string;
  requestedBy: { name: string; githubHandle: string };
  sourceAccount: { id: string; name: string };
  destinationAccount: { id: string; name: string };
  amount: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  reviewedBy: { name: string } | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
  projectKey: string | null;
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const statusConfig = {
  pending: { label: "Pendente", color: "warning" as const, icon: <HourglassEmptyIcon fontSize="small" /> },
  approved: { label: "Aprovada", color: "success" as const, icon: <CheckCircleIcon fontSize="small" /> },
  rejected: { label: "Rejeitada", color: "error" as const, icon: <CancelIcon fontSize="small" /> },
};

interface Person {
  name: string;
  githubHandle?: string;
  avatarUrl?: string;
}

/** Avatar + nome com label — exibe solicitante/aprovador de forma compacta */
function PersonBadge({
  label,
  person,
  color = "default",
}: {
  readonly label: string;
  readonly person: Person;
  readonly color?: "default" | "success" | "error";
}) {
  const initials = person.name?.charAt(0)?.toUpperCase() ?? "?";
  const display = person.githubHandle ? `@${person.githubHandle}` : person.name;
  let avatarBgColor: string;
  if (color === "success") { avatarBgColor = "success.main"; }
  else if (color === "error") { avatarBgColor = "error.main"; }
  else { avatarBgColor = "action.selected"; }
  return (
    <Tooltip title={display}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: "nowrap" }}>
          {label}:
        </Typography>
        <Avatar
          src={person.avatarUrl}
          alt={person.name}
          sx={{
            width: 18,
            height: 18,
            fontSize: "0.6rem",
            bgcolor: avatarBgColor,
          }}
        >
          {!person.avatarUrl && initials}
        </Avatar>
        <Typography variant="caption" fontWeight={600} color="text.secondary">
          {display}
        </Typography>
      </Box>
    </Tooltip>
  );
}

export default function TransferenciasAdminPage(): React.JSX.Element {
  const { ready, isLoggedIn, isAdmin, user, authFetch } = useAuth();
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";
  const history = useHistory();

  const isFinanceAnalyzer = user?.role === "finance-analyzer";
  const canAccess = isAdmin || isFinanceAnalyzer;

  const [tab, setTab] = useState(0);
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // New transfer dialog (finance-analyzer)
  const [newDialog, setNewDialog] = useState(false);
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [destAccountId, setDestAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  // Review state
  const [approveTarget, setApproveTarget] = useState<TransferRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<TransferRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const transfersRes = await authFetch(`${apiUrl}/account-transfers`);
      const accountsRes = isAdmin
        ? await authFetch(`${apiUrl}/ledger/accounts`)
        : await fetch(`${apiUrl}/ledger/community-balances`);

      const transfersBody = await parseAuthJson<{ data?: TransferRequest[] }>(
        transfersRes,
        setLoadError,
      );
      if (!transfersBody) return;
      const accountsData = await parseAuthJson<unknown>(accountsRes, setLoadError);

      setRequests(Array.isArray(transfersBody.data) ? transfersBody.data : []);
      setAccounts(Array.isArray(accountsData) ? (accountsData as Account[]) : []);
    } catch {
      setLoadError("Erro inesperado ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, authFetch, isAdmin]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !canAccess) { history.replace("/"); return; }
    fetchData();
  }, [ready, isLoggedIn, canAccess, history, fetchData]);

  const handleCreate = async () => {
    setActionLoading(true);
    setActionError("");
    try {
      const res = await authFetch(`${apiUrl}/account-transfers`, {
        method: "POST",
        body: JSON.stringify({
          sourceAccountId,
          destinationAccountId: destAccountId,
          amount: Math.round(Number.parseFloat(amount)),
          reason,
        }),
      });
      if (!res.ok) {
        setActionError(await extractErrorMessage(res, "Erro ao criar solicitação."));
        return;
      }
      setNewDialog(false);
      setSourceAccountId(""); setDestAccountId(""); setAmount(""); setReason("");
      fetchData();
    } catch {
      setActionError("Erro inesperado.");
    } finally {
      setActionLoading(false);
    }
  };

  const [approveNote, setApproveNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  const handleApprove = async () => {
    if (!approveTarget) return;
    setActionLoading(true);
    setActionError("");
    try {
      const res = await authFetch(`${apiUrl}/account-transfers/${approveTarget.id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ reviewNote: approveNote }),
      });
      if (!res.ok) {
        setActionError(await extractErrorMessage(res, "Erro ao aprovar."));
        return;
      }
      setApproveTarget(null);
      setApproveNote("");
      fetchData();
    } catch {
      setActionError("Erro inesperado.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setActionLoading(true);
    setActionError("");
    try {
      const res = await authFetch(`${apiUrl}/account-transfers/${rejectTarget.id}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reviewNote: rejectNote }),
      });
      if (!res.ok) {
        setActionError(await extractErrorMessage(res, "Erro ao rejeitar."));
        return;
      }
      setRejectTarget(null);
      setRejectNote("");
      fetchData();
    } catch {
      setActionError("Erro inesperado.");
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = requests.filter((r) => {
    if (tab === 0) return r.status === "pending";
    if (tab === 1) return r.status === "approved";
    return r.status === "rejected";
  });

  if (!ready || !isLoggedIn || !canAccess) {
    return (
      <Layout title="Transferências">
        <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  let emptyLabel: string;
  if (tab === 0) { emptyLabel = "pendente"; }
  else if (tab === 1) { emptyLabel = "aprovada"; }
  else { emptyLabel = "rejeitada"; }
  let transferListContent: React.ReactNode;
  if (loading) {
    transferListContent = (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  } else if (filtered.length === 0) {
    transferListContent = (
      <Typography color="text.secondary" textAlign="center" py={6}>
        Nenhuma transferência {emptyLabel}.
      </Typography>
    );
  } else {
    transferListContent = (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {filtered.map((req) => {
          const sc = statusConfig[req.status];
          return (
            <Card key={req.id} variant="outlined">
              <CardContent>
                {/* ── Cabeçalho: motivo + valor + status ── */}
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={700} gutterBottom>
                      {req.reason}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(req.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0 }}>
                    <Chip icon={sc.icon} label={sc.label} color={sc.color} size="small" variant="outlined" />
                    <Typography variant="h6" fontWeight={800} color="primary.main">
                      {formatBRL(req.amount)}
                    </Typography>
                  </Box>
                </Box>

                {/* ── Rota da transferência ── */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
                  <Chip label={req.sourceAccount?.name} size="small" variant="outlined" />
                  <Typography variant="caption" color="text.secondary">→</Typography>
                  <Chip label={req.destinationAccount?.name} size="small" variant="outlined" color="primary" />
                </Box>

                {/* ── Pessoas envolvidas ── */}
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center", mb: req.reviewNote || (req.status === "pending" && isAdmin) ? 1.5 : 0 }}>
                  {req.requestedBy && (
                    <PersonBadge
                      label="Solicitante"
                      person={req.requestedBy}
                    />
                  )}
                  {req.reviewedBy && req.status !== "pending" && (
                    <>
                      <Typography variant="caption" color="text.disabled">·</Typography>
                      <PersonBadge
                        label={req.status === "approved" ? "Aprovado por" : "Rejeitado por"}
                        person={req.reviewedBy}
                        color={req.status === "approved" ? "success" : "error"}
                      />
                      {req.reviewedAt && (
                        <Typography variant="caption" color="text.disabled">
                          em {new Date(req.reviewedAt).toLocaleDateString("pt-BR")}
                        </Typography>
                      )}
                    </>
                  )}
                </Box>

                {req.reviewNote && (
                  <Alert severity={req.status === "approved" ? "success" : "error"} sx={{ mt: 1.5 }}>
                    <strong>{req.reviewedBy?.name}:</strong> {req.reviewNote}
                  </Alert>
                )}

                {req.status === "pending" && isAdmin && (
                  <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      onClick={() => { setApproveTarget(req); setApproveNote(""); setActionError(""); }}
                    >
                      Aprovar
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={() => { setRejectTarget(req); setRejectNote(""); setActionError(""); }}
                    >
                      Rejeitar
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Box>
    );
  }

  return (
    <Layout title="Transferências Internas" description="Pedidos de transferência entre contas do ledger">
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 4, flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={800}>Transferências Internas</Typography>
            <Typography variant="body2" color="text.secondary">
              Finance-analyzers solicitam · Admins aprovam
            </Typography>
          </Box>
          {(isFinanceAnalyzer || isAdmin) && (
            <Button variant="contained" startIcon={<CompareArrowsIcon />} onClick={() => { setNewDialog(true); setActionError(""); }}>
              Nova Solicitação
            </Button>
          )}
        </Box>

        {loadError && <Alert severity="error" sx={{ mb: 3 }}>{loadError}</Alert>}

        {!isAdmin && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Apenas admins podem aprovar ou rejeitar transferências. Suas solicitações ficam visíveis aqui após a criação.
          </Alert>
        )}

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab label={`Pendentes (${requests.filter((r) => r.status === "pending").length})`} />
          <Tab label={`Aprovadas (${requests.filter((r) => r.status === "approved").length})`} />
          <Tab label={`Rejeitadas (${requests.filter((r) => r.status === "rejected").length})`} />
        </Tabs>

        {transferListContent}
      </Container>

      {/* ── New Transfer Dialog ── */}
      <Dialog open={newDialog} onClose={() => setNewDialog(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderTop: 3, borderColor: "primary.main" } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Nova Solicitação de Transferência</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Conta de Origem</InputLabel>
              <Select value={sourceAccountId} onChange={(e) => setSourceAccountId(e.target.value)} label="Conta de Origem">
                {accounts.map((a: any) => (
                  <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel>Conta de Destino</InputLabel>
              <Select value={destAccountId} onChange={(e) => setDestAccountId(e.target.value)} label="Conta de Destino">
                {accounts.map((a: any) => (
                  <MenuItem key={a.id} value={a.id} disabled={a.id === sourceAccountId}>{a.name}</MenuItem>
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
              label="Justificativa"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              multiline
              rows={3}
              placeholder="Ex: Carteira Dev Paraná com saldo insuficiente para reembolso #abc123"
            />
            {actionError && <Alert severity="error">{actionError}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNewDialog(false)} color="inherit" disabled={actionLoading}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!sourceAccountId || !destAccountId || !amount || !reason.trim() || actionLoading}
            onClick={handleCreate}
            startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Enviar para Admin
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Approve — ModalConfirm simples (nota opcional) ── */}
      <ModalConfirm
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        title="Aprovar Transferência?"
        description={
          approveTarget && (
            <>
              Confirma a transferência de{" "}
              <strong>{formatBRL(approveTarget.amount)}</strong> de{" "}
              <strong>{approveTarget.sourceAccount?.name}</strong> para{" "}
              <strong>{approveTarget.destinationAccount?.name}</strong>.
              O ledger será atualizado automaticamente.
            </>
          )
        }
        variant="success"
        confirmLabel="Confirmar Aprovação"
        loading={actionLoading}
        error={actionError}
        onConfirm={handleApprove}
      />

      {/* ── Reject — Dialog com nota obrigatória ── */}
      <Dialog open={!!rejectTarget} onClose={() => setRejectTarget(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderTop: 3, borderColor: "error.main" } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Rejeitar Transferência</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            {rejectTarget && (
              <Typography variant="body2" color="text.secondary">
                Rejeitando {formatBRL(rejectTarget.amount)} de{" "}
                <strong>{rejectTarget.sourceAccount?.name}</strong> →{" "}
                <strong>{rejectTarget.destinationAccount?.name}</strong>.
              </Typography>
            )}
            <TextField
              label="Motivo (obrigatório)"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              required
              multiline
              rows={3}
              fullWidth
              autoFocus
            />
            {actionError && <Alert severity="error">{actionError}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRejectTarget(null)} color="inherit" disabled={actionLoading}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            disabled={!rejectNote.trim() || actionLoading}
            onClick={handleReject}
            startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Confirmar Rejeição
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}

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
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import DeleteIcon from "@mui/icons-material/Delete";
import UndoIcon from "@mui/icons-material/Undo";
import { useAuth } from "../../hooks/useAuth";
import ModalConfirm from "../../components/ModalConfirm";

interface ReimbursementRequest {
  id: string;
  member: { name: string; avatarUrl: string; githubHandle: string };
  account: { id: string; name: string };
  amount: number;
  description: string;
  receiptUrl: string;
  internalReceiptUrl: string | null;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  reviewedBy: { name: string } | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface CommunityBalance {
  id: string;
  projectKey: string;
  name: string;
  balance: number;
}

const DRIVE_FOLDER_URL =
  "https://drive.google.com/drive/folders/1z8wP1XzfuTZs8Qp40mVm74UPBbHUWQUY";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const statusConfig = {
  pending: { label: "Pendente", color: "warning" as const, icon: <HourglassEmptyIcon fontSize="small" /> },
  approved: { label: "Aprovado", color: "success" as const, icon: <CheckCircleIcon fontSize="small" /> },
  rejected: { label: "Rejeitado", color: "error" as const, icon: <CancelIcon fontSize="small" /> },
};

export default function ReembolsosAdminPage(): React.JSX.Element {
  const { ready, isLoggedIn, isAdmin, user, authFetch } = useAuth();
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";
  const history = useHistory();

  const isFinanceAnalyzer = user?.role === "finance-analyzer";
  const canAccess = isAdmin || isFinanceAnalyzer;

  const [tab, setTab] = useState(0);
  const [requests, setRequests] = useState<ReimbursementRequest[]>([]);
  const [balances, setBalances] = useState<CommunityBalance[]>([]);
  const [loading, setLoading] = useState(true);

  // Approve dialog state
  const [approveDialog, setApproveDialog] = useState<ReimbursementRequest | null>(null);
  const [internalReceiptUrl, setInternalReceiptUrl] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  // Reject dialog state
  const [rejectDialog, setRejectDialog] = useState<ReimbursementRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Revert state
  const [revertId, setRevertId] = useState<string | null>(null);
  const [revertLoading, setRevertLoading] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      authFetch(`${apiUrl}/reimbursements`).then((r) => r.json()),
      fetch(`${apiUrl}/ledger/community-balances`).then((r) => r.json()),
    ])
      .then(([reqs, bals]) => {
        setRequests(Array.isArray(reqs.data) ? reqs.data : []);
        setBalances(Array.isArray(bals) ? bals : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiUrl, authFetch]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !canAccess) { history.replace("/"); return; }
    fetchData();
  }, [ready, isLoggedIn, canAccess, history, fetchData]);

  const getBalance = (accountId: string) => {
    const found = balances.find((b) => b.id === accountId);
    return found?.balance ?? null;
  };

  const handleApprove = async () => {
    if (!approveDialog) return;
    setActionLoading(true);
    setActionError("");
    try {
      const res = await authFetch(`${apiUrl}/reimbursements/${approveDialog.id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ internalReceiptUrl, reviewNote: approveNote }),
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.message ?? "Erro ao aprovar.");
        return;
      }
      setApproveDialog(null);
      setInternalReceiptUrl("");
      setApproveNote("");
      fetchData();
    } catch {
      setActionError("Erro inesperado.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog) return;
    setActionLoading(true);
    setActionError("");
    try {
      const res = await authFetch(`${apiUrl}/reimbursements/${rejectDialog.id}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reviewNote: rejectNote }),
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.message ?? "Erro ao rejeitar.");
        return;
      }
      setRejectDialog(null);
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
      <Layout title="Reembolsos">
        <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  let tabLabel: string;
  if (tab === 0) { tabLabel = "pendente"; }
  else if (tab === 1) { tabLabel = "aprovada"; }
  else { tabLabel = "rejeitada"; }

  let listContent: React.JSX.Element;
  if (loading) {
    listContent = (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  } else if (filtered.length === 0) {
    listContent = (
      <Typography color="text.secondary" textAlign="center" py={6}>
        Nenhuma solicitação {tabLabel}.
      </Typography>
    );
  } else {
    listContent = (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {filtered.map((req) => {
          const balance = getBalance(req.account?.id);
          const hasEnough = balance === null || balance >= req.amount;
          const sc = statusConfig[req.status];
          return (
            <Card key={req.id} variant="outlined">
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Avatar src={req.member?.avatarUrl} alt={req.member?.name} sx={{ width: 36, height: 36 }} />
                    <Box>
                      <Typography variant="body2" fontWeight={700}>{req.member?.name}</Typography>
                      <Typography variant="caption" color="text.secondary">@{req.member?.githubHandle}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Chip icon={sc.icon} label={sc.label} color={sc.color} size="small" variant="outlined" />
                    <Typography variant="h6" fontWeight={800} color="primary.main">
                      {formatBRL(req.amount)}
                    </Typography>
                  </Box>
                </Box>

                <Typography variant="body2" sx={{ mb: 1 }}>{req.description}</Typography>

                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", mb: 1 }}>
                  <Chip label={req.account?.name} size="small" variant="outlined" />
                  {balance !== null && (
                    <Chip
                      label={`Saldo: ${formatBRL(balance)}`}
                      size="small"
                      color={hasEnough ? "success" : "error"}
                      variant="outlined"
                    />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {new Date(req.createdAt).toLocaleDateString("pt-BR")}
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<ReceiptLongIcon />}
                    endIcon={<OpenInNewIcon />}
                    href={req.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Comprovante original
                  </Button>
                  {req.internalReceiptUrl && (
                    <Button
                      size="small"
                      variant="text"
                      color="success"
                      startIcon={<DriveFileMoveIcon />}
                      endIcon={<OpenInNewIcon />}
                      href={req.internalReceiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Cópia interna
                    </Button>
                  )}
                </Box>

                {req.reviewNote && (
                  <Alert severity={req.status === "approved" ? "success" : "error"} sx={{ mt: 1.5 }}>
                    <strong>{req.reviewedBy?.name}:</strong> {req.reviewNote}
                  </Alert>
                )}

                {req.status === "pending" && (
                  <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                    <Tooltip title={hasEnough ? "" : "Saldo insuficiente — solicite uma transferência ao Admin"}>
                      <span>
                        <Button
                          variant="contained"
                          color="success"
                          size="small"
                          disabled={!hasEnough}
                          onClick={() => { setApproveDialog(req); setActionError(""); }}
                        >
                          Aprovar
                        </Button>
                      </span>
                    </Tooltip>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={() => { setRejectDialog(req); setActionError(""); }}
                    >
                      Rejeitar
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="text"
                        color="error"
                        size="small"
                        startIcon={<DeleteIcon />}
                        onClick={() => setDeleteId(req.id)}
                      >
                        Excluir
                      </Button>
                    )}
                    {!hasEnough && (
                      <Button
                        variant="text"
                        size="small"
                        href="/admin/transferencias"
                      >
                        Solicitar transferência →
                      </Button>
                    )}
                  </Box>
                )}

                {req.status !== "pending" && isAdmin && (
                  <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                    {req.status === "approved" && (
                      <Button
                        variant="outlined"
                        color="warning"
                        size="small"
                        startIcon={<UndoIcon />}
                        onClick={() => setRevertId(req.id)}
                      >
                        Reverter aprovação
                      </Button>
                    )}
                    <Button
                      variant="text"
                      color="error"
                      size="small"
                      startIcon={<DeleteIcon />}
                      onClick={() => setDeleteId(req.id)}
                    >
                      Excluir{req.status === "approved" ? " (com estorno)" : ""}
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
    <Layout title="Gestão de Reembolsos" description="Aprovar ou rejeitar solicitações de reembolso">
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 4, flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={800}>
              Reembolsos
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Solicitações de reembolso dos membros da Codaqui
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DriveFileMoveIcon />}
            href={DRIVE_FOLDER_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Pasta de Comprovantes
          </Button>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          <strong>Responsabilidade do aprovador:</strong> ao aprovar, copie o comprovante original para a{" "}
          <a href={DRIVE_FOLDER_URL} target="_blank" rel="noopener noreferrer">
            pasta interna do Drive
          </a>{" "}
          e informe o novo link no campo de aprovação.
        </Alert>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab label={`Pendentes (${requests.filter((r) => r.status === "pending").length})`} />
          <Tab label={`Aprovados (${requests.filter((r) => r.status === "approved").length})`} />
          <Tab label={`Rejeitados (${requests.filter((r) => r.status === "rejected").length})`} />
        </Tabs>

        {listContent}
      </Container>

      {/* ── Approve Dialog — mantém Dialog rico (requer link do Drive + nota) ── */}
      <Dialog open={!!approveDialog} onClose={() => setApproveDialog(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderTop: 3, borderColor: "success.main" } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Aprovar Reembolso</DialogTitle>
        <DialogContent>
          {approveDialog && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
              <Alert severity="info" icon={<DriveFileMoveIcon />}>
                <strong>Antes de aprovar:</strong>{" "}
                <a href={approveDialog.receiptUrl} target="_blank" rel="noopener noreferrer">
                  Abra o comprovante original
                </a>
                {" "}→ copie para a{" "}
                <a href={DRIVE_FOLDER_URL} target="_blank" rel="noopener noreferrer">
                  pasta interna do Drive
                </a>
                {" "}→ cole o link abaixo.
              </Alert>
              <TextField
                label="Link interno (cópia no Drive)"
                value={internalReceiptUrl}
                onChange={(e) => setInternalReceiptUrl(e.target.value)}
                required
                placeholder="https://drive.google.com/file/d/..."
                fullWidth
              />
              <TextField
                label="Nota (opcional)"
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                multiline
                rows={2}
                fullWidth
              />
              {actionError && <Alert severity="error">{actionError}</Alert>}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setApproveDialog(null)} color="inherit" disabled={actionLoading}>Cancelar</Button>
          <Button
            variant="contained"
            color="success"
            disabled={!internalReceiptUrl.trim() || actionLoading}
            onClick={handleApprove}
            startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Confirmar Aprovação
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <ModalConfirm
        open={!!deleteId}
        title="Excluir reembolso?"
        description={
          requests.find((r) => r.id === deleteId)?.status === "approved"
            ? "Este reembolso já foi aprovado. Um lançamento de estorno será criado no ledger para reverter a operação."
            : "A solicitação será permanentemente removida."
        }
        onConfirm={async () => {
          if (!deleteId) return;
          setDeleteLoading(true);
          try {
            const res = await authFetch(`${apiUrl}/reimbursements/${deleteId}`, { method: "DELETE" });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              setActionError(err.message || "Erro ao excluir.");
              return;
            }
            setDeleteId(null);
            fetchData();
          } catch {
            setActionError("Erro ao excluir reembolso.");
          } finally {
            setDeleteLoading(false);
          }
        }}
        onClose={() => setDeleteId(null)}
        loading={deleteLoading}
      />

      {/* ── Revert Confirmation ── */}
      <ModalConfirm
        open={!!revertId}
        title="Reverter aprovação?"
        description="A aprovação será desfeita: um estorno será lançado no ledger e o status voltará para PENDENTE, permitindo reavaliação."
        onConfirm={async () => {
          if (!revertId) return;
          setRevertLoading(true);
          try {
            const res = await authFetch(`${apiUrl}/reimbursements/${revertId}/revert`, { method: "PATCH" });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              setActionError(err.message || "Erro ao reverter.");
              return;
            }
            setRevertId(null);
            fetchData();
          } catch {
            setActionError("Erro ao reverter aprovação.");
          } finally {
            setRevertLoading(false);
          }
        }}
        onClose={() => setRevertId(null)}
        loading={revertLoading}
      />

      {/* ── Reject — ModalConfirm com campo de nota ── */}
      <Dialog open={!!rejectDialog} onClose={() => setRejectDialog(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderTop: 3, borderColor: "error.main" } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Rejeitar Solicitação</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            {rejectDialog && (
              <Typography variant="body2" color="text.secondary">
                Rejeitando reembolso de <strong>{formatBRL(rejectDialog.amount)}</strong>{" "}
                de <strong>@{rejectDialog.member?.githubHandle}</strong>.
                O motivo será exibido ao solicitante.
              </Typography>
            )}
            <TextField
              label="Motivo da rejeição (obrigatório)"
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
          <Button onClick={() => setRejectDialog(null)} color="inherit" disabled={actionLoading}>Cancelar</Button>
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

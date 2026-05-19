import React, { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@theme/Layout";
import { useHistory } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import InputAdornment from "@mui/material/InputAdornment";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import PostAddIcon from "@mui/icons-material/PostAdd";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { useAuth } from "../../hooks/useAuth";
import AdminNavbar from "../../components/AdminNavbar";
import AdminPageContainer from "../../components/AdminPageContainer";
import { parseAuthJson, extractErrorMessage } from "../../hooks/authFetchHelpers";
import ModalConfirm from "../../components/ModalConfirm";

interface Account {
  id: string;
  name: string;
  type: string;
  projectKey: string | null;
}

interface TransferRequest {
  id: string;
  amount: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: { name: string; githubHandle: string };
  reviewedBy: { name: string } | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  sourceAccount: { name: string };
  destinationAccount: { name: string };
}

export default function LancamentoPage(): React.JSX.Element {
  const { ready, isLoggedIn, isAdmin, authFetch } = useAuth();
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";
  const history = useHistory();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(0);

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

  const [externalDialogOpen, setExternalDialogOpen] = useState(false);
  const [externalAccountName, setExternalAccountName] = useState("");
  const [externalProjectKey, setExternalProjectKey] = useState("");
  const [externalAccountError, setExternalAccountError] = useState("");
  const [externalAccountLoading, setExternalAccountLoading] = useState(false);
  const [transferTab, setTransferTab] = useState(0);
  const [newTransferOpen, setNewTransferOpen] = useState(false);
  const [transferSourceAccountId, setTransferSourceAccountId] = useState("");
  const [transferDestinationAccountId, setTransferDestinationAccountId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferActionError, setTransferActionError] = useState("");
  const [transferActionLoading, setTransferActionLoading] = useState(false);
  const [approveTarget, setApproveTarget] = useState<TransferRequest | null>(null);
  const [approveNote, setApproveNote] = useState("");
  const [rejectTarget, setRejectTarget] = useState<TransferRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const pendingTransfers = useMemo(
    () => transfers.filter((transfer) => transfer.status === "pending"),
    [transfers],
  );
  const filteredTransfers = useMemo(() => {
    if (transferTab === 0) return transfers.filter((transfer) => transfer.status === "pending");
    if (transferTab === 1) return transfers.filter((transfer) => transfer.status === "approved");
    return transfers.filter((transfer) => transfer.status === "rejected");
  }, [transfers, transferTab]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [accountsRes, transfersRes] = await Promise.all([
        authFetch(`${apiUrl}/ledger/accounts`),
        authFetch(`${apiUrl}/account-transfers`),
      ]);

      const accountsData = await parseAuthJson<Account[]>(accountsRes, setError);
      const transfersData = await parseAuthJson<{ data?: TransferRequest[] }>(
        transfersRes,
        setError,
      );

      if (accountsData) {
        setAccounts(accountsData);
      }
      const nextTransfers = Array.isArray(transfersData?.data) ? transfersData.data : [];
      setTransfers(nextTransfers);
    } catch {
      setError("Não foi possível carregar os dados de lançamento.");
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
    fetchData();
  }, [ready, isLoggedIn, isAdmin, history, fetchData]);

  useEffect(() => {
    if (globalThis.window === undefined) return;
    const tabParam = new URLSearchParams(globalThis.location.search).get("tab");
    if (tabParam === "transferencias") {
      setTab(1);
    }
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSuccess(false);
    if (!form.sourceAccountId || !form.destinationAccountId || !form.amount || !form.description) {
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

      const res = await authFetch(`${apiUrl}/ledger/transactions`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, "Falha ao registrar lançamento."));
      }

      setSuccess(true);
      setForm({
        sourceAccountId: "",
        destinationAccountId: "",
        amount: "",
        description: "",
        referenceId: "",
      });
      await fetchData();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Falha ao registrar lançamento.");
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
      const res = await authFetch(`${apiUrl}/ledger/accounts`, {
        method: "POST",
        body: JSON.stringify({
          name: externalAccountName.trim(),
          type: "EXTERNAL",
          ...(externalProjectKey.trim() && { projectKey: externalProjectKey.trim() }),
        }),
      });

      if (!res.ok) {
        setExternalAccountError(await extractErrorMessage(res, "Não foi possível criar a conta externa."));
        setExternalAccountLoading(false);
        return;
      }

      setExternalDialogOpen(false);
      setExternalAccountName("");
      setExternalProjectKey("");
      await fetchData();
    } catch {
      setExternalAccountError("Erro inesperado ao criar conta externa.");
    } finally {
      setExternalAccountLoading(false);
    }
  };

  const createTransferRequest = async () => {
    setTransferActionLoading(true);
    setTransferActionError("");
    try {
      const amount = Math.round(Number.parseFloat(transferAmount));
      if (!transferSourceAccountId || !transferDestinationAccountId || Number.isNaN(amount) || amount <= 0 || !transferReason.trim()) {
        setTransferActionError("Preencha origem, destino, valor (> 0) e justificativa.");
        setTransferActionLoading(false);
        return;
      }
      const res = await authFetch(`${apiUrl}/account-transfers`, {
        method: "POST",
        body: JSON.stringify({
          sourceAccountId: transferSourceAccountId,
          destinationAccountId: transferDestinationAccountId,
          amount,
          reason: transferReason.trim(),
        }),
      });
      if (!res.ok) {
        setTransferActionError(await extractErrorMessage(res, "Não foi possível criar solicitação."));
        setTransferActionLoading(false);
        return;
      }
      setNewTransferOpen(false);
      setTransferSourceAccountId("");
      setTransferDestinationAccountId("");
      setTransferAmount("");
      setTransferReason("");
      await fetchData();
    } catch {
      setTransferActionError("Erro inesperado ao criar solicitação.");
    } finally {
      setTransferActionLoading(false);
    }
  };

  const approveTransfer = async () => {
    if (!approveTarget) return;
    setTransferActionLoading(true);
    setTransferActionError("");
    try {
      const res = await authFetch(`${apiUrl}/account-transfers/${approveTarget.id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ reviewNote: approveNote }),
      });
      if (!res.ok) {
        setTransferActionError(await extractErrorMessage(res, "Não foi possível aprovar solicitação."));
        setTransferActionLoading(false);
        return;
      }
      setApproveTarget(null);
      setApproveNote("");
      await fetchData();
    } catch {
      setTransferActionError("Erro inesperado ao aprovar solicitação.");
    } finally {
      setTransferActionLoading(false);
    }
  };

  const rejectTransfer = async () => {
    if (!rejectTarget) return;
    setTransferActionLoading(true);
    setTransferActionError("");
    try {
      const res = await authFetch(`${apiUrl}/account-transfers/${rejectTarget.id}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reviewNote: rejectNote }),
      });
      if (!res.ok) {
        setTransferActionError(await extractErrorMessage(res, "Não foi possível rejeitar solicitação."));
        setTransferActionLoading(false);
        return;
      }
      setRejectTarget(null);
      setRejectNote("");
      await fetchData();
    } catch {
      setTransferActionError("Erro inesperado ao rejeitar solicitação.");
    } finally {
      setTransferActionLoading(false);
    }
  };

  if (!ready || !isLoggedIn || !isAdmin) {
    return <Layout><Box /></Layout>;
  }

  return (
    <Layout title="Lançamento Manual" description="Painel Admin">
      <AdminPageContainer>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h4" fontWeight={800} gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <PostAddIcon color="primary" fontSize="large" />
            Lançamento e Transferências
          </Typography>
          <Typography color="text.secondary">
            Registre lançamentos de dupla partida, crie contas externas e acompanhe solicitações de transferência.
          </Typography>
        </Box>

        <AdminNavbar active="/admin/lancamento" />

        {loading ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
              <Tab label="Lançamento direto" />
              <Tab label={`Transferências (${pendingTransfers.length} pendente${pendingTransfers.length === 1 ? "" : "s"})`} />
            </Tabs>

            {tab === 0 && (
              <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", p: 2 }}>
                <CardContent>
                  {success && (
                    <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }} onClose={() => setSuccess(false)}>
                      Transação registrada com sucesso no Ledger! Saldos atualizados em tempo real.
                    </Alert>
                  )}

                  {submitError && <Alert severity="error" sx={{ mb: 3 }}>{submitError}</Alert>}

                  <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
                    <Button
                      variant="outlined"
                      startIcon={<AddCircleOutlineIcon />}
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
                      <Box sx={{ display: "flex", gap: 2, flexWrap: { xs: "wrap", md: "nowrap" } }}>
                        <Box sx={{ flex: 1, minWidth: 200 }}>
                          <Typography variant="subtitle2" gutterBottom>Conta de Origem (Sai dinheiro)</Typography>
                          <Select
                            fullWidth
                            size="small"
                            value={form.sourceAccountId}
                            onChange={(event) => setForm({ ...form, sourceAccountId: event.target.value })}
                            displayEmpty
                          >
                            <MenuItem value="" disabled>Selecione a origem</MenuItem>
                            {accounts.map((account) => (
                              <MenuItem key={account.id} value={account.id}>
                                {account.name}
                                <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                                  ({account.type})
                                </Typography>
                              </MenuItem>
                            ))}
                          </Select>
                        </Box>

                        <Box sx={{ flex: 1, minWidth: 200 }}>
                          <Typography variant="subtitle2" gutterBottom>Conta de Destino (Entra dinheiro)</Typography>
                          <Select
                            fullWidth
                            size="small"
                            value={form.destinationAccountId}
                            onChange={(event) => setForm({ ...form, destinationAccountId: event.target.value })}
                            displayEmpty
                          >
                            <MenuItem value="" disabled>Selecione o destino</MenuItem>
                            {accounts.map((account) => (
                              <MenuItem key={account.id} value={account.id}>
                                {account.name}
                                <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                                  ({account.type})
                                </Typography>
                              </MenuItem>
                            ))}
                          </Select>
                        </Box>
                      </Box>

                      <Box>
                        <Typography variant="subtitle2" gutterBottom>Valor (R$)</Typography>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Ex: 150.00"
                          value={form.amount}
                          onChange={(event) => setForm({ ...form, amount: event.target.value })}
                          slotProps={{
                            input: { startAdornment: <InputAdornment position="start">R$</InputAdornment> },
                          }}
                        />
                      </Box>

                      <Box>
                        <Typography variant="subtitle2" gutterBottom>Descrição da Movimentação</Typography>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Ex: Patrocínio empresa XYZ, Ajuste caixa..."
                          value={form.description}
                          onChange={(event) => setForm({ ...form, description: event.target.value })}
                        />
                      </Box>

                      <Box>
                        <Typography variant="subtitle2" gutterBottom>ID de Referência Externa (Opcional)</Typography>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Ex: evt_live_xxx, PIX-123"
                          value={form.referenceId}
                          onChange={(event) => setForm({ ...form, referenceId: event.target.value })}
                        />
                      </Box>

                      <Button type="submit" variant="contained" color="primary" size="large" sx={{ fontWeight: "bold", mt: 1 }}>
                        Revisar lançamento
                      </Button>
                    </Box>
                  </form>
                </CardContent>
              </Card>
            )}

            {tab === 1 && (
              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Solicitações de transferência
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<CompareArrowsIcon />}
                    onClick={() => {
                      setTransferActionError("");
                      setNewTransferOpen(true);
                    }}
                  >
                    Nova solicitação
                  </Button>
                </Box>
                <Tabs value={transferTab} onChange={(_, value) => setTransferTab(value)} sx={{ mb: 2 }}>
                  <Tab label={`Pendentes (${pendingTransfers.length})`} />
                  <Tab label={`Aprovadas (${transfers.filter((transfer) => transfer.status === "approved").length})`} />
                  <Tab label={`Rejeitadas (${transfers.filter((transfer) => transfer.status === "rejected").length})`} />
                </Tabs>

                {transferActionError && <Alert severity="error" sx={{ mb: 2 }}>{transferActionError}</Alert>}

                {filteredTransfers.length === 0 ? (
                  <Alert severity="info">Nenhuma solicitação nesta aba.</Alert>
                ) : (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    {filteredTransfers.map((transfer) => {
                      let statusLabel = "Rejeitada";
                      let statusColor: "warning" | "success" | "error" = "error";
                      if (transfer.status === "pending") {
                        statusLabel = "Pendente";
                        statusColor = "warning";
                      } else if (transfer.status === "approved") {
                        statusLabel = "Aprovada";
                        statusColor = "success";
                      }
                      return (
                        <Card key={transfer.id} variant="outlined">
                          <CardContent>
                          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
                            <Box>
                              <Typography variant="body2" fontWeight={700}>{transfer.reason}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {transfer.sourceAccount?.name} → {transfer.destinationAccount?.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                Solicitado por @{transfer.requestedBy?.githubHandle} em {new Date(transfer.createdAt).toLocaleString("pt-BR")}
                              </Typography>
                              {transfer.reviewNote && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {transfer.reviewedBy?.name ?? "Revisão"}: {transfer.reviewNote}
                                </Typography>
                              )}
                            </Box>
                            <Box sx={{ textAlign: "right" }}>
                              <Chip
                                label={statusLabel}
                                size="small"
                                color={statusColor}
                                sx={{ mb: 0.5 }}
                              />
                              <Typography variant="body2" fontWeight={700}>
                                R$ {Number(transfer.amount).toFixed(2)}
                              </Typography>
                              {transfer.status === "pending" && (
                                <Box sx={{ display: "flex", gap: 1, mt: 1, justifyContent: "flex-end" }}>
                                  <Button size="small" variant="contained" color="success" onClick={() => { setApproveTarget(transfer); setApproveNote(""); setTransferActionError(""); }}>
                                    Aprovar
                                  </Button>
                                  <Button size="small" variant="outlined" color="error" onClick={() => { setRejectTarget(transfer); setRejectNote(""); setTransferActionError(""); }}>
                                    Rejeitar
                                  </Button>
                                </Box>
                              )}
                            </Box>
                          </Box>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Box>
                )}
              </Box>
            )}
          </>
        )}

        <ModalConfirm
          open={confirmOpen}
          title="Confirmar lançamento"
          description={(
            <Box>
              <Typography gutterBottom>Deseja efetuar o lançamento definitivo?</Typography>
              <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 1, mt: 2 }}>
                <Typography variant="body2"><strong>Valor:</strong> R$ {form.amount}</Typography>
                <Typography variant="body2"><strong>Origem:</strong> {accounts.find((account) => account.id === form.sourceAccountId)?.name}</Typography>
                <Typography variant="body2"><strong>Destino:</strong> {accounts.find((account) => account.id === form.destinationAccountId)?.name}</Typography>
                <Typography variant="body2"><strong>Descrição:</strong> {form.description}</Typography>
              </Box>
            </Box>
          )}
          confirmLabel="Confirmar lançamento"
          variant="info"
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleConfirm}
          loading={submitLoading}
        />

        <Dialog open={externalDialogOpen} onClose={() => setExternalDialogOpen(false)} maxWidth="sm" fullWidth>
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
              {externalAccountError && <Alert severity="error">{externalAccountError}</Alert>}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExternalDialogOpen(false)} color="inherit" disabled={externalAccountLoading}>
              Cancelar
            </Button>
            <Button variant="contained" onClick={createExternalAccount} disabled={externalAccountLoading}>
              Criar conta
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={newTransferOpen} onClose={() => setNewTransferOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Nova solicitação de transferência</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <Select
                displayEmpty
                value={transferSourceAccountId}
                onChange={(event) => setTransferSourceAccountId(event.target.value)}
              >
                <MenuItem value="" disabled>Conta de origem</MenuItem>
                {accounts.map((account) => (
                  <MenuItem key={account.id} value={account.id}>{account.name}</MenuItem>
                ))}
              </Select>
              <Select
                displayEmpty
                value={transferDestinationAccountId}
                onChange={(event) => setTransferDestinationAccountId(event.target.value)}
              >
                <MenuItem value="" disabled>Conta de destino</MenuItem>
                {accounts.map((account) => (
                  <MenuItem key={account.id} value={account.id} disabled={account.id === transferSourceAccountId}>
                    {account.name}
                  </MenuItem>
                ))}
              </Select>
              <TextField
                label="Valor (R$)"
                type="number"
                value={transferAmount}
                onChange={(event) => setTransferAmount(event.target.value)}
                inputProps={{ min: 1, step: 1 }}
              />
              <TextField
                label="Justificativa"
                value={transferReason}
                onChange={(event) => setTransferReason(event.target.value)}
                multiline
                rows={3}
              />
              {transferActionError && <Alert severity="error">{transferActionError}</Alert>}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setNewTransferOpen(false)} color="inherit" disabled={transferActionLoading}>
              Cancelar
            </Button>
            <Button variant="contained" onClick={createTransferRequest} disabled={transferActionLoading}>
              Enviar
            </Button>
          </DialogActions>
        </Dialog>

        <ModalConfirm
          open={!!approveTarget}
          onClose={() => setApproveTarget(null)}
          title="Aprovar transferência?"
          description={approveTarget ? `Confirma a transferência de R$ ${Number(approveTarget.amount).toFixed(2)} de ${approveTarget.sourceAccount?.name} para ${approveTarget.destinationAccount?.name}?` : ""}
          confirmLabel="Aprovar"
          variant="success"
          loading={transferActionLoading}
          onConfirm={approveTransfer}
        />

        <Dialog open={!!rejectTarget} onClose={() => setRejectTarget(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Rejeitar solicitação</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="Motivo"
                value={rejectNote}
                onChange={(event) => setRejectNote(event.target.value)}
                multiline
                rows={3}
              />
              {transferActionError && <Alert severity="error">{transferActionError}</Alert>}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRejectTarget(null)} color="inherit" disabled={transferActionLoading}>
              Cancelar
            </Button>
            <Button variant="contained" color="error" onClick={rejectTransfer} disabled={!rejectNote.trim() || transferActionLoading}>
              Rejeitar
            </Button>
          </DialogActions>
        </Dialog>
      </AdminPageContainer>
    </Layout>
  );
}

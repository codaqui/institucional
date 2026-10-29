/**
 * Aba "Transferências" de /admin/lancamento — solicitações de transferência
 * entre contas com aprovação/rejeição + diálogo de nova solicitação.
 * Port de `src/pages/admin/lancamento.tsx` (Docusaurus).
 */
import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import ModalConfirm from "../ui/ModalConfirm";
import { useAuth } from "../../../../lib/use-auth";
import { extractErrorMessage } from "../../../../lib/auth-fetch-helpers";
import { formatBRL, parseBrlInput } from "../../../../lib/transaction";
import type { Account, TransferRequest } from "./types";

interface TransfersPanelProps {
  readonly accounts: Account[];
  readonly transfers: TransferRequest[];
  /** Recarrega contas/transferências após mutações. */
  readonly onChanged: () => Promise<void>;
}

const TRANSFER_STATUS = {
  pending: { label: "Pendente", color: "warning" },
  approved: { label: "Aprovada", color: "success" },
  rejected: { label: "Rejeitada", color: "error" },
} as const;

export default function TransfersPanel({
  accounts,
  transfers,
  onChanged,
}: TransfersPanelProps): React.JSX.Element {
  const { authFetch } = useAuth();

  const [transferTab, setTransferTab] = useState(0);
  const [newTransferOpen, setNewTransferOpen] = useState(false);
  const [transferSourceAccountId, setTransferSourceAccountId] = useState("");
  const [transferDestinationAccountId, setTransferDestinationAccountId] =
    useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferActionError, setTransferActionError] = useState("");
  const [transferActionLoading, setTransferActionLoading] = useState(false);
  const [approveTarget, setApproveTarget] = useState<TransferRequest | null>(
    null,
  );
  const [approveNote, setApproveNote] = useState("");
  const [rejectTarget, setRejectTarget] = useState<TransferRequest | null>(
    null,
  );
  const [rejectNote, setRejectNote] = useState("");

  const filteredTransfers = useMemo(() => {
    if (transferTab === 0)
      return transfers.filter((transfer) => transfer.status === "pending");
    if (transferTab === 1)
      return transfers.filter((transfer) => transfer.status === "approved");
    return transfers.filter((transfer) => transfer.status === "rejected");
  }, [transfers, transferTab]);

  const countByStatus = (status: TransferRequest["status"]) =>
    transfers.filter((transfer) => transfer.status === status).length;

  const createTransferRequest = async () => {
    setTransferActionLoading(true);
    setTransferActionError("");
    try {
      const amount = parseBrlInput(transferAmount);
      if (
        !transferSourceAccountId ||
        !transferDestinationAccountId ||
        amount === null ||
        amount <= 0 ||
        !transferReason.trim()
      ) {
        setTransferActionError(
          "Preencha origem, destino, valor (> 0) e justificativa.",
        );
        setTransferActionLoading(false);
        return;
      }
      const res = await authFetch("/account-transfers", {
        method: "POST",
        body: JSON.stringify({
          sourceAccountId: transferSourceAccountId,
          destinationAccountId: transferDestinationAccountId,
          amount,
          reason: transferReason.trim(),
        }),
      });
      if (!res.ok) {
        setTransferActionError(
          await extractErrorMessage(
            res,
            "Não foi possível criar solicitação.",
          ),
        );
        setTransferActionLoading(false);
        return;
      }
      setNewTransferOpen(false);
      setTransferSourceAccountId("");
      setTransferDestinationAccountId("");
      setTransferAmount("");
      setTransferReason("");
      await onChanged();
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
      const res = await authFetch(
        `/account-transfers/${approveTarget.id}/approve`,
        {
          method: "PATCH",
          body: JSON.stringify({ reviewNote: approveNote }),
        },
      );
      if (!res.ok) {
        setTransferActionError(
          await extractErrorMessage(
            res,
            "Não foi possível aprovar solicitação.",
          ),
        );
        setTransferActionLoading(false);
        return;
      }
      setApproveTarget(null);
      setApproveNote("");
      await onChanged();
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
      const res = await authFetch(
        `/account-transfers/${rejectTarget.id}/reject`,
        {
          method: "PATCH",
          body: JSON.stringify({ reviewNote: rejectNote }),
        },
      );
      if (!res.ok) {
        setTransferActionError(
          await extractErrorMessage(
            res,
            "Não foi possível rejeitar solicitação.",
          ),
        );
        setTransferActionLoading(false);
        return;
      }
      setRejectTarget(null);
      setRejectNote("");
      await onChanged();
    } catch {
      setTransferActionError("Erro inesperado ao rejeitar solicitação.");
    } finally {
      setTransferActionLoading(false);
    }
  };

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
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
      <Tabs
        value={transferTab}
        onChange={(_, value) => setTransferTab(value)}
        sx={{ mb: 2 }}
      >
        <Tab label={`Pendentes (${countByStatus("pending")})`} />
        <Tab label={`Aprovadas (${countByStatus("approved")})`} />
        <Tab label={`Rejeitadas (${countByStatus("rejected")})`} />
      </Tabs>

      {transferActionError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {transferActionError}
        </Alert>
      )}

      {filteredTransfers.length === 0 ? (
        <Alert severity="info">Nenhuma solicitação nesta aba.</Alert>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {filteredTransfers.map((transfer) => {
            const status = TRANSFER_STATUS[transfer.status];
            return (
              <Card key={transfer.id} variant="outlined">
                <CardContent>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 2,
                      flexWrap: "wrap",
                    }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {transfer.reason}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {transfer.sourceAccount?.name} →{" "}
                        {transfer.destinationAccount?.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        Solicitado por @{transfer.requestedBy?.githubHandle} em{" "}
                        {new Date(transfer.createdAt).toLocaleString("pt-BR")}
                      </Typography>
                      {transfer.reviewNote && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block" }}
                        >
                          {transfer.reviewedBy?.name ?? "Revisão"}:{" "}
                          {transfer.reviewNote}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                      <Chip
                        label={status.label}
                        size="small"
                        color={status.color}
                        sx={{ mb: 0.5 }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {formatBRL(Number(transfer.amount))}
                      </Typography>
                      {transfer.status === "pending" && (
                        <Box
                          sx={{
                            display: "flex",
                            gap: 1,
                            mt: 1,
                            justifyContent: "flex-end",
                          }}
                        >
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={() => {
                              setApproveTarget(transfer);
                              setApproveNote("");
                              setTransferActionError("");
                            }}
                          >
                            Aprovar
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => {
                              setRejectTarget(transfer);
                              setRejectNote("");
                              setTransferActionError("");
                            }}
                          >
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

      <Dialog
        open={newTransferOpen}
        onClose={() => setNewTransferOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Nova solicitação de transferência</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <Select
              displayEmpty
              value={transferSourceAccountId}
              onChange={(event) =>
                setTransferSourceAccountId(event.target.value)
              }
            >
              <MenuItem value="" disabled>
                Conta de origem
              </MenuItem>
              {accounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.name}
                </MenuItem>
              ))}
            </Select>
            <Select
              displayEmpty
              value={transferDestinationAccountId}
              onChange={(event) =>
                setTransferDestinationAccountId(event.target.value)
              }
            >
              <MenuItem value="" disabled>
                Conta de destino
              </MenuItem>
              {accounts.map((account) => (
                <MenuItem
                  key={account.id}
                  value={account.id}
                  disabled={account.id === transferSourceAccountId}
                >
                  {account.name}
                </MenuItem>
              ))}
            </Select>
            <TextField
              label="Valor (R$)"
              type="number"
              value={transferAmount}
              onChange={(event) => setTransferAmount(event.target.value)}
              slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
            />
            <TextField
              label="Justificativa"
              value={transferReason}
              onChange={(event) => setTransferReason(event.target.value)}
              multiline
              rows={3}
            />
            {transferActionError && (
              <Alert severity="error">{transferActionError}</Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setNewTransferOpen(false)}
            color="inherit"
            disabled={transferActionLoading}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={createTransferRequest}
            disabled={transferActionLoading}
          >
            Enviar
          </Button>
        </DialogActions>
      </Dialog>

      <ModalConfirm
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        title="Aprovar transferência?"
        description={
          approveTarget
            ? `Confirma a transferência de ${formatBRL(
                Number(approveTarget.amount),
              )} de ${approveTarget.sourceAccount?.name} para ${approveTarget.destinationAccount?.name}?`
            : ""
        }
        confirmLabel="Aprovar"
        variant="success"
        loading={transferActionLoading}
        onConfirm={approveTransfer}
      />

      <Dialog
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        maxWidth="sm"
        fullWidth
      >
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
            {transferActionError && (
              <Alert severity="error">{transferActionError}</Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setRejectTarget(null)}
            color="inherit"
            disabled={transferActionLoading}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={rejectTransfer}
            disabled={!rejectNote.trim() || transferActionLoading}
          >
            Rejeitar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

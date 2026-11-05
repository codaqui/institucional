import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MuiIslandProvider from "../../MuiIslandProvider";
import PageContainer from "../ui/PageContainer";
import PaginationControls from "../../ui/PaginationControls";
import { useAuth } from "../../../../lib/use-auth";
import { extractErrorMessage, parseAuthJson } from "../../../../lib/auth-fetch-helpers";
import {
  DEFAULT_PAGE_SIZE,
  rangeLabel,
  type PaginatedResponse,
} from "../../../../lib/pagination";

interface PendingHourEntry {
  id: string;
  memberId: string;
  sourceType: string;
  sourceId: string;
  sourceLabel: string;
  hours: number | string;
  description: string;
  occurredAt: string;
  status: "pending";
  reportedById: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  rejectReason: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

const hoursFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

function HoursApprovalsInner(): React.JSX.Element | null {
  const { ready, isLoggedIn, isAdmin, isFinanceAnalyzer, authFetch } = useAuth();
  const canReview = isAdmin || isFinanceAnalyzer;
  const [items, setItems] = useState<PendingHourEntry[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingHourEntry | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [dialogError, setDialogError] = useState("");

  const loadPending = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await authFetch(`/hours/pending?page=${page}&limit=${DEFAULT_PAGE_SIZE}`);
      const result = await parseAuthJson<PaginatedResponse<PendingHourEntry>>(response, setLoadError);
      if (!result) return;
      setItems(Array.isArray(result.data) ? result.data : []);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setLimit(result.limit ?? DEFAULT_PAGE_SIZE);
    } catch {
      setLoadError("Não foi possível carregar a fila de horas.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, page]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !canReview) {
      window.location.replace("/");
      return;
    }
    void loadPending();
  }, [ready, isLoggedIn, canReview, loadPending]);

  const approve = async (entry: PendingHourEntry) => {
    setBusyId(entry.id);
    setReviewError("");
    setFeedback("");
    try {
      const response = await authFetch(`/hours/${entry.id}/approve`, { method: "POST" });
      if (!response.ok) {
        setReviewError(await extractErrorMessage(response, "Não foi possível aprovar as horas."));
        return;
      }
      setFeedback("Horas aprovadas com sucesso.");
      await loadPending();
    } catch {
      setReviewError("Não foi possível aprovar as horas.");
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (entry: PendingHourEntry) => {
    setRejectTarget(entry);
    setReason("");
    setReasonError("");
    setDialogError("");
    setFeedback("");
  };

  const reject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rejectTarget) return;
    if (!reason.trim()) {
      setReasonError("Informe o motivo da rejeição.");
      document.getElementById("hour-rejection-reason")?.focus();
      return;
    }
    setBusyId(rejectTarget.id);
    setReasonError("");
    setDialogError("");
    try {
      const response = await authFetch(`/hours/${rejectTarget.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!response.ok) {
        setDialogError(await extractErrorMessage(response, "Não foi possível rejeitar as horas."));
        return;
      }
      setRejectTarget(null);
      setReason("");
      setFeedback("Horas rejeitadas com sucesso.");
      await loadPending();
    } catch {
      setDialogError("Não foi possível rejeitar as horas.");
    } finally {
      setBusyId(null);
    }
  };

  if (!ready) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
        <CircularProgress aria-label="Carregando autenticação" />
      </Box>
    );
  }
  if (!isLoggedIn || !canReview) return null;

  return (
    <PageContainer>
      <Typography variant="h4" component="h2" sx={{ fontWeight: 800, mb: 1 }}>
        Aprovação de horas
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Revise os lançamentos pendentes. A rejeição sempre exige um motivo.
      </Typography>

      {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}
      {reviewError && <Alert severity="error" sx={{ mb: 2 }}>{reviewError}</Alert>}
      {feedback && <Alert severity="success" role="status" sx={{ mb: 2 }}>{feedback}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress aria-label="Carregando fila de horas" />
        </Box>
      ) : items.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
          Nenhum lançamento pendente.
        </Typography>
      ) : (
        <>
          <TableContainer
            component={Box}
            role="region"
            aria-labelledby="pending-hours-table-caption"
            tabIndex={0}
            sx={{ overflowX: "auto", mb: 2 }}
          >
            <Table size="small" aria-labelledby="pending-hours-table-caption" sx={{ minWidth: 820 }}>
              <caption id="pending-hours-table-caption">Fila de aprovação de horas</caption>
              <TableHead>
                <TableRow>
                  <TableCell component="th" scope="col">Membro</TableCell>
                  <TableCell component="th" scope="col">Atividade</TableCell>
                  <TableCell component="th" scope="col">Data</TableCell>
                  <TableCell component="th" scope="col">Horas</TableCell>
                  <TableCell component="th" scope="col" align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.memberId}</TableCell>
                    <TableCell component="th" scope="row">
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{entry.description}</Typography>
                      <Typography variant="caption" color="text.secondary">{entry.sourceLabel}</Typography>
                    </TableCell>
                    <TableCell>{dateFormatter.format(new Date(entry.occurredAt))}</TableCell>
                    <TableCell>{hoursFormatter.format(Number(entry.hours))}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <Button
                          size="small"
                          variant="contained"
                          aria-label={`Aprovar ${entry.description}`}
                          disabled={busyId !== null}
                          onClick={() => void approve(entry)}
                        >
                          Aprovar
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          aria-label={`Rejeitar ${entry.description}`}
                          disabled={busyId !== null}
                          onClick={() => openReject(entry)}
                        >
                          Rejeitar
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mb: 1 }}>
            {rangeLabel(page, limit, total)}
          </Typography>
          <PaginationControls
            page={page}
            totalPages={totalPages}
            onChange={setPage}
            itemLabel="lançamentos de horas"
          />
        </>
      )}

      <Dialog
        open={rejectTarget !== null}
        onClose={() => busyId === null && setRejectTarget(null)}
        aria-labelledby="reject-hours-title"
        fullWidth
        maxWidth="sm"
      >
        <form onSubmit={(event) => void reject(event)} noValidate>
          <DialogTitle id="reject-hours-title">Rejeitar lançamento de horas</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography color="text.secondary">{rejectTarget?.description}</Typography>
              {(reasonError || dialogError) && (
                <Alert severity="error">{reasonError || dialogError}</Alert>
              )}
              <TextField
                id="hour-rejection-reason"
                label="Motivo da rejeição"
                name="reason"
                required
                autoFocus
                multiline
                minRows={3}
                value={reason}
                error={Boolean(reasonError)}
                helperText="Explique por que o lançamento não pode ser aprovado."
                onChange={(event) => {
                  setReason(event.target.value);
                  setReasonError("");
                  setDialogError("");
                }}
                onBlur={() => {
                  if (!reason.trim()) setReasonError("Informe o motivo da rejeição.");
                }}
                slotProps={{ htmlInput: { maxLength: 500 } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              type="button"
              disabled={busyId !== null}
              onClick={() => setRejectTarget(null)}
            >
              Cancelar
            </Button>
            <Button type="submit" color="error" variant="contained" disabled={busyId !== null}>
              {busyId !== null ? "Rejeitando…" : "Confirmar rejeição"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </PageContainer>
  );
}

export default function HoursApprovalsApp(): React.JSX.Element {
  return (
    <MuiIslandProvider>
      <HoursApprovalsInner />
    </MuiIslandProvider>
  );
}

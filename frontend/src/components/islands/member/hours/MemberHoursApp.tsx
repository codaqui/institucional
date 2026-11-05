import { useCallback, useEffect, useState } from "react";
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
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PrintIcon from "@mui/icons-material/Print";
import MuiIslandProvider from "../../MuiIslandProvider";
import PageContainer from "../../admin/ui/PageContainer";
import { useAuth } from "../../../../lib/use-auth";
import { extractErrorMessage, parseAuthJson } from "../../../../lib/auth-fetch-helpers";
import { resolveApiUrl } from "../../../../lib/api-url";

interface HourEntry {
  id: string;
  memberId: string;
  sourceType: string;
  sourceId: string;
  sourceLabel: string;
  hours: number | string;
  description: string;
  occurredAt: string;
  status: "pending" | "approved" | "rejected";
  reportedById: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  rejectReason: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StatementEntry {
  id: string;
  sourceType: string;
  sourceLabel: string;
  hours: number | string;
  description: string;
  occurredAt: string;
}

interface HourStatement {
  memberId: string;
  from: string | null;
  to: string | null;
  totalHours: number | string;
  entries: StatementEntry[];
  verificationCode: string;
}

const hoursFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

function formatHours(value: number | string): string {
  return `${hoursFormatter.format(Number(value))} horas`;
}

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

function formatPeriod(from: string | null, to: string | null): string {
  if (from && to) return `${formatDate(from)} a ${formatDate(to)}`;
  if (from) return `a partir de ${formatDate(from)}`;
  if (to) return `até ${formatDate(to)}`;
  return "todo o histórico";
}

const statusLabels = {
  approved: "Aprovada",
  pending: "Pendente",
  rejected: "Rejeitada",
} as const;

function MemberHoursInner(): React.JSX.Element | null {
  const { user, ready, isLoggedIn, authFetch } = useAuth();
  const [entries, setEntries] = useState<HourEntry[]>([]);
  const [approvedTotal, setApprovedTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statement, setStatement] = useState<HourStatement | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementError, setStatementError] = useState("");
  const [printPending, setPrintPending] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [entriesResponse, summaryResponse] = await Promise.all([
        authFetch("/hours/me"),
        authFetch("/hours/me/summary"),
      ]);
      const result = await parseAuthJson<HourEntry[]>(entriesResponse, setLoadError);
      const summary = await parseAuthJson<{ totalHours: number | string }>(
        summaryResponse,
        setLoadError,
      );
      if (!result || !summary) return;
      setEntries(Array.isArray(result) ? result : []);
      setApprovedTotal(Number(summary.totalHours));
    } catch {
      setLoadError("Não foi possível carregar seu extrato de horas.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn) {
      window.location.replace("/");
      return;
    }
    void loadEntries();
  }, [ready, isLoggedIn, loadEntries]);

  useEffect(() => {
    if (!statement || !printPending) return;
    setPrintPending(false);
    globalThis.print();
  }, [statement, printPending]);

  const emitStatement = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setStatementLoading(true);
    setStatementError("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const suffix = params.size > 0 ? `?${params.toString()}` : "";
      const response = await authFetch(`/hours/members/${user.sub}/statement${suffix}`);
      if (!response.ok) {
        setStatementError(
          await extractErrorMessage(response, "Não foi possível emitir a declaração de horas."),
        );
        return;
      }
      const result = (await response.json()) as HourStatement;
      setStatement(result);
      setPrintPending(true);
    } catch {
      setStatementError("Não foi possível emitir a declaração de horas.");
    } finally {
      setStatementLoading(false);
    }
  };

  if (!ready) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
        <CircularProgress aria-label="Carregando autenticação" />
      </Box>
    );
  }
  if (!isLoggedIn || !user) return null;

  const verificationUrl = statement
    ? `${resolveApiUrl(import.meta.env.SITE)}/hours/verify/${encodeURIComponent(statement.verificationCode)}`
    : "";

  return (
    <PageContainer>
      <Typography variant="h4" component="h2" sx={{ fontWeight: 800, mb: 1 }}>
        Minhas horas
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Consulte seu extrato e emita uma declaração das horas aprovadas.
      </Typography>

      <Card variant="outlined" sx={{ mb: 3, maxWidth: 360 }}>
        <CardContent>
          <Typography variant="overline" color="text.secondary" sx={{ display: "block" }}>
            Saldo aprovado
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {formatHours(approvedTotal)}
          </Typography>
        </CardContent>
      </Card>

      {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}

      <Box
        component="form"
        onSubmit={(event) => void emitStatement(event)}
        sx={{ mb: 4, p: 2, border: 1, borderColor: "divider", borderRadius: 1 }}
      >
        <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
          Declaração de horas
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "flex-start" } }}>
          <TextField
            label="Data inicial"
            name="from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <TextField
            label="Data final"
            name="to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <Button
            type="submit"
            variant="contained"
            startIcon={<PrintIcon />}
            disabled={statementLoading}
            sx={{ minHeight: 56, whiteSpace: "nowrap" }}
          >
            {statementLoading ? "Emitindo…" : "Emitir declaração"}
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Deixe as datas em branco para incluir todo o histórico. Somente horas aprovadas entram na declaração.
        </Typography>
        {statementError && <Alert severity="error" sx={{ mt: 2 }}>{statementError}</Alert>}
      </Box>

      <Typography variant="h5" component="h3" sx={{ mb: 2 }}>
        Extrato
      </Typography>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress aria-label="Carregando extrato de horas" />
        </Box>
      ) : entries.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
          Nenhum lançamento de horas encontrado.
        </Typography>
      ) : (
        <TableContainer
          component={Box}
          role="region"
          aria-labelledby="member-hours-table-caption"
          tabIndex={0}
          sx={{ overflowX: "auto" }}
        >
          <Table size="small" aria-labelledby="member-hours-table-caption" sx={{ minWidth: 720 }}>
            <caption id="member-hours-table-caption">Extrato de horas</caption>
            <TableHead>
              <TableRow>
                <TableCell component="th" scope="col">Atividade</TableCell>
                <TableCell component="th" scope="col">Data</TableCell>
                <TableCell component="th" scope="col">Horas</TableCell>
                <TableCell component="th" scope="col">Situação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell component="th" scope="row">
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{entry.description}</Typography>
                    <Typography variant="caption" color="text.secondary">{entry.sourceLabel}</Typography>
                  </TableCell>
                  <TableCell>{formatDate(entry.occurredAt)}</TableCell>
                  <TableCell>{formatHours(entry.hours)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={entry.status === "approved" ? "success" : entry.status === "rejected" ? "error" : "default"}
                      label={statusLabels[entry.status]}
                    />
                    {entry.rejectReason && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        {entry.rejectReason}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        className="hours-statement-dialog"
        open={statement !== null}
        onClose={() => setStatement(null)}
        aria-labelledby="hours-statement-title"
        fullWidth
        maxWidth="md"
      >
        <DialogTitle id="hours-statement-title">Declaração de horas</DialogTitle>
        <DialogContent>
          {statement && (
            <Box className="hours-statement-print-area">
              <Box sx={{ textAlign: "center", mb: 3 }}>
                <Box component="img" src="/img/logo.png" alt="Codaqui" sx={{ height: 40, mb: 1 }} />
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  Associação Codaqui — CNPJ 44.593.429/0001-05
                </Typography>
              </Box>
              <Typography sx={{ mb: 2 }}>
                A Associação Codaqui declara que <strong>{user.name}</strong> acumulou, no período de {formatPeriod(statement.from, statement.to)}, o total de:
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, textAlign: "center", my: 3 }}>
                {formatHours(statement.totalHours)}
              </Typography>
              {statement.entries.length > 0 && (
                <Table size="small" aria-label="Atividades da declaração" sx={{ mb: 3 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell component="th" scope="col">Atividade</TableCell>
                      <TableCell component="th" scope="col">Data</TableCell>
                      <TableCell component="th" scope="col" align="right">Horas</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {statement.entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell component="th" scope="row">{entry.description}</TableCell>
                        <TableCell>{formatDate(entry.occurredAt)}</TableCell>
                        <TableCell align="right">{formatHours(entry.hours)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <Box sx={{ pt: 2, borderTop: 1, borderColor: "divider" }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  Código de verificação
                </Typography>
                <Typography sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}>
                  {statement.verificationCode}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, overflowWrap: "anywhere" }}>
                  Verificação pública: <a href={verificationUrl} target="_blank" rel="noopener noreferrer">{verificationUrl}</a>
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions className="no-print">
          <Button onClick={() => setStatement(null)} color="inherit">Fechar</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => globalThis.print()}>
            Imprimir
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}

export default function MemberHoursApp(): React.JSX.Element {
  return (
    <MuiIslandProvider>
      <MemberHoursInner />
    </MuiIslandProvider>
  );
}

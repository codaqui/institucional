import React, { useCallback, useEffect, useState } from "react";
import Layout from "@theme/Layout";
import { useHistory } from "@docusaurus/router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Select from "@mui/material/Select";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import SendIcon from "@mui/icons-material/Send";
import { useAuth } from "../../hooks/useAuth";
import AdminNavbar from "../../components/AdminNavbar";
import AdminPageContainer from "../../components/AdminPageContainer";
import StatCard from "../../components/StatCard";
import { parseAuthJson, extractErrorMessage } from "../../hooks/authFetchHelpers";

// ---------------------------------------------------------------------------
// Types (contrato do backend — painel /notifications/emails)
// ---------------------------------------------------------------------------

interface EmailLog {
  id: string;
  to: string;
  template: string;
  eventId: string | null;
  status: "sent" | "failed";
  error: string | null;
  createdAt: string;
}

interface EmailLogsResponse {
  items: EmailLog[];
  total: number;
  summary: {
    sent: number;
    failed: number;
    byTemplate: Record<string, { sent: number; failed: number }>;
  };
}

const PAGE_SIZE = 20;

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const statusConfig = {
  sent: { label: "Enviado", color: "success" as const, icon: <CheckCircleIcon fontSize="small" /> },
  failed: { label: "Falha", color: "error" as const, icon: <ErrorIcon fontSize="small" /> },
};

export default function EmailsAdminPage(): React.JSX.Element {
  const { ready, isLoggedIn, isAdmin, authFetch } = useAuth();
  const history = useHistory();

  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<EmailLogsResponse["summary"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [statusFilter, setStatusFilter] = useState("");
  const [templateFilter, setTemplateFilter] = useState("");
  const [page, setPage] = useState(1);

  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendFeedback, setResendFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (templateFilter) params.set("template", templateFilter);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const res = await authFetch(`/notifications/emails?${params.toString()}`);
      const data = await parseAuthJson<EmailLogsResponse>(res, setLoadError);
      if (!data) return;
      setLogs(Array.isArray(data.items) ? data.items : []);
      setTotal(data.total ?? 0);
      setSummary(data.summary ?? null);
    } catch {
      setLoadError("Erro inesperado ao carregar e-mails.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, statusFilter, templateFilter, page]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !isAdmin) {
      history.replace("/");
      return;
    }
    fetchLogs();
  }, [ready, isLoggedIn, isAdmin, history, fetchLogs]);

  const handleResend = async (log: EmailLog) => {
    setResendingId(log.id);
    setResendFeedback(null);
    try {
      const res = await authFetch(`/notifications/emails/${log.id}/resend`, { method: "POST" });
      if (!res.ok) {
        setResendFeedback({
          kind: "error",
          message: await extractErrorMessage(res, `Erro ao reenviar e-mail para ${log.to}.`),
        });
        return;
      }
      const updated = (await res.json()) as EmailLog;
      setLogs((prev) => prev.map((l) => (l.id === log.id ? { ...l, ...updated } : l)));
      setResendFeedback({
        kind: updated.status === "sent" ? "success" : "error",
        message:
          updated.status === "sent"
            ? `E-mail reenviado com sucesso para ${updated.to}.`
            : `Reenvio para ${updated.to} falhou novamente.`,
      });
      // Atualiza os cards de resumo
      fetchLogs();
    } catch {
      setResendFeedback({ kind: "error", message: "Erro inesperado ao reenviar e-mail." });
    } finally {
      setResendingId(null);
    }
  };

  if (!ready || !isLoggedIn || !isAdmin) {
    return (
      <Layout title="E-mails">
        <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  const templateKeys = summary ? Object.keys(summary.byTemplate) : [];
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Layout title="E-mails Enviados" description="Painel de e-mails transacionais da plataforma de eventos">
      <AdminPageContainer>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h4" fontWeight={800}>
            E-mails
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Envios transacionais da plataforma de eventos (confirmação, lembrete, pós-evento)
          </Typography>
        </Box>

        <AdminNavbar active="/admin/emails" />

        {loadError && <Alert severity="error" sx={{ mb: 3 }}>{loadError}</Alert>}
        {resendFeedback && (
          <Alert severity={resendFeedback.kind} sx={{ mb: 3 }} onClose={() => setResendFeedback(null)}>
            {resendFeedback.message}
          </Alert>
        )}

        {/* ── Cards de resumo ── */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard
              icon={<SendIcon fontSize="large" />}
              value={summary?.sent ?? "—"}
              label="Enviados"
              color="success.main"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard
              icon={<ErrorIcon fontSize="large" />}
              value={summary?.failed ?? "—"}
              label="Falhas"
              color="error.main"
            />
          </Grid>
          {templateKeys.slice(0, 2).map((tpl) => (
            <Grid key={tpl} size={{ xs: 6, sm: 3 }}>
              <StatCard
                icon={<MailOutlineIcon fontSize="large" />}
                value={summary!.byTemplate[tpl].sent + summary!.byTemplate[tpl].failed}
                label={tpl}
                color="info.main"
              />
            </Grid>
          ))}
        </Grid>

        {/* ── Por template (chips) ── */}
        {templateKeys.length > 0 && (
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent sx={{ py: "12px !important" }}>
              <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Por template
              </Typography>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {templateKeys.map((tpl) => {
                  const stats = summary!.byTemplate[tpl];
                  return (
                    <Chip
                      key={tpl}
                      label={`${tpl}: ${stats.sent} enviados · ${stats.failed} falhas`}
                      size="small"
                      variant="outlined"
                      color={stats.failed > 0 ? "warning" : "default"}
                      onClick={() => {
                        setTemplateFilter(tpl);
                        setPage(1);
                      }}
                    />
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        )}

        {/* ── Filtros ── */}
        <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="sent">Enviados</MenuItem>
              <MenuItem value="failed">Falhas</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Template</InputLabel>
            <Select
              value={templateFilter}
              label="Template"
              onChange={(e) => {
                setTemplateFilter(e.target.value);
                setPage(1);
              }}
            >
              <MenuItem value="">Todos</MenuItem>
              {templateKeys.map((tpl) => (
                <MenuItem key={tpl} value={tpl}>
                  {tpl}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* ── Tabela ── */}
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : logs.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={6}>
            Nenhum e-mail encontrado com os filtros atuais.
          </Typography>
        ) : (
          <TableContainer component={Card} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Destinatário</TableCell>
                  <TableCell>Template</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Data</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => {
                  const sc = statusConfig[log.status];
                  return (
                    <TableRow key={log.id} hover>
                      <TableCell sx={{ wordBreak: "break-all" }}>{log.to}</TableCell>
                      <TableCell>
                        <Chip label={log.template} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={log.error ?? ""} arrow disableHoverListener={!log.error}>
                          <Chip icon={sc.icon} label={sc.label} color={sc.color} size="small" variant="outlined" />
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(log.createdAt)}</TableCell>
                      <TableCell align="right">
                        {log.status === "failed" && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            disabled={resendingId === log.id}
                            onClick={() => handleResend(log)}
                            startIcon={
                              resendingId === log.id ? (
                                <CircularProgress size={14} color="inherit" />
                              ) : (
                                <SendIcon />
                              )
                            }
                          >
                            Reenviar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {total > PAGE_SIZE && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
            <Pagination
              page={page}
              count={pageCount}
              onChange={(_, value) => setPage(value)}
              color="primary"
            />
          </Box>
        )}
      </AdminPageContainer>
    </Layout>
  );
}

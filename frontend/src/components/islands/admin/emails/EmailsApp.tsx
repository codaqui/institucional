/**
 * /admin/emails — Painel de campanhas, logs e templates de e-mail.
 *
 * Três abas: Campanhas (jornada de criação, segmentação, prévia, teste,
 * confirmação e acompanhamento), Logs (volume, filtros por destinatário,
 * período, status, template e campanha, exportação CSV e resend) e
 * Templates (edição de subject/corpo — ver EmailsTemplatesTab).
 */

import { useCallback, useEffect, useState } from "react";
import MuiIslandProvider from "../../MuiIslandProvider";
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
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DownloadIcon from "@mui/icons-material/Download";
import ErrorIcon from "@mui/icons-material/Error";
import MailOutlineIcon from "@mui/icons-material/MailOutlined";
import SendIcon from "@mui/icons-material/Send";
import { useAuth } from "../../../../lib/use-auth";
import {
  parseAuthJson,
  extractErrorMessage,
} from "../../../../lib/auth-fetch-helpers";
import PageContainer from "../ui/PageContainer";
import StatCard from "../ui/StatCard";
import EmailsCampaignsTab from "./EmailsCampaignsTab";
import EmailsTemplatesTab from "./EmailsTemplatesTab";

// ---------------------------------------------------------------------------
// Types (contrato do backend — painel /notifications/emails)
// ---------------------------------------------------------------------------

interface EmailLog {
  id: string;
  to: string;
  template: string;
  eventId: string | null;
  registrationId: string | null;
  campaignId?: string | null;
  status: "sent" | "failed" | "skipped";
  error: string | null;
  createdAt: string;
}

interface EmailLogsResponse {
  items: EmailLog[];
  total: number;
  summary: {
    sent: number;
    failed: number;
    skipped: number;
    byTemplate: Record<string, { sent: number; failed: number; skipped: number }>;
  };
}

type EmailsTabKey = "campanhas" | "logs" | "templates";

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
  sent: {
    label: "Enviado",
    color: "success" as const,
    icon: <CheckCircleIcon fontSize="small" />,
  },
  failed: {
    label: "Falha",
    color: "error" as const,
    icon: <ErrorIcon fontSize="small" />,
  },
  skipped: {
    label: "Ignorado",
    color: "default" as const,
    icon: <MailOutlineIcon fontSize="small" />,
  },
};

function EmailsInner(): React.JSX.Element | null {
  const { ready, isLoggedIn, isAdmin, isFinanceAnalyzer, authFetch } = useAuth();
  const canViewEmails = isAdmin || isFinanceAnalyzer;

  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<EmailLogsResponse["summary"] | null>(
    null,
  );
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [statusFilter, setStatusFilter] = useState("");
  const [templateFilter, setTemplateFilter] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [campaignIdFilter, setCampaignIdFilter] = useState("");
  const [page, setPage] = useState(1);

  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendFeedback, setResendFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  const [tab, setTab] = useState<EmailsTabKey>(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("tab");
      if (q === "campanhas" || q === "logs" || q === "templates") return q;
    }
    return "logs";
  });

  const buildFilterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (templateFilter) params.set("template", templateFilter);
    if (isAdmin && recipientFilter.trim()) {
      params.set("recipient", recipientFilter.trim());
    }
    if (fromFilter) params.set("from", `${fromFilter}T00:00:00.000Z`);
    if (toFilter) params.set("to", `${toFilter}T23:59:59.999Z`);
    if (campaignIdFilter.trim()) {
      params.set("campaignId", campaignIdFilter.trim());
    }
    return params;
  }, [
    statusFilter,
    templateFilter,
    isAdmin,
    recipientFilter,
    fromFilter,
    toFilter,
    campaignIdFilter,
  ]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const params = buildFilterParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const [res, statusRes] = await Promise.all([
        authFetch(`/notifications/emails?${params.toString()}`),
        authFetch("/notifications/status"),
      ]);
      const [data, statusData] = await Promise.all([
        parseAuthJson<EmailLogsResponse>(res, setLoadError),
        parseAuthJson<{ configured: boolean }>(statusRes, setLoadError),
      ]);
      if (statusData) setConfigured(statusData.configured);
      if (!data) return;
      setLogs(Array.isArray(data.items) ? data.items : []);
      setTotal(data.total ?? 0);
      setSummary(data.summary ?? null);
    } catch {
      setLoadError("Erro inesperado ao carregar e-mails.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, buildFilterParams, page]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !canViewEmails) {
      window.location.replace("/");
      return;
    }
    void fetchLogs();
  }, [ready, isLoggedIn, canViewEmails, fetchLogs]);

  if (!ready) {
    return (
      <span className="inline-block h-10 w-64 animate-pulse rounded-md bg-sunken" />
    );
  }

  if (!isLoggedIn || !canViewEmails) {
    return null;
  }

  const handleResend = async (log: EmailLog) => {
    setResendingId(log.id);
    setResendFeedback(null);
    try {
      const res = await authFetch(`/notifications/emails/${log.id}/resend`, {
        method: "POST",
      });
      if (!res.ok) {
        setResendFeedback({
          kind: "error",
          message: await extractErrorMessage(
            res,
            `Erro ao reenviar e-mail para ${log.to}.`,
          ),
        });
        return;
      }
      const updated = (await res.json()) as EmailLog;
      setLogs((prev) =>
        prev.map((l) => (l.id === log.id ? { ...l, ...updated } : l)),
      );
      setResendFeedback({
        kind: updated.status === "sent" ? "success" : "error",
        message:
          updated.status === "sent"
            ? `E-mail reenviado com sucesso para ${updated.to}.`
            : `Reenvio para ${updated.to} falhou novamente.`,
      });
      void fetchLogs();
    } catch {
      setResendFeedback({
        kind: "error",
        message: "Erro inesperado ao reenviar e-mail.",
      });
    } finally {
      setResendingId(null);
    }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const params = buildFilterParams();
      const queryStr = params.toString();
      const exportUrl = queryStr
        ? `/notifications/emails/export?${queryStr}`
        : "/notifications/emails/export";
      const res = await authFetch(exportUrl);
      if (!res.ok) {
        setResendFeedback({
          kind: "error",
          message: await extractErrorMessage(
            res,
            "Não foi possível exportar os logs em CSV.",
          ),
        });
        return;
      }
      const csvText = await res.text();
      if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
        const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "email-logs.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }
    } catch {
      setResendFeedback({
        kind: "error",
        message: "Erro inesperado ao exportar CSV.",
      });
    } finally {
      setExportingCsv(false);
    }
  };

  const templateKeys = summary ? Object.keys(summary.byTemplate) : [];
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  let logsSection: React.JSX.Element;
  if (loading) {
    logsSection = (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  } else if (logs.length === 0) {
    logsSection = (
      <Typography sx={{ color: "text.secondary", textAlign: "center", py: 6 }}>
        Nenhum e-mail encontrado com os filtros atuais.
      </Typography>
    );
  } else {
    logsSection = (
      <TableContainer component={Card} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Destinatário</TableCell>
              <TableCell>Template</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Data</TableCell>
              {isAdmin && <TableCell align="right">Ações</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => {
              const sc = statusConfig[log.status];
              return (
                <TableRow key={log.id} hover>
                  <TableCell sx={{ wordBreak: "break-all" }}>
                    {isAdmin ? log.to : "[redacted]"}
                  </TableCell>
                  <TableCell>
                    <Chip label={log.template} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Tooltip
                      title={log.error ?? ""}
                      arrow
                      disableHoverListener={!log.error}
                    >
                      <Chip
                        icon={sc.icon}
                        label={sc.label}
                        color={sc.color}
                        size="small"
                        variant="outlined"
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {formatDateTime(log.createdAt)}
                  </TableCell>
                  {isAdmin && (
                    <TableCell align="right">
                      {configured === true &&
                        log.registrationId &&
                        (log.status === "failed" || log.status === "skipped") && (
                          <Button
                            type="button"
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
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  return (
    <PageContainer>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" component="h2" sx={{ fontWeight: 800 }}>
          E-mails
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Campanhas segmentadas, logs de entregas e templates transacionais da plataforma
        </Typography>
      </Box>

      <Tabs
        value={tab}
        onChange={(_e, v: EmailsTabKey) => setTab(v)}
        sx={{ mb: 3 }}
      >
        <Tab label="Campanhas" value="campanhas" />
        <Tab label="Logs" value="logs" />
        {isAdmin && <Tab label="Templates" value="templates" />}
      </Tabs>

      {tab === "campanhas" && (
        <Box role="tabpanel" aria-label="Campanhas">
          <EmailsCampaignsTab />
        </Box>
      )}

      {tab === "logs" && (
        <Box role="tabpanel" aria-label="Logs">
          {configured === false && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              Envios de e-mail estão desativados porque o SMTP não está configurado. Novos envios serão registrados como ignorados.
            </Alert>
          )}
          {loadError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {loadError}
            </Alert>
          )}
          {resendFeedback && (
            <Alert
              severity={resendFeedback.kind}
              sx={{ mb: 3 }}
              onClose={() => setResendFeedback(null)}
            >
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
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                icon={<MailOutlineIcon fontSize="large" />}
                value={summary?.skipped ?? "—"}
                label="Ignorados"
                color="warning.main"
              />
            </Grid>
            {templateKeys.slice(0, 2).map((tpl) => (
              <Grid key={tpl} size={{ xs: 6, sm: 3 }}>
                <StatCard
                  icon={<MailOutlineIcon fontSize="large" />}
                  value={
                    summary!.byTemplate[tpl].sent +
                    summary!.byTemplate[tpl].failed +
                    summary!.byTemplate[tpl].skipped
                  }
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
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ display: "block", mb: 1 }}
                >
                  Por template
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {templateKeys.map((tpl) => {
                    const stats = summary!.byTemplate[tpl];
                    return (
                      <Chip
                        key={tpl}
                        label={`${tpl}: ${stats.sent} enviados · ${stats.failed} falhas · ${stats.skipped} ignorados`}
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

          {/* ── Filtros e Exportação ── */}
          <Box
            role="search"
            sx={{
              display: "flex",
              gap: 2,
              mb: 2,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel id="email-status-filter-label">Status</InputLabel>
              <Select
                labelId="email-status-filter-label"
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
                <MenuItem value="skipped">Ignorados</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 190 }}>
              <InputLabel id="email-template-filter-label">Template</InputLabel>
              <Select
                labelId="email-template-filter-label"
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

            {isAdmin && (
              <TextField
                label="Destinatário"
                size="small"
                value={recipientFilter}
                slotProps={{
                  htmlInput: {
                    autoCorrect: "off",
                    autoCapitalize: "none",
                    spellCheck: false,
                  },
                }}
                onChange={(e) => {
                  setRecipientFilter(e.target.value);
                  setPage(1);
                }}
              />
            )}

            <TextField
              label="De (data)"
              type="date"
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              value={fromFilter}
              onChange={(e) => {
                setFromFilter(e.target.value);
                setPage(1);
              }}
            />

            <TextField
              label="Até (data)"
              type="date"
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              value={toFilter}
              onChange={(e) => {
                setToFilter(e.target.value);
                setPage(1);
              }}
            />

            <TextField
              label="Campanha (ID)"
              size="small"
              value={campaignIdFilter}
              slotProps={{
                htmlInput: {
                  autoCorrect: "off",
                  autoCapitalize: "none",
                  spellCheck: false,
                },
              }}
              onChange={(e) => {
                setCampaignIdFilter(e.target.value);
                setPage(1);
              }}
            />

            <Button
              type="button"
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              disabled={exportingCsv}
              onClick={handleExportCsv}
            >
              {exportingCsv ? "Exportando…" : "Exportar CSV"}
            </Button>
          </Box>

          {/* ── Tabela ── */}
          {logsSection}

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
        </Box>
      )}

      {tab === "templates" && isAdmin && (
        <Box role="tabpanel" aria-label="Templates">
          <EmailsTemplatesTab />
        </Box>
      )}
    </PageContainer>
  );
}

export default function EmailsApp() {
  return (
    <MuiIslandProvider>
      <EmailsInner />
    </MuiIslandProvider>
  );
}

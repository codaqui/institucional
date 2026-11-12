import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MuiIslandProvider from "../../MuiIslandProvider";
import PageContainer from "../ui/PageContainer";
import TabPanel from "../ui/TabPanel";
import {
  extractErrorMessage,
  parseAuthJson,
} from "../../../../lib/auth-fetch-helpers";
import { DEFAULT_PAGE_SIZE, rangeLabel, type PaginatedResponse } from "../../../../lib/pagination";
import { useAuth } from "../../../../lib/use-auth";
import { buildC4pReportModel, downloadC4pReportPdf } from "../../../../lib/c4p-pdf";
import type {
  C4pDashboard,
  C4pReport,
  EvaluatorSummary,
  ManageCall,
  ManageTalk,
} from "./c4p-admin-types";

const STATUS_LABEL: Record<ManageCall["status"], string> = {
  draft: "Rascunho",
  open: "Aberta",
  closed: "Fechada",
};

function TalksTab({ callId, onChanged }: Readonly<{ callId: string; onChanged: () => void }>) {
  const { authFetch } = useAuth();
  const [talks, setTalks] = useState<ManageTalk[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [importFeedback, setImportFeedback] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(
    async (targetPage: number) => {
      const params = new URLSearchParams({ page: String(targetPage), limit: String(DEFAULT_PAGE_SIZE) });
      const response = await authFetch(`/c4p/manage/calls/${callId}/talks?${params}`);
      const result = await parseAuthJson<PaginatedResponse<ManageTalk>>(response, setLoadError);
      if (result) {
        setTalks(result.data);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setPage(result.page);
      }
    },
    [authFetch, callId],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const importCsv = async () => {
    if (!file) return;
    setImportFeedback("");
    const text = await file.text();
    const response = await authFetch(`/c4p/manage/calls/${callId}/talks/import`, {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: text,
    });
    if (!response.ok) {
      setImportFeedback(await extractErrorMessage(response, "Não foi possível importar o CSV."));
      return;
    }
    const result = (await response.json()) as { imported: number; skipped: Array<{ line: number; reason: string }> };
    setImportFeedback(
      `${result.imported} propostas importadas${result.skipped.length ? `, ${result.skipped.length} linhas ignoradas` : ""}.`,
    );
    setFile(null);
    onChanged();
    await load(1);
  };

  const removeTalk = async (talkId: string) => {
    const response = await authFetch(`/c4p/manage/calls/${callId}/talks/${talkId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setLoadError(await extractErrorMessage(response, "Não foi possível remover a proposta."));
      return;
    }
    onChanged();
    await load(page);
  };

  return (
    <Stack spacing={2}>
      {loadError ? <Alert severity="error">{loadError}</Alert> : null}
      {importFeedback ? <Alert severity={importFeedback.includes("Não") ? "error" : "success"}>{importFeedback}</Alert> : null}
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
        <Button component="label" variant="outlined">
          Escolher arquivo CSV
          <input
            aria-label="Arquivo CSV"
            hidden
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </Button>
        <Typography variant="body2" color="text.secondary">
          {file ? file.name : "Nenhum arquivo selecionado"}
        </Typography>
        <Button variant="contained" onClick={() => void importCsv()} disabled={!file}>
          Importar
        </Button>
      </Box>
      {talks === null ? (
        <CircularProgress aria-label="Carregando propostas" />
      ) : talks.length === 0 ? (
        <Alert severity="info">Nenhuma proposta ainda.</Alert>
      ) : (
        <>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Título</TableCell>
                <TableCell>Palestrante</TableCell>
                <TableCell>Origem</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {talks.map((talk) => (
                <TableRow key={talk.id}>
                  <TableCell>{talk.title}</TableCell>
                  <TableCell>{talk.speakerName}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={talk.origin === "public_form" ? "Formulário" : "CSV"}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" color="error" onClick={() => void removeTalk(talk.id)}>
                      Excluir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography variant="body2" color="text.secondary">
            {rangeLabel(page, DEFAULT_PAGE_SIZE, total)}
          </Typography>
        </>
      )}
    </Stack>
  );
}

function EvaluatorsTab({ callId, onChanged }: Readonly<{ callId: string; onChanged: () => void }>) {
  const { authFetch } = useAuth();
  const [evaluators, setEvaluators] = useState<EvaluatorSummary[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [inviteValue, setInviteValue] = useState("");
  const [feedback, setFeedback] = useState("");

  const load = useCallback(async () => {
    const response = await authFetch(`/c4p/manage/calls/${callId}/evaluators`);
    setEvaluators(await parseAuthJson<EvaluatorSummary[]>(response, setLoadError));
  }, [authFetch, callId]);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async () => {
    setFeedback("");
    const response = await authFetch(`/c4p/manage/calls/${callId}/evaluators`, {
      method: "POST",
      body: JSON.stringify({ handleOrEmail: inviteValue.trim() }),
    });
    if (!response.ok) {
      setFeedback(await extractErrorMessage(response, "Não foi possível convidar."));
      return;
    }
    setInviteValue("");
    setFeedback("Convite enviado.");
    onChanged();
    await load();
  };

  const remove = async (designationId: string) => {
    const response = await authFetch(`/c4p/manage/calls/${callId}/evaluators/${designationId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setFeedback(await extractErrorMessage(response, "Não foi possível remover."));
      return;
    }
    onChanged();
    await load();
  };

  return (
    <Stack spacing={2}>
      {loadError ? <Alert severity="error">{loadError}</Alert> : null}
      {feedback ? <Alert severity={feedback.includes("Não") ? "error" : "success"}>{feedback}</Alert> : null}
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
        <TextField
          label="Handle ou e-mail do membro"
          value={inviteValue}
          onChange={(event) => setInviteValue(event.target.value)}
          sx={{ minWidth: 280 }}
        />
        <Button variant="contained" onClick={() => void invite()} disabled={inviteValue.trim().length < 2}>
          Convidar avaliador
        </Button>
      </Box>
      {evaluators === null ? (
        <CircularProgress aria-label="Carregando avaliadores" />
      ) : evaluators.length === 0 ? (
        <Alert severity="info">Nenhum avaliador convidado ainda.</Alert>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Avaliador(a)</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {evaluators.map((evaluator) => (
              <TableRow key={evaluator.designationId}>
                <TableCell>
                  {evaluator.member.name} (@{evaluator.member.handle})
                </TableCell>
                <TableCell>{evaluator.status}</TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    color="error"
                    disabled={evaluator.status === "removed"}
                    onClick={() => void remove(evaluator.designationId)}
                  >
                    Remover
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Stack>
  );
}

function DashboardTab({ callId }: Readonly<{ callId: string }>) {
  const { authFetch } = useAuth();
  const [dashboard, setDashboard] = useState<C4pDashboard | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    void (async () => {
      const response = await authFetch(`/c4p/manage/calls/${callId}/dashboard`);
      setDashboard(await parseAuthJson<C4pDashboard>(response, setLoadError));
    })();
  }, [authFetch, callId]);

  if (loadError) return <Alert severity="error">{loadError}</Alert>;
  if (!dashboard) return <CircularProgress aria-label="Carregando dashboard" />;

  return (
    <Stack spacing={3}>
      <Typography>
        {dashboard.totals.talks} propostas · {dashboard.totals.evaluators} avaliadores ·{" "}
        {dashboard.totals.votes}/{dashboard.totals.expected} votos ({dashboard.totals.completionPercent}%)
      </Typography>
      <Box>
        <Typography fontWeight="bold">Progresso por avaliador</Typography>
        {dashboard.progressByEvaluator.map((row) => (
          <Box key={row.designationId} sx={{ mt: 1 }}>
            <Typography variant="body2">
              {row.member.name} — {row.done}/{row.total} {row.complete ? "✓" : ""}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={row.total === 0 ? 0 : (row.done / row.total) * 100}
            />
          </Box>
        ))}
      </Box>
      <Box>
        <Typography fontWeight="bold">Ranking</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Título</TableCell>
              <TableCell>Média</TableCell>
              <TableCell>Votos</TableCell>
              <TableCell>Sel.</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {dashboard.ranking.map((row) => (
              <TableRow key={row.talkId}>
                <TableCell>{row.position ?? "—"}</TableCell>
                <TableCell>{row.title}</TableCell>
                <TableCell>{row.avgTotal === null ? "—" : row.avgTotal.toFixed(2)}</TableCell>
                <TableCell>{row.votesCount}</TableCell>
                <TableCell>{row.selected ? "✓" : ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Stack>
  );
}

function FinalizeTab({
  call,
  onChanged,
}: Readonly<{ call: ManageCall; onChanged: () => void }>) {
  const { isAdmin, authFetch } = useAuth();
  const [talks, setTalks] = useState<ManageTalk[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const params = new URLSearchParams({ page: "1", limit: "100" });
      const response = await authFetch(`/c4p/manage/calls/${call.id}/talks?${params}`);
      const result = await parseAuthJson<PaginatedResponse<ManageTalk>>(response, () => {});
      if (result) setTalks(result.data ?? []);
    })();
  }, [authFetch, call.id]);

  const finalize = async () => {
    const response = await authFetch(`/c4p/manage/calls/${call.id}/finalize`, {
      method: "POST",
      body: JSON.stringify({ talkIds: [...selected] }),
    });
    if (!response.ok) {
      setFeedback(await extractErrorMessage(response, "Não foi possível finalizar."));
      return;
    }
    setConfirmOpen(false);
    setFeedback("Campanha finalizada. E-mails de resultado despachados.");
    onChanged();
  };

  const downloadPdf = async () => {
    setPdfLoading(true);
    try {
      const response = await authFetch(`/c4p/manage/calls/${call.id}/report`);
      if (!response.ok) throw new Error("Não foi possível carregar o relatório.");
      const report = (await response.json()) as C4pReport;
      await downloadC4pReportPdf(buildC4pReportModel(report));
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Não foi possível gerar o PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <Stack spacing={2}>
      {feedback ? (
        <Alert severity={feedback.startsWith("Não") ? "error" : "success"}>{feedback}</Alert>
      ) : null}
      {!isAdmin ? (
        <Alert severity="info">
          A finalização e a reabertura são operações de governança: somente admin.
        </Alert>
      ) : null}
      {call.status === "closed" ? (
        <Alert severity="info">
          Campanha finalizada em{" "}
          {call.finalizedAt
            ? new Date(call.finalizedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
            : "—"}
          .
        </Alert>
      ) : null}
      {talks === null ? (
        <CircularProgress aria-label="Carregando propostas" />
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">Selecionar</TableCell>
              <TableCell>Título</TableCell>
              <TableCell>Palestrante</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {talks.map((talk) => (
              <TableRow key={talk.id}>
                <TableCell padding="checkbox">
                  <Checkbox
                    slotProps={{ input: { "aria-label": `Selecionar ${talk.title}` } }}
                    checked={selected.has(talk.id)}
                    onChange={(event) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(talk.id);
                        else next.delete(talk.id);
                        return next;
                      })
                    }
                  />
                </TableCell>
                <TableCell>{talk.title}</TableCell>
                <TableCell>{talk.speakerName}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Button
          variant="contained"
          disabled={!isAdmin || call.status !== "open" || selected.size === 0}
          onClick={() => setConfirmOpen(true)}
        >
          Finalizar campanha
        </Button>
        {call.status === "closed" && isAdmin ? (
          <Button
            variant="outlined"
            onClick={() =>
              void authFetch(`/c4p/manage/calls/${call.id}/reopen`, { method: "POST" }).then(
                () => onChanged(),
              )
            }
          >
            Reabrir campanha
          </Button>
        ) : null}
        <Button variant="outlined" onClick={() => void downloadPdf()} disabled={pdfLoading}>
          {pdfLoading ? "Gerando…" : "Baixar relatório PDF"}
        </Button>
      </Box>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Finalizar campanha?</DialogTitle>
        <DialogContent>
          <Typography>
            {selected.size} proposta(s) serão marcadas como selecionadas, a campanha será fechada
            e os e-mails de resultado serão enviados a todos os palestrantes.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => void finalize()}>
            Confirmar finalização
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function C4pAdminDetailInner({ callId }: Readonly<{ callId?: string }>) {
  const actualCallId =
    callId ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("id") || ""
      : "");
  const { ready, isLoggedIn, authFetch } = useAuth();
  const [call, setCall] = useState<ManageCall | null>(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState(0);

  const load = useCallback(async () => {
    if (!actualCallId) return;
    setLoadError("");
    const response = await authFetch(`/c4p/manage/calls/${actualCallId}`);
    setCall(await parseAuthJson<ManageCall>(response, setLoadError));
  }, [authFetch, actualCallId]);

  useEffect(() => {
    if (ready && isLoggedIn) void load();
  }, [ready, isLoggedIn, load]);

  if (!actualCallId) {
    return <Alert severity="error">Link incompleto: informe a campanha com ?id=&lt;uuid&gt;.</Alert>;
  }
  if (!ready || !isLoggedIn || call === null) {
    return loadError ? (
      <PageContainer><Alert severity="error">{loadError}</Alert></PageContainer>
    ) : (
      <PageContainer><CircularProgress aria-label="Carregando campanha" /></PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" component="h1">{call.name}</Typography>
          <Box component="div" sx={{ display: "flex", alignItems: "center", gap: 1 }} color="text.secondary">
            <Typography component="span" variant="body2">/c4p/{call.slug}</Typography>
            <Chip size="small" label={STATUS_LABEL[call.status]} />
          </Box>
        </Box>
        {loadError ? <Alert severity="error">{loadError}</Alert> : null}
        <Tabs value={tab} onChange={(_event, value) => setTab(value)} aria-label="Gestão da campanha">
          <Tab label="Propostas" />
          <Tab label="Avaliadores" />
          <Tab label="Dashboard" />
          <Tab label="Finalização" />
        </Tabs>
        <TabPanel value={tab} index={0}>
          <TalksTab callId={call.id} onChanged={() => void load()} />
        </TabPanel>
        <TabPanel value={tab} index={1}>
          <EvaluatorsTab callId={call.id} onChanged={() => void load()} />
        </TabPanel>
        <TabPanel value={tab} index={2}>
          <DashboardTab callId={call.id} />
        </TabPanel>
        <TabPanel value={tab} index={3}>
          <FinalizeTab call={call} onChanged={() => void load()} />
        </TabPanel>
      </Stack>
    </PageContainer>
  );
}

export default function C4pAdminDetailApp({
  callId,
}: Readonly<{ callId?: string }>) {
  return (
    <MuiIslandProvider>
      <C4pAdminDetailInner callId={callId} />
    </MuiIslandProvider>
  );
}

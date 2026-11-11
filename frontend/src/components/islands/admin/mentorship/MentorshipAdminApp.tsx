import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import MuiIslandProvider from "../../MuiIslandProvider";
import PageContainer from "../ui/PageContainer";
import PaginationControls from "../../ui/PaginationControls";
import MentorDirectory from "./MentorDirectory";
import { useAuth } from "../../../../lib/use-auth";
import { extractErrorMessage, parseAuthJson } from "../../../../lib/auth-fetch-helpers";
import { DEFAULT_PAGE_SIZE, rangeLabel, type PaginatedResponse } from "../../../../lib/pagination";

interface Application { id: string; memberId: string; status: string }
interface AdminSession { id: string; menteeName: string; scheduledAt: string; status: string }
interface Insights { completed: number; activeMentors: number; requested: number; confirmed: number; canceled: number; noShow: number; noShowRate: number }

function MentorshipAdmin() {
  const { ready, isLoggedIn, isAdmin, authFetch } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  const loadApplications = useCallback(async () => {
    const response = await authFetch("/mentorship/applications");
    const result = await parseAuthJson<Application[]>(response, setError);
    if (result) setApplications(result);
  }, [authFetch]);

  const loadSessions = useCallback(async () => {
    const response = await authFetch(`/mentorship/sessions/admin?page=${page}&limit=${DEFAULT_PAGE_SIZE}`);
    const result = await parseAuthJson<PaginatedResponse<AdminSession>>(response, setError);
    if (result) {
      setSessions(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    }
  }, [authFetch, page]);

  const loadInsights = useCallback(async () => {
    const response = await authFetch("/mentorship/insights");
    const result = await parseAuthJson<Insights>(response, setError);
    if (result) setInsights(result);
  }, [authFetch]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !isAdmin) {
      window.location.replace("/");
      return;
    }
    void Promise.all([loadApplications(), loadInsights()]).catch(() => setError("Não foi possível carregar a mentoria."));
  }, [ready, isLoggedIn, isAdmin, loadApplications, loadInsights]);

  useEffect(() => {
    if (ready && isLoggedIn && isAdmin) void loadSessions().catch(() => setError("Não foi possível carregar as sessões."));
  }, [ready, isLoggedIn, isAdmin, loadSessions]);

  const approve = async (id: string) => {
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      const response = await authFetch(`/mentorship/applications/${id}/confirm`, { method: "POST" });
      if (!response.ok) {
        setError(await extractErrorMessage(response, "Não foi possível aprovar o mentor."));
        return;
      }
      setFeedback("Mentor aprovado e perfil ativado.");
      await loadApplications();
    } catch {
      setError("Não foi possível aprovar o mentor.");
    } finally {
      setBusy(false);
    }
  };

  if (!ready || !isAdmin) return null;

  return (
    <PageContainer>
      <Stack spacing={4}>
        <Box><Typography variant="h4" component="h2" sx={{ fontWeight: 800 }}>Gestão de mentoria</Typography><Typography color="text.secondary">Candidaturas, sessões e resultados agregados.</Typography></Box>
        {error && <Alert severity="error">{error}</Alert>}
        {feedback && <Alert severity="success">{feedback}</Alert>}
        {insights && <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Card variant="outlined" sx={{ flex: 1 }}><CardContent><Typography variant="h4">{insights.activeMentors}</Typography><Typography color="text.secondary">Mentores ativos</Typography></CardContent></Card>
          <Card variant="outlined" sx={{ flex: 1 }}><CardContent><Typography variant="h4">{insights.completed}</Typography><Typography color="text.secondary">Sessões concluídas</Typography></CardContent></Card>
          <Card variant="outlined" sx={{ flex: 1 }}><CardContent><Typography variant="h4">{Math.round(insights.noShowRate * 100)}%</Typography><Typography color="text.secondary">No-show</Typography></CardContent></Card>
        </Stack>}
        <MentorDirectory authFetch={authFetch} onError={setError} onFeedback={setFeedback} />
        <Box>
          <Typography variant="h5" component="h3" sx={{ mb: 2 }}>Candidaturas pendentes</Typography>
          <Stack spacing={1}>{applications.length === 0 ? <Typography color="text.secondary">Nenhuma candidatura pendente.</Typography> : applications.map((application) => (
            <Card key={application.id} variant="outlined"><CardContent><Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }} spacing={1}>
              <Typography>Membro {application.memberId}</Typography><Chip label={application.status} size="small" />
              <Button variant="contained" disabled={busy} onClick={() => void approve(application.id)}>Aprovar mentor</Button>
            </Stack></CardContent></Card>
          ))}</Stack>
        </Box>
        <Box>
          <Typography variant="h5" component="h3" sx={{ mb: 2 }}>Sessões</Typography>
          <TableContainer component={Box} tabIndex={0} role="region" aria-label="Sessões de mentoria" sx={{ overflowX: "auto" }}>
            <Table size="small"><TableHead><TableRow><TableCell>Participante</TableCell><TableCell>Data</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
              <TableBody>{sessions.map((session) => <TableRow key={session.id}><TableCell>{session.menteeName}</TableCell><TableCell>{session.scheduledAt}</TableCell><TableCell>{session.status}</TableCell></TableRow>)}</TableBody>
            </Table>
          </TableContainer>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", my: 1 }}>{rangeLabel(page, DEFAULT_PAGE_SIZE, total)}</Typography>
          <PaginationControls page={page} totalPages={totalPages} onChange={setPage} itemLabel="sessões" />
        </Box>
      </Stack>
    </PageContainer>
  );
}

export default function MentorshipAdminApp() {
  return <MuiIslandProvider><MentorshipAdmin /></MuiIslandProvider>;
}

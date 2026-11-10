import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";
import MuiIslandProvider from "../MuiIslandProvider";
import PageContainer from "../admin/ui/PageContainer";
import PaginationControls from "../ui/PaginationControls";
import { useAuth } from "../../../lib/use-auth";
import { extractErrorMessage, parseAuthJson } from "../../../lib/auth-fetch-helpers";
import { DEFAULT_PAGE_SIZE } from "../../../lib/pagination";

interface MentorProfile { id: string; areas: string[]; focus: string | null }
interface MentorSession {
  id: string;
  menteeName: string;
  menteeEmail: string;
  topicTags: string[];
  scheduledAt: string;
  durationMin: number;
  timeZone: string;
  status: "requested" | "confirmed" | "completed" | "canceled" | "no_show";
  meetLink: string | null;
}

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function MentorDashboard() {
  const { ready, isLoggedIn, authFetch } = useAuth();
  const [profile, setProfile] = useState<MentorProfile | null>(null);
  const [areas, setAreas] = useState("");
  const [focus, setFocus] = useState("");
  const [sessions, setSessions] = useState<MentorSession[]>([]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [weekday, setWeekday] = useState(1);
  const [startTime, setStartTime] = useState("19:00");
  const [endTime, setEndTime] = useState("20:00");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [profileResponse, sessionsResponse] = await Promise.all([
        authFetch("/mentorship/profile"), authFetch("/mentorship/sessions"),
      ]);
      const profileResult = await parseAuthJson<MentorProfile>(profileResponse, setError);
      const sessionResult = await parseAuthJson<MentorSession[]>(sessionsResponse, setError);
      if (profileResult) {
        setProfile(profileResult);
        setAreas(profileResult.areas.join(", "));
        setFocus(profileResult.focus ?? "");
      }
      if (sessionResult) setSessions(sessionResult);
    } catch {
      setError("Não foi possível carregar o painel de mentoria.");
    }
  }, [authFetch]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn) {
      window.location.replace("/");
      return;
    }
    void load();
  }, [ready, isLoggedIn, load]);

  const mutate = async (path: string, body: object | undefined, message: string, method = "POST") => {
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      const response = await authFetch(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      if (!response.ok) {
        setError(await extractErrorMessage(response, "Não foi possível atualizar a mentoria."));
        return false;
      }
      setFeedback(message);
      await load();
      return true;
    } catch {
      setError("Não foi possível atualizar a mentoria.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!ready || !profile) {
    return <PageContainer>{error ? <Alert severity="error">{error}</Alert> : <Typography>Carregando mentoria…</Typography>}</PageContainer>;
  }

  const totalPages = Math.ceil(sessions.length / DEFAULT_PAGE_SIZE);
  const visibleSessions = sessions.slice((page - 1) * DEFAULT_PAGE_SIZE, page * DEFAULT_PAGE_SIZE);

  return (
    <PageContainer>
      <Stack spacing={4}>
        <Box><Typography variant="h4" component="h2" sx={{ fontWeight: 800 }}>Minha mentoria</Typography><Typography color="text.secondary">Perfil, disponibilidade e sessões dos participantes.</Typography></Box>
        {error && <Alert severity="error">{error}</Alert>}
        {feedback && <Alert severity="success">{feedback}</Alert>}

        <Card variant="outlined"><CardContent><Stack spacing={2}>
          <Typography variant="h5" component="h3">Perfil público</Typography>
          <TextField label="Áreas" value={areas} onChange={(event) => setAreas(event.target.value)} />
          <TextField label="Foco" multiline minRows={2} value={focus} onChange={(event) => setFocus(event.target.value)} />
          <Button variant="outlined" disabled={busy} onClick={() => void mutate("/mentorship/profile", { areas: areas.split(",").map((area) => area.trim()).filter(Boolean), focus }, "Perfil atualizado.", "PATCH")}>Salvar perfil</Button>
        </Stack></CardContent></Card>

        <Card variant="outlined"><CardContent><Stack spacing={2}>
          <Typography variant="h5" component="h3">Disponibilidade semanal</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select fullWidth label="Dia da semana" value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}>{WEEKDAYS.map((label, value) => <MenuItem key={label} value={value}>{label}</MenuItem>)}</TextField>
            <TextField fullWidth label="Início" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField fullWidth label="Fim" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          </Stack>
          <Button variant="outlined" disabled={busy} onClick={() => void mutate(`/mentorship/availability/${weekday}`, [{ startTime, endTime, timeZone: "America/Sao_Paulo" }], "Disponibilidade atualizada.", "PUT")}>Substituir horários do dia</Button>
          <Typography variant="body2" color="text.secondary">A alteração vale para o dia escolhido e não altera sessões já reservadas.</Typography>
        </Stack></CardContent></Card>

        <Box>
          <Typography variant="h5" component="h3" sx={{ mb: 2 }}>Sessões</Typography>
          <Stack spacing={2}>
            {visibleSessions.length === 0 && <Typography color="text.secondary">Nenhuma sessão encontrada.</Typography>}
            {visibleSessions.map((session) => (
              <Card key={session.id} variant="outlined"><CardContent><Stack spacing={2}>
                <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between" }}>
                  <Box><Typography sx={{ fontWeight: 700 }}>{session.menteeName}</Typography><Typography variant="body2" color="text.secondary">{session.scheduledAt} · {session.timeZone}</Typography></Box>
                  <Chip size="small" label={session.status} />
                </Stack>
                <Typography variant="body2">{session.topicTags.join(", ")}</Typography>
                {session.status === "requested" && <TextField label="Link da sessão" type="url" required value={links[session.id] ?? ""} onChange={(event) => setLinks({ ...links, [session.id]: event.target.value })} slotProps={{ htmlInput: { pattern: "https://.*" } }} />}
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                  {session.status === "requested" && <Button variant="contained" disabled={busy || !(links[session.id]?.startsWith("https://"))} onClick={() => void mutate(`/mentorship/sessions/${session.id}/confirm`, { meetLink: links[session.id] }, "Sessão confirmada.")}>Confirmar sessão</Button>}
                  {session.status === "confirmed" && <>
                    <Button variant="contained" disabled={busy} onClick={() => void mutate(`/mentorship/sessions/${session.id}/complete`, undefined, "Sessão concluída; horas pendentes registradas.")}>Concluir sessão</Button>
                    <Button variant="outlined" disabled={busy} onClick={() => void mutate(`/mentorship/sessions/${session.id}/no-show`, undefined, "No-show registrado.")}>Registrar no-show</Button>
                  </>}
                </Stack>
                {["requested", "confirmed"].includes(session.status) && <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField fullWidth label="Motivo do cancelamento" value={reasons[session.id] ?? ""} onChange={(event) => setReasons({ ...reasons, [session.id]: event.target.value })} />
                  <Button color="error" variant="outlined" disabled={busy || (reasons[session.id]?.trim().length ?? 0) < 3} onClick={() => void mutate(`/mentorship/sessions/${session.id}/cancel`, { reason: reasons[session.id] }, "Sessão cancelada.")}>Cancelar</Button>
                </Stack>}
              </Stack></CardContent></Card>
            ))}
          </Stack>
          <PaginationControls page={page} totalPages={totalPages} onChange={setPage} itemLabel="sessões" />
        </Box>
      </Stack>
    </PageContainer>
  );
}

export default function MentorDashboardIsland() {
  return <MuiIslandProvider><MentorDashboard /></MuiIslandProvider>;
}

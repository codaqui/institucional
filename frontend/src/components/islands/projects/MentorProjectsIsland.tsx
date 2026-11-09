import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useAuth } from "../../../lib/use-auth";
import { extractErrorMessage, parseAuthJson } from "../../../lib/auth-fetch-helpers";

interface Membership {
  projectId: string;
  projectName: string;
  projectSlug: string | null;
  role: "participant" | "mentor";
  status: "draft" | "proposed" | "active" | "finished" | "canceled" | null;
  reportDiscussionUrl: string | null;
}

interface Participant {
  id: string;
  memberId: string;
  role: "participant" | "mentor";
  member: { name: string; handle: string };
}

interface ProjectHour {
  id: string;
  memberId: string;
  hours: number;
  description: string;
  occurredAt: string;
  status: "pending" | "approved" | "rejected";
}

const EMPTY_HOUR = { memberId: "", hours: "", occurredAt: "", description: "" };

export default function MentorProjectsIsland() {
  const { ready, isLoggedIn, authFetch } = useAuth();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [selected, setSelected] = useState<Membership | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [hours, setHours] = useState<ProjectHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [hourOpen, setHourOpen] = useState(false);
  const [editingHour, setEditingHour] = useState<ProjectHour | null>(null);
  const [hourForm, setHourForm] = useState(EMPTY_HOUR);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [finishOpen, setFinishOpen] = useState(false);
  const [reportUrl, setReportUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const loadMemberships = useCallback(async () => {
    setError("");
    try {
      const response = await authFetch("/projects/my");
      const result = await parseAuthJson<Membership[]>(response, setError);
      if (result) {
        const mentors = Array.isArray(result) ? result.filter((item) => item.role === "mentor") : [];
        setMemberships(mentors);
        setSelected((current) => current ? mentors.find((item) => item.projectId === current.projectId) ?? current : current);
      }
    } catch {
      setError("Não foi possível carregar os projetos de mentoria.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (ready && isLoggedIn) void loadMemberships();
  }, [ready, isLoggedIn, loadMemberships]);

  const loadDetails = useCallback(async (projectId: string) => {
    setDetailsLoading(true);
    setError("");
    try {
      const [participantsResponse, hoursResponse] = await Promise.all([
        authFetch(`/projects/${projectId}/participants`),
        authFetch(`/projects/${projectId}/hours`),
      ]);
      const participantResult = await parseAuthJson<Participant[]>(participantsResponse, setError);
      const hourResult = await parseAuthJson<ProjectHour[]>(hoursResponse, setError);
      if (participantResult) setParticipants(Array.isArray(participantResult) ? participantResult : []);
      if (hourResult) setHours(Array.isArray(hourResult) ? hourResult : []);
    } catch {
      setError("Não foi possível carregar os detalhes do projeto.");
    } finally {
      setDetailsLoading(false);
    }
  }, [authFetch]);

  const manage = (membership: Membership) => {
    setSelected(membership);
    setParticipants([]);
    setHours([]);
    void loadDetails(membership.projectId);
  };

  const openHour = (hour: ProjectHour | null) => {
    setEditingHour(hour);
    setHourForm(hour ? {
      memberId: hour.memberId,
      hours: String(hour.hours),
      occurredAt: hour.occurredAt.slice(0, 10),
      description: hour.description,
    } : EMPTY_HOUR);
    setIdempotencyKey(hour ? "" : crypto.randomUUID());
    setError("");
    setHourOpen(true);
  };

  const saveHours = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await authFetch(editingHour ? `/projects/${selected.projectId}/hours/${editingHour.id}` : `/projects/${selected.projectId}/hours`, {
        method: editingHour ? "PATCH" : "POST",
        body: JSON.stringify({
          memberId: hourForm.memberId,
          hours: Number(hourForm.hours),
          occurredAt: hourForm.occurredAt,
          description: hourForm.description.trim(),
          ...(editingHour ? {} : { idempotencyKey }),
        }),
      });
      if (!response.ok) {
        setError(await extractErrorMessage(response, "Não foi possível salvar as horas."));
        return;
      }
      setHourOpen(false);
      setFeedback(editingHour ? "Lançamento atualizado." : "Horas registradas como pendentes de aprovação.");
      await loadDetails(selected.projectId);
    } catch {
      setError("Não foi possível salvar as horas.");
    } finally {
      setSaving(false);
    }
  };

  const finishProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    if (!window.confirm(`Finalizar "${selected.projectName}"?`)) return;
    setSaving(true);
    setError("");
    try {
      const response = await authFetch(`/projects/${selected.projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "finished", reportDiscussionUrl: reportUrl.trim() }),
      });
      if (!response.ok) {
        setError(await extractErrorMessage(response, "Não foi possível finalizar o projeto."));
        return;
      }
      setFinishOpen(false);
      setFeedback("Projeto finalizado. Os participantes já podem emitir suas declarações quando houver horas aprovadas.");
      await loadMemberships();
    } catch {
      setError("Não foi possível finalizar o projeto.");
    } finally {
      setSaving(false);
    }
  };

  if (!ready || loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress aria-label="Carregando mentorias" /></Box>;
  if (!isLoggedIn || memberships.length === 0) return null;

  return (
    <Stack spacing={2} sx={{ mt: 3 }}>
      <Typography variant="h5" component="h3">Projetos que você mentora</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {feedback && <Alert severity="success" onClose={() => setFeedback("")}>{feedback}</Alert>}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ flexWrap: "wrap" }}>
        {memberships.map((membership) => <Button key={membership.projectId} variant={selected?.projectId === membership.projectId ? "contained" : "outlined"} onClick={() => manage(membership)}>Gerenciar projeto<span className="cq-visually-hidden"> {membership.projectName}</span></Button>)}
      </Stack>
      {selected && <Card variant="outlined"><CardContent><Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}><Typography variant="h6" component="h4">{selected.projectName}</Typography><Chip size="small" label={selected.status ?? "Projeto"} /></Stack>
        {selected.status === "active" && <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Button variant="contained" onClick={() => openHour(null)}>Lançar horas</Button><Button color="error" onClick={() => { setReportUrl(selected.reportDiscussionUrl ?? ""); setFinishOpen(true); }}>Finalizar projeto</Button></Stack>}
        {detailsLoading ? <CircularProgress aria-label="Carregando participantes e horas" /> : <>
          <Box><Typography variant="subtitle1" component="h5">Participantes</Typography>{participants.length === 0 ? <Typography variant="body2" color="text.secondary">Nenhum vínculo ativo.</Typography> : <Stack component="ul" sx={{ pl: 3 }}>{participants.map((participant) => <Typography component="li" variant="body2" key={participant.id}>{participant.member.name} (@{participant.member.handle}){participant.role === "mentor" ? " · mentor" : ""}</Typography>)}</Stack>}</Box>
          <Box><Typography variant="subtitle1" component="h5">Horas lançadas</Typography>{hours.length === 0 ? <Typography variant="body2" color="text.secondary">Nenhuma hora lançada.</Typography> : <Stack component="ul" spacing={1} sx={{ listStyle: "none", p: 0 }}>{hours.map((hour) => {
            const owner = participants.find((participant) => participant.memberId === hour.memberId);
            return <Stack component="li" direction={{ xs: "column", sm: "row" }} key={hour.id} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}><Typography variant="body2">{owner?.member.name ?? "Participante"} · {hour.hours}h · {hour.status} · {hour.description}</Typography>{hour.status === "pending" && selected.status === "active" && <Button size="small" onClick={() => openHour(hour)}>Editar lançamento</Button>}</Stack>;
          })}</Stack>}</Box>
        </>}
      </Stack></CardContent></Card>}

      <Dialog open={hourOpen} onClose={() => !saving && setHourOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={(event) => void saveHours(event)}>
          <DialogTitle>{editingHour ? "Editar horas pendentes" : "Lançar horas"}</DialogTitle>
          <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Participante" select required disabled={Boolean(editingHour)} value={hourForm.memberId} onChange={(event) => setHourForm({ ...hourForm, memberId: event.target.value })}>{participants.map((participant) => <MenuItem key={participant.memberId} value={participant.memberId}>{participant.member.name}</MenuItem>)}</TextField>
            <TextField label="Horas" type="number" required value={hourForm.hours} onChange={(event) => setHourForm({ ...hourForm, hours: event.target.value })} slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }} />
            <TextField label="Data da atividade" type="date" required value={hourForm.occurredAt} onChange={(event) => setHourForm({ ...hourForm, occurredAt: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Descrição" multiline minRows={2} required value={hourForm.description} onChange={(event) => setHourForm({ ...hourForm, description: event.target.value })} slotProps={{ htmlInput: { maxLength: 500 } }} />
          </Stack></DialogContent>
          <DialogActions><Button type="button" onClick={() => setHourOpen(false)}>Cancelar</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? "Salvando…" : "Salvar horas"}</Button></DialogActions>
        </form>
      </Dialog>

      <Dialog open={finishOpen} onClose={() => !saving && setFinishOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={(event) => void finishProject(event)}>
          <DialogTitle>Finalizar projeto</DialogTitle>
          <DialogContent><Stack spacing={2} sx={{ pt: 1 }}><Typography variant="body2" color="text.secondary">Vincule a Discussion que contém o relatório final. Projetos finalizados não voltam ao estado ativo.</Typography><TextField label="URL do relatório" type="url" required value={reportUrl} onChange={(event) => setReportUrl(event.target.value)} helperText="Discussion do repositório codaqui/institucional." /></Stack></DialogContent>
          <DialogActions><Button type="button" onClick={() => setFinishOpen(false)}>Cancelar</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? "Finalizando…" : "Confirmar finalização"}</Button></DialogActions>
        </form>
      </Dialog>
    </Stack>
  );
}

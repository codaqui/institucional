import { useState } from "react";
import { Alert, Avatar, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, FormControlLabel, Grid, Stack, TextField, Typography } from "@mui/material";
import MuiIslandProvider from "../MuiIslandProvider";
import { useAuth } from "../../../lib/use-auth";
import { extractErrorMessage, parseAuthJson } from "../../../lib/auth-fetch-helpers";
import type { PublicMentor } from "../../../data/mentors";

interface AvailabilitySlot {
  scheduledAt: string;
  durationMin: number;
  timeZone: string;
}

function MentorDirectory({ mentors }: Readonly<{ mentors: PublicMentor[] }>) {
  const { authFetch, isLoggedIn } = useAuth();
  const [selectedMentor, setSelectedMentor] = useState<PublicMentor | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [form, setForm] = useState({ menteeName: "", menteeEmail: "", topics: "", consent: false });

  const loadSlots = async (mentor: PublicMentor) => {
    setSelectedMentor(mentor);
    setSelectedSlot(null);
    setLoading(true);
    setError("");
    try {
      const response = await authFetch(`/mentorship/availability?mentorId=${encodeURIComponent(mentor.id)}&from=${encodeURIComponent(new Date().toISOString())}`);
      const result = await parseAuthJson<AvailabilitySlot[]>(response, setError);
      if (result) setSlots(result);
    } catch {
      setError("Não foi possível carregar os horários.");
    } finally {
      setLoading(false);
    }
  };

  const reserve = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMentor || !selectedSlot) return;
    setSaving(true);
    setError("");
    try {
      const response = await authFetch("/mentorship/sessions", {
        method: "POST",
        body: JSON.stringify({
          mentorId: selectedMentor.id,
          scheduledAt: selectedSlot.scheduledAt,
          durationMin: selectedSlot.durationMin,
          menteeName: form.menteeName,
          menteeEmail: form.menteeEmail,
          topicTags: form.topics.split(",").map((topic) => topic.trim()).filter(Boolean),
          ...(isLoggedIn ? {} : { guestConsentAt: new Date().toISOString() }),
        }),
      });
      if (!response.ok) {
        setError(await extractErrorMessage(response, "Não foi possível solicitar a sessão."));
        return;
      }
      const result = await response.json() as { token: string };
      setToken(result.token);
      setSelectedSlot(null);
    } catch {
      setError("Não foi possível solicitar a sessão.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        {mentors.map((mentor) => (
          <Grid key={mentor.id} size={{ xs: 12, md: 6 }}>
            <Card variant="outlined" sx={{ height: "100%" }}>
              <CardContent>
                <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 2 }}>
                  <Avatar src={mentor.avatarUrl} alt={`Avatar de ${mentor.name}`} />
                  <Box><Typography variant="h6" component="h3">{mentor.name}</Typography><Typography variant="body2" color="text.secondary">@{mentor.handle}</Typography></Box>
                </Stack>
                <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", mb: 1 }}>{mentor.areas.map((area) => <Chip key={area} size="small" label={area} />)}</Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{mentor.focus}</Typography>
                <Button variant="outlined" onClick={() => void loadSlots(mentor)}>Ver horários de {mentor.name}</Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      {error && <Alert severity="error">{error}</Alert>}
      {token && <Alert severity="success">Sessão solicitada. <Button component="a" href={`/mentoria/sessao/${token}`}>Acompanhar sessão</Button></Alert>}
      {loading && <CircularProgress aria-label="Carregando horários" />}
      {selectedMentor && !loading && !selectedSlot && !token && (
        <Box>
          <Typography variant="h5" component="h3" sx={{ mb: 2 }}>Horários de {selectedMentor.name}</Typography>
          {slots.length === 0 ? <Typography color="text.secondary">Nenhum horário disponível nas próximas quatro semanas.</Typography> : (
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
              {slots.map((slot) => <Button key={`${slot.scheduledAt}-${slot.durationMin}`} variant="outlined" onClick={() => { setSelectedSlot(slot); setToken(""); }}>Agendar {slot.scheduledAt.slice(11, 16)}</Button>)}
            </Stack>
          )}
        </Box>
      )}
      {selectedSlot && (
        <Box component="form" onSubmit={(event) => void reserve(event)} sx={{ maxWidth: 560 }}>
          <Stack spacing={2}>
            <Typography variant="h5" component="h3">Solicitar mentoria</Typography>
            <Typography color="text.secondary">{selectedSlot.scheduledAt.slice(0, 10)} às {selectedSlot.scheduledAt.slice(11, 16)} ({selectedSlot.timeZone})</Typography>
            <TextField label="Nome" name="name" autoComplete="name" required value={form.menteeName} onChange={(event) => setForm({ ...form, menteeName: event.target.value })} />
            <TextField label="E-mail" name="email" type="email" autoComplete="email" required value={form.menteeEmail} onChange={(event) => setForm({ ...form, menteeEmail: event.target.value })} />
            <TextField label="Temas" name="topics" required value={form.topics} onChange={(event) => setForm({ ...form, topics: event.target.value })} helperText="Separe os temas por vírgula." />
            {!isLoggedIn && <FormControlLabel control={<Checkbox required checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} />} label="Consentimento para contato sobre esta sessão" />}
            <Button type="submit" variant="contained" disabled={saving}>{saving ? "Solicitando…" : "Solicitar sessão"}</Button>
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

export default function MentorDirectoryIsland(props: Readonly<{ mentors: PublicMentor[] }>) {
  return <MuiIslandProvider><MentorDirectory {...props} /></MuiIslandProvider>;
}

import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import MuiIslandProvider from "../MuiIslandProvider";
import { resolveApiUrl } from "../../../lib/api-url";
import { extractErrorMessage } from "../../../lib/auth-fetch-helpers";

interface GuestSession {
  scheduledAt: string;
  durationMin: number;
  timeZone: string;
  status: "requested" | "confirmed" | "completed" | "canceled" | "no_show";
  meetLink: string | null;
  menteeName: string;
  menteeEmail: string;
  topicTags: string[];
  rating: number | null;
  feedback: string | null;
  cancelReason: string | null;
}

function MenteeSession({ token }: Readonly<{ token: string }>) {
  const apiUrl = resolveApiUrl(import.meta.env.SITE);
  const [session, setSession] = useState<GuestSession | null>(null);
  const [reason, setReason] = useState("");
  const [rating, setRating] = useState("5");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/mentorship/sessions/${encodeURIComponent(token)}`, { credentials: "include", headers: { Accept: "application/json" } });
      if (!response.ok) {
        setError(await extractErrorMessage(response, "Sessão não encontrada."));
        return;
      }
      setSession(await response.json() as GuestSession);
    } catch {
      setError("Não foi possível carregar a sessão.");
    }
  }, [apiUrl, token]);

  useEffect(() => { void load(); }, [load]);

  const mutate = async (action: "cancel" | "rating", body: object, message: string) => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${apiUrl}/mentorship/sessions/${encodeURIComponent(token)}/${action}`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(await extractErrorMessage(response, "Não foi possível atualizar a sessão."));
        return;
      }
      setSession(await response.json() as GuestSession);
      setSuccess(message);
      if (action === "cancel") setReason("");
    } catch {
      setError("Não foi possível atualizar a sessão.");
    } finally {
      setSaving(false);
    }
  };

  if (error && !session) return <Alert severity="error">{error}</Alert>;
  if (!session) return <Typography>Carregando sessão…</Typography>;

  return (
    <Stack spacing={3} sx={{ maxWidth: 680 }}>
      <Box>
        <Typography variant="h4" component="h2">Sessão de mentoria</Typography>
        <Typography color="text.secondary">{session.scheduledAt} · {session.durationMin} min · {session.timeZone}</Typography>
        <Typography>Status: {session.status}</Typography>
        <Typography>Temas: {session.topicTags.join(", ")}</Typography>
        {session.meetLink && session.status === "confirmed" && <Button component="a" href={session.meetLink} target="_blank" rel="noopener noreferrer" variant="contained" sx={{ mt: 2 }}>Entrar na sessão</Button>}
        {session.cancelReason && <Alert severity="info" sx={{ mt: 2 }}>Motivo: {session.cancelReason}</Alert>}
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      {["requested", "confirmed"].includes(session.status) && (
        <Box component="form" onSubmit={(event) => { event.preventDefault(); void mutate("cancel", { reason }, "Sessão cancelada."); }}>
          <Stack spacing={2}>
            <TextField label="Motivo do cancelamento" required value={reason} onChange={(event) => setReason(event.target.value)} slotProps={{ htmlInput: { minLength: 3, maxLength: 500 } }} />
            <Button type="submit" color="error" variant="outlined" disabled={saving}>Cancelar sessão</Button>
          </Stack>
        </Box>
      )}
      {session.status === "completed" && (
        <Box component="form" onSubmit={(event) => { event.preventDefault(); void mutate("rating", { rating: Number(rating), feedback }, "Avaliação registrada. Obrigado!"); }}>
          <Stack spacing={2}>
            <TextField select label="Avaliação" value={rating} onChange={(event) => setRating(event.target.value)} slotProps={{ select: { native: true } }}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</TextField>
            <TextField label="Feedback" multiline minRows={3} value={feedback} onChange={(event) => setFeedback(event.target.value)} slotProps={{ htmlInput: { maxLength: 2000 } }} />
            <Button type="submit" variant="contained" disabled={saving}>Enviar avaliação</Button>
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

export default function MenteeSessionIsland(props: Readonly<{ token: string }>) {
  return <MuiIslandProvider><MenteeSession {...props} /></MuiIslandProvider>;
}

import { useEffect, useState } from "react";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import MuiIslandProvider from "../MuiIslandProvider";
import { useAuth } from "../../../lib/use-auth";
import { extractErrorMessage, parseAuthJson } from "../../../lib/auth-fetch-helpers";

interface Application { id: string; status: string }

function MentorApplication() {
  const { ready, isLoggedIn, login, authFetch } = useAuth();
  const [areas, setAreas] = useState("");
  const [focus, setFocus] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!ready || !isLoggedIn) return;
    void authFetch("/mentorship/applications/my").then(async (response) => {
      const result = await parseAuthJson<Application[]>(response, setError);
      if (result) setApplications(result);
    }).catch(() => setError("Não foi possível carregar suas candidaturas."));
  }, [ready, isLoggedIn, authFetch]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await authFetch("/mentorship/applications", {
        method: "POST",
        body: JSON.stringify({ areas: areas.split(",").map((area) => area.trim()).filter(Boolean), focus }),
      });
      if (!response.ok) {
        setError(await extractErrorMessage(response, "Não foi possível enviar a candidatura."));
        return;
      }
      const application = await response.json() as Application;
      setApplications((current) => [application, ...current]);
      setAreas("");
      setFocus("");
      setSuccess("Candidatura enviada para análise da administração.");
    } catch {
      setError("Não foi possível enviar a candidatura.");
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return null;
  if (!isLoggedIn) return <Button variant="contained" onClick={() => login({ returnTo: "/participe/mentoria" })}>Entrar para ser mentor</Button>;

  return (
    <Stack spacing={2}>
      {applications.map((application) => <Alert key={application.id} severity="info">Candidatura: {application.status}</Alert>)}
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      <Box component="form" onSubmit={(event) => void submit(event)}>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">A administração revisará sua candidatura antes de ativar o perfil.</Typography>
          <TextField label="Áreas" name="areas" required value={areas} onChange={(event) => setAreas(event.target.value)} helperText="Separe por vírgula; por exemplo: DevOps, Backend." />
          <TextField label="Foco" name="focus" value={focus} onChange={(event) => setFocus(event.target.value)} multiline minRows={2} />
          <Button type="submit" variant="contained" disabled={saving}>{saving ? "Enviando…" : "Enviar candidatura"}</Button>
        </Stack>
      </Box>
    </Stack>
  );
}

export default function MentorApplicationIsland() {
  return <MuiIslandProvider><MentorApplication /></MuiIslandProvider>;
}

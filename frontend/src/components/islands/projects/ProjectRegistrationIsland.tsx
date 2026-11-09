import { useCallback, useEffect, useState } from "react";
import { Alert, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { extractErrorMessage } from "../../../lib/auth-fetch-helpers";
import { useAuth } from "../../../lib/use-auth";

interface ProjectRegistrationIslandProps {
  projectId: string;
}

export default function ProjectRegistrationIsland({ projectId }: Readonly<ProjectRegistrationIslandProps>) {
  const { ready, isLoggedIn, authFetch, login } = useAuth();
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready || !isLoggedIn) return;
    void authFetch("/projects/my").then(async (response) => {
      if (!response.ok) return;
      const items = await response.json() as Array<{ projectId: string }>;
      setJoined(items.some((item) => item.projectId === projectId));
    }).catch(() => undefined);
  }, [authFetch, isLoggedIn, projectId, ready]);

  const changeMembership = useCallback(async (action: "join" | "leave") => {
    setBusy(true);
    setError("");
    try {
      const response = await authFetch(`/projects/${projectId}/${action}`, { method: "POST" });
      if (!response.ok) {
        setError(await extractErrorMessage(response, "Não foi possível atualizar a inscrição."));
        return;
      }
      setJoined(action === "join");
    } catch {
      setError("Não foi possível atualizar a inscrição. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }, [authFetch, projectId]);

  if (!ready) return <CircularProgress size={24} aria-label="Carregando autenticação" />;
  if (!isLoggedIn) {
    return (
      <Button variant="contained" onClick={() => login({ returnTo: globalThis.location.pathname })}>
        Entrar com GitHub para se inscrever
      </Button>
    );
  }

  return (
    <Stack spacing={1.5}>
      {error && <Alert severity="error">{error}</Alert>}
      {joined && <Alert severity="success">Inscrição confirmada neste projeto.</Alert>}
      <Button
        variant={joined ? "outlined" : "contained"}
        color={joined ? "error" : "primary"}
        disabled={busy}
        onClick={() => void changeMembership(joined ? "leave" : "join")}
      >
        {busy ? "Atualizando…" : joined ? "Sair do projeto" : "Inscrever-se"}
      </Button>
      <Typography variant="caption" color="text.secondary">
        A janela e o limite de vagas são confirmados pelo servidor na inscrição.
      </Typography>
    </Stack>
  );
}

import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MuiIslandProvider from "../MuiIslandProvider";
import { extractErrorMessage, parseAuthJson } from "../../../lib/auth-fetch-helpers";
import { useAuth } from "../../../lib/use-auth";

interface MyEvaluation {
  designationId: string;
  status: "pending" | "active";
  call: { id: string; slug: string; name: string; status: string };
}

function C4pEvaluatorHomeInner() {
  const { ready, isLoggedIn, login, authFetch } = useAuth();
  const [evaluations, setEvaluations] = useState<MyEvaluation[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    const response = await authFetch("/c4p/evaluator/calls");
    setEvaluations(
      await parseAuthJson<MyEvaluation[]>(response, setLoadError),
    );
  }, [authFetch]);

  useEffect(() => {
    if (ready && isLoggedIn) void load();
  }, [ready, isLoggedIn, load]);

  if (!ready) {
    return <CircularProgress aria-label="Carregando" />;
  }
  if (!isLoggedIn) {
    return (
      <Box sx={{ textAlign: "center", py: 4 }}>
        <Typography sx={{ mb: 2 }} color="text.secondary">
          Entre com sua conta do GitHub para ver seus convites de avaliação.
        </Typography>
        <Button
          variant="contained"
          onClick={() => login({ returnTo: "/c4p/avaliar" })}
        >
          Entrar para avaliar
        </Button>
      </Box>
    );
  }

  const accept = async (designationId: string) => {
    setFeedback("");
    const response = await authFetch(
      `/c4p/evaluator/designations/${designationId}/accept`,
      { method: "POST" },
    );
    if (!response.ok) {
      setFeedback(await extractErrorMessage(response, "Não foi possível aceitar o convite."));
      return;
    }
    await load();
  };

  if (evaluations === null && !loadError) {
    return <CircularProgress aria-label="Carregando convites" />;
  }

  const pending = (evaluations ?? []).filter((item) => item.status === "pending");
  const active = (evaluations ?? []).filter((item) => item.status === "active");

  return (
    <Stack spacing={3}>
      <Typography variant="h5" component="h2">Avaliação de propostas (C4P)</Typography>
      {loadError ? <Alert severity="error">{loadError}</Alert> : null}
      {feedback ? <Alert severity="error">{feedback}</Alert> : null}
      {pending.length === 0 && active.length === 0 ? (
        <Alert severity="info">
          Você não tem convites de avaliação no momento. Os convites chegam por
          e-mail quando uma chamada o seleciona como avaliador(a).
        </Alert>
      ) : null}
      {pending.map((item) => (
        <Alert
          key={item.designationId}
          severity="info"
          action={
            <Button color="inherit" size="small" onClick={() => accept(item.designationId)}>
              Aceitar convite
            </Button>
          }
        >
          Convite pendente: <strong>{item.call.name}</strong>
        </Alert>
      ))}
      {active.map((item) => (
        <Box
          key={item.designationId}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Typography>{item.call.name}</Typography>
          <Button
            variant="contained"
            href={`/c4p/avaliar/votar?call=${encodeURIComponent(item.call.id)}`}
          >
            Avaliar propostas
          </Button>
        </Box>
      ))}
    </Stack>
  );
}

export default function C4pEvaluatorHomeIsland() {
  return (
    <MuiIslandProvider>
      <C4pEvaluatorHomeInner />
    </MuiIslandProvider>
  );
}

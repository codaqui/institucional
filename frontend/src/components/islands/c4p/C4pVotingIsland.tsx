import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MuiIslandProvider from "../MuiIslandProvider";
import {
  extractErrorMessage,
  parseAuthJson,
} from "../../../lib/auth-fetch-helpers";
import { useAuth } from "../../../lib/use-auth";

interface Criterion {
  key: string;
  label: string;
  weight: number;
}

interface EvaluatorCall {
  call: { id: string; name: string; criteria?: Criterion[] };
  progress: { voted: number; total: number };
}

interface EvaluatorTalk {
  id: string;
  title: string;
  summary: string;
  level: string | null;
  track: string | null;
  speakerName: string;
  speakerRole: string | null;
  bio: string | null;
  myVote: {
    scores: Record<string, number>;
    comment: string | null;
    updatedAt: string;
  } | null;
}

function C4pVotingInner({ callId: callIdProp }: Readonly<{ callId?: string }>) {
  const callId =
    callIdProp ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("call") || ""
      : "");
  const { ready, isLoggedIn, authFetch } = useAuth();
  const [callInfo, setCallInfo] = useState<EvaluatorCall | null>(null);
  const [talks, setTalks] = useState<EvaluatorTalk[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [selectedTalkId, setSelectedTalkId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    const [callResponse, talksResponse] = await Promise.all([
      authFetch(`/c4p/evaluator/calls/${callId}`),
      authFetch(`/c4p/evaluator/calls/${callId}/talks`),
    ]);
    const nextCall = await parseAuthJson<EvaluatorCall>(callResponse, setLoadError);
    const nextTalks = await parseAuthJson<EvaluatorTalk[]>(talksResponse, setLoadError);
    setCallInfo(nextCall);
    setTalks(nextTalks);
    if (nextTalks && nextTalks.length > 0) {
      setSelectedTalkId((current) =>
        current && nextTalks.some((talk) => talk.id === current)
          ? current
          : nextTalks[0].id,
      );
    }
  }, [authFetch, callId]);

  useEffect(() => {
    if (ready && isLoggedIn) void load();
  }, [ready, isLoggedIn, load]);

  const criteria = useMemo<Criterion[]>(
    () => callInfo?.call?.criteria ?? [],
    [callInfo],
  );

  const selectedTalk = useMemo(
    () => talks?.find((talk) => talk.id === selectedTalkId) ?? null,
    [talks, selectedTalkId],
  );

  useEffect(() => {
    if (!selectedTalk) return;
    const next: Record<string, number> = {};
    for (const criterion of criteria) {
      next[criterion.key] = selectedTalk.myVote?.scores[criterion.key] ?? 5;
    }
    setScores(next);
    setComment(selectedTalk.myVote?.comment ?? "");
  }, [selectedTalk, criteria]);

  const save = async () => {
    if (!selectedTalk) return;
    setSaving(true);
    setError("");
    try {
      const response = await authFetch(
        `/c4p/evaluator/calls/${callId}/talks/${selectedTalk.id}/vote`,
        {
          method: "PUT",
          body: JSON.stringify({
            scores,
            ...(comment.trim() ? { comment: comment.trim() } : {}),
          }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await extractErrorMessage(response, "Não foi possível salvar a avaliação."),
        );
      }
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar a avaliação.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!callId) {
    return (
      <Alert severity="error">
        Link incompleto: informe a campanha com <code>?call=&lt;id&gt;</code>.
      </Alert>
    );
  }

  if (!ready || !isLoggedIn || callInfo === null || talks === null) {
    return loadError ? (
      <Alert severity="error">{loadError}</Alert>
    ) : (
      <CircularProgress aria-label="Carregando propostas" />
    );
  }

  const progress = callInfo.progress;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" component="h2">{callInfo.call.name}</Typography>
        <Typography color="text.secondary">
          {progress.voted} de {progress.total} avaliadas
        </Typography>
      </Box>
      {loadError ? <Alert severity="error">{loadError}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {talks.length === 0 ? (
        <Alert severity="info">Esta chamada ainda não recebeu propostas.</Alert>
      ) : (
        <Stack spacing={2}>
          {talks.map((talk) => (
            <Button
              key={talk.id}
              variant={talk.id === selectedTalkId ? "contained" : "outlined"}
              onClick={() => setSelectedTalkId(talk.id)}
              sx={{ justifyContent: "flex-start", textAlign: "left" }}
            >
              {talk.myVote ? "✓ " : ""}
              {talk.title}
            </Button>
          ))}
        </Stack>
      )}
      {selectedTalk ? (
        <Stack spacing={2}>
          <Typography variant="h6" component="h3">{selectedTalk.title}</Typography>
          <Typography color="text.secondary">
            {selectedTalk.speakerName}
            {selectedTalk.track ? ` · ${selectedTalk.track}` : ""}
            {selectedTalk.level ? ` · ${selectedTalk.level}` : ""}
          </Typography>
          <Typography sx={{ whiteSpace: "pre-wrap" }}>{selectedTalk.summary}</Typography>
          {selectedTalk.bio ? (
            <Typography color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
              {selectedTalk.bio}
            </Typography>
          ) : null}
          {criteria.map((criterion) => (
            <Box key={criterion.key}>
              <Typography id={`criterion-${criterion.key}`}>{criterion.label}</Typography>
              <Slider
                min={0}
                max={10}
                step={1}
                value={scores[criterion.key] ?? 5}
                onChange={(_event, value) =>
                  setScores((current) => ({
                    ...current,
                    [criterion.key]: value as number,
                  }))
                }
                aria-labelledby={`criterion-${criterion.key}`}
                valueLabelDisplay="auto"
                marks
              />
            </Box>
          ))}
          <TextField
            label="Comentário para a curadoria (opcional)"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            multiline
            minRows={2}
          />
          <Button
            variant="contained"
            onClick={() => void save()}
            disabled={saving}
            sx={{ alignSelf: "flex-start" }}
          >
            {saving ? "Salvando…" : "Salvar avaliação"}
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
}

export default function C4pVotingIsland({
  callId,
}: Readonly<{ callId?: string }>) {
  return (
    <MuiIslandProvider>
      <C4pVotingInner callId={callId} />
    </MuiIslandProvider>
  );
}

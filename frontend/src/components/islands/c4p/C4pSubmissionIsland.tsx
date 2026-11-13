import { useEffect, useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MuiIslandProvider from "../MuiIslandProvider";
import TurnstileField from "../ui/TurnstileField";
import { resolveApiUrl } from "../../../lib/api-url";

interface PublicCall {
  slug: string;
  name: string;
  description: string | null;
  status: string;
  submissionOpenAt: string | null;
  submissionCloseAt: string | null;
  community: { slug: string; name: string } | null;
  event: { slug: string; title: string } | null;
}

async function readApiError(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  const message = Array.isArray(body?.message)
    ? body.message.join(" ")
    : body?.message;
  return new Error(message ?? fallback);
}

function isAccepting(call: PublicCall): boolean {
  if (call.status !== "open") {
    return false;
  }
  const now = Date.now();
  if (call.submissionOpenAt && Date.parse(call.submissionOpenAt) > now) {
    return false;
  }
  if (call.submissionCloseAt && Date.parse(call.submissionCloseAt) <= now) {
    return false;
  }
  return true;
}

function C4pSubmissionInner({ slug }: Readonly<{ slug: string }>) {
  const apiUrl = resolveApiUrl(import.meta.env.SITE);
  const [call, setCall] = useState<PublicCall | null>(null);
  const [loadError, setLoadError] = useState("");
  const [speakerName, setSpeakerName] = useState("");
  const [speakerEmail, setSpeakerEmail] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [track, setTrack] = useState("");
  const [level, setLevel] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [consent, setConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/c4p/public/calls/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Chamada não encontrada.");
        return res.json() as Promise<PublicCall>;
      })
      .then((data) => {
        if (active) setCall(data);
      })
      .catch((reason: Error) => {
        if (active) setLoadError(reason.message);
      });
    return () => {
      active = false;
    };
  }, [apiUrl, slug]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(
        `${apiUrl}/c4p/public/calls/${encodeURIComponent(slug)}/submissions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            speakerName,
            speakerEmail,
            title,
            summary,
            ...(track.trim() ? { track: track.trim() } : {}),
            ...(level ? { level } : {}),
            ...(linkedin.trim() ? { linkedin: linkedin.trim() } : {}),
            consent,
            turnstileToken,
          }),
        },
      );
      if (!res.ok) throw await readApiError(res, "Não foi possível enviar a proposta.");
      setSubmitted(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível enviar a proposta.",
      );
      setTurnstileResetKey((current) => current + 1);
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return <Alert severity="error">{loadError}</Alert>;
  }
  if (!call) {
    return <CircularProgress aria-label="Carregando chamada" />;
  }
  if (!isAccepting(call)) {
    return (
      <Alert severity="info">
        A chamada <strong>{call.name}</strong> não está aceitando submissões no
        momento.
      </Alert>
    );
  }
  if (submitted) {
    return (
      <Stack spacing={2} role="status" sx={{ alignItems: "center", textAlign: "center" }}>
        <Typography variant="h5" component="h2">Proposta enviada!</Typography>
        <Typography color="text.secondary">
          Obrigado por submeter <strong>{title}</strong> para a{" "}
          <strong>{call.name}</strong>. Você receberá a confirmação por e-mail e
          o resultado será comunicado pela curadoria.
        </Typography>
      </Stack>
    );
  }

  return (
    <Box component="form" onSubmit={submit} sx={{ maxWidth: 640 }}>
      <Stack spacing={2}>
        <Typography variant="h5" component="h2">{call.name}</Typography>
        {call.description ? (
          <Typography color="text.secondary">{call.description}</Typography>
        ) : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        <TextField
          label="Seu nome"
          value={speakerName}
          onChange={(event) => setSpeakerName(event.target.value)}
          required
          fullWidth
        />
        <TextField
          label="Seu e-mail"
          type="email"
          value={speakerEmail}
          onChange={(event) => setSpeakerEmail(event.target.value)}
          required
          fullWidth
        />
        <TextField
          label="Título da palestra"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          fullWidth
        />
        <TextField
          label="Resumo da palestra"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          required
          multiline
          minRows={4}
          fullWidth
        />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Trilha/tema"
            value={track}
            onChange={(event) => setTrack(event.target.value)}
            fullWidth
          />
          <TextField
            label="Nível"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            select
            slotProps={{ select: { native: true } }}
            fullWidth
          >
            <option value="">Não informado</option>
            <option value="Iniciante">Iniciante</option>
            <option value="Intermediário">Intermediário</option>
            <option value="Avançado">Avançado</option>
          </TextField>
        </Stack>
        <TextField
          label="LinkedIn (https://…)"
          type="url"
          value={linkedin}
          onChange={(event) => setLinkedin(event.target.value)}
          fullWidth
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
          }
          label="Declaro meu consentimento para o tratamento dos meus dados nesta submissão e na curadoria da chamada, conforme a Política de Privacidade."
        />
        <TurnstileField
          onTokenChange={setTurnstileToken}
          action="c4p_submission"
          resetKey={turnstileResetKey}
        />
        <Button type="submit" variant="contained" disabled={saving || !consent}>
          {saving ? "Enviando…" : "Enviar proposta"}
        </Button>
      </Stack>
    </Box>
  );
}

export default function C4pSubmissionIsland({
  slug,
}: Readonly<{ slug: string }>) {
  return (
    <MuiIslandProvider>
      <C4pSubmissionInner slug={slug} />
    </MuiIslandProvider>
  );
}

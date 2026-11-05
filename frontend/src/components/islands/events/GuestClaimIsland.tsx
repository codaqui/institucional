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
import { QRCodeSVG } from "qrcode.react";
import MuiIslandProvider from "../MuiIslandProvider";
import TurnstileField from "../ui/TurnstileField";
import { resolveApiUrl } from "../../../lib/api-url";

interface GuestInvite {
  status: string;
  eventTitle?: string;
  eventStartAt?: string;
  attendeeName?: string | null;
  attendeeEmail?: string | null;
  checkinToken?: string | null;
}

function GuestClaim({ token }: Readonly<{ token: string }>) {
  const apiUrl = resolveApiUrl(import.meta.env.SITE);
  const [invite, setInvite] = useState<GuestInvite | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const actualToken = token || new URLSearchParams(window.location.search).get("token") || "";

  useEffect(() => {
    if (!actualToken) {
      setError("O link do convite está incompleto. Solicite um novo link ao organizador.");
      return;
    }
    let active = true;
    fetch(`${apiUrl}/events/public/guest-invites/${encodeURIComponent(actualToken)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Convite não encontrado ou indisponível.");
        return res.json() as Promise<GuestInvite>;
      })
      .then((data) => { if (active) setInvite(data); })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [apiUrl, actualToken]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${apiUrl}/events/public/guest-claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: actualToken,
          name,
          email,
          consent,
          turnstileToken,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { message?: string | string[] } | null;
        const message = Array.isArray(body?.message) ? body.message.join(" ") : body?.message;
        throw new Error(message ?? "Não foi possível confirmar a inscrição.");
      }
      setInvite(await res.json() as GuestInvite);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível confirmar a inscrição.");
      setTurnstileResetKey((current) => current + 1);
    } finally {
      setSaving(false);
    }
  };

  if (error && !invite) return <Alert severity="error">{error}</Alert>;
  if (!invite) return <CircularProgress aria-label="Carregando convite" />;

  if (invite.status === "confirmed") {
    return (
      <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
        <Typography variant="h5" component="h2">Inscrição confirmada</Typography>
        <Typography>{invite.attendeeName}</Typography>
        <Typography color="text.secondary">{invite.attendeeEmail}</Typography>
        <Box role="img" aria-label="QR Code de check-in" sx={{ p: 2, bgcolor: "background.paper" }}>
          <QRCodeSVG value={invite.checkinToken ?? ""} size={200} />
        </Box>
        <Typography color="text.secondary">Apresente este QR Code na entrada do evento.</Typography>
      </Stack>
    );
  }

  if (invite.status !== "pending_guest") {
    return <Alert severity="info">Este convite não está mais disponível.</Alert>;
  }

  return (
    <Stack spacing={2} component="form" onSubmit={submit}>
      <Typography variant="h5" component="h2">{invite.eventTitle}</Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <TextField
        label="Nome completo"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
        slotProps={{ input: { name: "name", autoComplete: "name" }, htmlInput: { maxLength: 160 } }}
      />
      <TextField
        label="E-mail"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
        slotProps={{ input: { name: "email", autoComplete: "email" } }}
      />
      <FormControlLabel
        control={<Checkbox checked={consent} onChange={(event) => setConsent(event.target.checked)} required />}
        label="Concordo com o uso dos dados para inscrição e comunicações deste evento, conforme a Política de Privacidade."
      />
      <TurnstileField onTokenChange={setTurnstileToken} action="guest_claim" resetKey={turnstileResetKey} />
      <Button type="submit" variant="contained" disabled={saving}>
        {saving ? "Confirmando…" : "Confirmar inscrição"}
      </Button>
      <Typography variant="body2" color="text.secondary">
        Leia a <a href="/sobre/privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>.
      </Typography>
    </Stack>
  );
}

export default function GuestClaimIsland(props: Readonly<{ token: string }>) {
  return <MuiIslandProvider><GuestClaim {...props} /></MuiIslandProvider>;
}

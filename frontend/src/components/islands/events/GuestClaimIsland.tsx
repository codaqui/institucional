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
import { buildMemberHref } from "../../../lib/member-navigation";
import { useAuth } from "../../../lib/use-auth";

interface GuestInvite {
  status: string;
  eventTitle?: string;
  eventStartAt?: string;
  attendeeName?: string | null;
  attendeeEmail?: string | null;
  checkinToken?: string | null;
  requiresAccount?: boolean;
  registrationId?: string;
  certificateGranted?: boolean;
}

async function readApiError(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => null) as { message?: string | string[] } | null;
  const message = Array.isArray(body?.message) ? body.message.join(" ") : body?.message;
  return new Error(message ?? fallback);
}

function AccountClaimResult({ invite }: Readonly<{ invite: GuestInvite }>) {
  const certificateHref = invite.registrationId
    ? `/membro${buildMemberHref("participation", "certificates")}&certificate=${encodeURIComponent(invite.registrationId)}`
    : `/membro${buildMemberHref("participation", "certificates")}`;
  const hasCertificate = invite.certificateGranted === true;
  return (
    <Stack spacing={2} role="status" sx={{ alignItems: "center", textAlign: "center" }}>
      <Typography variant="h5" component="h2">Participação vinculada à sua conta</Typography>
      <Typography>{invite.attendeeName}</Typography>
      <Typography color="text.secondary">{invite.attendeeEmail}</Typography>
      <Typography color="text.secondary">
        {hasCertificate
          ? "Seu certificado já foi concedido e está pronto para abrir."
          : "A organização ainda não concedeu o certificado. Acompanhe sua participação na área do membro."}
      </Typography>
      <Button
        variant="contained"
        href={hasCertificate
          ? certificateHref
          : `/membro${buildMemberHref("participation", "history")}`}
      >
        {hasCertificate ? "Abrir meu certificado" : "Ver histórico de participação"}
      </Button>
    </Stack>
  );
}

function AccountClaimPanel({
  invite,
  error,
  saving,
  userHandle,
  isLoggedIn,
  login,
  claimWithAccount,
}: Readonly<{
  invite: GuestInvite;
  error: string;
  saving: boolean;
  userHandle?: string;
  isLoggedIn: boolean;
  login: (options?: { returnTo?: string; switchAccount?: boolean }) => void;
  claimWithAccount: () => void;
}>) {
  const returnTo = window.location.pathname + window.location.search;
  return (
    <Stack spacing={2}>
      <Typography variant="h5" component="h2">{invite.eventTitle}</Typography>
      <Typography>
        Entre ou crie sua conta Codaqui com GitHub para associar esta participação e o certificado.
        O e-mail do convite precisa estar verificado na conta GitHub utilizada.
      </Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {isLoggedIn ? (
        <>
          <Typography color="text.secondary">Conta conectada: @{userHandle}</Typography>
          <Button type="button" variant="contained" onClick={claimWithAccount} disabled={saving}>
            {saving ? "Associando…" : "Associar certificado à minha conta"}
          </Button>
          <Button type="button" variant="text" disabled={saving} onClick={() => login({ returnTo, switchAccount: true })}>
            Trocar conta GitHub
          </Button>
        </>
      ) : (
        <Button type="button" variant="contained" onClick={() => login({ returnTo })}>
          Entrar com GitHub e associar certificado
        </Button>
      )}
    </Stack>
  );
}

function GuestClaim({ token }: Readonly<{ token: string }>) {
  const apiUrl = resolveApiUrl(import.meta.env.SITE);
  const { user, ready, isLoggedIn, login, authFetch } = useAuth();
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
      if (!res.ok) throw await readApiError(res, "Não foi possível confirmar a inscrição.");
      setInvite(await res.json() as GuestInvite);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível confirmar a inscrição.");
      setTurnstileResetKey((current) => current + 1);
    } finally {
      setSaving(false);
    }
  };

  const claimWithAccount = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await authFetch("/events/public/guest-claim/github", {
        method: "POST",
        body: JSON.stringify({ token: actualToken, consent: true }),
      });
      if (!res.ok) throw await readApiError(res, "Não foi possível associar o certificado.");
      setInvite(await res.json() as GuestInvite);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível associar o certificado.");
    } finally {
      setSaving(false);
    }
  };

  if (error && !invite) return <Alert severity="error">{error}</Alert>;
  if (!invite || !ready) return <CircularProgress aria-label="Carregando convite" />;

  if (invite.status === "confirmed" && invite.requiresAccount) {
    return <AccountClaimResult invite={invite} />;
  }

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

  if (invite.requiresAccount) {
    return (
      <AccountClaimPanel
        invite={invite}
        error={error}
        saving={saving}
        userHandle={user?.handle}
        isLoggedIn={isLoggedIn}
        login={login}
        claimWithAccount={claimWithAccount}
      />
    );
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

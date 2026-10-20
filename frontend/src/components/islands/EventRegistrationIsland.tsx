import { useEffect, useState } from "react";
import MuiIslandProvider from "./MuiIslandProvider";
import { useAuth } from "../../lib/use-auth";
import { API_URL } from "../../lib/config";
import { Alert, Button, MenuItem, Select, Stack, Typography } from "@mui/material";

interface TicketType {
  id: string;
  name: string;
  kind: "free" | "paid" | "community" | "company";
  priceCents: number;
  quantityTotal: number;
  quantitySold: number;
  salesStartAt?: string;
  salesEndAt?: string;
  maxPerOrder?: number;
}

interface Props {
  eventId: string;
  source: string;
  sourceId: string;
  externalHref: string;
  ctaLabel: string;
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function RegistrationInner({ eventId, source, externalHref, ctaLabel }: Props) {
  const { isLoggedIn, ready, login, authFetch } = useAuth();
  const [ticketTypes, setTicketTypes] = useState<TicketType[] | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  // Retorno do Stripe (?status=success&session_id=...) — POC mostra inline;
  // na 0.4 redireciona para /membro?purchase=success.
  const [paymentSuccess] = useState(() => {
    if (typeof window === "undefined") return false;
    const q = new URLSearchParams(window.location.search);
    return q.get("status") === "success" && q.has("session_id");
  });

  const isInternal = source === "internal";

  useEffect(() => {
    if (!isInternal) return;
    fetch(`${API_URL}/events/public/managed/${eventId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setTicketTypes(data?.ticketTypes ?? []))
      .catch(() => setTicketTypes([]));
  }, [eventId, isInternal]);

  if (paymentSuccess) {
    return <Alert severity="success">Inscrição confirmada! 🎉 Você receberá os detalhes por e-mail.</Alert>;
  }

  if (!isInternal) {
    return (
      <Button
        variant="contained"
        href={externalHref}
        target="_blank"
        rel="noopener noreferrer"
      >
        {ctaLabel}
      </Button>
    );
  }

  if (!ready || ticketTypes === null) {
    return <span className="inline-block h-10 w-48 animate-pulse rounded-md bg-sunken" />;
  }

  if (ticketTypes.length === 0) {
    return <Typography color="text.secondary">Inscrições em breve.</Typography>;
  }

  if (!isLoggedIn) {
    return (
      <Stack spacing={1}>
        <Typography color="text.secondary">Entre com sua conta para se inscrever.</Typography>
        <Button variant="contained" onClick={() => login()} sx={{ alignSelf: "flex-start" }}>
          Entrar com GitHub
        </Button>
      </Stack>
    );
  }

  if (done) {
    return <Alert severity="success">Inscrição realizada! 🎉</Alert>;
  }

  const ticket = ticketTypes.find((t) => t.id === selected);

  const submit = async () => {
    if (!ticket) return;
    setLoading(true);
    setError(null);
    try {
      if (ticket.kind === "free") {
        const res = await authFetch(`/events/${eventId}/register`, {
          method: "POST",
          body: JSON.stringify({ ticketTypeId: ticket.id }),
        });
        if (res.status === 409) throw new Error("Você já está inscrito ou o lote esgotou.");
        if (!res.ok) throw new Error("Falha ao inscrever. Tente novamente.");
        setDone(true);
      } else {
        const res = await authFetch(`/events/${eventId}/checkout`, {
          method: "POST",
          body: JSON.stringify({ ticketTypeId: ticket.id, quantity: 1, acceptTerms: true }),
        });
        if (res.status === 409) throw new Error("Você já possui ingresso para este evento.");
        if (!res.ok) throw new Error("Falha ao iniciar o pagamento. Tente novamente.");
        const data = (await res.json()) as { url?: string };
        if (!data.url) throw new Error("Checkout indisponível no momento.");
        window.location.href = data.url;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography sx={{ fontWeight: 700 }}>Inscrição</Typography>
      <Select
        value={selected}
        displayEmpty
        onChange={(e) => setSelected(e.target.value)}
        sx={{ maxWidth: 360 }}
        inputProps={{ "aria-label": "Tipo de ingresso" }}
      >
        <MenuItem value="" disabled>Selecione o ingresso</MenuItem>
        {ticketTypes.map((t) => (
          <MenuItem key={t.id} value={t.id} disabled={t.quantitySold >= t.quantityTotal}>
            {t.name} — {t.kind === "free" ? "Grátis" : formatBRL(t.priceCents)}
            {t.quantitySold >= t.quantityTotal ? " (esgotado)" : ""}
          </MenuItem>
        ))}
      </Select>
      {error && <Alert severity="error">{error}</Alert>}
      <Button
        variant="contained"
        disabled={!ticket || loading}
        onClick={submit}
        sx={{ alignSelf: "flex-start" }}
      >
        {loading ? "Processando…" : ticket?.kind === "free" ? "Confirmar inscrição" : "Ir para pagamento"}
      </Button>
    </Stack>
  );
}

export default function EventRegistrationIsland(props: Props) {
  return (
    <MuiIslandProvider>
      <RegistrationInner {...props} />
    </MuiIslandProvider>
  );
}

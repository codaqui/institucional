import React, { useEffect, useMemo, useState } from "react";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import { useLocation, useHistory } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import {
  Alert,
  Avatar,
  AvatarGroup,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Container,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ForumIcon from "@mui/icons-material/Forum";
import GitHubIcon from "@mui/icons-material/GitHub";
import GroupsIcon from "@mui/icons-material/Groups";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import RepeatIcon from "@mui/icons-material/Repeat";
import SlideshowIcon from "@mui/icons-material/Slideshow";
import EventOverrideBadge from "../../components/EventOverrideBadge";
import StripeEmbeddedCheckoutDialog from "../../components/StripeEmbeddedCheckoutDialog";
import { useAuth } from "../../hooks/useAuth";
import { resolveApiUrl } from "../../lib/api-url";
import type { EventSourceConfig } from "../../data/events";
import {
  loadEventWithOverride,
  type EventOverride,
  type EventWithOverride,
} from "../../utils/event-override";
import { formatBRL } from "../../utils/transaction";

// ---------------------------------------------------------------------------
// Tipos do contrato com o backend (eventos internos / managed)
// ---------------------------------------------------------------------------

type TicketKind = "free" | "paid" | "community" | "company";

interface EventTicketType {
  id: string;
  name: string;
  kind: TicketKind;
  priceCents: number;
  quantityTotal: number;
  quantitySold: number;
  salesStartAt?: string;
  salesEndAt?: string;
  maxPerOrder?: number;
}

interface ManagedEventPayload {
  event: unknown;
  ticketTypes: EventTicketType[];
}

interface EventRegistration {
  checkinToken: string;
}

// ---------------------------------------------------------------------------
// Helpers de formatação (espelham a listagem /eventos)
// ---------------------------------------------------------------------------

function formatEventDate(date: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).format(new Date(date));
}

function formatEventTime(date: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeStyle: "short",
    timeZone,
  } as Intl.DateTimeFormatOptions).format(new Date(date));
}

function getStatusLabel(status?: string): string | null {
  switch (status) {
    case "scheduled":
      return "Agendado";
    case "active":
      return "Ao vivo";
    case "completed":
      return "Concluído";
    case "canceled":
      return "Cancelado";
    default:
      return null;
  }
}

function getStatusColor(status?: string): "default" | "success" | "warning" | "error" {
  switch (status) {
    case "active":
      return "success";
    case "completed":
      return "default";
    case "canceled":
      return "error";
    default:
      return "warning";
  }
}

type Availability =
  | { status: "available"; label: null }
  | { status: "not_yet"; label: string; availableAt: Date }
  | { status: "ended"; label: string }
  | { status: "sold_out"; label: string };

function getTicketAvailability(
  ticket: EventTicketType,
  now = new Date()
): Availability {
  const available = ticket.quantityTotal - ticket.quantitySold;
  if (available <= 0) return { status: "sold_out", label: "Esgotado" };

  if (ticket.salesStartAt) {
    const start = new Date(ticket.salesStartAt);
    if (now < start) {
      return {
        status: "not_yet",
        label: `Disponível em ${start.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}`,
        availableAt: start,
      };
    }
  }

  if (ticket.salesEndAt) {
    const end = new Date(ticket.salesEndAt);
    if (now > end) {
      return {
        status: "ended",
        label: `Vendas encerradas em ${end.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}`,
      };
    }
  }

  return { status: "available", label: null };
}

function formatOrganizers(event: EventWithOverride): string {
  const orgs = event.organizers;
  if (!orgs?.length) return event.host;
  if (orgs.length === 1) return orgs[0].name;
  return `${orgs.slice(0, -1).map((o) => o.name).join(", ")} e ${orgs.at(-1)?.name ?? ""}`;
}

interface AttendeeInput {
  name: string;
  email: string;
}

function emptyAttendees(quantity: number): AttendeeInput[] {
  return Array.from({ length: quantity }, () => ({ name: "", email: "" }));
}

function AttendeeFields({
  quantity,
  attendees,
  onChange,
  disabled,
}: {
  readonly quantity: number;
  readonly attendees: AttendeeInput[];
  readonly onChange: (attendees: AttendeeInput[]) => void;
  readonly disabled?: boolean;
}): React.JSX.Element {
  useEffect(() => {
    if (attendees.length !== quantity) {
      const next = attendees.slice(0, quantity);
      while (next.length < quantity) next.push({ name: "", email: "" });
      onChange(next);
    }
  }, [quantity, attendees, onChange]);

  const update = (index: number, patch: Partial<AttendeeInput>): void => {
    const next = attendees.map((a, i) => (i === index ? { ...a, ...patch } : a));
    onChange(next);
  };

  return (
    <Stack spacing={2} sx={{ mb: 3 }}>
      <Typography variant="subtitle2" fontWeight={700}>
        Participantes ({quantity})
      </Typography>
      {attendees.map((attendee, index) => (
        <Stack key={index} direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            label={`Nome ${index + 1}`}
            size="small"
            value={attendee.name}
            onChange={(e) => update(index, { name: e.target.value })}
            disabled={disabled}
            fullWidth
          />
          <TextField
            label={`E-mail ${index + 1}`}
            size="small"
            type="email"
            value={attendee.email}
            onChange={(e) => update(index, { email: e.target.value })}
            disabled={disabled}
            fullWidth
          />
        </Stack>
      ))}
      <Typography variant="caption" color="text.secondary">
        Informe nome e e-mail de cada participante. Se um dos participantes for você, use o
        mesmo e-mail da sua conta GitHub para vincular automaticamente.
      </Typography>
    </Stack>
  );
}

function attendeesValid(attendees: AttendeeInput[]): boolean {
  return attendees.every((a) => a.name.trim().length > 0 && a.email.trim().includes("@"));
}

// ---------------------------------------------------------------------------
// Inscrição em evento interno (backend /events)
// ---------------------------------------------------------------------------

function InternalEventRegistration({
  eventId,
  apiUrl,
  stripeKey,
  eventTitle,
}: {
  readonly eventId: string;
  readonly apiUrl: string;
  readonly stripeKey: string;
  readonly eventTitle: string;
}): React.JSX.Element | null {
  const location = useLocation();
  const { ready, isLoggedIn, login, authFetch } = useAuth();

  const [ticketTypes, setTicketTypes] = useState<EventTicketType[] | null>(null);
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<EventRegistration | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<AttendeeInput[]>([]);
  const [buyForOther, setBuyForOther] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadTicketTypes(): Promise<void> {
      try {
        const res = await fetch(`${apiUrl}/events/public/managed/${eventId}`);
        if (!res.ok) return; // 404 = evento não gerenciado/publicado → esconde a seção
        const payload = (await res.json()) as ManagedEventPayload;
        if (!active) return;
        setTicketTypes(payload.ticketTypes ?? []);
        const firstAvailable = (payload.ticketTypes ?? []).find(
          (t) => getTicketAvailability(t).status === "available"
        );
        if (firstAvailable) setSelectedTicketTypeId(firstAvailable.id);
      } catch {
        // Backend fora do ar → seção de inscrição simplesmente não aparece.
      }
    }

    void loadTicketTypes();
    return () => {
      active = false;
    };
  }, [apiUrl, eventId]);

  const selectedTicketType = useMemo(
    () => ticketTypes?.find((t) => t.id === selectedTicketTypeId) ?? null,
    [ticketTypes, selectedTicketTypeId]
  );

  if (!ticketTypes || ticketTypes.length === 0) return null;

  const isFreeFlow = (ticket: EventTicketType | null): boolean =>
    ticket !== null && ticket.kind === "free";

  const maxQuantity = selectedTicketType
    ? Math.max(
        1,
        Math.min(
          selectedTicketType.maxPerOrder ?? 5,
          selectedTicketType.quantityTotal - selectedTicketType.quantitySold
        )
      )
    : 1;

  const handleLogin = (): void => {
    login({ returnTo: `${location.pathname}${location.search}` });
  };

  const handleFreeRegister = async (): Promise<void> => {
    if (!selectedTicketType) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const body: Record<string, unknown> = { ticketTypeId: selectedTicketType.id };
      if (quantity > 1 && attendeesValid(attendees)) {
        body.attendees = attendees;
      }
      const res = await authFetch(`/events/${eventId}/register`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.status === 409) {
        setActionError("Este tipo de ingresso está esgotado ou você já possui ingresso próprio para este evento.");
        return;
      }
      if (!res.ok) {
        setActionError("Não foi possível concluir sua inscrição. Tente novamente.");
        return;
      }
      setRegistration((await res.json()) as EventRegistration);
    } catch {
      setActionError("Não foi possível concluir sua inscrição. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckout = async (): Promise<void> => {
    if (!selectedTicketType || !termsAccepted) return;
    const needsAttendees = quantity > 1 || buyForOther;
    if (needsAttendees && !attendeesValid(attendees)) {
      setActionError("Preencha nome e e-mail de todos os participantes.");
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      const body: Record<string, unknown> = {
        ticketTypeId: selectedTicketType.id,
        quantity,
        acceptTerms: true,
        uiMode: "embedded",
      };
      if (needsAttendees && attendeesValid(attendees)) {
        body.attendees = attendees;
      }
      const res = await authFetch(`/events/${eventId}/checkout`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.status === 409) {
        setActionError("Você já possui ingresso próprio para este evento. Comprar para outra pessoa? Ative a opção abaixo e informe os dados dela.");
        return;
      }
      if (!res.ok) {
        setActionError("Não foi possível iniciar o pagamento. Tente novamente.");
        return;
      }
      const data = (await res.json()) as {
        url?: string | null;
        clientSecret?: string | null;
      };
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setCheckoutOpen(true);
      } else if (data.url) {
        globalThis.location.href = data.url;
      } else {
        setActionError("Resposta inesperada do checkout.");
      }
    } catch {
      setActionError("Não foi possível iniciar o pagamento. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckoutComplete = (): void => {
    setCheckoutOpen(false);
    setClientSecret(null);
  };

  if (registration) {
    return (
      <Card variant="outlined" sx={{ mb: 4, borderColor: "success.main" }}>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Inscrição confirmada!
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Apresente o código abaixo no check-in do evento.
          </Typography>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: "action.hover",
              fontFamily: "monospace",
              fontWeight: 700,
              textAlign: "center",
              wordBreak: "break-all",
            }}
          >
            {registration.checkinToken}
          </Box>
        </CardContent>
      </Card>
    );
  }

  const singleFreeTicket =
    ticketTypes.length === 1 && isFreeFlow(ticketTypes[0]);

  return (
    <Card variant="outlined" sx={{ mb: 4 }}>
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Inscrição
        </Typography>

        {actionError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {actionError}
          </Alert>
        ) : null}

        {!singleFreeTicket ? (
          <Stack spacing={1.5} sx={{ mb: 3 }}>
            {ticketTypes.map((ticket) => {
              const available = ticket.quantityTotal - ticket.quantitySold;
              const availability = getTicketAvailability(ticket);
              const selectable = availability.status === "available";
              return (
                <Box
                  key={ticket.id}
                  onClick={() => {
                    if (!selectable) return;
                    setSelectedTicketTypeId(ticket.id);
                    setQuantity(1);
                  }}
                  sx={{
                    p: 1.5,
                    border: "1px solid",
                    borderColor:
                      ticket.id === selectedTicketTypeId ? "primary.main" : "divider",
                    borderRadius: 2,
                    cursor: selectable ? "pointer" : "default",
                    opacity: selectable ? 1 : 0.6,
                    bgcolor:
                      ticket.id === selectedTicketTypeId ? "action.hover" : "transparent",
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" fontWeight={700}>
                      {ticket.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {isFreeFlow(ticket) || ticket.priceCents === 0
                        ? "Gratuito"
                        : formatBRL(ticket.priceCents / 100)}
                      {availability.status === "sold_out"
                        ? " · Esgotado"
                        : availability.status === "not_yet"
                        ? ` · ${availability.label}`
                        : availability.status === "ended"
                        ? ` · ${availability.label}`
                        : ` · ${available} vaga(s)`}
                    </Typography>
                  </Stack>
                </Box>
              );
            })}

            {selectedTicketType && !isFreeFlow(selectedTicketType) ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Quantidade:
                </Typography>
                <Select
                  size="small"
                  value={quantity}
                  onChange={(e) => {
                    const q = Number(e.target.value);
                    setQuantity(q);
                    setAttendees(emptyAttendees(q));
                  }}
                >
                  {Array.from({ length: maxQuantity }, (_, i) => i + 1).map((n) => (
                    <MenuItem key={n} value={n}>
                      {n}
                    </MenuItem>
                  ))}
                </Select>
              </Stack>
            ) : null}

            {selectedTicketType && !isFreeFlow(selectedTicketType) ? (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={buyForOther}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setBuyForOther(checked);
                      if (checked) {
                        setAttendees(emptyAttendees(quantity));
                      } else {
                        setAttendees([]);
                      }
                    }}
                    disabled={submitting}
                  />
                }
                label="Comprar ingresso para outra pessoa"
              />
            ) : null}

            {selectedTicketType && !isFreeFlow(selectedTicketType) && (quantity > 1 || buyForOther) ? (
              <AttendeeFields
                quantity={quantity}
                attendees={attendees}
                onChange={setAttendees}
                disabled={submitting}
              />
            ) : null}
          </Stack>
        ) : null}

        {selectedTicketType && !isFreeFlow(selectedTicketType) ? (
          <Box
            sx={{
              mb: 3,
              p: 2,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
            }}
          >
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Termos de compra e política de reembolso
            </Typography>
            <Typography variant="body2" color="text.secondary" component="div" sx={{ mb: 1 }}>
              <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                <li>
                  Você pode se arrepender da compra em até 7 dias corridos, com direito a
                  reembolso integral (CDC, art. 49 — compras online).
                </li>
                <li>
                  Em caso de cancelamento ou adiamento do evento, o valor pago é reembolsado
                  integralmente.
                </li>
                <li>
                  Reembolsos são processados via Stripe, no mesmo meio de pagamento utilizado
                  na compra.
                </li>
                <li>Versão do termo: 2026-07-v1.</li>
              </ul>
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
              }
              label={
                <span>
                  Li e aceito os{" "}
                  <Link href="/termos-de-compra" target="_blank" rel="noopener noreferrer">
                    termos de compra e a política de reembolso
                  </Link>
                </span>
              }
            />
          </Box>
        ) : null}

        {ready && !isLoggedIn ? (
          <Button
            variant="contained"
            size="large"
            startIcon={<GitHubIcon />}
            onClick={handleLogin}
          >
            Entrar com GitHub para se inscrever
          </Button>
        ) : (
          <Button
            variant="contained"
            size="large"
            startIcon={<HowToRegIcon />}
            disabled={
              submitting ||
              !selectedTicketType ||
              (!isFreeFlow(selectedTicketType) && !termsAccepted)
            }
            onClick={() => {
              void (isFreeFlow(selectedTicketType)
                ? handleFreeRegister()
                : handleCheckout());
            }}
          >
            {isFreeFlow(selectedTicketType) ? "Inscrever-se" : "Comprar"}
          </Button>
        )}
      </CardContent>
      <StripeEmbeddedCheckoutDialog
        open={checkoutOpen}
        title={`Pagamento — ${eventTitle}`}
        stripeKey={stripeKey}
        clientSecret={clientSecret}
        onClose={() => setCheckoutOpen(false)}
        onComplete={handleCheckoutComplete}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Compra de ingresso em evento EXTERNO com feature payments (backend /events/external)
// ---------------------------------------------------------------------------

function ExternalEventRegistration({
  eventKey,
  apiUrl,
  externalHref,
  stripeKey,
  eventTitle,
}: {
  readonly eventKey: string;
  readonly apiUrl: string;
  readonly externalHref: string;
  readonly stripeKey: string;
  readonly eventTitle: string;
}): React.JSX.Element | null {
  const location = useLocation();
  const { ready, isLoggedIn, login, authFetch } = useAuth();

  const [ticketTypes, setTicketTypes] = useState<EventTicketType[] | null>(null);
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [activeTab, setActiveTab] = useState<"paid" | "free">("paid");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<AttendeeInput[]>([]);
  const [buyForOther, setBuyForOther] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadTicketTypes(): Promise<void> {
      try {
        const res = await fetch(
          `${apiUrl}/events/external/${encodeURIComponent(eventKey)}/ticket-types`
        );
        if (!res.ok) return; // 404 = evento sem feature payments → nada renderiza
        const payload = (await res.json()) as EventTicketType[];
        if (!active) return;
        const list = Array.isArray(payload) ? payload : [];
        setTicketTypes(list);
        const paidList = list.filter((t) => t.kind !== "free");
        const freeList = list.filter((t) => t.kind === "free");
        // Começa na aba que tiver ingressos disponíveis (dentro da janela de vendas).
        const firstPaid = paidList.find(
          (t) => getTicketAvailability(t).status === "available"
        );
        const firstFree = freeList.find(
          (t) => getTicketAvailability(t).status === "available"
        );
        if (firstPaid) {
          setActiveTab("paid");
          setSelectedTicketTypeId(firstPaid.id);
        } else if (firstFree) {
          setActiveTab("free");
        }
      } catch {
        // Backend fora do ar → seção de compra simplesmente não aparece.
      }
    }

    void loadTicketTypes();
    return () => {
      active = false;
    };
  }, [apiUrl, eventKey]);

  const paidTypes = useMemo(
    () => (ticketTypes ?? []).filter((t) => t.kind !== "free"),
    [ticketTypes]
  );
  const freeTypes = useMemo(
    () => (ticketTypes ?? []).filter((t) => t.kind === "free"),
    [ticketTypes]
  );

  const selectedTicketType = useMemo(
    () => paidTypes.find((t) => t.id === selectedTicketTypeId) ?? null,
    [paidTypes, selectedTicketTypeId]
  );

  if (!ticketTypes) return null;
  if (paidTypes.length === 0 && freeTypes.length === 0) return null;

  const maxQuantity = selectedTicketType
    ? Math.max(
        1,
        Math.min(
          selectedTicketType.maxPerOrder ?? 5,
          selectedTicketType.quantityTotal - selectedTicketType.quantitySold
        )
      )
    : 1;

  const handleLogin = (): void => {
    login({ returnTo: `${location.pathname}${location.search}` });
  };

  const handleCheckout = async (): Promise<void> => {
    if (!selectedTicketType || !termsAccepted) return;
    const needsAttendees = quantity > 1 || buyForOther;
    if (needsAttendees && !attendeesValid(attendees)) {
      setActionError("Preencha nome e e-mail de todos os participantes.");
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      const body: Record<string, unknown> = {
        ticketTypeId: selectedTicketType.id,
        quantity,
        acceptTerms: true,
        uiMode: "embedded",
      };
      if (needsAttendees && attendeesValid(attendees)) {
        body.attendees = attendees;
      }
      const res = await authFetch(
        `/events/external/${encodeURIComponent(eventKey)}/checkout`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );
      if (res.status === 409) {
        setActionError("Você já possui ingresso próprio para este evento. Comprar para outra pessoa? Ative a opção abaixo e informe os dados dela.");
        return;
      }
      if (!res.ok) {
        setActionError("Não foi possível iniciar o pagamento. Tente novamente.");
        return;
      }
      const data = (await res.json()) as {
        url?: string | null;
        clientSecret?: string | null;
      };
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setCheckoutOpen(true);
      } else if (data.url) {
        globalThis.location.href = data.url;
      } else {
        setActionError("Resposta inesperada do checkout.");
      }
    } catch {
      setActionError("Não foi possível iniciar o pagamento. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckoutComplete = (): void => {
    setCheckoutOpen(false);
    setClientSecret(null);
  };

  return (
    <Card variant="outlined" sx={{ mb: 4 }}>
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Ingressos
        </Typography>

        {actionError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {actionError}
          </Alert>
        ) : null}

        {(paidTypes.length > 0 && freeTypes.length > 0) && (
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v as "paid" | "free")}
            sx={{ mb: 3 }}
          >
            <Tab value="paid" label={`Pagos (${paidTypes.length})`} />
            <Tab value="free" label={`Gratuitos (${freeTypes.length})`} />
          </Tabs>
        )}

        {activeTab === "paid" && (
          <>
            {paidTypes.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Não há ingressos pagos disponíveis neste evento.
              </Typography>
            ) : (
              <>
                <Stack spacing={1.5} sx={{ mb: 3 }}>
                  {paidTypes.map((ticket) => {
                    const available = ticket.quantityTotal - ticket.quantitySold;
                    const availability = getTicketAvailability(ticket);
                    const selectable = availability.status === "available";
                    return (
                      <Box
                        key={ticket.id}
                        onClick={() => {
                          if (!selectable) return;
                          setSelectedTicketTypeId(ticket.id);
                          setQuantity(1);
                        }}
                        sx={{
                          p: 1.5,
                          border: "1px solid",
                          borderColor:
                            ticket.id === selectedTicketTypeId ? "primary.main" : "divider",
                          borderRadius: 2,
                          cursor: selectable ? "pointer" : "default",
                          opacity: selectable ? 1 : 0.6,
                          bgcolor:
                            ticket.id === selectedTicketTypeId ? "action.hover" : "transparent",
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" fontWeight={700}>
                            {ticket.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {formatBRL(ticket.priceCents / 100)}
                            {availability.status === "sold_out"
                              ? " · Esgotado"
                              : availability.status === "not_yet"
                              ? ` · ${availability.label}`
                              : availability.status === "ended"
                              ? ` · ${availability.label}`
                              : ` · ${available} vaga(s)`}
                          </Typography>
                        </Stack>
                      </Box>
                    );
                  })}

                  {selectedTicketType ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" color="text.secondary">
                        Quantidade:
                      </Typography>
                      <Select
                        size="small"
                        value={quantity}
                        onChange={(e) => {
                          const q = Number(e.target.value);
                          setQuantity(q);
                          setAttendees(emptyAttendees(q));
                        }}
                      >
                        {Array.from({ length: maxQuantity }, (_, i) => i + 1).map((n) => (
                          <MenuItem key={n} value={n}>
                            {n}
                          </MenuItem>
                        ))}
                      </Select>
                    </Stack>
                  ) : null}

                  {selectedTicketType ? (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={buyForOther}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setBuyForOther(checked);
                            if (checked) {
                              setAttendees(emptyAttendees(quantity));
                            } else {
                              setAttendees([]);
                            }
                          }}
                          disabled={submitting}
                        />
                      }
                      label="Comprar ingresso para outra pessoa"
                    />
                  ) : null}

                  {selectedTicketType && (quantity > 1 || buyForOther) ? (
                    <AttendeeFields
                      quantity={quantity}
                      attendees={attendees}
                      onChange={setAttendees}
                      disabled={submitting}
                    />
                  ) : null}
                </Stack>

                {selectedTicketType ? (
                  <Box
                    sx={{
                      mb: 3,
                      p: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                      Termos de compra e política de reembolso
                    </Typography>
                    <Typography variant="body2" color="text.secondary" component="div" sx={{ mb: 1 }}>
                      <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                        <li>
                          Você pode se arrepender da compra em até 7 dias corridos, com direito a
                          reembolso integral (CDC, art. 49 — compras online).
                        </li>
                        <li>
                          Em caso de cancelamento ou adiamento do evento, o valor pago é reembolsado
                          integralmente.
                        </li>
                        <li>
                          Reembolsos são processados via Stripe, no mesmo meio de pagamento utilizado
                          na compra.
                        </li>
                        <li>Versão do termo: 2026-07-v1.</li>
                      </ul>
                    </Typography>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                        />
                      }
                      label={
                        <span>
                          Li e aceito os{" "}
                          <Link href="/termos-de-compra" target="_blank" rel="noopener noreferrer">
                            termos de compra e a política de reembolso
                          </Link>
                        </span>
                      }
                    />
                  </Box>
                ) : null}

                {ready && !isLoggedIn ? (
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<GitHubIcon />}
                    onClick={handleLogin}
                  >
                    Entrar com GitHub para comprar
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<HowToRegIcon />}
                    disabled={submitting || !selectedTicketType || !termsAccepted}
                    onClick={() => {
                      void handleCheckout();
                    }}
                  >
                    Comprar
                  </Button>
                )}
              </>
            )}
          </>
        )}

        {activeTab === "free" && (
          <Stack spacing={1.5}>
            {freeTypes.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Não há ingressos gratuitos disponíveis neste evento.
              </Typography>
            ) : (
              <>
                {freeTypes.map((ticket) => {
                  const available = ticket.quantityTotal - ticket.quantitySold;
                  const availability = getTicketAvailability(ticket);
                  return (
                    <Box
                      key={ticket.id}
                      sx={{
                        p: 1.5,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 2,
                        opacity: availability.status === "available" ? 1 : 0.6,
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" fontWeight={700}>
                          {ticket.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Gratuito
                          {availability.status === "sold_out"
                            ? " · Esgotado"
                            : availability.status === "not_yet"
                            ? ` · ${availability.label}`
                            : availability.status === "ended"
                            ? ` · ${availability.label}`
                            : ` · ${available} vaga(s)`}
                        </Typography>
                      </Stack>
                    </Box>
                  );
                })}
                <Button
                  variant="contained"
                  size="large"
                  endIcon={<OpenInNewIcon />}
                  component={Link}
                  href={externalHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Inscrever-se na plataforma original
                </Button>
                <Typography variant="caption" color="text.secondary">
                  A inscrição gratuita é feita diretamente na plataforma que organiza o evento.
                </Typography>
              </>
            )}
          </Stack>
        )}
      </CardContent>
      <StripeEmbeddedCheckoutDialog
        open={checkoutOpen}
        title={`Pagamento — ${eventTitle}`}
        stripeKey={stripeKey}
        clientSecret={clientSecret}
        onClose={() => setCheckoutOpen(false)}
        onComplete={handleCheckoutComplete}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Página de detalhe
// ---------------------------------------------------------------------------

function EventDetailContent({
  source,
  sourceId,
  eventId,
}: {
  readonly source: string;
  readonly sourceId: string;
  readonly eventId: string;
}): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const configuredApiUrl =
    (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";
  const apiUrl = resolveApiUrl(configuredApiUrl, siteConfig.url);
  const stripeKey = (siteConfig.customFields?.stripePublishableKey as string) ?? "";

  const [event, setEvent] = useState<EventWithOverride | null>(null);
  const [override, setOverride] = useState<EventOverride | null>(null);
  const [sourceMeta, setSourceMeta] = useState<EventSourceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Ações de owner (eventos externos): probe can-manage no backend.
  const { ready, isLoggedIn, authFetch } = useAuth();
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    if (!ready || !isLoggedIn || source === "internal") return;
    let active = true;
    const sourceKey = `${source}:${sourceId}`;
    authFetch(
      `${apiUrl}/events/override/${encodeURIComponent(sourceKey)}/${encodeURIComponent(eventId)}/can-manage`
    )
      .then(async (res) => {
        if (!active || !res.ok) return; // falha → botão fica escondido
        const data = (await res.json()) as { canManage?: boolean };
        if (data.canManage) setCanManage(true);
      })
      .catch(() => {
        // Backend fora do ar → sem botão de owner.
      });
    return () => {
      active = false;
    };
  }, [ready, isLoggedIn, source, sourceId, eventId, apiUrl, authFetch]);

  useEffect(() => {
    let active = true;

    loadEventWithOverride(source, sourceId, eventId)
      .then((result) => {
        if (!active) return;
        setEvent(result.event);
        setOverride(result.override);
        setSourceMeta(result.source);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setHasError(true);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [source, sourceId, eventId]);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Skeleton variant="rounded" height={320} sx={{ mb: 4 }} />
        <Skeleton variant="rounded" height={200} />
      </Container>
    );
  }

  if (hasError || !event) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Alert
          severity="warning"
          variant="outlined"
          action={
            <Button component={Link} href="/eventos" color="inherit" size="small">
              Ver todos os eventos
            </Button>
          }
        >
          Não foi possível carregar este evento. Ele pode ter sido removido ou o link
          está incorreto.
        </Alert>
      </Container>
    );
  }

  const statusLabel = getStatusLabel(event.status);
  const isExternal = event.href.startsWith("http");
  const isInternal = source === "internal";
  const hasMaterials = Boolean(event.slidesUrl ?? event.videoUrl ?? event.discussionUrl);
  const speakers = event.speakers ?? [];
  const sourceEmoji = sourceMeta?.emoji ?? "📌";
  const sourceLabel = sourceMeta?.label ?? sourceId;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      {/* ── Banner hero ── */}
      <Box
        sx={{
          position: "relative",
          borderRadius: 3,
          overflow: "hidden",
          mb: 4,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        {event.imageUrl ? (
          <Box
            component="img"
            src={event.imageUrl}
            alt={event.title}
            sx={{
              display: "block",
              width: "100%",
              aspectRatio: "16 / 9",
              maxHeight: 420,
              objectFit: "cover",
            }}
          />
        ) : (
          <Box
            sx={{
              aspectRatio: "16 / 9",
              maxHeight: 320,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: (theme) =>
                `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.main} 100%)`,
            }}
          >
            <Typography sx={{ fontSize: { xs: "4rem", md: "6rem" }, lineHeight: 1 }}>
              {sourceEmoji}
            </Typography>
          </Box>
        )}
        {override ? (
          <Box sx={{ position: "absolute", top: 16, right: 16 }}>
            <EventOverrideBadge override={override} />
          </Box>
        ) : null}
      </Box>

      {/* ── Cabeçalho ── */}
      <Card variant="outlined" sx={{ mb: 4 }}>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
            {statusLabel ? (
              <Chip label={statusLabel} size="small" color={getStatusColor(event.status)} />
            ) : null}
            <Chip
              label={`${sourceEmoji} ${sourceLabel}`}
              size="small"
              variant="outlined"
            />
            <Chip label={`📍 ${event.location}`} size="small" variant="outlined" />
            {event.featured ? <Chip label="Destaque" size="small" color="success" /> : null}
          </Stack>

          <Typography variant="h4" fontWeight={800} gutterBottom>
            {event.title}
          </Typography>
          <Divider sx={{ my: 2 }} />

          <Stack spacing={1.25} sx={{ mb: 3 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <CalendarMonthIcon color="primary" fontSize="small" />
              <Typography variant="body2">
                {formatEventDate(event.startAt, event.timezone)}
                {event.endAt
                  ? ` – ${formatEventTime(event.endAt, event.timezone)}`
                  : null}{" "}
                ({event.timezone})
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <PlaceOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="body2">{event.location}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <ForumIcon color="primary" fontSize="small" />
              <Typography variant="body2">
                {event.platform} · com {formatOrganizers(event)}
              </Typography>
            </Stack>
            {typeof event.userCount === "number" && event.userCount > 0 ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <GroupsIcon color="primary" fontSize="small" />
                <Typography variant="body2">
                  {event.userCount} participante(s) confirmado(s)
                </Typography>
              </Stack>
            ) : null}
            {event.recurrenceLabel ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <RepeatIcon color="primary" fontSize="small" />
                <Typography variant="body2">{event.recurrenceLabel}</Typography>
              </Stack>
            ) : null}
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            {isInternal ? null : (
              <Button
                component={Link}
                href={event.registrationUrl ?? event.href}
                target="_blank"
                rel="noopener noreferrer"
                variant="contained"
                endIcon={<OpenInNewIcon />}
              >
                {event.registrationUrl ? "Inscrever-se" : event.ctaLabel}
              </Button>
            )}
            {!isInternal && event.registrationUrl && event.registrationUrl !== event.href ? (
              <Button
                component={Link}
                href={event.href}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                endIcon={<OpenInNewIcon />}
              >
                {event.ctaLabel}
              </Button>
            ) : null}
            <Button component={Link} href="/eventos" variant="text">
              ← Voltar para a agenda
            </Button>
            {canManage ? (
              <>
                <Button
                  component={Link}
                  href={`/admin/overrides?tab=0&sourceKey=${encodeURIComponent(`${source}:${sourceId}`)}&eventId=${encodeURIComponent(eventId)}`}
                  variant="outlined"
                  size="small"
                  startIcon={<EditIcon />}
                >
                  Editar metadados
                </Button>
                <Button
                  component={Link}
                  href={`/admin/overrides?tab=2&sourceKey=${encodeURIComponent(`${source}:${sourceId}`)}&eventId=${encodeURIComponent(eventId)}`}
                  variant="text"
                  size="small"
                >
                  Gerenciar features
                </Button>
              </>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      {/* ── Inscrição (eventos internos) / Ingressos (externos com payments) ── */}
      {isInternal ? (
        <InternalEventRegistration
          eventId={eventId}
          apiUrl={apiUrl}
          stripeKey={stripeKey}
          eventTitle={event.title}
        />
      ) : null}
      {!isInternal ? (
        <ExternalEventRegistration
          eventKey={`${source}:${sourceId}:${eventId}`}
          apiUrl={apiUrl}
          externalHref={event.registrationUrl ?? event.href}
          stripeKey={stripeKey}
          eventTitle={event.title}
        />
      ) : null}

      {/* ── Sobre o evento ── */}
      <Card variant="outlined" sx={{ mb: 4 }}>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Sobre o evento
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2.5 }}>
            {event.summary}
          </Typography>
          {event.tags.length > 0 ? (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {event.tags.map((tag) => (
                <Chip key={tag} label={tag} size="small" variant="outlined" />
              ))}
            </Stack>
          ) : null}
        </CardContent>
      </Card>

      {/* ── Palestrantes ── */}
      {speakers.length > 0 ? (
        <Card variant="outlined" sx={{ mb: 4 }}>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Palestrantes
            </Typography>
            <Stack direction="row" spacing={3} useFlexGap flexWrap="wrap">
              {speakers.map((speaker) => {
                const profileHref =
                  speaker.profileUrl ??
                  (speaker.handle ? `https://github.com/${speaker.handle}` : null);
                const avatarSrc =
                  speaker.avatarUrl ??
                  (speaker.handle
                    ? `https://avatars.githubusercontent.com/${speaker.handle}?v=4`
                    : undefined);
                return (
                  <Stack
                    key={`${speaker.name}-${speaker.talkTitle ?? ""}`}
                    spacing={1}
                    alignItems="center"
                    sx={{ maxWidth: 180, textAlign: "center" }}
                  >
                    <Avatar
                      src={avatarSrc}
                      alt={speaker.name}
                      sx={{ width: 72, height: 72 }}
                    />
                    <Typography variant="body2" fontWeight={700}>
                      {speaker.name}
                    </Typography>
                    {speaker.talkTitle ? (
                      <Typography variant="caption" color="text.secondary">
                        {speaker.talkTitle}
                      </Typography>
                    ) : null}
                    {profileHref ? (
                      <Button
                        component={Link}
                        href={profileHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="small"
                        variant="text"
                      >
                        {speaker.handle ? `@${speaker.handle}` : "Ver perfil"}
                      </Button>
                    ) : null}
                  </Stack>
                );
              })}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Materiais (pós-evento) ── */}
      {hasMaterials ? (
        <Card variant="outlined" sx={{ mb: 4 }}>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Materiais
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              {event.videoUrl ? (
                <Button
                  component={Link}
                  href={event.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                  startIcon={<PlayCircleOutlineIcon />}
                >
                  Ver gravação
                </Button>
              ) : null}
              {event.slidesUrl ? (
                <Button
                  component={Link}
                  href={event.slidesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                  startIcon={<SlideshowIcon />}
                >
                  Ver slides
                </Button>
              ) : null}
              {event.discussionUrl ? (
                <Button
                  component={Link}
                  href={event.discussionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                  startIcon={<ForumIcon />}
                >
                  Discussão no GitHub
                </Button>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Organizado por ── */}
      <Card variant="outlined">
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Organizado por
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center" useFlexGap flexWrap="wrap">
            <AvatarGroup>
              <Avatar alt={sourceLabel}>{sourceEmoji}</Avatar>
            </AvatarGroup>
            <Typography variant="body1" fontWeight={700}>
              {sourceLabel}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              · {event.platform}
            </Typography>
            <Button component={Link} href="/eventos" size="small" variant="outlined">
              Ver todos os eventos
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}

export default function EventoDetalhePage(): React.JSX.Element {
  const location = useLocation();
  const history = useHistory();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const params = new URLSearchParams(location.search);
  const source = params.get("source") ?? "";
  const sourceId = params.get("sourceId") ?? "";
  const eventId = params.get("id") ?? "";
  const hasParams = Boolean(source && sourceId && eventId);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const status = params.get("status");
    const sessionId = params.get("session_id");
    if (status === "success" && sessionId) {
      window.location.href = "/membro?tab=future&purchase=success";
    }
  }, [params]);

  return (
    <Layout
      title="Detalhes do evento"
      description="Detalhes do evento da comunidade Codaqui."
    >
      {!mounted || !hasParams ? (
        mounted && !hasParams ? (
          <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
            <Alert
              severity="warning"
              variant="outlined"
              action={
                <Button component={Link} href="/eventos" color="inherit" size="small">
                  Ver todos os eventos
                </Button>
              }
            >
              Link de evento inválido. Acesse a agenda para escolher um evento.
            </Alert>
          </Container>
        ) : (
          <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
            <Skeleton variant="rounded" height={320} sx={{ mb: 4 }} />
            <Skeleton variant="rounded" height={200} />
          </Container>
        )
      ) : (
        <EventDetailContent source={source} sourceId={sourceId} eventId={eventId} />
      )}
    </Layout>
  );
}

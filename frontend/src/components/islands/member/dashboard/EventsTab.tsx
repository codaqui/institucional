/**
 * Aba "Eventos" do dashboard: inscrições do membro com sub-abas
 * Próximos ingressos / Comprei para outros / Histórico, QR de check-in,
 * cancelamento e emissão de certificado.
 * Port de `EventsTabPanel`/`EventRegistrationsList`/`EventTitleLink` em
 * `src/pages/membro/index.tsx`.
 */
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EventIcon from "@mui/icons-material/Event";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import { QRCodeSVG } from "qrcode.react";
import { buildEventPath, buildEventPublicPath } from "../../../../lib/event-path";
import { formatBRL } from "../../../../lib/transaction";
import type {
  EventRegistration,
  EventsListMode,
  EventsSubTab,
} from "./types";
import {
  formatEventDate,
  getEventsEmptyMessage,
  getEventsListMode,
  registrationStatusConfig,
} from "./types";

function EventTitleLink({
  registration,
  children,
}: {
  readonly registration: EventRegistration;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  if (registration.event) {
    return (
      <a
        href={buildEventPublicPath({
          source: "internal",
          sourceId: "codaqui",
          id: registration.event.id,
          slug: registration.event.slug,
        })}
      >
        {children}
      </a>
    );
  }
  if (registration.activation) {
    const parts = registration.activation.eventKey.split(":");
    const source = parts[0] ?? "";
    const sourceId = parts[1] ?? "";
    const eventId = parts[2] ?? "";
    return <a href={buildEventPath(source, sourceId, eventId)}>{children}</a>;
  }
  return <>{children}</>;
}

interface EventRegistrationsListProps {
  registrations: EventRegistration[];
  expandedQrId: string | null;
  setExpandedQrId: (id: string | null) => void;
  certLoadingId: string | null;
  onEmitCertificate: (id: string) => void;
  onCancel: (id: string) => void;
  emptyMessage: string;
  mode?: EventsListMode;
  userName?: string;
}

function EventRegistrationsList({
  registrations,
  expandedQrId,
  setExpandedQrId,
  certLoadingId,
  onEmitCertificate,
  onCancel,
  emptyMessage,
  mode = "mine",
  userName,
}: Readonly<EventRegistrationsListProps>): React.JSX.Element {
  if (registrations.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        {emptyMessage}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 4 }}>
      {registrations.map((reg) => {
        if (!reg) return null;
        const sc = registrationStatusConfig[reg.status] ?? registrationStatusConfig.confirmed;
        const eventTitle = reg.event?.title ?? reg.activation?.title ?? "Evento externo";
        const eventStartAt = reg.event?.startAt ?? reg.activation?.startAt ?? null;
        const eventLocation = reg.event?.location ?? null;
        const isFutureEvent = eventStartAt ? new Date(eventStartAt).getTime() > Date.now() : true;
        const alreadyUsed = !!reg.checkedInAt;
        const canCancel =
          mode !== "history" &&
          isFutureEvent &&
          !alreadyUsed &&
          (reg.status === "confirmed" || reg.status === "pending_match" || reg.status === "waitlist");
        const isPurchasedForOther = mode === "purchased" || reg.isPayerOnly;
        return (
          <Card key={reg.id} variant="outlined">
            <CardContent sx={{ py: "12px !important" }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 1,
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    <EventTitleLink registration={reg}>{eventTitle}</EventTitleLink>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {eventStartAt ? formatEventDate(eventStartAt) : "Data a definir"}
                    {eventLocation ? ` · ${eventLocation}` : ""}
                  </Typography>
                  {isPurchasedForOther && (
                    <Typography
                      variant="caption"
                      color="primary.main"
                      sx={{ display: "block", mt: 0.25 }}
                    >
                      Comprado por {userName ?? "você"} para <strong>{reg.attendeeName}</strong>{" "}
                      ({reg.attendeeEmail})
                    </Typography>
                  )}
                  <Box sx={{ display: "flex", gap: 1, mt: 0.5, flexWrap: "wrap" }}>
                    <Chip label={sc.label} color={sc.color} size="small" variant="outlined" />
                    {reg.ticketType && (
                      <Chip
                        label={
                          reg.ticketType.priceCents > 0
                            ? `${reg.ticketType.name} · ${formatBRL(reg.ticketType.priceCents / 100)}`
                            : reg.ticketType.name
                        }
                        size="small"
                        variant="outlined"
                      />
                    )}
                    {alreadyUsed && reg.checkedInAt && (
                      <Chip
                        icon={<CheckCircleIcon />}
                        label={`Presente · ${formatEventDate(reg.checkedInAt)}`}
                        color="success"
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Box>
              </Box>

              <Box
                sx={{ display: "flex", gap: 1, mt: 1.5, flexWrap: "wrap", alignItems: "center" }}
              >
                {reg.status === "confirmed" && (
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<QrCode2Icon />}
                    endIcon={expandedQrId === reg.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    onClick={() => setExpandedQrId(expandedQrId === reg.id ? null : reg.id)}
                  >
                    QR de check-in
                  </Button>
                )}
                {reg.checkedInAt && (
                  <Button
                    size="small"
                    variant="outlined"
                    color="secondary"
                    startIcon={
                      certLoadingId === reg.id ? (
                        <CircularProgress size={14} color="inherit" />
                      ) : (
                        <WorkspacePremiumIcon />
                      )
                    }
                    disabled={certLoadingId === reg.id}
                    onClick={() => onEmitCertificate(reg.id)}
                  >
                    Emitir certificado
                  </Button>
                )}
                {canCancel && (
                  <Button
                    size="small"
                    variant="text"
                    color="error"
                    startIcon={<CancelIcon />}
                    onClick={() => onCancel(reg.id)}
                  >
                    Cancelar inscrição
                  </Button>
                )}
              </Box>

              {expandedQrId === reg.id && (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1,
                    mt: 2,
                  }}
                >
                  <Box sx={{ bgcolor: "white", p: 2, borderRadius: 2, display: "inline-block" }}>
                    <QRCodeSVG value={reg.checkinToken} size={180} level="M" marginSize={0} />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
                    Apresente este QR Code na entrada do evento
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
}

export interface EventsTabProps {
  readonly purchaseSuccess: boolean;
  readonly setPurchaseSuccess: (value: boolean) => void;
  readonly regsError: string;
  readonly regsLoading: boolean;
  readonly regsLoaded: boolean;
  readonly registrations: EventRegistration[];
  readonly groupedRegistrations: Record<EventsSubTab, EventRegistration[]>;
  readonly eventsSubTab: EventsSubTab;
  readonly setEventsSubTab: (value: EventsSubTab) => void;
  readonly expandedQrId: string | null;
  readonly setExpandedQrId: (id: string | null) => void;
  readonly certLoadingId: string | null;
  readonly certError: string;
  readonly setCertError: (value: string) => void;
  readonly onEmitCertificate: (id: string) => void;
  readonly onCancel: (id: string) => void;
  readonly userName?: string;
}

export default function EventsTab({
  purchaseSuccess,
  setPurchaseSuccess,
  regsError,
  regsLoading,
  regsLoaded,
  registrations,
  groupedRegistrations,
  eventsSubTab,
  setEventsSubTab,
  expandedQrId,
  setExpandedQrId,
  certLoadingId,
  certError,
  setCertError,
  onEmitCertificate,
  onCancel,
  userName,
}: Readonly<EventsTabProps>): React.JSX.Element {
  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <EventIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Meus eventos
          </Typography>
        </Box>
        <Button variant="outlined" size="small" href="/eventos">
          Ver próximos eventos
        </Button>
      </Box>

      {purchaseSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setPurchaseSuccess(false)}>
          Compra aprovada! Seus ingressos já estão disponíveis na aba “Próximos
          ingressos”.
        </Alert>
      )}

      {regsError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {regsError}
        </Alert>
      )}
      {certError && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setCertError("")}>
          {certError}
        </Alert>
      )}

      {regsLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {!regsLoading && regsLoaded && registrations.length === 0 && (
        <Box sx={{ textAlign: "center", py: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Você ainda não se inscreveu em nenhum evento.
          </Typography>
          <Button variant="contained" href="/eventos">
            Explorar eventos
          </Button>
        </Box>
      )}

      {!regsLoading && registrations.length > 0 && (
        <>
          <Tabs
            value={eventsSubTab}
            onChange={(_, v) => setEventsSubTab(v as EventsSubTab)}
            sx={{ mb: 2 }}
          >
            <Tab value="future" label="Próximos ingressos" />
            <Tab value="purchased" label="Comprei para outros" />
            <Tab value="history" label="Histórico" />
          </Tabs>
          <EventRegistrationsList
            registrations={groupedRegistrations[eventsSubTab]}
            expandedQrId={expandedQrId}
            setExpandedQrId={setExpandedQrId}
            certLoadingId={certLoadingId}
            onEmitCertificate={onEmitCertificate}
            onCancel={onCancel}
            emptyMessage={getEventsEmptyMessage(eventsSubTab)}
            mode={getEventsListMode(eventsSubTab)}
            userName={userName}
          />
        </>
      )}
    </Box>
  );
}

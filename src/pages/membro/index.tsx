import React, { useEffect, useState, useCallback, useMemo } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import { useHistory } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Pagination from "@mui/material/Pagination";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import TabPanel from "../../components/TabPanel";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import EditIcon from "@mui/icons-material/Edit";
import GitHubIcon from "@mui/icons-material/GitHub";
import LogoutIcon from "@mui/icons-material/Logout";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import PersonIcon from "@mui/icons-material/Person";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { QRCodeSVG } from "qrcode.react";
import EventIcon from "@mui/icons-material/Event";
import PrintIcon from "@mui/icons-material/Print";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useAuth } from "../../hooks/useAuth";
import type { AuthUser } from "../../hooks/useAuth";
import ModalConfirm from "../../components/ModalConfirm";
import { communities } from "../../data/communities";

interface Donation {
  id: string;
  amount: number;
  description: string;
  community: string;
  referenceId: string;
  createdAt: string;
}

interface ReimbursementRequest {
  id: string;
  account: { name: string };
  amount: number;
  description: string;
  receiptUrl: string;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  createdAt: string;
}

interface CommunityBalance {
  id: string;
  projectKey: string;
  name: string;
  balance: number;
}

interface Subscription {
  id: string;
  status: string;
  interval: string;
  amount: number;
  currency: string;
  communityId: string;
  entityType?: "member" | "business";
  companyId?: string | null;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const getSubscriptionOwnerLabel = (sub: Subscription): "Pessoal" | "Business" =>
  sub.entityType === "business" || !!sub.companyId ? "Business" : "Pessoal";

const getDonationOwnerLabel = (donation: Donation): "Pessoal" | "Business" => {
  const description = donation.description.toLowerCase();
  return description.includes("empresa") || description.includes("business")
    ? "Business"
    : "Pessoal";
};

const reimbursementStatusConfig = {
  pending: { label: "Pendente", color: "warning" as const, icon: <HourglassEmptyIcon fontSize="small" /> },
  approved: { label: "Aprovado", color: "success" as const, icon: <CheckCircleIcon fontSize="small" /> },
  rejected: { label: "Rejeitado", color: "error" as const, icon: <CancelIcon fontSize="small" /> },
};

function getRoleLabel(role: string): string {
  if (role === "admin") return "Organização";
  if (role === "finance-analyzer") return "Finance Analyzer";
  if (role === "event_organizer") return "Organizador de Eventos";
  if (role === "event_checker") return "Credenciamento";
  if (role === "event_finance") return "Financeiro de Eventos";
  if (role === "membro" || role === "member") return "Membro";
  return role;
}

function getRoleColor(role: string): "primary" | "secondary" | "info" | "default" {
  if (role === "admin") return "primary";
  if (role === "finance-analyzer") return "secondary";
  if (role === "event_organizer" || role === "event_checker" || role === "event_finance") return "info";
  return "default";
}

/** Multi-role: o backend expõe `roles: string[]` na sessão (migração Fase 2). */
function getUserRoles(u: AuthUser | null): string[] {
  return u?.roles ?? [];
}

// ---------------------------------------------------------------------------
// Histórico de eventos (Fase 2 do EVENT_PLAN)
// ---------------------------------------------------------------------------

type RegistrationStatus = "confirmed" | "pending_match" | "cancelled" | "refunded" | "waitlist";

interface EventRegistration {
  id: string;
  status: RegistrationStatus;
  checkedInAt: string | null;
  checkinToken: string;
  attendeeName: string;
  attendeeEmail?: string;
  memberId: string | null;
  payerMemberId: string | null;
  isPayerOnly?: boolean;
  /** Evento interno. Null para inscrições externas via activation. */
  event: { id: string; title: string; startAt: string; location: string | null; status: string } | null;
  /** Ativação externa (quando event == null). */
  activation?: { eventKey: string; title: string; startAt?: string | null } | null;
  ticketType: { name: string; kind: string; priceCents: number } | null;
}

interface CertificateData {
  attendeeName: string;
  attendeeEmail?: string;
  eventTitle: string;
  /** Eventos externos podem não ter datas — o backend retorna null. */
  eventStartAt: string | null;
  eventEndAt: string | null;
  /** Pode ser null (externo sem carga horária definida). */
  workloadMinutes: number | null;
  /** Chave da comunidade organizadora (ex.: 'cloudnativemaringa'). */
  communityProjectKey: string | null;
  verificationCode: string;
  issuedAt: string;
}

const registrationStatusConfig: Record<
  RegistrationStatus,
  { label: string; color: "success" | "warning" | "error" | "info" | "default" }
> = {
  confirmed: { label: "Confirmada", color: "success" },
  pending_match: { label: "Aguardando vínculo", color: "warning" },
  cancelled: { label: "Cancelada", color: "error" },
  refunded: { label: "Reembolsada", color: "default" },
  waitlist: { label: "Lista de espera", color: "info" },
};

const formatEventDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatWorkload = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}min`;
  return rest === 0 ? `${hours}h` : `${hours}h${rest}min`;
};

type EventsSubTab = "future" | "purchased" | "history";
type EventsListMode = "mine" | "purchased" | "history";

function getEventsEmptyMessage(subTab: EventsSubTab): string {
  switch (subTab) {
    case "future":
      return "Nenhum ingresso próximo.";
    case "purchased":
      return "Você ainda não comprou ingressos para outras pessoas.";
    case "history":
      return "Nenhum ingresso no histórico.";
  }
}

function getEventsListMode(subTab: EventsSubTab): EventsListMode {
  switch (subTab) {
    case "purchased":
      return "purchased";
    case "history":
      return "history";
    default:
      return "mine";
  }
}

function isUpcomingEvent(reg: EventRegistration): boolean {
  const startAt = reg.event?.startAt ?? reg.activation?.startAt ?? null;
  if (!startAt) return true; // eventos sem data tratamos como próximos
  const t = new Date(startAt).getTime();
  return Number.isNaN(t) ? true : t > Date.now();
}

function EventTitleLink({
  registration,
  children,
}: {
  readonly registration: EventRegistration;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  if (registration.event) {
    return (
      <Link
        href={`/eventos/detalhe?source=internal&sourceId=codaqui&id=${registration.event.id}`}
      >
        {children}
      </Link>
    );
  }
  if (registration.activation) {
    const parts = registration.activation.eventKey.split(":");
    const source = parts[0] ?? "";
    const sourceId = parts[1] ?? "";
    const eventId = parts[2] ?? "";
    return (
      <Link
        href={`/eventos/detalhe?source=${encodeURIComponent(source)}&sourceId=${encodeURIComponent(
          sourceId
        )}&id=${encodeURIComponent(eventId)}`}
      >
        {children}
      </Link>
    );
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
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1 }}>
                <Box>
                  <Typography variant="body2" fontWeight={700}>
                    <EventTitleLink registration={reg}>{eventTitle}</EventTitleLink>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {eventStartAt ? formatEventDate(eventStartAt) : "Data a definir"}
                    {eventLocation ? ` · ${eventLocation}` : ""}
                  </Typography>
                  {isPurchasedForOther && (
                    <Typography variant="caption" color="primary.main" display="block" sx={{ mt: 0.25 }}>
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

              <Box sx={{ display: "flex", gap: 1, mt: 1.5, flexWrap: "wrap", alignItems: "center" }}>
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
                      certLoadingId === reg.id
                        ? <CircularProgress size={14} color="inherit" />
                        : <WorkspacePremiumIcon />
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
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, mt: 2 }}>
                  <Box sx={{ bgcolor: "white", p: 2, borderRadius: 2, display: "inline-block" }}>
                    <QRCodeSVG value={reg.checkinToken} size={180} level="M" includeMargin={false} />
                  </Box>
                  <Typography variant="caption" color="text.secondary" textAlign="center">
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

/**
 * Formata uma data ISO de forma defensiva: retorna null quando o valor é
 * ausente ou inválido (evita "Invalid Date" na UI — ex.: certificados de
 * eventos externos, que podem ter datas/workload nulos).
 */
const formatDateSafe = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR");
};

interface ReimbursementListProps {
  loading: boolean;
  reimbursements: ReimbursementRequest[];
}

function ReimbursementList({ loading, reimbursements }: Readonly<ReimbursementListProps>): React.JSX.Element {
  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={28} /></Box>;
  }
  if (reimbursements.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Nenhuma solicitação ainda.
      </Typography>
    );
  }
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 4 }}>
      {reimbursements.map((r) => {
        const sc = reimbursementStatusConfig[r.status];
        return (
          <Card key={r.id} variant="outlined">
            <CardContent sx={{ py: "12px !important" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1 }}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{r.description}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {r.account?.name} · {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Chip icon={sc.icon} label={sc.label} color={sc.color} size="small" variant="outlined" />
                  <Typography variant="body1" fontWeight={700} color="primary.main">
                    {formatBRL(r.amount)}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap", alignItems: "center" }}>
                <Button size="small" variant="text" endIcon={<OpenInNewIcon />} href={r.receiptUrl} target="_blank" rel="noopener noreferrer">
                  Comprovante
                </Button>
              </Box>
              {r.reviewNote && (
                <Alert severity={r.status === "approved" ? "success" : "error"} sx={{ mt: 1 }}>
                  {r.reviewNote}
                </Alert>
              )}
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Certificado de participação (cartão imprimível)
// ---------------------------------------------------------------------------

function EventDateWorkloadLine({
  startDate,
  endDate,
  workload,
  communityName,
}: {
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly workload: string | null;
  readonly communityName: string;
}): React.JSX.Element {
  const endPart = endDate ? ` a ${endDate}` : "";
  const datePart = startDate ? `realizado em ${startDate}${endPart}` : "evento da comunidade";
  return (
    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
      {datePart}
      {workload ? (
        <>
          , com carga horária de <strong>{workload}</strong>
        </>
      ) : null}
      {", organizado por "}
      <strong>{communityName}</strong>
      {", em parceria com a Associação Codaqui."}
    </Typography>
  );
}

function CertificateCard({
  certificate,
  origin,
}: Readonly<{ certificate: CertificateData; origin: string }>): React.JSX.Element {
  const startDate = formatDateSafe(certificate.eventStartAt);
  const endDate = formatDateSafe(certificate.eventEndAt);
  const issuedDate = formatDateSafe(certificate.issuedAt);
  const workload =
    typeof certificate.workloadMinutes === "number" && certificate.workloadMinutes > 0
      ? formatWorkload(certificate.workloadMinutes)
      : null;
  const community = useMemo(
    () =>
      certificate.communityProjectKey
        ? communities.find((c) => c.id === certificate.communityProjectKey) ?? null
        : null,
    [certificate.communityProjectKey]
  );
  const communityName = community?.name ?? certificate.communityProjectKey ?? "Associação Codaqui";
  const verifyUrl = `${origin}/certificado/verificar?codigo=${encodeURIComponent(
    certificate.verificationCode
  )}`;

  return (
    <Box
      className="certificate-print-area"
      sx={{
        p: 5,
        textAlign: "center",
        border: 8,
        borderColor: "primary.main",
        borderRadius: 1,
        bgcolor: "background.paper",
      }}
    >
      <Box
        component="img"
        src="/img/logo.png"
        alt="Codaqui"
        sx={{ height: 40, mb: 1 }}
      />
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 3 }}>
        Associação Codaqui — CNPJ 44.593.429/0001-05
      </Typography>
      <Typography variant="overline" fontWeight={800} color="primary.main" display="block">
        CERTIFICADO DE PARTICIPAÇÃO
      </Typography>
      <Typography variant="body1" sx={{ mt: 3 }}>
        Certificamos que
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
        Nome do participante
      </Typography>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
        {certificate.attendeeName}
      </Typography>
      {certificate.attendeeEmail && (
        <>
          <Typography variant="caption" color="text.secondary" display="block">
            E-mail
          </Typography>
          <Typography variant="body2" fontWeight={500} sx={{ mb: 2 }}>
            {certificate.attendeeEmail}
          </Typography>
        </>
      )}
      <Typography variant="body1">
        participou do evento
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
        Evento
      </Typography>
      <Typography variant="h5" fontWeight={800} color="primary.main" sx={{ mb: 1 }}>
        {certificate.eventTitle}
      </Typography>
      <EventDateWorkloadLine
        startDate={startDate}
        endDate={endDate}
        workload={workload}
        communityName={communityName}
      />
      <Box
        sx={{
          mt: 4,
          pt: 2,
          borderTop: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ bgcolor: "white", p: 1, borderRadius: 1, display: "inline-block" }}>
          <QRCodeSVG value={verifyUrl} size={72} level="M" includeMargin={false} />
        </Box>
        <Box sx={{ textAlign: "left" }}>
          {issuedDate && (
            <Typography variant="caption" color="text.secondary" display="block">
              Emitido em {issuedDate}
            </Typography>
          )}
          <Typography variant="caption" fontFamily="monospace" color="text.secondary" display="block">
            Código de verificação: {certificate.verificationCode}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Verifique a autenticidade pelo QR code ou em {origin}/certificado/verificar
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

interface SubscriptionListProps {
  loading: boolean;
  subscriptions: Subscription[];
  onCancelClick: (id: string) => void;
}
function SubscriptionList({ loading, subscriptions, onCancelClick }: Readonly<SubscriptionListProps>): React.JSX.Element {
  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={28} /></Box>;
  }
  if (subscriptions.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 3, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">Nenhuma assinatura ativa.</Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 4 }}>
      {subscriptions.map((sub) => (
        <Card key={sub.id} variant="outlined" sx={{
          borderColor: sub.cancelAtPeriodEnd ? "warning.main" : "primary.main",
          borderWidth: 1,
        }}>
          <CardContent sx={{ py: "12px !important" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <AutorenewIcon fontSize="small" color={sub.cancelAtPeriodEnd ? "warning" : "info"} />
                  <Typography variant="body2" fontWeight={700}>
                    {sub.communityId === "tesouro-geral" ? "Tesouro Codaqui" : sub.communityId}
                  </Typography>
                  <Chip
                    label={sub.interval === "month" ? "Mensal" : "Anual"}
                    size="small"
                    color="info"
                    variant="outlined"
                  />
                  <Chip
                    label={getSubscriptionOwnerLabel(sub)}
                    size="small"
                    color={getSubscriptionOwnerLabel(sub) === "Business" ? "secondary" : "default"}
                    variant="outlined"
                  />
                  {sub.cancelAtPeriodEnd && (
                    <Chip label="Encerra em breve" size="small" color="warning" variant="outlined" />
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {sub.cancelAtPeriodEnd
                    ? `Ativa até ${new Date(sub.currentPeriodEnd * 1000).toLocaleDateString("pt-BR")}`
                    : `Próxima cobrança: ${new Date(sub.currentPeriodEnd * 1000).toLocaleDateString("pt-BR")}`
                  }
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Typography variant="body1" fontWeight={700} color="primary.main">
                  {formatBRL(sub.amount / 100)}/{sub.interval === "month" ? "mês" : "ano"}
                </Typography>
                {!sub.cancelAtPeriodEnd && (
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    startIcon={<CancelIcon />}
                    onClick={() => onCancelClick(sub.id)}
                  >
                    Cancelar
                  </Button>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

interface DonationListProps {
  loading: boolean;
  donations: Donation[];
}

function DonationList({ loading, donations }: Readonly<DonationListProps>): React.JSX.Element {
  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={32} /></Box>;
  }
  if (donations.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 4 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Nenhuma doação registrada ainda.
        </Typography>
        <Button variant="contained" href="/participe/apoiar">Fazer uma doação</Button>
      </Box>
    );
  }
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {donations.map((tx) => (
        <Card key={tx.id} variant="outlined">
          <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: "12px !important" }}>
            <Box>
              <Typography variant="body2" fontWeight={600}>{tx.community}</Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(tx.createdAt).toLocaleDateString("pt-BR")}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Chip
                label={getDonationOwnerLabel(tx)}
                size="small"
                color={getDonationOwnerLabel(tx) === "Business" ? "secondary" : "default"}
                variant="outlined"
              />
              <ArrowUpwardIcon fontSize="small" sx={{ color: "success.main" }} />
              <Typography variant="body1" fontWeight={700} color="success.main">
                {formatBRL(tx.amount)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

interface MemberProfileCardProps {
  readonly user: AuthUser;
  readonly vanityUrl: string;
  readonly copied: boolean;
  readonly onCopy: () => void;
  readonly onShowQr: () => void;
  readonly onLogout: () => void;
}

function MemberProfileCard({
  user,
  vanityUrl,
  copied,
  onCopy,
  onShowQr,
  onLogout,
}: MemberProfileCardProps): React.JSX.Element {
  const roles = getUserRoles(user);
  const canAccessReimbursements = roles.some(
    (r) => r === "admin" || r === "finance-analyzer"
  );

  return (
    <Card variant="outlined" sx={{ mb: 4 }}>
      <CardContent sx={{ display: "flex", gap: 3, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Avatar src={user.avatarUrl} alt={user.name} sx={{ width: 80, height: 80 }} />
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5, flexWrap: "wrap" }}>
            <Typography variant="h5" fontWeight={800}>
              {user.name}
            </Typography>
            {roles.map((role) => (
              <Chip
                key={role}
                label={getRoleLabel(role)}
                color={getRoleColor(role)}
                size="small"
                variant="outlined"
              />
            ))}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <GitHubIcon sx={{ fontSize: "0.9rem", mr: 0.5, verticalAlign: "middle" }} />
            @{user.handle}
          </Typography>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            <Button variant="outlined" size="small" startIcon={<EditIcon />} href="/membro/editar">
              Editar perfil
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<PersonIcon />}
              href={`/@${user.handle}`}
            >
              Ver perfil público
            </Button>
            <Tooltip title="Exibir QR Code do perfil">
              <IconButton size="small" onClick={onShowQr} aria-label="Exibir QR Code">
                <QrCode2Icon />
              </IconButton>
            </Tooltip>
            {canAccessReimbursements && (
              <Button variant="outlined" size="small" color="secondary" href="/admin/reembolsos">
                Painel de Reembolsos
              </Button>
            )}
            <Button
              variant="text"
              size="small"
              color="inherit"
              startIcon={<LogoutIcon />}
              onClick={onLogout}
              sx={{ color: "text.secondary" }}
            >
              Sair
            </Button>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary" fontFamily="monospace">
              {vanityUrl}
            </Typography>
            <Tooltip title={copied ? "Copiado!" : "Copiar URL"}>
              <IconButton size="small" onClick={onCopy} aria-label="Copiar URL do perfil">
                <ContentCopyIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

interface MemberQrDialogProps {
  readonly open: boolean;
  readonly vanityUrl: string;
  readonly copied: boolean;
  readonly onCopy: () => void;
  readonly onClose: () => void;
}

function MemberQrDialog({
  open,
  vanityUrl,
  copied,
  onCopy,
  onClose,
}: MemberQrDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ textAlign: "center", fontWeight: 700 }}>Seu QR Code</DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, pb: 3 }}
      >
        <Box sx={{ bgcolor: "white", p: 2, borderRadius: 2, display: "inline-block" }}>
          <QRCodeSVG
            value={vanityUrl}
            size={200}
            level="M"
            includeMargin={false}
            fgColor="#16a34a"
          />
        </Box>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Escaneie para acessar seu perfil público
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="caption" fontFamily="monospace" color="text.secondary">
            {vanityUrl}
          </Typography>
          <Tooltip title={copied ? "Copiado!" : "Copiar"}>
            <IconButton size="small" onClick={onCopy} aria-label="Copiar URL">
              <ContentCopyIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "center", pb: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface EventsTabPanelProps {
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

function EventsTabPanel({
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
}: EventsTabPanelProps): React.JSX.Element {
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <EventIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>Meus eventos</Typography>
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

      {regsError && <Alert severity="error" sx={{ mb: 2 }}>{regsError}</Alert>}
      {certError && <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setCertError("")}>{certError}</Alert>}

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
          <Button variant="contained" href="/eventos">Explorar eventos</Button>
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

export default function MembroPage(): React.JSX.Element {
  const { user, ready, isLoggedIn, logout, authFetch } = useAuth();
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";
  const history = useHistory();

  const [donations, setDonations] = useState<Donation[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [donationsPage, setDonationsPage] = useState(1);
  const [donationsTotal, setDonationsTotal] = useState(0);
  const [donationsLimit] = useState(10);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [subsPage, setSubsPage] = useState(1);
  const [subsTotal, setSubsTotal] = useState(0);
  const [subsLimit] = useState(10);
  const [cancelSubId, setCancelSubId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reimbursements, setReimbursements] = useState<ReimbursementRequest[]>([]);
  const [reimbLoading, setReimbLoading] = useState(true);
  const [accounts, setAccounts] = useState<CommunityBalance[]>([]);

  // Reimbursement form state
  const [reimbDialog, setReimbDialog] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Sub-abas da seção Eventos
  const [eventsSubTab, setEventsSubTab] = useState<EventsSubTab>("future");
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  // ── Histórico de eventos (dados sob demanda — só carrega ao abrir a aba) ──
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [regsLoading, setRegsLoading] = useState(false);
  const [regsLoaded, setRegsLoaded] = useState(false);
  const [regsError, setRegsError] = useState("");
  const [expandedQrId, setExpandedQrId] = useState<string | null>(null);
  const [cancelRegId, setCancelRegId] = useState<string | null>(null);
  const [cancelRegLoading, setCancelRegLoading] = useState(false);
  const [cancelRegError, setCancelRegError] = useState("");
  const [certificate, setCertificate] = useState<CertificateData | null>(null);
  const [certLoadingId, setCertLoadingId] = useState<string | null>(null);
  const [certError, setCertError] = useState("");

  const origin =
    globalThis.window === undefined
      ? ""
      : globalThis.location.origin;
  const vanityUrl = user ? `${origin}/@${user.handle}` : "";

  const groupedRegistrations = useMemo(() => {
    const future: EventRegistration[] = [];
    const purchased: EventRegistration[] = [];
    const history: EventRegistration[] = [];
    for (const reg of registrations) {
      if (!reg) continue;
      const isOwn = reg.memberId === user?.sub;
      const isPast = !isUpcomingEvent(reg) || reg.checkedInAt || reg.status === "cancelled" || reg.status === "refunded";
      if (reg.isPayerOnly || (!isOwn && reg.payerMemberId === user?.sub)) {
        // ingresso comprado pelo usuário para outra pessoa
        if (isPast) history.push(reg);
        else purchased.push(reg);
      } else if (isPast) {
        history.push(reg);
      } else {
        future.push(reg);
      }
    }
    return { future, purchased, history };
  }, [registrations, user]);

  const copyVanityUrl = () => {
    navigator.clipboard.writeText(vanityUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const fetchReimbursements = useCallback(() => {
    setReimbLoading(true);
    authFetch(`${apiUrl}/reimbursements/my`)
      .then((r) => r.json())
      .then((data) => setReimbursements(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setReimbLoading(false));
  }, [apiUrl, authFetch]);

  const fetchRegistrations = useCallback(() => {
    setRegsLoading(true);
    setRegsError("");
    authFetch(`${apiUrl}/events/my-registrations`)
      .then(async (r) => {
        if (!r.ok) {
          setRegsError("Não foi possível carregar suas inscrições em eventos.");
          return;
        }
        const data = await r.json();
        setRegistrations(Array.isArray(data) ? data : []);
      })
      .catch(() => setRegsError("Erro inesperado ao carregar inscrições."))
      .finally(() => {
        setRegsLoading(false);
        setRegsLoaded(true);
      });
  }, [apiUrl, authFetch]);

  // Carrega o histórico de eventos sob demanda ao abrir a aba pela 1ª vez
  useEffect(() => {
    if (activeTab === 4 && !regsLoaded && !regsLoading) fetchRegistrations();
  }, [activeTab, regsLoaded, regsLoading, fetchRegistrations]);

  // Detecta redirecionamento pós-compra de ingresso
  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    if (search.get("purchase") === "success") {
      setPurchaseSuccess(true);
      setActiveTab(4);
      setEventsSubTab("future");
      // limpa o parâmetro da URL sem recarregar
      const next = new URL(window.location.href);
      next.searchParams.delete("purchase");
      window.history.replaceState({}, "", next.toString());
    }
    if (search.get("tab") === "future") {
      setActiveTab(4);
      setEventsSubTab("future");
    }
  }, []);

  const handleCancelRegistration = async () => {
    if (!cancelRegId) return;
    setCancelRegLoading(true);
    setCancelRegError("");
    try {
      const res = await authFetch(`${apiUrl}/events/registrations/${cancelRegId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setCancelRegError(data?.message ?? "Erro ao cancelar inscrição.");
        return;
      }
      setCancelRegId(null);
      fetchRegistrations();
    } catch {
      setCancelRegError("Erro inesperado ao cancelar inscrição.");
    } finally {
      setCancelRegLoading(false);
    }
  };

  const handleEmitCertificate = async (registrationId: string) => {
    setCertLoadingId(registrationId);
    setCertError("");
    try {
      const res = await authFetch(`${apiUrl}/events/registrations/${registrationId}/certificate`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setCertError(
          res.status === 403
            ? "O certificado só pode ser emitido após a confirmação de presença (check-in) no evento."
            : (data?.message ?? "Erro ao emitir certificado."),
        );
        return;
      }
      setCertificate((await res.json()) as CertificateData);
    } catch {
      setCertError("Erro inesperado ao emitir certificado.");
    } finally {
      setCertLoadingId(null);
    }
  };

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn) { history.replace("/"); return; }

    // Doações via Stripe
    authFetch(`${apiUrl}/stripe/my-donations?page=${donationsPage}&limit=${donationsLimit}`)
      .then((r) => r.json())
      .then((data: PaginatedResponse<Donation> | Donation[]) => {
        if (Array.isArray(data)) {
          setDonations(data);
          setDonationsTotal(data.length);
          return;
        }
        setDonations(Array.isArray(data.items) ? data.items : []);
        setDonationsTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setTxLoading(false));

    // Assinaturas recorrentes
    authFetch(`${apiUrl}/stripe/my-subscriptions?page=${subsPage}&limit=${subsLimit}`)
      .then((r) => r.json())
      .then((data: PaginatedResponse<Subscription> | Subscription[]) => {
        if (Array.isArray(data)) {
          setSubscriptions(data);
          setSubsTotal(data.length);
          return;
        }
        setSubscriptions(Array.isArray(data.items) ? data.items : []);
        setSubsTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setSubsLoading(false));

    // Reembolsos
    fetchReimbursements();

    // Contas disponíveis para reembolso
    fetch(`${apiUrl}/ledger/community-balances`)
      .then((r) => r.json())
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [
    ready,
    isLoggedIn,
    apiUrl,
    authFetch,
    history,
    fetchReimbursements,
    donationsPage,
    donationsLimit,
    subsPage,
    subsLimit,
  ]);

  const handleSubmitReimbursement = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await authFetch(`${apiUrl}/reimbursements`, {
        method: "POST",
        body: JSON.stringify({
          accountId,
          amount: Math.round(Number.parseFloat(amount)),
          description,
          receiptUrl,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSubmitError(data.message ?? "Erro ao enviar solicitação.");
        return;
      }
      setReimbDialog(false);
      setAccountId(""); setAmount(""); setDescription(""); setReceiptUrl("");
      fetchReimbursements();
    } catch {
      setSubmitError("Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!cancelSubId) return;
    setCancelling(true);
    try {
      const res = await authFetch(`${apiUrl}/stripe/subscriptions/${cancelSubId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Falha ao cancelar assinatura.");
      // Atualiza estado local — marca como cancelAtPeriodEnd
      setSubscriptions((prev) =>
        prev.map((s) => s.id === cancelSubId ? { ...s, cancelAtPeriodEnd: true } : s)
      );
    } catch (e) {
      console.error(e);
    } finally {
      setCancelling(false);
      setCancelSubId(null);
    }
  };

  const activeSubscriptions = subscriptions.filter((s) => !s.cancelAtPeriodEnd);
  const activePersonalSubscriptions = activeSubscriptions.filter(
    (s) => getSubscriptionOwnerLabel(s) === "Pessoal",
  ).length;
  const activeBusinessSubscriptions = activeSubscriptions.filter(
    (s) => getSubscriptionOwnerLabel(s) === "Business",
  ).length;

  if (!ready || !isLoggedIn) {
    return (
      <Layout title="Área do Membro">
        <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title="Área do Membro" description="Perfil e histórico de doações">
      <Container maxWidth="md" sx={{ py: 6 }}>
        {/* Perfil */}
        <MemberProfileCard
          user={user!}
          vanityUrl={vanityUrl}
          copied={copied}
          onCopy={copyVanityUrl}
          onShowQr={() => setShowQr(true)}
          onLogout={() => logout()}
        />

        {/* ── QR Code Dialog ── */}
        <MemberQrDialog
          open={showQr}
          vanityUrl={vanityUrl}
          copied={copied}
          onCopy={copyVanityUrl}
          onClose={() => setShowQr(false)}
        />

        <Divider sx={{ my: 3 }} />

        {/* ── Tabs ── */}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
        >
          <Tab label="Visão Geral" />
          <Tab label="Histórico de Doações" />
          <Tab label="Assinaturas Recorrentes" />
          <Tab label="Carteira" />
          <Tab label="Eventos" icon={<EventIcon />} iconPosition="start" />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <Box>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card variant="outlined">
                  <CardContent sx={{ py: "12px !important" }}>
                    <Typography variant="overline" color="text.secondary" display="block">
                      Total doado
                    </Typography>
                    {txLoading ? (
                      <CircularProgress size={18} sx={{ mt: 0.5 }} />
                    ) : (
                      <Typography variant="h5" fontWeight={800} color="success.main">
                        {formatBRL(donations.reduce((s, d) => s + d.amount, 0))}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card variant="outlined">
                  <CardContent sx={{ py: "12px !important" }}>
                    <Typography variant="overline" color="text.secondary" display="block">
                      Assinaturas ativas
                    </Typography>
                    {subsLoading ? (
                      <CircularProgress size={18} sx={{ mt: 0.5 }} />
                    ) : (
                      <>
                        <Typography variant="h5" fontWeight={800}>
                          {activeSubscriptions.length}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {activePersonalSubscriptions} pessoal · {activeBusinessSubscriptions} business
                        </Typography>
                      </>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card variant="outlined">
                  <CardContent sx={{ py: "12px !important" }}>
                    <Typography variant="overline" color="text.secondary" display="block">
                      Reembolsos pendentes
                    </Typography>
                    {reimbLoading ? (
                      <CircularProgress size={18} sx={{ mt: 0.5 }} />
                    ) : (
                      <Typography variant="h5" fontWeight={800}>
                        {reimbursements.filter((r) => r.status === "pending").length}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <Button variant="outlined" size="small" href="/clube">
                Minha carteira de moedas
              </Button>
              <Button variant="outlined" size="small" onClick={() => setActiveTab(1)}>
                Ver histórico de doações
              </Button>
              <Button variant="outlined" size="small" onClick={() => setActiveTab(2)}>
                Ver assinaturas recorrentes
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ReceiptLongIcon />}
                onClick={() => { setActiveTab(3); setReimbDialog(true); setSubmitError(""); }}
              >
                Solicitar Reembolso
              </Button>
            </Stack>
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Box>
            <Typography variant="h6" fontWeight={700} gutterBottom>Doações avulsas</Typography>
            <DonationList loading={txLoading} donations={donations} />
            {donationsTotal > donationsLimit && (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                <Pagination
                  page={donationsPage}
                  count={Math.max(1, Math.ceil(donationsTotal / donationsLimit))}
                  onChange={(_, value) => setDonationsPage(value)}
                  color="primary"
                  size="small"
                />
              </Box>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <AutorenewIcon color="info" />
                <Typography variant="h6" fontWeight={700}>Assinaturas Recorrentes</Typography>
              </Box>
              <Button variant="outlined" size="small" href="/participe/apoiar">
                + Nova assinatura
              </Button>
            </Box>
            <SubscriptionList loading={subsLoading} subscriptions={subscriptions} onCancelClick={setCancelSubId} />
            {subsTotal > subsLimit && (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                <Pagination
                  page={subsPage}
                  count={Math.max(1, Math.ceil(subsTotal / subsLimit))}
                  onChange={(_, value) => setSubsPage(value)}
                  color="primary"
                  size="small"
                />
              </Box>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
              <Typography variant="h6" fontWeight={700}>Minhas Solicitações de Reembolso</Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<ReceiptLongIcon />}
                onClick={() => { setReimbDialog(true); setSubmitError(""); }}
              >
                Solicitar Reembolso
              </Button>
            </Box>
            <ReimbursementList loading={reimbLoading} reimbursements={reimbursements} />
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={4}>
          <EventsTabPanel
            purchaseSuccess={purchaseSuccess}
            setPurchaseSuccess={setPurchaseSuccess}
            regsError={regsError}
            regsLoading={regsLoading}
            regsLoaded={regsLoaded}
            registrations={registrations}
            groupedRegistrations={groupedRegistrations}
            eventsSubTab={eventsSubTab}
            setEventsSubTab={setEventsSubTab}
            expandedQrId={expandedQrId}
            setExpandedQrId={setExpandedQrId}
            certLoadingId={certLoadingId}
            certError={certError}
            setCertError={setCertError}
            onEmitCertificate={handleEmitCertificate}
            onCancel={(id) => { setCancelRegId(id); setCancelRegError(""); }}
            userName={user?.name}
          />
        </TabPanel>
      </Container>

      {/* ── Dialog: Confirmar cancelamento de assinatura ── */}
      <Dialog open={!!cancelSubId} onClose={() => !cancelling && setCancelSubId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 700 }}>
          <CancelIcon color="error" />
          Cancelar assinatura?
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            A assinatura <strong>não será cancelada imediatamente</strong>. Ela continuará ativa
            até o final do período já pago e só então será encerrada.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            Você pode criar uma nova assinatura a qualquer momento em{" "}
            <strong>/participe/apoiar</strong>.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCancelSubId(null)} disabled={cancelling} color="inherit">
            Manter assinatura
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={cancelling}
            onClick={handleCancelSubscription}
            startIcon={cancelling ? <CircularProgress size={16} color="inherit" /> : <CancelIcon />}
          >
            {cancelling ? "Cancelando…" : "Confirmar cancelamento"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Reimbursement Dialog ── */}
      <Dialog open={reimbDialog} onClose={() => setReimbDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Solicitar Reembolso</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
            <Alert severity="info">
              O comprovante deve ser uma URL pública (Google Drive, Dropbox etc.).
              Após a aprovação, ele será arquivado internamente pela equipe financeira.
            </Alert>

            <FormControl fullWidth required>
              <InputLabel>Conta (carteira comunitária)</InputLabel>
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} label="Conta (carteira comunitária)">
                {accounts.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.name} ({formatBRL(a.balance)})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Valor (R$)"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              inputProps={{ min: 1, step: 1 }}
            />

            <TextField
              label="Descrição"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              multiline
              rows={2}
              placeholder="Ex: Compra de materiais para o evento de outubro"
            />

            <TextField
              label="URL do comprovante (obrigatório)"
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              required
              placeholder="https://drive.google.com/file/d/..."
              type="url"
              helperText="Use um link público para que a equipe financeira possa verificar."
            />

            {submitError && <Alert severity="error">{submitError}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReimbDialog(false)} color="inherit">Cancelar</Button>
          <Button
            variant="contained"
            disabled={!accountId || !amount || !description.trim() || !receiptUrl.trim() || submitting}
            onClick={handleSubmitReimbursement}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <ReceiptLongIcon />}
          >
            Enviar Solicitação
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Cancelar inscrição em evento ── */}
      <ModalConfirm
        open={!!cancelRegId}
        title="Cancelar inscrição?"
        description="Sua inscrição no evento será cancelada. Se o ingresso foi pago, o estorno segue a política do evento."
        variant="error"
        confirmLabel="Cancelar inscrição"
        loading={cancelRegLoading}
        error={cancelRegError}
        onConfirm={handleCancelRegistration}
        onClose={() => setCancelRegId(null)}
      />

      {/* ── Certificado de participação (imprimível) ── */}
      <Dialog open={!!certificate} onClose={() => setCertificate(null)} maxWidth="sm" fullWidth>
        <DialogContent sx={{ p: 0 }}>
          {certificate && <CertificateCard certificate={certificate} origin={origin} />}
        </DialogContent>
        <DialogActions className="no-print" sx={{ justifyContent: "center", pb: 2, gap: 1 }}>
          <Button onClick={() => setCertificate(null)} color="inherit">
            Fechar
          </Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={() => globalThis.print()}
          >
            Imprimir
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}

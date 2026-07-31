import React, { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import { useHistory } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExtensionIcon from "@mui/icons-material/Extension";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PublishIcon from "@mui/icons-material/Publish";
import CancelIcon from "@mui/icons-material/Cancel";
import SyncIcon from "@mui/icons-material/Sync";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import AdminNavbar from "../../components/AdminNavbar";
import AdminPageContainer from "../../components/AdminPageContainer";
import ModalConfirm from "../../components/ModalConfirm";
import EventOrdersDialog from "../../components/EventOrdersDialog";
import EventReimbursementDialog from "../../components/EventReimbursementDialog";
import { useAuth } from "../../hooks/useAuth";
import { parseAuthJson, extractErrorMessage } from "../../hooks/authFetchHelpers";
import { communities } from "../../data/communities";
import {
  type EventIndexFile,
  type EventSummary,
} from "../../data/events";
import { fetchEventsIndexMerged } from "../../lib/events-api";

// ── Tipos (contrato do backend — módulo events) ─────────────────────────────

type EventStatus = "draft" | "published" | "canceled" | "completed";
type TicketKind = "free" | "paid" | "community" | "company";
type EventStaffRole = "host" | "checker" | "finance";

interface TicketType {
  id: string;
  name: string;
  kind: TicketKind;
  priceCents: number;
  quantityTotal: number;
  quantitySold: number;
  salesStartAt: string | null;
  salesEndAt: string | null;
  maxPerOrder: number;
  isActive: boolean;
}

interface EventStaff {
  id: string;
  memberId: string;
  staffRole: EventStaffRole;
}

interface ManagedEvent {
  id: string;
  slug: string;
  title: string;
  summary: string;
  imageUrl: string | null;
  location: string;
  startAt: string;
  endAt: string | null;
  timezone: string;
  communityProjectKey: string;
  status: EventStatus;
  capacity: number | null;
  ticketTypes: TicketType[];
  staff: EventStaff[];
}

interface MemberOption {
  id: string;
  name: string;
  githubHandle: string;
}

// ── Hub: eventos externos, ownership e ativações ────────────────────────────

interface ExternalActivationItem {
  id: string;
  eventKey: string;
  features: string[];
  communityProjectKey: string;
  title?: string;
}

interface OwnershipEntry {
  memberId: string;
  githubHandle: string;
  scope: string[];
}

interface OrganizersStaticFile {
  version: number;
  ownerships: OwnershipEntry[];
}

/** Linha da lista unificada do hub (interno gerenciável ou externo do snapshot). */
type HubRow =
  | {
      kind: "internal";
      key: string;
      title: string;
      startAt: string;
      hasOverride: boolean;
      canEdit: boolean;
      features: string[];
      event: ManagedEvent;
    }
  | {
      kind: "external";
      key: string;
      title: string;
      startAt: string;
      hasOverride: boolean;
      canEdit: boolean;
      features: string[];
      communityProjectKey?: string;
      ownerHandle?: string;
      event: EventSummary;
    };

type SnapshotResult = { prUrl: string; prNumber: number | null } | "skipped";

// ── Constantes ───────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<EventStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  canceled: "Cancelado",
  completed: "Concluído",
};

const STATUS_COLOR: Record<EventStatus, "default" | "success" | "error" | "info"> = {
  draft: "default",
  published: "success",
  canceled: "error",
  completed: "info",
};

const KIND_LABEL: Record<TicketKind, string> = {
  free: "Gratuito",
  paid: "Pago",
  community: "Comunitário",
  company: "Empresa",
};

const STAFF_ROLE_LABEL: Record<EventStaffRole, string> = {
  host: "Anfitrião",
  checker: "Credenciador",
  finance: "Financeiro",
};

const FEATURE_LABEL: Record<string, string> = {
  checkin: "Check-in",
  certificates: "Certificados",
  payments: "Pagamentos",
};

/** URL estática do ownership de organizers (GitHub-as-DB). */
const ORGANIZERS_URL = "/events/organizers.json";

const PAGE_SIZE = 10;

const COMMUNITY_OPTIONS = [
  { id: "codaqui", name: "Codaqui (geral)" },
  ...communities.map((c) => ({ id: c.id, name: c.name })),
];

/** URL pública de detalhe de um evento próprio (fonte internal:codaqui). */
const publicEventUrl = (eventId: string): string =>
  `/eventos/detalhe?source=internal&sourceId=codaqui&id=${eventId}`;

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatBRLFromCents = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDateTimeLocal(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

const DATETIME_LOCAL_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function isValidDateTimeLocal(value: string): boolean {
  if (!value) return false;
  if (!DATETIME_LOCAL_REGEX.test(value)) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

interface EventValidationResult {
  error?: string;
  payload?: Record<string, unknown>;
}

function buildEventPayload(form: EventForm): EventValidationResult {
  if (!form.slug.trim() || !form.title.trim() || !form.summary.trim() || !form.location.trim()) {
    return { error: "Preencha slug, título, resumo e local." };
  }
  if (!isValidDateTimeLocal(form.startAt)) {
    return { error: "Informe uma data/hora de início válida (incluindo horas e minutos)." };
  }
  const startIso = fromDateTimeLocal(form.startAt);
  if (!startIso) {
    return { error: "Data/hora de início inválida." };
  }
  const payload: Record<string, unknown> = {
    slug: form.slug.trim(),
    title: form.title.trim(),
    summary: form.summary.trim(),
    location: form.location.trim(),
    startAt: startIso,
    communityProjectKey: form.communityProjectKey,
  };
  if (form.imageUrl.trim()) payload.imageUrl = form.imageUrl.trim();
  if (form.endAt && !isValidDateTimeLocal(form.endAt)) {
    return { error: "Data/hora de término inválida. Deixe em branco ou informe data e hora completas." };
  }
  const endIso = fromDateTimeLocal(form.endAt);
  if (endIso) payload.endAt = endIso;
  if (form.timezone.trim()) payload.timezone = form.timezone.trim();
  if (form.capacity.trim()) {
    const cap = Number.parseInt(form.capacity, 10);
    if (Number.isNaN(cap) || cap <= 0) {
      return { error: "Capacidade inválida." };
    }
    payload.capacity = cap;
  }
  return { payload };
}

// ── Formulários ──────────────────────────────────────────────────────────────

interface EventForm {
  slug: string;
  title: string;
  summary: string;
  imageUrl: string;
  location: string;
  startAt: string;
  endAt: string;
  timezone: string;
  communityProjectKey: string;
  capacity: string;
}

const EMPTY_EVENT_FORM: EventForm = {
  slug: "",
  title: "",
  summary: "",
  imageUrl: "",
  location: "",
  startAt: "",
  endAt: "",
  timezone: "America/Sao_Paulo",
  communityProjectKey: "codaqui",
  capacity: "",
};

interface TicketForm {
  name: string;
  kind: TicketKind;
  price: string;
  quantityTotal: string;
  salesStartAt: string;
  salesEndAt: string;
  maxPerOrder: string;
}

const EMPTY_TICKET_FORM: TicketForm = {
  name: "",
  kind: "free",
  price: "",
  quantityTotal: "",
  salesStartAt: "",
  salesEndAt: "",
  maxPerOrder: "1",
};

// ── Sub-componentes do hub ───────────────────────────────────────────────────

interface HubAlertsProps {
  snapshotResult: SnapshotResult | null;
  snapshotError: string;
  publishSuccess: ManagedEvent | null;
  saveSuccess: { event: ManagedEvent; mode: "create" | "edit" } | null;
  onCloseSnapshotError: () => void;
  onCloseSnapshotResult: () => void;
  onClosePublishSuccess: () => void;
  onCloseSaveSuccess: () => void;
}

function HubAlerts({
  snapshotResult,
  snapshotError,
  publishSuccess,
  saveSuccess,
  onCloseSnapshotError,
  onCloseSnapshotResult,
  onClosePublishSuccess,
  onCloseSaveSuccess,
}: HubAlertsProps): React.JSX.Element {
  return (
    <>
      {snapshotError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={onCloseSnapshotError}>
          {snapshotError}
        </Alert>
      )}
      {snapshotResult === "skipped" && (
        <Alert severity="info" sx={{ mb: 3 }} onClose={onCloseSnapshotResult}>
          Nada a sincronizar — o snapshot de eventos próprios já está atualizado.
        </Alert>
      )}
      {snapshotResult && snapshotResult !== "skipped" && (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          onClose={onCloseSnapshotResult}
          action={
            <Button
              color="inherit"
              size="small"
              endIcon={<OpenInNewIcon />}
              href={snapshotResult.prUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {snapshotResult.prNumber ? `PR #${snapshotResult.prNumber}` : "Abrir PR"}
            </Button>
          }
        >
          Snapshot enviado via Pull Request — o merge é automático e a página de eventos leva
          alguns minutos para rebuildar.
        </Alert>
      )}
      {publishSuccess && (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          onClose={onClosePublishSuccess}
          action={
            <Button
              component={Link}
              href={publicEventUrl(publishSuccess.id)}
              target="_blank"
              rel="noopener noreferrer"
              color="inherit"
              size="small"
              endIcon={<OpenInNewIcon />}
            >
              Ver página pública
            </Button>
          }
        >
          Evento <strong>{publishSuccess.title}</strong> publicado com sucesso.
        </Alert>
      )}
      {saveSuccess && (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          onClose={onCloseSaveSuccess}
          action={
            <Button
              component={Link}
              href={publicEventUrl(saveSuccess.event.id)}
              target="_blank"
              rel="noopener noreferrer"
              color="inherit"
              size="small"
              endIcon={<OpenInNewIcon />}
            >
              Ver página do evento
            </Button>
          }
        >
          Evento <strong>{saveSuccess.event.title}</strong>{" "}
          {saveSuccess.mode === "create" ? "criado" : "atualizado"} com sucesso.
        </Alert>
      )}
    </>
  );
}

interface HubFiltersProps {
  search: string;
  showInternos: boolean;
  showExternos: boolean;
  onlyOverride: boolean;
  onlyEditable: boolean;
  onlyFeatures: boolean;
  communityFilter: string;
  onSearchChange: (value: string) => void;
  onToggleInternos: () => void;
  onToggleExternos: () => void;
  onToggleOverride: () => void;
  onToggleEditable: () => void;
  onToggleFeatures: () => void;
  onCommunityChange: (value: string) => void;
}

function HubFilters({
  search,
  showInternos,
  showExternos,
  onlyOverride,
  onlyEditable,
  onlyFeatures,
  communityFilter,
  onSearchChange,
  onToggleInternos,
  onToggleExternos,
  onToggleOverride,
  onToggleEditable,
  onToggleFeatures,
  onCommunityChange,
}: HubFiltersProps): React.JSX.Element {
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent sx={{ pb: "16px !important" }}>
        <TextField
          size="small"
          fullWidth
          label="Buscar por título"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          sx={{ mb: 1.5 }}
        />
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <Chip
            label="Internos"
            clickable
            color={showInternos ? "primary" : "default"}
            variant={showInternos ? "filled" : "outlined"}
            onClick={onToggleInternos}
          />
          <Chip
            label="Externos"
            clickable
            color={showExternos ? "primary" : "default"}
            variant={showExternos ? "filled" : "outlined"}
            onClick={onToggleExternos}
          />
          <Chip
            label="Com override"
            clickable
            color={onlyOverride ? "primary" : "default"}
            variant={onlyOverride ? "filled" : "outlined"}
            onClick={onToggleOverride}
          />
          <Chip
            label="Posso editar"
            clickable
            color={onlyEditable ? "primary" : "default"}
            variant={onlyEditable ? "filled" : "outlined"}
            onClick={onToggleEditable}
          />
          <Chip
            label="Com features ativas"
            clickable
            color={onlyFeatures ? "primary" : "default"}
            variant={onlyFeatures ? "filled" : "outlined"}
            onClick={onToggleFeatures}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="community-filter-label">Comunidade</InputLabel>
            <Select
              labelId="community-filter-label"
              value={communityFilter}
              label="Comunidade"
              onChange={(e) => onCommunityChange(e.target.value)}
            >
              <MenuItem value="">Todas</MenuItem>
              {COMMUNITY_OPTIONS.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </CardContent>
    </Card>
  );
}

interface ExternalEventCardProps {
  row: HubRow & { kind: "external" };
  sourceLabel: (sourceKey: string) => string;
  onOrdersClick: (eventKey: string, title: string) => void;
}

function ExternalEventCard({ row, sourceLabel, onOrdersClick }: ExternalEventCardProps): React.JSX.Element {
  const ev = row.event;
  const eventKey = `${ev.sourceKey}:${ev.id}`;
  const overrideQuery = `sourceKey=${encodeURIComponent(ev.sourceKey)}&eventId=${encodeURIComponent(ev.id)}`;
  const checkinEventParam = encodeURIComponent(`external:${eventKey}`);

  return (
    <Card variant="outlined" sx={{ mb: 1 }}>
      <CardContent sx={{ pb: "16px !important" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Typography fontWeight={700}>{ev.title}</Typography>
          <Chip
            label={`Externo · ${sourceLabel(ev.sourceKey)}`}
            size="small"
            variant="outlined"
          />
          {row.hasOverride && (
            <Chip label="Override" size="small" color="primary" variant="outlined" />
          )}
          {row.canEdit && (
            <Chip label="Você pode editar" size="small" color="success" variant="outlined" />
          )}
          {row.features.map((f) => (
            <Chip
              key={f}
              label={FEATURE_LABEL[f] ?? f}
              size="small"
              color="secondary"
              variant="outlined"
            />
          ))}
          {row.communityProjectKey && (
            <Chip
              label={`Comunidade: ${row.communityProjectKey}`}
              size="small"
              variant="outlined"
            />
          )}
          {row.ownerHandle && (
            <Chip
              label={`Owner: @${row.ownerHandle}`}
              size="small"
              color="info"
              variant="outlined"
            />
          )}
          <Typography variant="body2" color="text.secondary">
            {formatDateTime(ev.startAt)}
            {ev.location ? ` · ${ev.location}` : ""}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon />}
            component={Link}
            href={`/admin/overrides?tab=0&${overrideQuery}`}
          >
            Editar metadados
          </Button>
          <Button
            size="small"
            variant="text"
            startIcon={<ExtensionIcon />}
            component={Link}
            href={`/admin/overrides?tab=2&${overrideQuery}`}
          >
            Plugins
          </Button>
          {row.features.includes("payments") && (
            <Button
              size="small"
              variant="text"
              startIcon={<ReceiptLongIcon />}
              onClick={() => onOrdersClick(eventKey, ev.title)}
            >
              Pedidos
            </Button>
          )}
          {row.features.includes("checkin") && (
            <Button
              size="small"
              variant="text"
              startIcon={<HowToRegIcon />}
              component={Link}
              href={`/admin/eventos-checkin?event=${checkinEventParam}`}
            >
              Check-in
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

interface InternalEventAccordionProps {
  row: HubRow & { kind: "internal" };
  members: MemberOption[];
  membersById: Map<string, MemberOption>;
  staffForm: Record<string, { memberId: string; staffRole: EventStaffRole }>;
  onEdit: (event: ManagedEvent) => void;
  onPublish: (event: ManagedEvent) => void;
  onCancel: (event: ManagedEvent) => void;
  onOrdersClick: (eventId: string, title: string) => void;
  onReimbursementClick: (event: ManagedEvent) => void;
  onAddTicketClick: (event: ManagedEvent) => void;
  onDeactivateTicket: (ticket: TicketType) => void;
  onAddStaff: (event: ManagedEvent) => void;
  onRemoveStaff: (event: ManagedEvent, staff: EventStaff) => void;
  onStaffMemberChange: (eventId: string, memberId: string) => void;
  onStaffRoleChange: (eventId: string, staffRole: EventStaffRole) => void;
}

function InternalEventAccordion({
  row,
  members,
  membersById,
  staffForm,
  onEdit,
  onPublish,
  onCancel,
  onOrdersClick,
  onReimbursementClick,
  onAddTicketClick,
  onDeactivateTicket,
  onAddStaff,
  onRemoveStaff,
  onStaffMemberChange,
  onStaffRoleChange,
}: InternalEventAccordionProps): React.JSX.Element {
  const event = row.event;
  return (
    <Accordion sx={{ mb: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", width: "100%" }}>
          <Typography fontWeight={700}>{event.title}</Typography>
          <Chip label="Interno" size="small" color="primary" variant="outlined" />
          <Chip label={STATUS_LABEL[event.status]} size="small" color={STATUS_COLOR[event.status]} variant="outlined" />
          <Chip label="Você pode editar" size="small" color="success" variant="outlined" />
          <Typography variant="body2" color="text.secondary">
            {formatDateTime(event.startAt)} · {event.location}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {event.summary}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <Chip label={`Comunidade: ${event.communityProjectKey}`} size="small" variant="outlined" />
          {event.capacity != null && (
            <Chip label={`Capacidade: ${event.capacity}`} size="small" variant="outlined" />
          )}
          <Chip label={`/${event.slug}`} size="small" variant="outlined" />
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          {(event.status === "draft" || event.status === "published") && (
            <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => onEdit(event)}>
              Editar
            </Button>
          )}
          {event.status === "draft" && (
            <Button size="small" variant="contained" color="success" startIcon={<PublishIcon />} onClick={() => onPublish(event)}>
              Publicar
            </Button>
          )}
          <Tooltip
            title={
              event.status === "draft"
                ? "Rascunhos não aparecem na página pública — publique o evento primeiro"
                : ""
            }
          >
            <span>
              <Button
                size="small"
                variant="text"
                component={Link}
                href={publicEventUrl(event.id)}
                target="_blank"
                rel="noopener noreferrer"
                endIcon={<OpenInNewIcon />}
              >
                Ver página pública
              </Button>
            </span>
          </Tooltip>
          {(event.status === "draft" || event.status === "published") && (
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<CancelIcon />}
              onClick={() => onCancel(event)}
            >
              Cancelar evento
            </Button>
          )}
          <Button
            size="small"
            variant="text"
            startIcon={<ReceiptLongIcon />}
            onClick={() => onOrdersClick(event.id, event.title)}
          >
            Pedidos
          </Button>
          <Button
            size="small"
            variant="text"
            startIcon={<AddIcon />}
            onClick={() => onReimbursementClick(event)}
          >
            Lançar despesa
          </Button>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* ── Tipos de ingresso ── */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            Tipos de ingresso ({event.ticketTypes?.length ?? 0})
          </Typography>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => onAddTicketClick(event)}
          >
            Adicionar tipo
          </Button>
        </Box>
        {(event.ticketTypes ?? []).length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Nenhum tipo de ingresso cadastrado.
          </Typography>
        ) : (
          <Stack spacing={1} sx={{ mb: 2 }}>
            {event.ticketTypes.map((ticket) => (
              <Box
                key={ticket.id}
                sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1 }}
              >
                <Typography variant="body2" fontWeight={600}>{ticket.name}</Typography>
                <Chip label={KIND_LABEL[ticket.kind]} size="small" variant="outlined" />
                {ticket.priceCents > 0 && (
                  <Chip label={formatBRLFromCents(ticket.priceCents)} size="small" color="success" variant="outlined" />
                )}
                <Chip label={`Vendidos: ${ticket.quantitySold ?? 0}/${ticket.quantityTotal}`} size="small" variant="outlined" />
                {!ticket.isActive && <Chip label="Inativo" size="small" color="default" />}
                <Box sx={{ flex: 1 }} />
                {ticket.isActive && (
                  <Tooltip title="Desativar tipo de ingresso">
                    <IconButton size="small" aria-label={`desativar ${ticket.name}`} onClick={() => onDeactivateTicket(ticket)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            ))}
          </Stack>
        )}

        <Divider sx={{ my: 2 }} />

        {/* ── Staff ── */}
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
          Equipe do evento ({event.staff?.length ?? 0})
        </Typography>
        {(event.staff ?? []).length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Nenhum membro na equipe deste evento.
          </Typography>
        ) : (
          <Stack spacing={1} sx={{ mb: 2 }}>
            {event.staff.map((staff) => {
              const member = membersById.get(staff.memberId);
              return (
                <Box
                  key={staff.id}
                  sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1 }}
                >
                  <Typography variant="body2" fontWeight={600}>
                    {member ? `${member.name} (@${member.githubHandle})` : staff.memberId}
                  </Typography>
                  <Chip label={STAFF_ROLE_LABEL[staff.staffRole]} size="small" color="secondary" variant="outlined" />
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title="Remover da equipe">
                    <IconButton size="small" aria-label="remover staff" onClick={() => onRemoveStaff(event, staff)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              );
            })}
          </Stack>
        )}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id={`staff-member-label-${event.id}`}>Membro</InputLabel>
            <Select
              labelId={`staff-member-label-${event.id}`}
              label="Membro"
              value={staffForm[event.id]?.memberId ?? ""}
              onChange={(e) => onStaffMemberChange(event.id, e.target.value)}
            >
              {members.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.name} (@{m.githubHandle})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id={`staff-role-label-${event.id}`}>Papel</InputLabel>
            <Select
              labelId={`staff-role-label-${event.id}`}
              label="Papel"
              value={staffForm[event.id]?.staffRole ?? "checker"}
              onChange={(e) => onStaffRoleChange(event.id, e.target.value as EventStaffRole)}
            >
              {(Object.keys(STAFF_ROLE_LABEL) as EventStaffRole[]).map((role) => (
                <MenuItem key={role} value={role}>
                  {STAFF_ROLE_LABEL[role]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            disabled={!staffForm[event.id]?.memberId}
            onClick={() => onAddStaff(event)}
          >
            Adicionar
          </Button>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────

export default function AdminEventosPage(): React.JSX.Element {
  const { ready, isLoggedIn, isAdmin, isEventOrganizer, user, authFetch } = useAuth();
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";
  const history = useHistory();

  const canAccess = isAdmin || isEventOrganizer;

  const [events, setEvents] = useState<ManagedEvent[]>([]);
  const [internalTotal, setInternalTotal] = useState(0);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [publishSuccess, setPublishSuccess] = useState<ManagedEvent | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<{ event: ManagedEvent; mode: "create" | "edit" } | null>(null);

  // Dialog de criação/edição de evento
  const [eventDialog, setEventDialog] = useState<{ mode: "create" } | { mode: "edit"; event: ManagedEvent } | null>(null);
  const [eventForm, setEventForm] = useState<EventForm>(EMPTY_EVENT_FORM);
  const [eventSaving, setEventSaving] = useState(false);
  const [eventError, setEventError] = useState("");

  // Cancelamento de evento
  const [cancelTarget, setCancelTarget] = useState<ManagedEvent | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState("");

  // Dialog de tipo de ingresso
  const [ticketDialog, setTicketDialog] = useState<ManagedEvent | null>(null);
  const [ticketForm, setTicketForm] = useState<TicketForm>(EMPTY_TICKET_FORM);
  const [ticketSaving, setTicketSaving] = useState(false);
  const [ticketError, setTicketError] = useState("");

  // Adição de staff (por evento)
  const [staffForm, setStaffForm] = useState<Record<string, { memberId: string; staffRole: EventStaffRole }>>({});

  // Hub: eventos externos (snapshot estático), ownership e ativações de features
  const [externalEvents, setExternalEvents] = useState<EventSummary[]>([]);
  const [externalSources, setExternalSources] = useState<EventIndexFile["sources"]>([]);
  const [externalLoading, setExternalLoading] = useState(true);
  const [externalError, setExternalError] = useState("");
  const [organizers, setOrganizers] = useState<OrganizersStaticFile | null>(null);
  const [activations, setActivations] = useState<ExternalActivationItem[]>([]);

  // Busca, filtros e paginação da lista unificada
  const [search, setSearch] = useState("");
  const [showInternos, setShowInternos] = useState(false);
  const [showExternos, setShowExternos] = useState(false);
  const [onlyOverride, setOnlyOverride] = useState(false);
  const [onlyEditable, setOnlyEditable] = useState(false);
  const [onlyFeatures, setOnlyFeatures] = useState(false);
  const [communityFilter, setCommunityFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  // Snapshot manual de internal:codaqui (via PR auto-mergeado)
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState("");
  const [snapshotResult, setSnapshotResult] = useState<SnapshotResult | null>(null);

  // Dialog de pedidos de ingressos
  const [ordersDialog, setOrdersDialog] = useState<
    | { kind: "internal"; eventId: string; title: string }
    | { kind: "external"; eventKey: string; title: string }
    | null
  >(null);

  // Dialog de lançamento de despesa vinculada ao evento
  const [reimbursementDialog, setReimbursementDialog] = useState<{
    eventId: string;
    title: string;
    communityProjectKey: string;
  } | null>(null);

  const membersById = useMemo(() => {
    const map = new Map<string, MemberOption>();
    for (const m of members) map.set(m.id, m);
    return map;
  }, [members]);

  const useBackendPagination = showInternos && !showExternos;

  const fetchEvents = useCallback(async (pageNum = page) => {
    setLoading(true);
    setLoadError("");
    const url = useBackendPagination
      ? `${apiUrl}/events?page=${pageNum}&limit=${PAGE_SIZE}`
      : `${apiUrl}/events`;
    const res = await authFetch(url);
    if (useBackendPagination) {
      const data = await parseAuthJson<{ events: ManagedEvent[]; total: number; page: number; limit: number }>(res, setLoadError);
      if (data) {
        setEvents(data.events);
        setInternalTotal(data.total);
      }
    } else {
      const data = await parseAuthJson<ManagedEvent[]>(res, setLoadError);
      if (data) setEvents(data);
      setInternalTotal(0);
    }
    setLoading(false);
  }, [apiUrl, authFetch, useBackendPagination, page]);

  // Membros para seleção de staff — mesmo endpoint usado em /admin.
  // Falha silenciosa: event_organizer pode não ter acesso; nesse caso o
  // select de staff fica vazio e o ID é exibido cru.
  const fetchMembers = useCallback(async () => {
    try {
      const res = await authFetch(`${apiUrl}/admin/members`);
      if (res.ok) {
        const data = (await res.json()) as MemberOption[];
        setMembers(Array.isArray(data) ? data : []);
      }
    } catch {
      /* sem acesso à lista de membros — staff ainda pode ser removido */
    }
  }, [apiUrl, authFetch]);

  // Snapshot estático de eventos (mesma fonte da página pública /eventos),
  // já mesclado com os overrides via "front API" — o filtro "Com override"
  // usa o dado mesclado (não a flag potencialmente desatualizada do index).
  // Exclui internal para não duplicar os eventos próprios já vindos do backend.
  const fetchExternalData = useCallback(async () => {
    setExternalLoading(true);
    try {
      const data = await fetchEventsIndexMerged();
      setExternalEvents((data.events ?? []).filter((e) => e.source !== "internal"));
      setExternalSources((data.sources ?? []).filter((s) => s.source !== "internal"));
    } catch {
      setExternalError("Não foi possível carregar os eventos externos (snapshot estático).");
    } finally {
      setExternalLoading(false);
    }
  }, []);

  // Ownership de organizers (estático, público) — base do badge "Você pode editar".
  const fetchOrganizers = useCallback(async () => {
    try {
      const res = await fetch(ORGANIZERS_URL);
      if (!res.ok) return;
      setOrganizers((await res.json()) as OrganizersStaticFile);
    } catch {
      /* ownership indisponível — badge "Você pode editar" fica oculto */
    }
  }, []);

  // Ativações de features em eventos externos (admin: todas; demais: próprias + ownership).
  const fetchActivations = useCallback(async () => {
    try {
      const res = await authFetch(`${apiUrl}/events/external/activations`);
      if (!res.ok) return;
      const data = (await res.json()) as ExternalActivationItem[];
      setActivations(Array.isArray(data) ? data : []);
    } catch {
      /* features externas são um plus do hub — falha não bloqueia a lista */
    }
  }, [apiUrl, authFetch]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn) {
      history.replace("/");
      return;
    }
    if (canAccess) {
      fetchEvents();
      fetchMembers();
      fetchExternalData();
      fetchOrganizers();
      fetchActivations();
    }
  }, [ready, isLoggedIn, canAccess, history, fetchEvents, fetchMembers, fetchExternalData, fetchOrganizers, fetchActivations]);

  // Volta para a primeira página ao mudar busca/filtros.
  useEffect(() => {
    setPage(1);
  }, [search, showInternos, showExternos, onlyOverride, onlyEditable, onlyFeatures, communityFilter]);

  // Em modo "apenas internos", recarrega a página atual do backend.
  useEffect(() => {
    if (!canAccess || !useBackendPagination) return;
    fetchEvents(page);
  }, [page, useBackendPagination, canAccess, fetchEvents]);

  // ── Handlers: evento ──────────────────────────────────────────────────────

  const openCreateDialog = () => {
    setEventForm(EMPTY_EVENT_FORM);
    setEventError("");
    setEventDialog({ mode: "create" });
  };

  const openEditDialog = (event: ManagedEvent) => {
    setEventForm({
      slug: event.slug,
      title: event.title,
      summary: event.summary,
      imageUrl: event.imageUrl ?? "",
      location: event.location,
      startAt: toDateTimeLocal(event.startAt),
      endAt: toDateTimeLocal(event.endAt),
      timezone: event.timezone || "America/Sao_Paulo",
      communityProjectKey: event.communityProjectKey,
      capacity: event.capacity != null ? String(event.capacity) : "",
    });
    setEventError("");
    setEventDialog({ mode: "edit", event });
  };

  const handleSaveEvent = async () => {
    if (!eventDialog) return;
    setEventError("");
    const validation = buildEventPayload(eventForm);
    if (validation.error || !validation.payload) {
      setEventError(validation.error ?? "Erro de validação.");
      return;
    }

    setEventSaving(true);
    try {
      const isEdit = eventDialog.mode === "edit";
      const res = await authFetch(
        isEdit ? `${apiUrl}/events/${eventDialog.event.id}` : `${apiUrl}/events`,
        { method: isEdit ? "PATCH" : "POST", body: JSON.stringify(validation.payload) },
      );
      if (!res.ok) {
        setEventError(await extractErrorMessage(res, "Erro ao salvar evento."));
        return;
      }
      const saved = (await res.json()) as ManagedEvent;
      setEventDialog(null);
      setSaveSuccess({ event: saved, mode: isEdit ? "edit" : "create" });
      fetchEvents();
    } catch {
      setEventError("Erro inesperado.");
    } finally {
      setEventSaving(false);
    }
  };

  const handlePublish = async (event: ManagedEvent) => {
    setActionError("");
    setPublishSuccess(null);
    try {
      const res = await authFetch(`${apiUrl}/events/${event.id}/publish`, { method: "POST" });
      if (!res.ok) {
        setActionError(await extractErrorMessage(res, "Erro ao publicar evento."));
        return;
      }
      setPublishSuccess(event);
      fetchEvents();
    } catch {
      setActionError("Erro inesperado ao publicar.");
    }
  };

  const handleCancelEvent = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    setCancelError("");
    try {
      const res = await authFetch(`${apiUrl}/events/${cancelTarget.id}/cancel`, { method: "POST" });
      if (!res.ok) {
        setCancelError(await extractErrorMessage(res, "Erro ao cancelar evento."));
        return;
      }
      setCancelTarget(null);
      fetchEvents();
    } catch {
      setCancelError("Erro inesperado.");
    } finally {
      setCancelLoading(false);
    }
  };

  // ── Handlers: tipos de ingresso ───────────────────────────────────────────

  const handleCreateTicketType = async () => {
    if (!ticketDialog) return;
    setTicketError("");
    if (!ticketForm.name.trim()) {
      setTicketError("Informe o nome do tipo de ingresso.");
      return;
    }
    const quantityTotal = Number.parseInt(ticketForm.quantityTotal, 10);
    if (Number.isNaN(quantityTotal) || quantityTotal <= 0) {
      setTicketError("Informe a quantidade total (maior que zero).");
      return;
    }
    let priceCents = 0;
    if (ticketForm.price.trim()) {
      const price = Number.parseFloat(ticketForm.price.replace(",", "."));
      if (Number.isNaN(price) || price < 0) {
        setTicketError("Preço inválido.");
        return;
      }
      priceCents = Math.round(price * 100);
    }
    const payload: Record<string, unknown> = {
      name: ticketForm.name.trim(),
      kind: ticketForm.kind,
      priceCents,
      quantityTotal,
    };
    const salesStart = fromDateTimeLocal(ticketForm.salesStartAt);
    if (salesStart) payload.salesStartAt = salesStart;
    const salesEnd = fromDateTimeLocal(ticketForm.salesEndAt);
    if (salesEnd) payload.salesEndAt = salesEnd;
    const maxPerOrder = Number.parseInt(ticketForm.maxPerOrder, 10);
    if (Number.isNaN(maxPerOrder) || maxPerOrder < 1 || maxPerOrder > 10) {
      setTicketError("Máximo por pedido deve ser entre 1 e 10.");
      return;
    }
    payload.maxPerOrder = maxPerOrder;

    setTicketSaving(true);
    try {
      const res = await authFetch(`${apiUrl}/events/${ticketDialog.id}/ticket-types`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setTicketError(await extractErrorMessage(res, "Erro ao criar tipo de ingresso."));
        return;
      }
      setTicketDialog(null);
      fetchEvents();
    } catch {
      setTicketError("Erro inesperado.");
    } finally {
      setTicketSaving(false);
    }
  };

  const handleDeactivateTicketType = async (ticket: TicketType) => {
    setActionError("");
    try {
      const res = await authFetch(`${apiUrl}/events/ticket-types/${ticket.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      });
      if (!res.ok) {
        setActionError(await extractErrorMessage(res, "Erro ao desativar tipo de ingresso."));
        return;
      }
      fetchEvents();
    } catch {
      setActionError("Erro inesperado ao desativar tipo de ingresso.");
    }
  };

  // ── Handlers: staff ───────────────────────────────────────────────────────

  const handleAddStaff = async (event: ManagedEvent) => {
    const form = staffForm[event.id];
    if (!form?.memberId) return;
    setActionError("");
    try {
      const res = await authFetch(`${apiUrl}/events/${event.id}/staff`, {
        method: "POST",
        body: JSON.stringify({ memberId: form.memberId, staffRole: form.staffRole }),
      });
      if (!res.ok) {
        setActionError(await extractErrorMessage(res, "Erro ao adicionar staff."));
        return;
      }
      setStaffForm((prev) => ({ ...prev, [event.id]: { memberId: "", staffRole: "checker" } }));
      fetchEvents();
    } catch {
      setActionError("Erro inesperado ao adicionar staff.");
    }
  };

  const handleRemoveStaff = async (event: ManagedEvent, staff: EventStaff) => {
    setActionError("");
    try {
      const res = await authFetch(`${apiUrl}/events/${event.id}/staff/${staff.id}`, { method: "DELETE" });
      if (!res.ok) {
        setActionError(await extractErrorMessage(res, "Erro ao remover staff."));
        return;
      }
      fetchEvents();
    } catch {
      setActionError("Erro inesperado ao remover staff.");
    }
  };

  // ── Hub: dados derivados ──────────────────────────────────────────────────

  const featuresByEventKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of activations) map.set(a.eventKey, a.features ?? []);
    return map;
  }, [activations]);

  const activationByEventKey = useMemo(() => {
    const map = new Map<string, ExternalActivationItem>();
    for (const a of activations) map.set(a.eventKey, a);
    return map;
  }, [activations]);

  // Owner declarado no organizers.json para um evento específico (primeiro match).
  const ownerByEventKey = useMemo(() => {
    const map = new Map<string, string>();
    if (!organizers) return map;
    for (const o of organizers.ownerships) {
      for (const scope of o.scope) {
        if (map.has(scope)) continue;
        map.set(scope, o.githubHandle);
      }
    }
    return map;
  }, [organizers]);

  // Escopos do usuário logado no organizers.json (match por memberId ou handle).
  const myScopes = useMemo(() => {
    if (!organizers || !user) return [] as string[];
    const handle = (user.handle ?? "").toLowerCase();
    return organizers.ownerships
      .filter((o) => o.memberId === user.sub || o.githubHandle.toLowerCase() === handle)
      .flatMap((o) => o.scope);
  }, [organizers, user]);

  const canEditExternal = useCallback(
    (ev: EventSummary) =>
      isAdmin ||
      myScopes.includes(`${ev.sourceKey}:${ev.id}`) ||
      myScopes.includes(`${ev.sourceKey}:*`),
    [isAdmin, myScopes]
  );

  const sourceLabel = useCallback(
    (sourceKey: string) => {
      const s = externalSources.find((x) => x.sourceKey === sourceKey);
      return s ? `${s.emoji} ${s.label}` : sourceKey;
    },
    [externalSources]
  );

  const rows = useMemo<HubRow[]>(() => {
    const internalRows: HubRow[] = events.map((event) => ({
      kind: "internal",
      key: `internal:${event.id}`,
      title: event.title,
      startAt: event.startAt,
      hasOverride: false,
      canEdit: true,
      features: [],
      event,
    }));
    const externalRows: HubRow[] = externalEvents.map((event) => {
      const eventKey = `${event.sourceKey}:${event.id}`;
      const activation = activationByEventKey.get(eventKey);
      return {
        kind: "external",
        key: `external:${eventKey}`,
        title: event.title,
        startAt: event.startAt,
        hasOverride: !!event.hasOverride,
        canEdit: canEditExternal(event),
        features: featuresByEventKey.get(eventKey) ?? [],
        communityProjectKey: activation?.communityProjectKey,
        ownerHandle: ownerByEventKey.get(eventKey),
        event,
      };
    });
    // Mais recentes primeiro (data desc).
    return [...internalRows, ...externalRows].sort((a, b) => b.startAt.localeCompare(a.startAt));
  }, [events, externalEvents, canEditExternal, featuresByEventKey]);

  function matchesFilters(row: HubRow): boolean {
    const q = search.trim().toLowerCase();
    if (q && !row.title.toLowerCase().includes(q)) return false;
    if (showInternos && !showExternos && row.kind !== "internal") return false;
    if (showExternos && !showInternos && row.kind !== "external") return false;
    if (onlyOverride && !row.hasOverride) return false;
    if (onlyEditable && !row.canEdit) return false;
    if (onlyFeatures && row.features.length === 0) return false;
    if (communityFilter) {
      const rowCommunity =
        row.kind === "internal" ? row.event.communityProjectKey : row.communityProjectKey;
      if (rowCommunity !== communityFilter) return false;
    }
    return true;
  }

  const filteredRows = useMemo(() => rows.filter(matchesFilters), [rows, search, showInternos, showExternos, onlyOverride, onlyEditable, onlyFeatures, communityFilter]);

  const pageCount = useBackendPagination
    ? Math.max(1, Math.ceil(internalTotal / PAGE_SIZE))
    : Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = useBackendPagination
    ? filteredRows
    : filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ── Handler: snapshot manual de internal:codaqui ──────────────────────────

  const handleSnapshot = async () => {
    setSnapshotLoading(true);
    setSnapshotError("");
    setSnapshotResult(null);
    try {
      const res = await authFetch(`${apiUrl}/events/internal/snapshot`, { method: "POST" });
      if (!res.ok) {
        setSnapshotError(await extractErrorMessage(res, "Erro ao sincronizar o snapshot."));
        return;
      }
      const data = (await res.json()) as { skipped?: boolean; prUrl?: string; prNumber?: number };
      if (!data.skipped && data.prUrl) {
        setSnapshotResult({ prUrl: data.prUrl, prNumber: data.prNumber ?? null });
      } else {
        setSnapshotResult("skipped");
      }
    } catch {
      setSnapshotError("Erro inesperado ao sincronizar o snapshot.");
    } finally {
      setSnapshotLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!ready || !isLoggedIn) {
    return (
      <Layout title="Admin — Eventos">
        <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  if (!canAccess) {
    return (
      <Layout title="Admin — Eventos" description="Gestão de eventos próprios da Codaqui">
        <AdminPageContainer>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            Eventos
          </Typography>
          <AdminNavbar active="/admin/eventos" />
          <Alert severity="warning">
            Acesso restrito a administradores e organizadores de eventos.
          </Alert>
        </AdminPageContainer>
      </Layout>
    );
  }

  return (
    <Layout title="Admin — Eventos" description="Gestão de eventos próprios da Codaqui">
      <AdminPageContainer>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={800}>Eventos</Typography>
            <Typography variant="body2" color="text.secondary">
              Hub do organizador: eventos próprios e externos num só lugar.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              startIcon={snapshotLoading ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
              disabled={snapshotLoading}
              onClick={handleSnapshot}
            >
              Sincronizar snapshot agora
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
              Novo evento
            </Button>
          </Stack>
        </Box>

        <AdminNavbar active="/admin/eventos" />

        {loadError && <Alert severity="error" sx={{ mb: 3 }}>{loadError}</Alert>}
        {actionError && <Alert severity="error" sx={{ mb: 3 }}>{actionError}</Alert>}
        {externalError && <Alert severity="warning" sx={{ mb: 3 }}>{externalError}</Alert>}
        <HubAlerts
          snapshotResult={snapshotResult}
          snapshotError={snapshotError}
          publishSuccess={publishSuccess}
          saveSuccess={saveSuccess}
          onCloseSnapshotError={() => setSnapshotError("")}
          onCloseSnapshotResult={() => setSnapshotResult(null)}
          onClosePublishSuccess={() => setPublishSuccess(null)}
          onCloseSaveSuccess={() => setSaveSuccess(null)}
        />

        {loading || externalLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* ── Busca e filtros da lista unificada ── */}
            <HubFilters
              search={search}
              showInternos={showInternos}
              showExternos={showExternos}
              onlyOverride={onlyOverride}
              onlyEditable={onlyEditable}
              onlyFeatures={onlyFeatures}
              communityFilter={communityFilter}
              onSearchChange={setSearch}
              onToggleInternos={() => setShowInternos((v) => !v)}
              onToggleExternos={() => setShowExternos((v) => !v)}
              onToggleOverride={() => setOnlyOverride((v) => !v)}
              onToggleEditable={() => setOnlyEditable((v) => !v)}
              onToggleFeatures={() => setOnlyFeatures((v) => !v)}
              onCommunityChange={setCommunityFilter}
            />

            <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
              Todos os eventos ({filteredRows.length})
            </Typography>

            {pageRows.length === 0 ? (
              <Alert severity="info">
                {rows.length === 0
                  ? "Nenhum evento cadastrado ainda. Crie o primeiro com o botão acima."
                  : "Nenhum evento encontrado com os filtros atuais."}
              </Alert>
            ) : (
              pageRows.map((row) =>
                row.kind === "external" ? (
                  <ExternalEventCard
                    key={row.key}
                    row={row}
                    sourceLabel={sourceLabel}
                    onOrdersClick={(eventKey, title) =>
                      setOrdersDialog({ kind: "external", eventKey, title })
                    }
                  />
                ) : (
                  <InternalEventAccordion
                    key={row.key}
                    row={row}
                    members={members}
                    membersById={membersById}
                    staffForm={staffForm}
                    onEdit={openEditDialog}
                    onPublish={handlePublish}
                    onCancel={(event) => { setCancelTarget(event); setCancelError(""); }}
                    onOrdersClick={(eventId, title) =>
                      setOrdersDialog({ kind: "internal", eventId, title })
                    }
                    onReimbursementClick={(event) =>
                      setReimbursementDialog({
                        eventId: event.id,
                        title: event.title,
                        communityProjectKey: event.communityProjectKey,
                      })
                    }
                    onAddTicketClick={(event) => {
                      setTicketForm(EMPTY_TICKET_FORM);
                      setTicketError("");
                      setTicketDialog(event);
                    }}
                    onDeactivateTicket={handleDeactivateTicketType}
                    onAddStaff={handleAddStaff}
                    onRemoveStaff={handleRemoveStaff}
                    onStaffMemberChange={(eventId, memberId) =>
                      setStaffForm((prev) => ({
                        ...prev,
                        [eventId]: {
                          memberId,
                          staffRole: prev[eventId]?.staffRole ?? "checker",
                        },
                      }))
                    }
                    onStaffRoleChange={(eventId, staffRole) =>
                      setStaffForm((prev) => ({
                        ...prev,
                        [eventId]: {
                          memberId: prev[eventId]?.memberId ?? "",
                          staffRole,
                        },
                      }))
                    }
                  />
                ),
              )
            )}

            {pageCount > 1 && (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                <Pagination
                  count={pageCount}
                  page={currentPage}
                  onChange={(_, p) => setPage(p)}
                  color="primary"
                />
              </Box>
            )}
          </>
        )}
      </AdminPageContainer>

      {/* ── Dialog: Criar / Editar evento ── */}
      <Dialog open={!!eventDialog} onClose={() => setEventDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{eventDialog?.mode === "edit" ? "Editar evento" : "Novo evento"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Slug"
              value={eventForm.slug}
              onChange={(e) => setEventForm((f) => ({ ...f, slug: e.target.value }))}
              size="small"
              fullWidth
              required
              helperText="Identificador único usado nas URLs (ex.: devpr-conf-2026)"
            />
            <TextField
              label="Título"
              value={eventForm.title}
              onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
              size="small"
              fullWidth
              required
            />
            <TextField
              label="Resumo"
              value={eventForm.summary}
              onChange={(e) => setEventForm((f) => ({ ...f, summary: e.target.value }))}
              size="small"
              fullWidth
              required
              multiline
              minRows={2}
            />
            <TextField
              label="URL da imagem (opcional)"
              value={eventForm.imageUrl}
              onChange={(e) => setEventForm((f) => ({ ...f, imageUrl: e.target.value }))}
              size="small"
              fullWidth
            />
            <TextField
              label="Local"
              value={eventForm.location}
              onChange={(e) => setEventForm((f) => ({ ...f, location: e.target.value }))}
              size="small"
              fullWidth
              required
            />
            <TextField
              label="Início"
              type="datetime-local"
              value={eventForm.startAt}
              onChange={(e) => setEventForm((f) => ({ ...f, startAt: e.target.value }))}
              size="small"
              fullWidth
              required
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Fim (opcional)"
              type="datetime-local"
              value={eventForm.endAt}
              onChange={(e) => setEventForm((f) => ({ ...f, endAt: e.target.value }))}
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Fuso horário"
              value={eventForm.timezone}
              onChange={(e) => setEventForm((f) => ({ ...f, timezone: e.target.value }))}
              size="small"
              fullWidth
              helperText="Padrão: America/Sao_Paulo"
            />
            <FormControl size="small" fullWidth>
              <InputLabel id="event-community-label">Comunidade</InputLabel>
              <Select
                labelId="event-community-label"
                label="Comunidade"
                value={eventForm.communityProjectKey}
                onChange={(e) => setEventForm((f) => ({ ...f, communityProjectKey: e.target.value }))}
              >
                {COMMUNITY_OPTIONS.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Capacidade (opcional)"
              value={eventForm.capacity}
              onChange={(e) => setEventForm((f) => ({ ...f, capacity: e.target.value }))}
              size="small"
              fullWidth
              inputMode="numeric"
            />
            {eventError && <Alert severity="error">{eventError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEventDialog(null)} disabled={eventSaving}>
            Voltar
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEvent}
            disabled={eventSaving}
            startIcon={eventSaving ? <CircularProgress size={14} /> : undefined}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Modal: Cancelar evento ── */}
      <ModalConfirm
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title={`Cancelar "${cancelTarget?.title}"?`}
        description="O evento será marcado como cancelado e deixará de aceitar inscrições. Esta ação é registrada em auditoria."
        variant="error"
        confirmLabel="Cancelar evento"
        loading={cancelLoading}
        error={cancelError}
        onConfirm={handleCancelEvent}
      />

      {/* ── Dialog: Novo tipo de ingresso ── */}
      <Dialog open={!!ticketDialog} onClose={() => setTicketDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Novo tipo de ingresso — {ticketDialog?.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nome"
              value={ticketForm.name}
              onChange={(e) => setTicketForm((f) => ({ ...f, name: e.target.value }))}
              size="small"
              fullWidth
              required
              helperText='Ex.: "Lote 1 — Early bird", "Comunitário"'
            />
            <FormControl size="small" fullWidth>
              <InputLabel id="ticket-kind-label">Tipo</InputLabel>
              <Select
                labelId="ticket-kind-label"
                label="Tipo"
                value={ticketForm.kind}
                onChange={(e) => setTicketForm((f) => ({ ...f, kind: e.target.value as TicketKind }))}
              >
                {(Object.keys(KIND_LABEL) as TicketKind[]).map((kind) => (
                  <MenuItem key={kind} value={kind}>
                    {KIND_LABEL[kind]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Preço (R$)"
              value={ticketForm.price}
              onChange={(e) => setTicketForm((f) => ({ ...f, price: e.target.value }))}
              size="small"
              fullWidth
              inputMode="decimal"
              helperText="Deixe em branco ou 0 para gratuito"
              disabled={ticketForm.kind === "free"}
            />
            <TextField
              label="Quantidade total"
              value={ticketForm.quantityTotal}
              onChange={(e) => setTicketForm((f) => ({ ...f, quantityTotal: e.target.value }))}
              size="small"
              fullWidth
              required
              inputMode="numeric"
            />
            <TextField
              label="Início das vendas (opcional)"
              type="datetime-local"
              value={ticketForm.salesStartAt}
              onChange={(e) => setTicketForm((f) => ({ ...f, salesStartAt: e.target.value }))}
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Fim das vendas (opcional)"
              type="datetime-local"
              value={ticketForm.salesEndAt}
              onChange={(e) => setTicketForm((f) => ({ ...f, salesEndAt: e.target.value }))}
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Máx. por pedido (opcional)"
              value={ticketForm.maxPerOrder}
              onChange={(e) => setTicketForm((f) => ({ ...f, maxPerOrder: e.target.value }))}
              size="small"
              fullWidth
              inputMode="numeric"
              helperText="Padrão do backend: 4"
            />
            {ticketError && <Alert severity="error">{ticketError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTicketDialog(null)} disabled={ticketSaving}>
            Voltar
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateTicketType}
            disabled={ticketSaving}
            startIcon={ticketSaving ? <CircularProgress size={14} /> : undefined}
          >
            Criar
          </Button>
        </DialogActions>
      </Dialog>

      <EventOrdersDialog
        open={!!ordersDialog}
        onClose={() => setOrdersDialog(null)}
        eventId={ordersDialog?.kind === "internal" ? ordersDialog.eventId : undefined}
        eventKey={ordersDialog?.kind === "external" ? ordersDialog.eventKey : undefined}
        eventTitle={ordersDialog?.title ?? ""}
        apiUrl={apiUrl}
      />

      <EventReimbursementDialog
        open={!!reimbursementDialog}
        onClose={() => setReimbursementDialog(null)}
        apiUrl={apiUrl}
        authFetch={authFetch}
        title={reimbursementDialog?.title ?? ""}
        eventId={reimbursementDialog?.eventId}
        communityProjectKey={reimbursementDialog?.communityProjectKey}
      />
    </Layout>
  );
}

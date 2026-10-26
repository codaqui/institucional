/**
 * Accordion de um evento INTERNO (gerenciável) na lista unificada do hub —
 * ações de editar/publicar/cancelar, tipos de ingresso (com recalcular vagas)
 * e equipe do evento. Port de `src/pages/admin/eventos.tsx` (Docusaurus) —
 * `Link` virou `<a>`; `formatBRLFromCents` → `formatBRL(cents/100)` da lib.
 */

import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PublishIcon from "@mui/icons-material/Publish";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SyncIcon from "@mui/icons-material/Sync";
import { formatBRL } from "../../../../lib/transaction";
import {
  KIND_LABEL,
  publicEventUrl,
  STAFF_ROLE_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
  formatDateTime,
  type EventStaff,
  type EventStaffRole,
  type HubRow,
  type ManagedEvent,
  type MemberOption,
  type ReconcileQuotaState,
  type TicketType,
} from "./types";

interface InternalEventAccordionProps {
  row: HubRow & { kind: "internal" };
  members: MemberOption[];
  membersById: Map<string, MemberOption>;
  staffForm: Record<string, { memberId: string; staffRole: EventStaffRole }>;
  canReimburse: boolean;
  onEdit: (event: ManagedEvent) => void;
  onPublish: (event: ManagedEvent) => void;
  onCancel: (event: ManagedEvent) => void;
  onOrdersClick: (eventId: string, title: string) => void;
  onReimbursementClick: (event: ManagedEvent) => void;
  onAddTicketClick: (event: ManagedEvent) => void;
  onEditTicket: (event: ManagedEvent, ticket: TicketType) => void;
  onDeactivateTicket: (ticket: TicketType) => void;
  onAddStaff: (event: ManagedEvent) => void;
  onRemoveStaff: (event: ManagedEvent, staff: EventStaff) => void;
  onReconcileQuota: (event: ManagedEvent) => void;
  reconcileLoadingId: string | null;
  reconcileResult: ReconcileQuotaState | null;
  onDismissReconcileResult: () => void;
  publishingId: string | null;
  staffAddingId: string | null;
  staffRemovingId: string | null;
  onStaffMemberChange: (eventId: string, memberId: string) => void;
  onStaffRoleChange: (eventId: string, staffRole: EventStaffRole) => void;
}

export default function InternalEventAccordion({
  row,
  members,
  membersById,
  staffForm,
  canReimburse,
  onEdit,
  onPublish,
  onCancel,
  onOrdersClick,
  onReimbursementClick,
  onAddTicketClick,
  onEditTicket,
  onDeactivateTicket,
  onAddStaff,
  onRemoveStaff,
  onReconcileQuota,
  reconcileLoadingId,
  reconcileResult,
  onDismissReconcileResult,
  publishingId,
  staffAddingId,
  staffRemovingId,
  onStaffMemberChange,
  onStaffRoleChange,
}: Readonly<InternalEventAccordionProps>): React.JSX.Element {
  const event = row.event;
  return (
    <Accordion sx={{ mb: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flexWrap: "wrap",
            width: "100%",
          }}
        >
          <Typography sx={{ fontWeight: 700 }}>{event.title}</Typography>
          <Chip label="Interno" size="small" color="primary" variant="outlined" />
          <Chip
            label={STATUS_LABEL[event.status]}
            size="small"
            color={STATUS_COLOR[event.status]}
            variant="outlined"
          />
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
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 2 }}>
          <Chip
            label={`Comunidade: ${event.communityProjectKey}`}
            size="small"
            variant="outlined"
          />
          {event.capacity != null && (
            <Chip label={`Capacidade: ${event.capacity}`} size="small" variant="outlined" />
          )}
          <Chip label={`/${event.slug}`} size="small" variant="outlined" />
        </Stack>

        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 2 }}>
          {(event.status === "draft" || event.status === "published") && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => onEdit(event)}
            >
              Editar
            </Button>
          )}
          {event.status === "draft" && (
            <Button
              size="small"
              variant="contained"
              color="success"
              startIcon={<PublishIcon />}
              disabled={publishingId === event.id}
              onClick={() => onPublish(event)}
            >
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
                component="a"
                href={publicEventUrl(event.slug)}
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
          {canReimburse && (
            <Button
              size="small"
              variant="text"
              startIcon={<AddIcon />}
              onClick={() => onReimbursementClick(event)}
            >
              Lançar despesa
            </Button>
          )}
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* ── Tipos de ingresso ── */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 1,
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Tipos de ingresso ({event.ticketTypes?.length ?? 0})
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={
                reconcileLoadingId === event.id ? (
                  <CircularProgress size={14} />
                ) : (
                  <SyncIcon />
                )
              }
              disabled={reconcileLoadingId === event.id}
              onClick={() => onReconcileQuota(event)}
            >
              Recalcular vagas
            </Button>
            <Button size="small" startIcon={<AddIcon />} onClick={() => onAddTicketClick(event)}>
              Adicionar tipo
            </Button>
          </Stack>
        </Box>
        {reconcileResult?.eventId === event.id && (
          <Alert
            severity={reconcileResult.severity}
            sx={{ mb: 1 }}
            onClose={onDismissReconcileResult}
          >
            {reconcileResult.lines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </Alert>
        )}
        {(event.ticketTypes ?? []).length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Nenhum tipo de ingresso cadastrado.
          </Typography>
        ) : (
          <Stack spacing={1} sx={{ mb: 2 }}>
            {event.ticketTypes.map((ticket) => (
              <Box
                key={ticket.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  flexWrap: "wrap",
                  p: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {ticket.name}
                </Typography>
                <Chip label={KIND_LABEL[ticket.kind]} size="small" variant="outlined" />
                {ticket.priceCents > 0 && (
                  <Chip
                    label={formatBRL(ticket.priceCents / 100)}
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                )}
                <Chip
                  label={`Vendidos: ${ticket.quantitySold ?? 0}/${ticket.quantityTotal}`}
                  size="small"
                  variant="outlined"
                />
                {!ticket.isActive && <Chip label="Inativo" size="small" color="default" />}
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Editar tipo de ingresso">
                  <IconButton
                    size="small"
                    aria-label={`editar ${ticket.name}`}
                    onClick={() => onEditTicket(event, ticket)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {ticket.isActive && (
                  <Tooltip title="Desativar tipo de ingresso">
                    <IconButton
                      size="small"
                      aria-label={`desativar ${ticket.name}`}
                      onClick={() => onDeactivateTicket(ticket)}
                    >
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
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Equipe do evento ({event.staff?.length ?? 0})
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          Hosts são exibidos como organizadores na página pública do evento.
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
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    flexWrap: "wrap",
                    p: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {member ? `${member.name} (@${member.githubHandle})` : staff.memberId}
                  </Typography>
                  <Chip
                    label={STAFF_ROLE_LABEL[staff.staffRole]}
                    size="small"
                    color="secondary"
                    variant="outlined"
                  />
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title="Remover da equipe">
                    <IconButton
                      size="small"
                      aria-label="remover staff"
                      disabled={staffRemovingId === staff.id}
                      onClick={() => onRemoveStaff(event, staff)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              );
            })}
          </Stack>
        )}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Autocomplete
            size="small"
            sx={{ minWidth: 260, flex: 1 }}
            options={members}
            value={members.find((m) => m.id === staffForm[event.id]?.memberId) ?? null}
            onChange={(_, v) => onStaffMemberChange(event.id, v?.id ?? "")}
            getOptionLabel={(m) => `${m.name} (@${m.githubHandle})`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            noOptionsText="Nenhum membro encontrado"
            renderInput={(params) => (
              <TextField {...params} label="Membro" placeholder="Busque por nome ou @github" />
            )}
          />
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
            disabled={!staffForm[event.id]?.memberId || staffAddingId === event.id}
            onClick={() => onAddStaff(event)}
          >
            Adicionar
          </Button>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

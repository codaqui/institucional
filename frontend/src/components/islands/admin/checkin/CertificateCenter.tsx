import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PaginationControls from "../../ui/PaginationControls";
import { CHECKIN_PAGE_SIZE, rangeLabel } from "../../../../lib/pagination";
import type { CertificateFilter, CertificateInviteBatch, CertificateInviteBatchProgress, EventRegistration } from "./types";
import { formatDateTime } from "./checkin-utils";
import { useCertificateInviteProgress } from "./useCertificateInviteProgress";

interface CertificateCenterProps {
  readonly registrations: EventRegistration[];
  readonly onGrant: (registrationId: string) => Promise<EventRegistration>;
  readonly onInvite: (registrationIds: string[]) => Promise<CertificateInviteBatch>;
  readonly onLoadBatch: (batchId: string) => Promise<CertificateInviteBatchProgress>;
  readonly onRefresh: () => Promise<void>;
  readonly filter: CertificateFilter;
  readonly onFilterChange: (filter: CertificateFilter) => void;
  readonly page: number;
  readonly total: number;
  readonly totalPages: number;
  readonly onPageChange: (page: number) => void;
}


type Feedback = {
  severity: "success" | "error" | "warning" | "info";
  messages: string[];
};

const participantName = (registration: EventRegistration) =>
  registration.attendeeName ?? registration.member?.name ?? registration.attendeeEmail;

const isRegistrationPending = (registration: EventRegistration) =>
  registration.status === "pending_match" || registration.status === "pending_guest";

const canGrant = (registration: EventRegistration) =>
  registration.status === "confirmed" || isRegistrationPending(registration);

const canInvite = (registration: EventRegistration) =>
  isRegistrationPending(registration) && !registration.certificateInvitedAt;

function inviteSeverity(batch: CertificateInviteBatch): Feedback["severity"] {
  if (batch.invalid.length > 0) return "warning";
  return batch.total > 0 ? "success" : "info";
}

function inviteMessage(batch: CertificateInviteBatch): string {
  if (batch.total === 0) return "Nenhum convite novo foi enfileirado.";
  const label = batch.total === 1 ? "convite enfileirado" : "convites enfileirados";
  return `${batch.total} ${label}. O envio acontecerá em segundo plano.`;
}

export default function CertificateCenter({
  registrations,
  onGrant,
  onInvite,
  onLoadBatch,
  onRefresh,
  filter,
  onFilterChange,
  page,
  total,
  totalPages,
  onPageChange,
}: Readonly<CertificateCenterProps>): React.JSX.Element {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeBatch, setActiveBatch] = useState<{ id: string; total: number } | null>(null);
  const { progress, error: progressError, refresh: refreshProgress } = useCertificateInviteProgress(
    activeBatch?.id ?? null,
    activeBatch?.total ?? 0,
    onLoadBatch,
    onRefresh,
  );

  useEffect(() => {
    setSelected(new Set());
  }, [registrations]);

  const filtered = useMemo(
    () =>
      registrations.filter((registration) => {
        if (filter === "eligible") {
          return canGrant(registration) && !registration.certificateGrantedAt;
        }
        if (filter === "granted") return !!registration.certificateGrantedAt;
        if (filter === "registration_pending") return isRegistrationPending(registration);
        return true;
      }),
    [filter, registrations],
  );
  const invitable = filtered.filter(canInvite);
  const allSelected = invitable.length > 0 && invitable.every((item) => selected.has(item.id));

  const toggleAll = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allSelected) invitable.forEach((item) => next.delete(item.id));
      else invitable.forEach((item) => next.add(item.id));
      return next;
    });
  };

  const toggleOne = (registrationId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(registrationId)) next.delete(registrationId);
      else next.add(registrationId);
      return next;
    });
  };

  const grant = async (registration: EventRegistration) => {
    const name = participantName(registration);
    setBusy(`grant-${registration.id}`);
    setFeedback(null);
    setErrors((current) => ({ ...current, [registration.id]: "" }));
    try {
      await onGrant(registration.id);
      setFeedback({ severity: "success", messages: [`Certificado concedido para ${name}.`] });
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [registration.id]: error instanceof Error ? error.message : "Erro ao conceder certificado.",
      }));
    } finally {
      setBusy("");
    }
  };

  const invite = async () => {
    const ids = registrations.filter((item) => selected.has(item.id)).map((item) => item.id);
    if (ids.length === 0) return;
    setBusy("invite");
    setFeedback(null);
    try {
      const batch = await onInvite(ids);
      const hasNewInvites = batch.total > 0;
      setActiveBatch(hasNewInvites ? { id: batch.batchId, total: batch.total } : null);
      setSelected(new Set());
      setFeedback({
        severity: inviteSeverity(batch),
        messages: [
          inviteMessage(batch),
          ...(batch.invalid.length > 0 ? [`${batch.invalid.length} inscrição(ões) não puderam ser enfileiradas.`] : []),
        ],
      });
    } catch (error) {
      setFeedback({
        severity: "error",
        messages: [error instanceof Error ? error.message : "Erro ao enfileirar convites."],
      });
    } finally {
      setBusy("");
    }
  };

  return (
    <Box>
      <Typography component="h3" variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Central de certificados
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Conceda certificados sem presença e convide participantes pendentes a concluir o cadastro.
      </Typography>

      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", mb: 2 }}>
        <TextField
          select
          size="small"
          label="Filtrar certificados"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value as CertificateFilter)}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="all">Todos</MenuItem>
          <MenuItem value="eligible">Elegíveis para concessão</MenuItem>
          <MenuItem value="granted">Certificado concedido</MenuItem>
          <MenuItem value="registration_pending">Cadastro pendente</MenuItem>
        </TextField>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Checkbox
            checked={allSelected}
            indeterminate={!allSelected && invitable.some((item) => selected.has(item.id))}
            disabled={invitable.length === 0 || busy === "invite"}
            onChange={toggleAll}
            slotProps={{ input: { "aria-label": "Selecionar todos os filtrados para convite" } }}
          />
          <Typography variant="body2">Selecionar convidáveis nesta página</Typography>
        </Box>
        <Button
          variant="contained"
          disabled={selected.size === 0 || !!busy}
          onClick={() => void invite()}
          startIcon={busy === "invite" ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Enfileirar convites ({selected.size})
        </Button>
      </Box>

      {feedback && (
        <Alert severity={feedback.severity} sx={{ mb: 2 }}>
          {feedback.messages.map((message) => (
            <Typography key={message} variant="body2" component="div">
              {message}
            </Typography>
          ))}
        </Alert>
      )}

      {progress && (
        <Box sx={{ mb: 2 }} role="status" aria-live="polite">
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            {progress.completed + progress.failed + progress.skipped} de {progress.total} convites processados · {progress.failed} falhas · {progress.retry} aguardando retry
          </Typography>
          <Box
            component="progress"
            aria-label="Progresso dos convites"
            max={Math.max(1, progress.total)}
            value={progress.completed + progress.failed + progress.skipped}
            sx={{ width: "100%", accentColor: "primary.main" }}
          />
          {progressError && (
            <Alert severity="error" sx={{ mt: 1 }} action={<Button color="inherit" size="small" onClick={() => void refreshProgress()}>Tentar novamente</Button>}>
              {progressError}
            </Alert>
          )}
        </Box>
      )}

      {filtered.length === 0 ? (
        <Alert severity="info">Nenhuma inscrição encontrada neste filtro.</Alert>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            gap: 1.5,
          }}
        >
          {filtered.map((registration) => {
            const name = participantName(registration);
            return (
              <Card key={registration.id} variant="outlined">
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                    <Checkbox
                      checked={selected.has(registration.id)}
                      disabled={!canInvite(registration) || !!busy}
                      onChange={() => toggleOne(registration.id)}
                      slotProps={{
                        input: { "aria-label": `Selecionar ${name} para convite` },
                      }}
                      sx={{ ml: -1, mt: -1 }}
                    />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
                        {name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                        {registration.attendeeEmail}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", my: 1.5 }}>
                    {registration.checkedInAt && (
                      <Chip size="small" color="success" variant="outlined" label="Presente" />
                    )}
                    {registration.certificateGrantedAt && (
                      <Chip
                        size="small"
                        color="success"
                        variant="outlined"
                        label={`Certificado concedido · ${formatDateTime(registration.certificateGrantedAt)}`}
                      />
                    )}
                    {registration.certificateInvitedAt && (
                      <Chip size="small" color="info" variant="outlined" label="Convite enviado" />
                    )}
                    {isRegistrationPending(registration) && (
                      <Chip size="small" color="warning" variant="outlined" label="Cadastro pendente" />
                    )}
                  </Box>

                  {!registration.certificateGrantedAt && canGrant(registration) && (
                    <Button
                      size="small"
                      variant="outlined"
                      aria-label={`Conceder certificado para ${name}`}
                      disabled={!!busy}
                      onClick={() => void grant(registration)}
                      startIcon={
                        busy === `grant-${registration.id}` ? (
                          <CircularProgress size={16} color="inherit" />
                        ) : undefined
                      }
                    >
                      Conceder certificado
                    </Button>
                  )}
                  {errors[registration.id] && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      {errors[registration.id]}
                    </Alert>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}
      {total > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 2 }}>
          {rangeLabel(page, CHECKIN_PAGE_SIZE, total)}
        </Typography>
      )}
      <PaginationControls page={page} totalPages={totalPages} onChange={onPageChange} itemLabel="certificados" />
    </Box>
  );
}

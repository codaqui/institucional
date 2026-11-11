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

function participantCertificateState(registration: EventRegistration): string {
  if (isRegistrationPending(registration)) {
    if (registration.certificateInvitedAt) return "Convite aguardando aceite";
    if (registration.certificateGrantedAt) return "Concedido aguardando cadastro";
    return "Cadastro pendente sem concessão";
  }
  if (registration.certificateGrantedAt) return "Certificado concedido";
  if (canGrant(registration)) return "Elegível para concessão";
  return "Não elegível";
}

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
  const [activeBatch, setActiveBatch] = useState<{ id: string; total: number } | null>(() => {
    const batchId = new URLSearchParams(window.location.search).get("batch");
    return batchId ? { id: batchId, total: 0 } : null;
  });
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

  const trackBatch = (batch: CertificateInviteBatch) => {
    const hasNewInvites = batch.total > 0;
    setActiveBatch(hasNewInvites ? { id: batch.batchId, total: batch.total } : null);
    const next = new URL(window.location.href);
    if (hasNewInvites) next.searchParams.set("batch", batch.batchId);
    else next.searchParams.delete("batch");
    window.history.replaceState({}, "", next.toString());
    setSelected(new Set());
    setFeedback({
      severity: inviteSeverity(batch),
      messages: [
        inviteMessage(batch),
        ...(batch.invalid.length > 0 ? [`${batch.invalid.length} inscrição(ões) não puderam ser enfileiradas.`] : []),
      ],
    });
  };

  const invite = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBusy("invite");
    setFeedback(null);
    try {
      trackBatch(await onInvite(ids));
    } catch (error) {
      setFeedback({
        severity: "error",
        messages: [error instanceof Error ? error.message : "Erro ao enfileirar convites."],
      });
    } finally {
      setBusy("");
    }
  };

  const grantThenInvite = async (registration: EventRegistration) => {
    setBusy(`grant-invite-${registration.id}`);
    setFeedback(null);
    setErrors((current) => ({ ...current, [registration.id]: "" }));
    try {
      await onGrant(registration.id);
      trackBatch(await onInvite([registration.id]));
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [registration.id]: error instanceof Error
          ? error.message
          : "Não foi possível conceder e depois convidar. Nenhuma outra ação foi tentada.",
      }));
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
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
        A seleção manual vale para esta página; falhas de um lote só entram quando você as seleciona
        explicitamente para um novo envio.
      </Typography>

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
        <Box sx={{ mb: 2 }}>
          <Box role="status" aria-live="polite">
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              {progress.completed + progress.failed + progress.skipped} de {progress.total} convites processados
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              {progress.completed} enviados · {progress.retry} aguardando retry · {progress.failed} falhas · {progress.skipped} ignorados por SMTP ausente
            </Typography>
            <Box
              component="progress"
              aria-label="Progresso dos convites"
              max={Math.max(1, progress.total)}
              value={progress.completed + progress.failed + progress.skipped}
              sx={{ width: "100%", accentColor: "primary.main" }}
            />
          </Box>
          {progressError && (
            <Alert severity="error" sx={{ mt: 1 }} action={<Button color="inherit" size="small" onClick={() => void refreshProgress()}>Tentar novamente</Button>}>
              {progressError}
            </Alert>
          )}
          {progress.items.length > 0 && (
            <Box component="details" sx={{ mt: 1 }}>
              <summary>Detalhes técnicos do lote</summary>
              <Box component="ul" sx={{ pl: 2.5 }}>
                {progress.items.map((item) => (
                  <li key={item.registrationId}>
                    <Typography variant="caption">
                      Inscrição {item.registrationId}: {item.status}, {item.attempts} tentativa(s)
                      {item.lastError ? ` — ${item.lastError}` : ""}
                    </Typography>
                  </li>
                ))}
              </Box>
            </Box>
          )}
          {progress.items.some((item) => item.status === "failed") && (
            <Button
              size="small"
              variant="outlined"
              sx={{ mt: 1 }}
              onClick={() => {
                const failedIds = progress.items
                  .filter((item) => item.status === "failed")
                  .map((item) => item.registrationId);
                setSelected(new Set(failedIds));
                setFeedback({
                  severity: "info",
                  messages: [`${failedIds.length} falha(s) selecionada(s). Revise antes de enfileirar um novo lote.`],
                });
              }}
            >
              Selecionar falhas para um novo lote ({progress.items.filter((item) => item.status === "failed").length})
            </Button>
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
                    <Chip
                      size="small"
                      color={registration.certificateGrantedAt
                        ? "success"
                        : registration.certificateInvitedAt
                          ? "info"
                          : isRegistrationPending(registration)
                            ? "warning"
                            : "default"}
                      variant="outlined"
                      label={participantCertificateState(registration)}
                    />
                  </Box>
                  {registration.certificateGrantedAt && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                      Concedido em {formatDateTime(registration.certificateGrantedAt)}
                    </Typography>
                  )}
                  {isRegistrationPending(registration) && !registration.certificateGrantedAt && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      O convite vincula a participação, não o certificado. Conceda primeiro quando essa
                      for a decisão da organização.
                    </Typography>
                  )}

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
                  {isRegistrationPending(registration) &&
                    !registration.certificateGrantedAt &&
                    !registration.certificateInvitedAt && (
                      <Button
                        size="small"
                        variant="contained"
                        aria-label={`Conceder e depois convidar para ${name}`}
                        disabled={!!busy}
                        onClick={() => void grantThenInvite(registration)}
                        sx={{ ml: 1 }}
                      >
                        {busy === `grant-invite-${registration.id}`
                          ? "Concedendo e convidando…"
                          : "Conceder e depois convidar"}
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

import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import SearchIcon from "@mui/icons-material/Search";
import PaginationControls from "../../ui/PaginationControls";
import { CHECKIN_PAGE_SIZE, rangeLabel } from "../../../../lib/pagination";
import type { EventRegistration } from "./types";
import { formatDateTime, formatOrderStatus } from "./checkin-utils";

export interface BatchCheckinResult {
  token: string;
  status: "checked_in" | "already_checked_in" | "invalid";
}

type ParticipantFilter = "all" | "pending" | "present" | "registration_pending";

const participantName = (registration: EventRegistration) =>
  registration.attendeeName ?? registration.member?.name ?? registration.attendeeEmail;

const isRegistrationPending = (registration: EventRegistration) =>
  registration.status === "pending_match" || registration.status === "pending_guest";

const canCheckin = (registration: EventRegistration) =>
  registration.status === "confirmed" && !registration.checkedInAt;

function CheckinAction({
  registration,
  enabled,
  loading,
  onCheckin,
}: {
  readonly registration: EventRegistration;
  readonly enabled: boolean;
  readonly loading: boolean;
  readonly onCheckin: (token: string) => void;
}): React.JSX.Element | null {
  if (registration.checkedInAt) {
    return (
      <Chip
        icon={<CheckCircleIcon />}
        label={`Presente · ${formatDateTime(registration.checkedInAt)}`}
        color="success"
        size="small"
        variant="outlined"
      />
    );
  }
  if (isRegistrationPending(registration)) {
    return <Chip label="Cadastro pendente" color="warning" size="small" variant="outlined" />;
  }
  if (!enabled) return null;
  return (
    <Button
      size="small"
      variant="outlined"
      disabled={loading}
      onClick={() => onCheckin(registration.checkinToken)}
    >
      Confirmar presença
    </Button>
  );
}

interface ManualSearchProps {
  readonly registrations: EventRegistration[];
  readonly regsLoading: boolean;
  readonly searchQuery: string;
  readonly checkinLoading: boolean;
  readonly canCheckinFeature: boolean;
  readonly page: number;
  readonly total: number;
  readonly totalPages: number;
  readonly onSearchQueryChange: (query: string) => void;
  readonly onSearch: () => void;
  readonly onPageChange: (page: number) => void;
  readonly onCheckin: (token: string) => void;
  readonly onBatchCheckin: (tokens: string[]) => Promise<BatchCheckinResult[]>;
}

export default function ManualSearch({
  registrations,
  regsLoading,
  searchQuery,
  checkinLoading,
  canCheckinFeature,
  page,
  total,
  totalPages,
  onSearchQueryChange,
  onSearch,
  onPageChange,
  onCheckin,
  onBatchCheckin,
}: Readonly<ManualSearchProps>): React.JSX.Element {
  const [filter, setFilter] = useState<ParticipantFilter>("all");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchFeedback, setBatchFeedback] = useState<{
    severity: "success" | "warning" | "error";
    messages: string[];
  } | null>(null);

  const filtered = useMemo(
    () =>
      registrations.filter((registration) => {
        if (filter === "pending") return canCheckin(registration);
        if (filter === "present") return !!registration.checkedInAt;
        if (filter === "registration_pending") return isRegistrationPending(registration);
        return true;
      }),
    [filter, registrations],
  );
  const eligible = canCheckinFeature ? filtered.filter(canCheckin) : [];
  const allSelected = eligible.length > 0 && eligible.every((item) => selected.has(item.id));

  const toggleAll = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allSelected) eligible.forEach((item) => next.delete(item.id));
      else eligible.forEach((item) => next.add(item.id));
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

  const runBatch = async () => {
    const chosen = registrations.filter((item) => selected.has(item.id) && canCheckin(item));
    if (chosen.length === 0) return;
    setBatchLoading(true);
    setBatchFeedback(null);
    try {
      const results = await onBatchCheckin(chosen.map((item) => item.checkinToken));
      const confirmed = results.filter((item) => item.status === "checked_in").length;
      const already = results.filter((item) => item.status === "already_checked_in").length;
      const invalid = results.filter((item) => item.status === "invalid");
      const messages: string[] = [];
      if (confirmed) messages.push(`${confirmed} ${confirmed === 1 ? "presença confirmada" : "presenças confirmadas"}.`);
      if (already) messages.push(`${already} ${already === 1 ? "presença já estava confirmada" : "presenças já estavam confirmadas"}.`);
      if (invalid.length) {
        const names = invalid
          .map((item) => chosen.find((registration) => registration.checkinToken === item.token))
          .map((item) => (item ? participantName(item) : "Participante"))
          .join(", ");
        messages.push(`${invalid.length} ${invalid.length === 1 ? "inscrição inválida" : "inscrições inválidas"}: ${names}.`);
      }
      setBatchFeedback({ severity: invalid.length ? "warning" : "success", messages });
      setSelected(new Set());
    } catch (error) {
      setBatchFeedback({
        severity: "error",
        messages: [error instanceof Error ? error.message : "Erro ao confirmar presenças."],
      });
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <PersonSearchIcon color="primary" />
        <Typography component="h3" variant="h6" sx={{ fontWeight: 700 }}>
          Participantes
        </Typography>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          gap: 1,
          mb: 2,
        }}
      >
        <TextField
          fullWidth
          size="small"
          label="Nome ou e-mail"
          value={searchQuery}
          onChange={(event) => {
            setSelected(new Set());
            onSearchQueryChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSearch();
          }}
        />
        <IconButton aria-label="Buscar participante" onClick={onSearch} disabled={regsLoading}>
          <SearchIcon />
        </IconButton>
      </Box>

      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 2 }}>
        <TextField
          select
          size="small"
          label="Filtrar participantes"
          value={filter}
          onChange={(event) => setFilter(event.target.value as ParticipantFilter)}
          sx={{ minWidth: 210 }}
        >
          <MenuItem value="all">Todos</MenuItem>
          <MenuItem value="pending">Presença pendente</MenuItem>
          <MenuItem value="present">Presentes</MenuItem>
          <MenuItem value="registration_pending">Cadastro pendente</MenuItem>
        </TextField>
        {canCheckinFeature && (
          <>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Checkbox
                checked={allSelected}
                indeterminate={!allSelected && eligible.some((item) => selected.has(item.id))}
                disabled={eligible.length === 0 || batchLoading}
                onChange={toggleAll}
                slotProps={{ input: { "aria-label": "Selecionar todos os filtrados para check-in" } }}
              />
              <Typography variant="body2">Selecionar elegíveis nesta página</Typography>
            </Box>
            <Button
              variant="contained"
              disabled={selected.size === 0 || batchLoading || checkinLoading}
              onClick={() => void runBatch()}
              startIcon={batchLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              Confirmar presença ({selected.size})
            </Button>
          </>
        )}
      </Box>

      {batchFeedback && (
        <Alert severity={batchFeedback.severity} sx={{ mb: 2 }}>
          {batchFeedback.messages.map((message) => (
            <Typography key={message} variant="body2" component="div">
              {message}
            </Typography>
          ))}
        </Alert>
      )}

      {regsLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      )}
      {!regsLoading && filtered.length === 0 && (
        <Alert severity="info">Nenhuma inscrição encontrada neste filtro.</Alert>
      )}
      {!regsLoading && filtered.length > 0 && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            gap: 1.5,
          }}
        >
          {filtered.map((reg) => {
            const name = participantName(reg);
            return (
              <Card key={reg.id} variant="outlined">
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                    {canCheckinFeature && (
                      <Checkbox
                        checked={selected.has(reg.id)}
                        disabled={!canCheckin(reg) || batchLoading}
                        onChange={() => toggleOne(reg.id)}
                        slotProps={{ input: { "aria-label": `Selecionar ${name} para check-in` } }}
                        sx={{ ml: -1, mt: -1 }}
                      />
                    )}
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
                        {name}
                        {reg.payer && reg.payer.id !== reg.member?.id && (
                          <Typography
                            component="span"
                            variant="caption"
                            color="primary.main"
                            sx={{ ml: 1 }}
                          >
                            (comprado por {reg.payer.name ?? reg.payer.githubHandle}
                            {reg.payer.githubHandle ? ` @${reg.payer.githubHandle}` : ""})
                          </Typography>
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        {reg.attendeeEmail}
                        {reg.member?.githubHandle ? ` · @${reg.member.githubHandle}` : ""}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        {reg.ticketType?.name ?? "Ingresso"}
                        {reg.order &&
                          ` · ${formatOrderStatus(reg.order.status)}${
                            reg.order.paidAt ? ` · ${formatDateTime(reg.order.paidAt)}` : ""
                          }`}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 1.5 }}>
                    {reg.isGuest && <Chip label="Convidado" size="small" variant="outlined" />}
                    <CheckinAction
                      registration={reg}
                      enabled={canCheckinFeature}
                      loading={checkinLoading || batchLoading}
                      onCheckin={onCheckin}
                    />
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}
      {total > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", my: 2 }}>
          {rangeLabel(page, CHECKIN_PAGE_SIZE, total)}
        </Typography>
      )}
      <PaginationControls
        page={page}
        totalPages={totalPages}
        onChange={(nextPage) => {
          setSelected(new Set());
          onPageChange(nextPage);
        }}
        itemLabel="participantes"
      />
    </Box>
  );
}

/**
 * Port da aba 3 (`ActivationTab`) de `src/pages/admin/overrides.tsx`
 * (Docusaurus) — ativação de features (check-in, certificados, pagamentos) em
 * evento externo, com importação CSV de participantes e gestão de ingressos.
 *
 * Desvio do original: links internos usam <a> nativo (não há @docusaurus/Link
 * no Astro).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SyncIcon from "@mui/icons-material/Sync";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { parseAuthJson, extractErrorMessage } from "../../../../lib/auth-fetch-helpers";
import { fromDateTimeLocal, toDateTimeLocal } from "../../../../lib/datetime";
import { parseBrlInput } from "../../../../lib/transaction";
import { communities } from "../../../../data/communities";
import EventOrdersDialog from "../events/EventOrdersDialog";
import EventReimbursementDialog from "../events/EventReimbursementDialog";
import ExternalEventAutocomplete from "./ExternalEventAutocomplete";
import {
  externalApiUrl,
  formatDateTime,
  type EventSummary,
  type ExternalActivation,
  type ExternalParticipant,
  type ImportReport,
  type TabCommonProps,
} from "./shared";

const EXTERNAL_PREFIX = "external:";

type TicketKind = "free" | "paid" | "community" | "company";

const KIND_LABEL: Record<TicketKind, string> = {
  free: "Gratuito",
  paid: "Pago",
  community: "Comunitário",
  company: "Empresa",
};

interface ExternalTicketType {
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
  kind: "paid",
  price: "",
  quantityTotal: "",
  salesStartAt: "",
  salesEndAt: "",
  maxPerOrder: "",
};

const formatBRLFromCents = (cents: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const FEATURE_OPTIONS = [
  {
    key: "checkin",
    label: "Check-in",
    description: "Check-in por QR code no dia do evento; participantes vêm do CSV importado.",
  },
  {
    key: "certificates",
    label: "Certificados",
    description:
      "Emissão sob demanda no perfil do membro. Exige check-in (presença confirmada) e match com conta no site.",
  },
  {
    key: "payments",
    label: "Pagamentos",
    description:
      "A Codaqui vende os ingressos do evento externo pelo próprio Stripe; a receita vai para a conta da comunidade.",
  },
] as const;

interface ActivationTabProps extends TabCommonProps {
  /** Só para os dialogs de pedidos/reembolso (a interface deles exige apiUrl). */
  readonly apiUrl: string;
}

export default function ActivationTab({
  apiUrl,
  authFetch,
  events,
  sourceLabel,
  initialSelected,
  canReimburse,
}: ActivationTabProps): JSX.Element {
  const [selected, setSelected] = useState<EventSummary | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(false);
  const [activation, setActivation] = useState<ExternalActivation | null>(null);
  const [features, setFeatures] = useState<string[]>([]);
  const [communityProjectKey, setCommunityProjectKey] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const [participants, setParticipants] = useState<ExternalParticipant[]>([]);
  const [participantsError, setParticipantsError] = useState("");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importError, setImportError] = useState("");
  const [rematching, setRematching] = useState(false);
  const [rematchResult, setRematchResult] = useState<{ rematched: number; stillUnmatched: number } | null>(null);

  // Ingressos do evento externo (feature payments)
  const [ticketTypes, setTicketTypes] = useState<ExternalTicketType[]>([]);
  const [ticketsError, setTicketsError] = useState("");
  const [ticketDialog, setTicketDialog] = useState(false);
  const [ticketForm, setTicketForm] = useState<TicketForm>(EMPTY_TICKET_FORM);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [ticketSaving, setTicketSaving] = useState(false);
  const [ticketError, setTicketError] = useState("");
  const [ordersDialogOpen, setOrdersDialogOpen] = useState(false);
  const [reimbursementDialogOpen, setReimbursementDialogOpen] = useState(false);

  const eventKey = selected ? `${selected.sourceKey}:${selected.id}` : null;
  const initialApplied = useRef(false);

  const fetchParticipants = useCallback(
    async (key: string) => {
      setParticipantsError("");
      try {
        const res = await authFetch(`${externalApiUrl(key)}/participants`);
        const data = await parseAuthJson<ExternalParticipant[]>(res, setParticipantsError);
        if (data) setParticipants(Array.isArray(data) ? data : []);
      } catch {
        setParticipantsError("Erro inesperado ao carregar participantes.");
      }
    },
    [authFetch],
  );

  // Ingressos (feature payments) — endpoint de gestão (owner/admin).
  // 404 = evento sem feature payments → lista vazia, seção escondida.
  const fetchTicketTypes = useCallback(
    async (key: string) => {
      setTicketsError("");
      try {
        const res = await authFetch(`${externalApiUrl(key)}/ticket-types/manage`);
        if (!res.ok) {
          setTicketTypes([]);
          return;
        }
        const data = (await res.json()) as ExternalTicketType[];
        setTicketTypes(Array.isArray(data) ? data : []);
      } catch {
        setTicketsError("Erro inesperado ao carregar ingressos.");
      }
    },
    [authFetch],
  );

  const loadEvent = useCallback(
    async (key: string, fallbackTitle = "") => {
      setLoadingEvent(true);
      setError("");
      setSuccess("");
      setActivation(null);
      setFeatures([]);
      setCommunityProjectKey("");
      setTitle(fallbackTitle);
      setParticipants([]);
      setTicketTypes([]);
      setImportReport(null);
      setRematchResult(null);
      try {
        const res = await authFetch(`${externalApiUrl(key)}/activation`);
        if (res.status === 404) {
          // Evento ainda não ativado — formulário em branco.
          return;
        }
        const data = await parseAuthJson<ExternalActivation>(res, setError);
        if (!data) return;
        setActivation(data);
        setFeatures(data.features ?? []);
        setCommunityProjectKey(data.communityProjectKey ?? "");
        setTitle(data.title ?? fallbackTitle);
        fetchParticipants(key);
        if ((data.features ?? []).includes("payments")) fetchTicketTypes(key);
      } catch {
        setError("Erro inesperado ao carregar a ativação.");
      } finally {
        setLoadingEvent(false);
      }
    },
    [authFetch, fetchParticipants, fetchTicketTypes],
  );

  // Aplica a pré-seleção via query string (uma única vez, quando o evento é encontrado).
  useEffect(() => {
    if (initialApplied.current || !initialSelected) return;
    initialApplied.current = true;
    setSelected(initialSelected);
    void loadEvent(`${initialSelected.sourceKey}:${initialSelected.id}`, initialSelected.title);
  }, [initialSelected, loadEvent]);

  const toggleFeature = (key: string, enabled: boolean) => {
    setFeatures((prev) => {
      if (enabled) {
        // certificates exige check-in: liga junto.
        const next = new Set(prev);
        next.add(key);
        if (key === "certificates") next.add("checkin");
        return [...next];
      }
      // Desligar check-in derruba certificates junto.
      return prev.filter((f) => f !== key && (key !== "checkin" || f !== "certificates"));
    });
  };

  const handleActivate = async () => {
    if (!eventKey) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await authFetch(`${externalApiUrl(eventKey)}/activate`, {
        method: "POST",
        body: JSON.stringify({
          features,
          communityProjectKey,
          title: title.trim() || undefined,
          startAt: selected?.startAt ?? activation?.startAt ?? undefined,
        }),
      });
      if (!res.ok) {
        setError(await extractErrorMessage(res, "Erro ao ativar features."));
        return;
      }
      await loadEvent(eventKey, title.trim());
      setSuccess("Ativação salva com sucesso.");
    } catch {
      setError("Erro inesperado ao ativar features.");
    } finally {
      setSaving(false);
    }
  };

  // ── Ingressos (feature payments) ─────────────────────────────────────────

  const buildTicketPayload = (includeKind: boolean): Record<string, unknown> | null => {
    if (!ticketForm.name.trim()) {
      setTicketError("Informe o nome do tipo de ingresso.");
      return null;
    }
    const quantityTotal = Number.parseInt(ticketForm.quantityTotal, 10);
    if (Number.isNaN(quantityTotal) || quantityTotal <= 0) {
      setTicketError("Informe a quantidade total (maior que zero).");
      return null;
    }
    let priceCents = 0;
    if (ticketForm.price.trim()) {
      const price = parseBrlInput(ticketForm.price);
      if (price === null) {
        setTicketError("Preço inválido.");
        return null;
      }
      priceCents = Math.round(price * 100);
    }
    const payload: Record<string, unknown> = {
      name: ticketForm.name.trim(),
      priceCents,
      quantityTotal,
    };
    if (includeKind) {
      payload.kind = ticketForm.kind;
    }
    const salesStart = fromDateTimeLocal(ticketForm.salesStartAt);
    if (salesStart) payload.salesStartAt = salesStart;
    const salesEnd = fromDateTimeLocal(ticketForm.salesEndAt);
    if (salesEnd) payload.salesEndAt = salesEnd;
    if (ticketForm.maxPerOrder.trim()) {
      const maxPerOrder = Number.parseInt(ticketForm.maxPerOrder, 10);
      if (!Number.isNaN(maxPerOrder) && maxPerOrder > 0) payload.maxPerOrder = maxPerOrder;
    }
    return payload;
  };

  const handleCreateTicketType = async () => {
    if (!eventKey) return;
    setTicketError("");
    const payload = buildTicketPayload(true);
    if (!payload) return;

    setTicketSaving(true);
    try {
      const res = await authFetch(`${externalApiUrl(eventKey)}/ticket-types`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setTicketError(await extractErrorMessage(res, "Erro ao criar tipo de ingresso."));
        return;
      }
      setTicketDialog(false);
      fetchTicketTypes(eventKey);
    } catch {
      setTicketError("Erro inesperado.");
    } finally {
      setTicketSaving(false);
    }
  };

  const handleUpdateTicketType = async () => {
    if (!eventKey || !editingTicketId) return;
    setTicketError("");
    const payload = buildTicketPayload(false);
    if (!payload) return;

    setTicketSaving(true);
    try {
      const res = await authFetch(`/events/external/ticket-types/${editingTicketId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setTicketError(await extractErrorMessage(res, "Erro ao atualizar tipo de ingresso."));
        return;
      }
      setTicketDialog(false);
      setEditingTicketId(null);
      fetchTicketTypes(eventKey);
    } catch {
      setTicketError("Erro inesperado.");
    } finally {
      setTicketSaving(false);
    }
  };

  const handleDeactivateTicketType = async (ticket: ExternalTicketType) => {
    if (!eventKey) return;
    setTicketsError("");
    try {
      const res = await authFetch(`/events/external/ticket-types/${ticket.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      });
      if (!res.ok) {
        setTicketsError(await extractErrorMessage(res, "Erro ao desativar tipo de ingresso."));
        return;
      }
      fetchTicketTypes(eventKey);
    } catch {
      setTicketsError("Erro inesperado ao desativar tipo de ingresso.");
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setCsvText(await file.text());
  };

  const handleImport = async () => {
    if (!eventKey) return;
    setImporting(true);
    setImportError("");
    setImportReport(null);
    try {
      const res = await authFetch(`${externalApiUrl(eventKey)}/participants/import`, {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: csvText,
      });
      if (!res.ok) {
        setImportError(await extractErrorMessage(res, "Erro ao importar CSV."));
        return;
      }
      setImportReport((await res.json()) as ImportReport);
      fetchParticipants(eventKey);
    } catch {
      setImportError("Erro inesperado ao importar CSV.");
    } finally {
      setImporting(false);
    }
  };

  const handleRematch = async () => {
    if (!eventKey) return;
    setRematching(true);
    setRematchResult(null);
    setImportError("");
    try {
      const res = await authFetch(`${externalApiUrl(eventKey)}/participants/rematch`, {
        method: "POST",
      });
      if (!res.ok) {
        setImportError(await extractErrorMessage(res, "Erro ao refazer o match."));
        return;
      }
      setRematchResult((await res.json()) as { rematched: number; stillUnmatched: number });
      fetchParticipants(eventKey);
    } catch {
      setImportError("Erro inesperado ao refazer o match.");
    } finally {
      setRematching(false);
    }
  };

  const statusChip = (p: ExternalParticipant) => {
    if (p.status === "pending_match") {
      return <Chip label="Pendente de match" color="warning" size="small" variant="outlined" />;
    }
    if (p.checkedInAt) {
      return <Chip label="Check-in feito" color="success" size="small" variant="outlined" />;
    }
    return <Chip label={p.status} size="small" variant="outlined" />;
  };

  return (
    <Stack spacing={3}>
      <ExternalEventAutocomplete
        events={events}
        sourceLabel={sourceLabel}
        value={selected}
        onChange={(ev) => {
          setSelected(ev);
          if (ev) loadEvent(`${ev.sourceKey}:${ev.id}`, ev.title);
        }}
      />

      {loadingEvent && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {selected && !loadingEvent && (
        <>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
                Features à la carte
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {activation
                  ? `Evento ativado (id ${activation.id}). Ajuste as features e salve para atualizar.`
                  : "Este evento externo ainda não está ativado. Ative para habilitar check-in, certificados e pagamentos."}
              </Typography>

              <Stack spacing={0.5}>
                {FEATURE_OPTIONS.map((opt) => (
                  <FormControlLabel
                    key={opt.key}
                    control={
                      <Checkbox
                        checked={features.includes(opt.key)}
                        onChange={(e) => toggleFeature(opt.key, e.target.checked)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {opt.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {opt.description}
                        </Typography>
                      </Box>
                    }
                  />
                ))}
              </Stack>

              <TextField
                label="Título do evento (opcional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                fullWidth
                sx={{ mt: 2 }}
                helperText="Pré-preenchido com o título do snapshot; usado na emissão de certificados"
              />

              <TextField
                select
                required
                label="Conta da comunidade organizadora (communityProjectKey)"
                value={communityProjectKey}
                onChange={(e) => setCommunityProjectKey(e.target.value)}
                fullWidth
                sx={{ mt: 2 }}
                helperText="Receita de pagamentos vai para esta conta no ledger"
              >
                {communities.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.emoji} {c.name} ({c.id})
                  </MenuItem>
                ))}
              </TextField>

              <Button
                variant="contained"
                sx={{ mt: 2 }}
                disabled={saving || !communityProjectKey}
                onClick={handleActivate}
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {activation ? "Atualizar ativação" : "Ativar evento"}
              </Button>
            </CardContent>
          </Card>

          {activation && (
            <>
              {/* Importação CSV */}
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
                    Participantes — importação CSV
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Formato canônico: UTF-8 com header{" "}
                    <code>name,email,ticket_type,external_id,github</code> (separador <code>;</code> ou{" "}
                    <code>,</code>; <code>ticket_type</code>, <code>external_id</code> e <code>github</code> opcionais).
                    O match com a conta no site é feito pelo e-mail; se não houver conta com esse e-mail,
                    a coluna <code>github</code> (handle, sem @) é usada como alternativa.
                    Re-upload é idempotente (dedupe por e-mail/external_id).
                  </Typography>

                  <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 2, flexWrap: "wrap" }}>
                    <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
                      Selecionar arquivo .csv{" "}
                      <input
                        hidden
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => handleFile(e.target.files?.[0])}
                      />
                    </Button>
                    {fileName && (
                      <Chip label={fileName} size="small" variant="outlined" onDelete={() => { setFileName(""); setCsvText(""); }} />
                    )}
                  </Box>

                  <TextField
                    label="Ou cole o conteúdo do CSV"
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    multiline
                    minRows={4}
                    maxRows={10}
                    fullWidth
                    slotProps={{ htmlInput: { style: { fontFamily: "monospace", fontSize: 13 } } }}
                  />

                  <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}>
                    <Button
                      variant="contained"
                      disabled={importing || !csvText.trim()}
                      onClick={handleImport}
                      startIcon={importing ? <CircularProgress size={16} color="inherit" /> : undefined}
                    >
                      Importar CSV
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={rematching ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
                      disabled={rematching}
                      onClick={handleRematch}
                    >
                      Refazer match
                    </Button>
                  </Box>

                  {importError && <Alert severity="error" sx={{ mt: 2 }}>{importError}</Alert>}

                  {importReport && (
                    <Box sx={{ mt: 2 }}>
                      <Alert severity="success" sx={{ mb: 1 }}>
                        Importação concluída: <strong>{importReport.imported}</strong> importados,{" "}
                        <strong>{importReport.matched}</strong> com conta vinculada,{" "}
                        <strong>{importReport.skippedDuplicates}</strong> duplicados ignorados.
                        {(importReport.healed ?? 0) > 0 && (
                          <>
                            {" "}<strong>{importReport.healed}</strong> pendente(s) vinculado(s)
                            agora via coluna <code>github</code>.
                          </>
                        )}
                      </Alert>
                      {importReport.unmatched.length > 0 && (
                        <Alert severity="warning" sx={{ mb: 1 }}>
                          <strong>{importReport.unmatched.length} sem conta no site</strong> — check-in
                          e certificado bloqueados até o match:
                          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                            {importReport.unmatched.map((u) => (
                              <li key={u.line}>
                                <Typography variant="caption">
                                  Linha {u.line}: {u.email}
                                </Typography>
                              </li>
                            ))}
                          </Box>
                        </Alert>
                      )}
                      {importReport.errors.length > 0 && (
                        <Alert severity="error">
                          {importReport.errors.length} linha(s) com erro:
                          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                            {importReport.errors.map((eItem) => (
                              <li key={eItem.line}>
                                <Typography variant="caption">
                                  Linha {eItem.line}: {eItem.reason}
                                </Typography>
                              </li>
                            ))}
                          </Box>
                        </Alert>
                      )}
                    </Box>
                  )}

                  {rematchResult && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      Match refeito: <strong>{rematchResult.rematched}</strong> participante(s)
                      vinculados agora; <strong>{rematchResult.stillUnmatched}</strong> ainda sem
                      conta no site.
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Lista de participantes */}
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
                    Participantes ({participants.length})
                  </Typography>
                  {participantsError && <Alert severity="error" sx={{ mb: 1 }}>{participantsError}</Alert>}
                  {participants.length === 0 && !participantsError ? (
                    <Typography color="text.secondary" variant="body2">
                      Nenhum participante importado ainda.
                    </Typography>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Nome</TableCell>
                          <TableCell>E-mail</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Check-in</TableCell>
                          <TableCell>Ingresso</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {participants.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{p.attendeeName ?? "—"}</TableCell>
                            <TableCell>{p.attendeeEmail}</TableCell>
                            <TableCell>{statusChip(p)}</TableCell>
                            <TableCell>
                              {p.checkedInAt ? formatDateTime(p.checkedInAt) : "—"}
                            </TableCell>
                            <TableCell>{p.ticketType?.name ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Ingressos (feature payments) */}
              {features.includes("payments") && (
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Ingressos ({ticketTypes.length})
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<OpenInNewIcon />}
                          onClick={() => setOrdersDialogOpen(true)}
                        >
                          Ver pedidos
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          component="a"
                          href={`/admin/eventos-checkin?event=${EXTERNAL_PREFIX}${eventKey}`}
                        >
                          Check-in
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<OpenInNewIcon />}
                          component="a"
                          href={`/transparencia?project=${encodeURIComponent(communityProjectKey)}`}
                        >
                          Caixa
                        </Button>
                        {canReimburse && (
                          <Button
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => setReimbursementDialogOpen(true)}
                          >
                            Lançar despesa
                          </Button>
                        )}
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => {
                            setTicketForm(EMPTY_TICKET_FORM);
                            setEditingTicketId(null);
                            setTicketError("");
                            setTicketDialog(true);
                          }}
                        >
                          Adicionar tipo
                        </Button>
                      </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      A Codaqui vende os ingressos deste evento externo pelo próprio Stripe.
                      A compra acontece na página pública de detalhe do evento.
                    </Typography>
                    {ticketsError && <Alert severity="error" sx={{ mb: 1 }}>{ticketsError}</Alert>}
                    {ticketTypes.length === 0 && !ticketsError ? (
                      <Typography color="text.secondary" variant="body2">
                        Nenhum tipo de ingresso cadastrado.
                      </Typography>
                    ) : (
                      <Stack spacing={1}>
                        {ticketTypes.map((ticket) => (
                          <Box
                            key={ticket.id}
                            sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1 }}
                          >
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{ticket.name}</Typography>
                            <Chip label={KIND_LABEL[ticket.kind] ?? ticket.kind} size="small" variant="outlined" />
                            {ticket.priceCents > 0 && (
                              <Chip label={formatBRLFromCents(ticket.priceCents)} size="small" color="success" variant="outlined" />
                            )}
                            <Chip label={`Vendidos: ${ticket.quantitySold ?? 0}/${ticket.quantityTotal}`} size="small" variant="outlined" />
                            {!ticket.isActive && <Chip label="Inativo" size="small" color="default" />}
                            <Chip
                              label={`Máx/pedido: ${ticket.maxPerOrder}`}
                              size="small"
                              variant="outlined"
                            />
                            {ticket.salesStartAt && (
                              <Chip
                                label={`Vendas: ${formatDateTime(ticket.salesStartAt)}`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                            {ticket.salesEndAt && (
                              <Chip
                                label={`Até: ${formatDateTime(ticket.salesEndAt)}`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                            <Box sx={{ flex: 1 }} />
                            <IconButton
                              size="small"
                              aria-label={`editar ${ticket.name}`}
                              onClick={() => {
                                setTicketForm({
                                  name: ticket.name,
                                  kind: ticket.kind,
                                  price: ticket.priceCents > 0 ? (ticket.priceCents / 100).toFixed(2) : "",
                                  quantityTotal: String(ticket.quantityTotal),
                                  salesStartAt: toDateTimeLocal(ticket.salesStartAt),
                                  salesEndAt: toDateTimeLocal(ticket.salesEndAt),
                                  maxPerOrder: String(ticket.maxPerOrder),
                                });
                                setEditingTicketId(ticket.id);
                                setTicketError("");
                                setTicketDialog(true);
                              }}
                            >
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                            {ticket.isActive && (
                              <IconButton
                                size="small"
                                aria-label={`desativar ${ticket.name}`}
                                onClick={() => handleDeactivateTicketType(ticket)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* ── Dialog: Novo tipo de ingresso (evento externo) ── */}
      <Dialog open={ticketDialog} onClose={() => setTicketDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTicketId ? "Editar tipo de ingresso" : "Novo tipo de ingresso"} — {selected?.title}
        </DialogTitle>
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
            <TextField
              select
              label="Tipo"
              value={ticketForm.kind}
              onChange={(e) => setTicketForm((f) => ({ ...f, kind: e.target.value as TicketKind }))}
              size="small"
              fullWidth
            >
              {(Object.keys(KIND_LABEL) as TicketKind[]).map((kind) => (
                <MenuItem key={kind} value={kind}>
                  {KIND_LABEL[kind]}
                </MenuItem>
              ))}
            </TextField>
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
          <Button onClick={() => setTicketDialog(false)} disabled={ticketSaving}>
            Voltar
          </Button>
          <Button
            variant="contained"
            onClick={editingTicketId ? handleUpdateTicketType : handleCreateTicketType}
            disabled={ticketSaving}
            startIcon={ticketSaving ? <CircularProgress size={14} /> : undefined}
          >
            {editingTicketId ? "Salvar" : "Criar"}
          </Button>
        </DialogActions>
      </Dialog>

      {activation && eventKey && (
        <EventOrdersDialog
          open={ordersDialogOpen}
          onClose={() => setOrdersDialogOpen(false)}
          eventKey={eventKey}
          eventTitle={selected?.title ?? eventKey}
          apiUrl={apiUrl}
          authFetch={authFetch}
        />
      )}

      {eventKey && (
        <EventReimbursementDialog
          open={reimbursementDialogOpen}
          onClose={() => setReimbursementDialogOpen(false)}
          apiUrl={apiUrl}
          authFetch={authFetch}
          title={selected?.title ?? eventKey}
          eventKey={eventKey}
          communityProjectKey={communityProjectKey}
        />
      )}
    </Stack>
  );
}

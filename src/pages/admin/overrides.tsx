import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import { useHistory } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import SyncIcon from "@mui/icons-material/Sync";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useAuth } from "../../hooks/useAuth";
import { parseAuthJson, extractErrorMessage } from "../../hooks/authFetchHelpers";
import { resolveApiUrl } from "../../lib/api-url";
import AdminNavbar from "../../components/AdminNavbar";
import EventOrdersDialog from "../../components/EventOrdersDialog";
import EventOverrideHistory from "../../components/EventOverrideHistory";
import EventReimbursementDialog from "../../components/EventReimbursementDialog";
import ModalConfirm from "../../components/ModalConfirm";
import TabPanel from "../../components/TabPanel";
import { communities } from "../../data/communities";
import {
  EVENTS_MANIFEST_URL,
  type EventIndexFile,
  type EventSourceSummary,
  type EventSummary,
} from "../../data/events";
import type { EventOverride, EventSpeaker } from "../../utils/event-override";
import {
  EMPTY_OVERRIDE_FORM,
  SCOPE_FORMAT_HINT,
  SPEAKERS_MAX,
  SUMMARY_MAX_LENGTH,
  TAGS_MAX,
  buildExtendData,
  buildSourceWildcardScope,
  computeCompleteness,
  formStateFromExtendData,
  generateSpeakerId,
  isValidScope,
  type OverrideFormState,
} from "../../utils/event-override-form";

// ─── Tipos locais ────────────────────────────────────────────────────────────

type AuthFetch = (path: string, init?: RequestInit) => Promise<Response>;

interface Ownership {
  memberId: string;
  githubHandle: string;
  scope: string[];
}

interface OrganizersFile {
  version: number;
  ownerships: Ownership[];
}

interface Member {
  id: string;
  name: string;
  githubHandle: string;
  avatarUrl: string;
  roles?: string[];
}

interface ExternalActivation {
  id: string;
  eventKey: string;
  features: string[];
  communityProjectKey: string;
  /** Título usado em certificados (eventos externos podem ter título ruim no snapshot). */
  title?: string;
  /** Data/hora de início do evento (copiada do snapshot para certificados/relatórios). */
  startAt?: string | null;
}

interface ExternalParticipant {
  id: string;
  attendeeName: string | null;
  attendeeEmail: string;
  status: string;
  checkedInAt: string | null;
  ticketType: { name: string | null } | null;
}

interface ImportReport {
  imported: number;
  matched: number;
  healed?: number;
  unmatched: { line: number; email: string }[];
  skippedDuplicates: number;
  errors: { line: number; reason: string }[];
}

interface TabCommonProps {
  readonly apiUrl: string;
  readonly authFetch: AuthFetch;
  readonly events: EventSummary[];
  readonly sourceLabel: (sourceKey: string) => string;
  /** Evento pré-selecionado via query string (?sourceKey=&eventId=) — aplicado uma vez. */
  readonly initialSelected?: EventSummary | null;
}

// ─── Helpers locais ──────────────────────────────────────────────────────────

const formatEventDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const overrideApiUrl = (apiUrl: string, sourceKey: string, eventId: string): string =>
  `${apiUrl}/events/overrides/${encodeURIComponent(sourceKey)}/${encodeURIComponent(eventId)}`;

const externalApiUrl = (apiUrl: string, eventKey: string): string =>
  `${apiUrl}/events/external/${encodeURIComponent(eventKey)}`;

// ─── Seletor de evento externo (abas 1 e 3) ──────────────────────────────────

const EVENT_SEARCH_MAX_RESULTS = 30;
const EVENT_DEFAULT_OPTIONS = 10;

interface ExternalEventAutocompleteProps {
  readonly events: EventSummary[];
  readonly sourceLabel: (sourceKey: string) => string;
  readonly value: EventSummary | null;
  readonly onChange: (event: EventSummary | null) => void;
}

function ExternalEventAutocomplete({
  events,
  sourceLabel,
  value,
  onChange,
}: ExternalEventAutocompleteProps): React.JSX.Element {
  const [inputValue, setInputValue] = useState("");

  const options = useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    let filtered: EventSummary[];
    if (q.length < 2) {
      // Sem busca: apenas os próximos eventos futuros (mais próximos primeiro).
      filtered = events
        .filter((e) => e.status !== "completed")
        .sort((a, b) => a.startAt.localeCompare(b.startAt))
        .slice(0, EVENT_DEFAULT_OPTIONS);
    } else {
      // Busca por título, fonte ou local — mais recentes primeiro, com cap.
      filtered = events
        .filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            (e.location ?? "").toLowerCase().includes(q) ||
            sourceLabel(e.sourceKey).toLowerCase().includes(q) ||
            e.sourceKey.toLowerCase().includes(q)
        )
        .sort((a, b) => b.startAt.localeCompare(a.startAt))
        .slice(0, EVENT_SEARCH_MAX_RESULTS);
    }
    // Mantém o valor selecionado nas opções mesmo fora do filtro atual.
    if (value && !filtered.some((e) => e.sourceKey === value.sourceKey && e.id === value.id)) {
      filtered = [value, ...filtered];
    }
    return filtered;
  }, [events, inputValue, value, sourceLabel]);

  return (
    <Autocomplete
      options={options}
      value={value}
      inputValue={inputValue}
      onInputChange={(_, v, reason) => {
        if (reason === "input") setInputValue(v);
      }}
      onChange={(_, v) => onChange(v)}
      filterOptions={(x) => x}
      groupBy={(option) => sourceLabel(option.sourceKey)}
      getOptionLabel={(option) => option.title}
      isOptionEqualToValue={(a, b) => a.sourceKey === b.sourceKey && a.id === b.id}
      noOptionsText={
        inputValue.trim().length < 2
          ? "Digite para buscar por título, fonte ou local"
          : "Nenhum evento encontrado"
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label="Evento externo"
          placeholder="Digite para buscar por título, fonte ou local..."
        />
      )}
      renderOption={(props, option) => {
        const { key, ...liProps } = props;
        return (
          <li key={key} {...liProps}>
            <Box sx={{ display: "flex", flexDirection: "column" }}>
              <Typography variant="body2">{option.title}</Typography>
              <Typography variant="caption" color="text.secondary">
                {sourceLabel(option.sourceKey)} · {formatEventDate(option.startAt)}
              </Typography>
            </Box>
          </li>
        );
      }}
    />
  );
}

// ─── Aba 1: Editor de override ───────────────────────────────────────────────

function OverrideTab({ apiUrl, authFetch, events, sourceLabel, initialSelected }: TabCommonProps): React.JSX.Element {
  const [selected, setSelected] = useState<EventSummary | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(false);
  const [override, setOverride] = useState<EventOverride | null>(null);
  const [form, setForm] = useState<OverrideFormState>(EMPTY_OVERRIDE_FORM);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const initialApplied = useRef(false);

  const completeness = useMemo(() => computeCompleteness(form), [form]);

  const setField = <K extends keyof OverrideFormState>(key: K, value: OverrideFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const loadEvent = useCallback(
    async (ev: EventSummary) => {
      setLoadingEvent(true);
      setError("");
      setSuccessMsg("");
      setOverride(null);
      setForm(EMPTY_OVERRIDE_FORM);
      setReason("");
      const base = overrideApiUrl(apiUrl, ev.sourceKey, ev.id);
      try {
        // Endpoint público — 404 significa "sem override".
        const res = await fetch(base);
        if (res.ok) {
          const data = (await res.json()) as EventOverride;
          setOverride(data);
          setForm(formStateFromExtendData(data.payload));
        }
      } catch {
        // Falha de rede ou ausência de override: segue com formulário vazio.
      } finally {
        setLoadingEvent(false);
      }
    },
    [apiUrl]
  );

  // Aplica a pré-seleção via query string (uma única vez, quando o evento é encontrado).
  useEffect(() => {
    if (initialApplied.current || !initialSelected) return;
    initialApplied.current = true;
    setSelected(initialSelected);
    void loadEvent(initialSelected);
  }, [initialSelected, loadEvent]);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      const isUpdate = Boolean(override);
      const url = isUpdate
        ? overrideApiUrl(apiUrl, selected.sourceKey, selected.id)
        : `${apiUrl}/events/overrides`;
      const body = isUpdate
        ? JSON.stringify({ payload: { extendData: buildExtendData(form) }, reason: reason.trim() })
        : JSON.stringify({
            sourceKey: selected.sourceKey,
            eventId: selected.id,
            payload: { extendData: buildExtendData(form) },
            reason: reason.trim(),
          });
      const res = await authFetch(url, {
        method: isUpdate ? "PUT" : "POST",
        body,
      });
      if (!res.ok) {
        setError(await extractErrorMessage(res, "Erro ao salvar o override."));
        return;
      }
      await loadEvent(selected);
      setSuccessMsg("Override salvo com sucesso. O snapshot sera atualizado no proximo sync.");
    } catch {
      setError("Erro inesperado ao salvar o override.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await authFetch(overrideApiUrl(apiUrl, selected.sourceKey, selected.id), {
        method: "DELETE",
      });
      if (!res.ok) {
        setDeleteError(await extractErrorMessage(res, "Erro ao remover o override."));
        return;
      }
      setDeleteOpen(false);
      await loadEvent(selected);
      setSuccessMsg("Override removido com sucesso.");
    } catch {
      setDeleteError("Erro inesperado ao remover o override.");
    } finally {
      setDeleting(false);
    }
  };

  const updateSpeaker = (id: string, patch: Partial<EventSpeaker>) =>
    setForm((prev) => ({
      ...prev,
      speakers: prev.speakers.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));

  return (
    <Stack spacing={3}>
      <ExternalEventAutocomplete
        events={events}
        sourceLabel={sourceLabel}
        value={selected}
        onChange={(ev) => {
          setSelected(ev);
          if (ev) loadEvent(ev);
        }}
      />

      {loadingEvent && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {selected && !loadingEvent && (
        <>
          <Alert severity="info">
            A alteração é salva diretamente no banco de dados. O site reflete o override
            na próxima requisição (ou no próximo sync de snapshots).
          </Alert>

          {successMsg && <Alert severity="success">{successMsg}</Alert>}

          {error && <Alert severity="error">{error}</Alert>}

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Stack spacing={2.5}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {selected.title}
                  </Typography>
                  <Chip label={sourceLabel(selected.sourceKey)} size="small" variant="outlined" />
                  <Chip label={formatEventDate(selected.startAt)} size="small" variant="outlined" />
                  {override && (
                    <Chip
                      label={`Override ativo · @${override.ownerHandle}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  )}
                </Box>

                <TextField
                  label="Título (override — use com cautela)"
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Descrição"
                  value={form.summary}
                  onChange={(e) => setField("summary", e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  slotProps={{ htmlInput: { maxLength: SUMMARY_MAX_LENGTH } }}
                  helperText={`${form.summary.length}/${SUMMARY_MAX_LENGTH}`}
                />
                <TextField
                  label="URL da imagem (banner/capa)"
                  value={form.imageUrl}
                  onChange={(e) => setField("imageUrl", e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Local"
                  value={form.location}
                  onChange={(e) => setField("location", e.target.value)}
                  fullWidth
                />

                <Autocomplete
                  multiple
                  freeSolo
                  options={[] as string[]}
                  value={form.tags}
                  onChange={(_, v) => {
                    const tags = v.map((t) => t.trim()).filter(Boolean).slice(0, TAGS_MAX);
                    setField("tags", tags);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={`Tags (${form.tags.length}/${TAGS_MAX})`}
                      helperText="Pressione Enter para adicionar cada tag"
                    />
                  )}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={form.featured}
                      onChange={(e) => setField("featured", e.target.checked)}
                    />
                  }
                  label="Destacar evento na página de eventos"
                />

                {/* Palestrantes */}
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                    Palestrantes ({form.speakers.length}/{SPEAKERS_MAX})
                  </Typography>
                  <Stack spacing={2}>
                    {form.speakers.map((speaker, index) => (
                      <Card key={speaker.id} variant="outlined">
                        <CardContent sx={{ pb: "16px !important" }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              Palestrante {index + 1}
                            </Typography>
                            <IconButton
                              size="small"
                              aria-label={`Remover palestrante ${index + 1}`}
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  speakers: prev.speakers.filter((s) => s.id !== speaker.id),
                                }))
                              }
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                          <Grid container spacing={1.5}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <TextField
                                label="Nome *"
                                value={speaker.name}
                                onChange={(e) => updateSpeaker(speaker.id, { name: e.target.value })}
                                fullWidth
                                size="small"
                              />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <TextField
                                label="Handle do GitHub"
                                value={speaker.handle ?? ""}
                                onChange={(e) => updateSpeaker(speaker.id, { handle: e.target.value })}
                                fullWidth
                                size="small"
                              />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <TextField
                                label="Título da palestra"
                                value={speaker.talkTitle ?? ""}
                                onChange={(e) => updateSpeaker(speaker.id, { talkTitle: e.target.value })}
                                fullWidth
                                size="small"
                              />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <TextField
                                label="URL do avatar"
                                value={speaker.avatarUrl ?? ""}
                                onChange={(e) => updateSpeaker(speaker.id, { avatarUrl: e.target.value })}
                                fullWidth
                                size="small"
                              />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                              <TextField
                                label="URL do perfil (GitHub, LinkedIn, site)"
                                value={speaker.profileUrl ?? ""}
                                onChange={(e) => updateSpeaker(speaker.id, { profileUrl: e.target.value })}
                                fullWidth
                                size="small"
                              />
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    ))}
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      disabled={form.speakers.length >= SPEAKERS_MAX}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          speakers: [...prev.speakers, { id: generateSpeakerId(), name: "" }],
                        }))
                      }
                      sx={{ alignSelf: "flex-start" }}
                    >
                      Adicionar palestrante
                    </Button>
                  </Stack>
                </Box>

                <TextField
                  label="URL de inscrição (se diferente do link original)"
                  value={form.registrationUrl}
                  onChange={(e) => setField("registrationUrl", e.target.value)}
                  fullWidth
                />
                <TextField
                  label="URL dos slides (pós-evento)"
                  value={form.slidesUrl}
                  onChange={(e) => setField("slidesUrl", e.target.value)}
                  fullWidth
                />
                <TextField
                  label="URL da gravação (pós-evento)"
                  value={form.videoUrl}
                  onChange={(e) => setField("videoUrl", e.target.value)}
                  fullWidth
                />
                <TextField
                  label="URL da discussão (GitHub Discussion, fórum)"
                  value={form.discussionUrl}
                  onChange={(e) => setField("discussionUrl", e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Carga horária (minutos)"
                  value={form.workloadMinutes}
                  onChange={(e) =>
                    setField("workloadMinutes", e.target.value.replace(/[^\d]/g, ""))
                  }
                  fullWidth
                  inputMode="numeric"
                  helperText="Opcional, 0–1000. Alimenta os certificados de eventos externos"
                />

                <TextField
                  label="Motivo da alteração *"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  fullWidth
                  helperText="Aparece no historico do override"
                />

                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <Button
                    variant="contained"
                    disabled={saving || !reason.trim()}
                    onClick={handleSave}
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
                  >
                    Salvar override
                  </Button>
                  {override && (
                    <Button
                      variant="text"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => {
                        setDeleteError("");
                        setDeleteOpen(true);
                      }}
                    >
                      Remover override
                    </Button>
                  )}
                </Box>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                    Completude do evento
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1.5 }}>
                    <LinearProgress
                      variant="determinate"
                      value={completeness.percent}
                      sx={{ flex: 1, height: 8, borderRadius: 4 }}
                    />
                    <Typography variant="body2" fontWeight={700}>
                      {completeness.percent}%
                    </Typography>
                  </Box>
                  <Stack spacing={0.5}>
                    {completeness.items.map((item) => (
                      <Box key={item.key} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {item.done ? (
                          <CheckCircleIcon color="success" fontSize="small" />
                        ) : (
                          <RadioButtonUncheckedIcon color="disabled" fontSize="small" />
                        )}
                        <Typography
                          variant="body2"
                          color={item.done ? "text.primary" : "text.secondary"}
                        >
                          {item.label}
                          {item.done && item.detail ? ` (${item.detail})` : ""}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
                    Quanto mais completo o evento, melhor o SEO e o engajamento na página.
                  </Typography>
                </CardContent>
              </Card>

              <Box sx={{ mt: 3 }}>
                <EventOverrideHistory
                  apiUrl={apiUrl}
                  sourceKey={selected.sourceKey}
                  eventId={selected.id}
                />
              </Box>
            </Grid>
          </Grid>
        </>
      )}

      <ModalConfirm
        open={deleteOpen}
        title="Remover override?"
        description="O override será removido do banco de dados e o evento volta a exibir apenas os dados da fonte externa."
        confirmLabel="Remover override"
        variant="error"
        loading={deleting}
        error={deleteError}
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </Stack>
  );
}

// ─── Aba 2: Organizers (somente admin) ───────────────────────────────────────

interface OrganizersTabProps {
  readonly apiUrl: string;
  readonly authFetch: AuthFetch;
  readonly sources: EventSourceSummary[];
}

function OrganizersTab({
  apiUrl,
  authFetch,
  sources,
}: OrganizersTabProps): React.JSX.Element {
  const [data, setData] = useState<OrganizersFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  // Busca server-side de membros (staff-candidates) — sem dump de /admin/members.
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberOptions, setMemberOptions] = useState<Member[]>([]);
  const [membersSearching, setMembersSearching] = useState(false);

  const [memberId, setMemberId] = useState("");
  const [githubHandle, setGithubHandle] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [newScope, setNewScope] = useState("");
  const [scopeError, setScopeError] = useState("");
  const [helperSource, setHelperSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<Ownership | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const orgRes = await authFetch(`${apiUrl}/events/organizers`);
      const org = await parseAuthJson<OrganizersFile>(orgRes, setLoadError);
      if (org) setData(org);
    } catch {
      setLoadError("Erro inesperado ao carregar organizers.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, authFetch]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Busca debounced (≥2 chars) em /events/staff-candidates (máx 20 resultados).
  useEffect(() => {
    const q = memberQuery.trim();
    if (q.length < 2) {
      setMemberOptions([]);
      return;
    }
    let cancelled = false;
    setMembersSearching(true);
    const timer = setTimeout(() => {
      authFetch(`${apiUrl}/events/staff-candidates?query=${encodeURIComponent(q)}`)
        .then(async (res) => {
          if (cancelled || !res.ok) return;
          const members = (await res.json()) as Member[];
          setMemberOptions(Array.isArray(members) ? members : []);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setMembersSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [memberQuery, apiUrl, authFetch]);

  // Garante que o membro selecionado continue nas opções (evita warning do MUI).
  const autocompleteOptions = useMemo(
    () =>
      selectedMember && !memberOptions.some((m) => m.id === selectedMember.id)
        ? [selectedMember, ...memberOptions]
        : memberOptions,
    [selectedMember, memberOptions]
  );

  const addScope = (raw: string) => {
    const scope = raw.trim();
    if (!isValidScope(scope)) {
      setScopeError(SCOPE_FORMAT_HINT);
      return;
    }
    if (scopes.includes(scope)) {
      setScopeError("Scope já adicionado.");
      return;
    }
    setScopes((prev) => [...prev, scope]);
    setNewScope("");
    setScopeError("");
  };

  const handleAddOwnership = async () => {
    setSaving(true);
    setSaveError("");
    setSaveSuccess("");
    try {
      const res = await authFetch(`${apiUrl}/events/organizers/${encodeURIComponent(memberId)}`, {
        method: "POST",
        body: JSON.stringify({ githubHandle: githubHandle.trim(), scope: scopes }),
      });
      if (!res.ok) {
        setSaveError(await extractErrorMessage(res, "Erro ao adicionar organizer."));
        return;
      }
      setSaveSuccess("Ownership salva com sucesso.");
      setSelectedMember(null);
      setMemberQuery("");
      setMemberOptions([]);
      setMemberId("");
      setGithubHandle("");
      setScopes([]);
      setNewScope("");
      fetchAll();
    } catch {
      setSaveError("Erro inesperado ao adicionar organizer.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await authFetch(`${apiUrl}/events/organizers/${deleteTarget.memberId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setDeleteError(await extractErrorMessage(res, "Erro ao remover ownership."));
        return;
      }
      setDeleteTarget(null);
      fetchAll();
    } catch {
      setDeleteError("Erro inesperado ao remover ownership.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Alert severity="info">
        O mapeamento de ownership define quais eventos externos cada <code>event_organizer</code>{" "}
        pode editar. Escopos: <code>source:sourceId:eventId</code> (evento específico) ou{" "}
        <code>source:sourceId:*</code> (toda a fonte).
      </Alert>

      {saveSuccess && <Alert severity="success">{saveSuccess}</Alert>}

      {loadError && <Alert severity="error">{loadError}</Alert>}

      {/* Lista de ownerships */}
      {!data || data.ownerships.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={3}>
          Nenhum organizer mapeado ainda.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {data.ownerships.map((o) => (
            <Card key={o.memberId} variant="outlined">
              <CardContent sx={{ pb: "16px !important" }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 1,
                    flexWrap: "wrap",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Avatar
                      src={`https://avatars.githubusercontent.com/${o.githubHandle}?v=4`}
                      alt={o.githubHandle}
                      sx={{ width: 36, height: 36 }}
                    />
                    <Box>
                      <Typography variant="body2" fontWeight={700}>
                        @{o.githubHandle}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {o.memberId}
                      </Typography>
                    </Box>
                  </Box>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={`Remover ownership de @${o.githubHandle}`}
                    onClick={() => {
                      setDeleteError("");
                      setDeleteTarget(o);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 1 }}>
                  {o.scope.map((s) => (
                    <Chip key={s} label={s} size="small" variant="outlined" />
                  ))}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* Adicionar ownership */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Adicionar organizer
          </Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              options={autocompleteOptions}
              value={selectedMember}
              inputValue={memberQuery}
              onInputChange={(_, v, reason) => {
                if (reason === "input") setMemberQuery(v);
              }}
              onChange={(_, member) => {
                setSelectedMember(member);
                setMemberId(member?.id ?? "");
                setGithubHandle(member?.githubHandle ?? "");
              }}
              filterOptions={(x) => x}
              loading={membersSearching}
              getOptionLabel={(m) => `${m.name} · @${m.githubHandle}`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              noOptionsText={
                memberQuery.trim().length < 2
                  ? "Digite ao menos 2 caracteres para buscar"
                  : "Nenhum membro encontrado"
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Membro"
                  placeholder="Buscar por nome ou handle do GitHub..."
                  slotProps={{
                    input: {
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {membersSearching ? <CircularProgress size={16} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    },
                  }}
                />
              )}
              renderOption={(props, m) => {
                const { key, ...liProps } = props;
                return (
                  <li key={key} {...liProps}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Avatar src={m.avatarUrl} alt={m.name} sx={{ width: 28, height: 28 }} />
                      <Box>
                        <Typography variant="body2">{m.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          @{m.githubHandle}
                        </Typography>
                      </Box>
                    </Box>
                  </li>
                );
              }}
            />

            {selectedMember && !(selectedMember.roles ?? []).includes("event_organizer") && (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                Este membro ainda não possui a role <code>event_organizer</code>. Adicione-a em
                "Administração → Membros" antes de salvar, ou a ownership não terá efeito.
              </Alert>
            )}

            <TextField
              label="Handle do GitHub"
              value={githubHandle}
              onChange={(e) => setGithubHandle(e.target.value)}
              fullWidth
              helperText="Pré-preenchido a partir do membro selecionado"
            />

            <Box>
              <Typography variant="body2" fontWeight={700} gutterBottom>
                Escopos
              </Typography>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
                {scopes.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    size="small"
                    onDelete={() => setScopes((prev) => prev.filter((x) => x !== s))}
                  />
                ))}
                {scopes.length === 0 && (
                  <Typography variant="caption" color="text.secondary">
                    Nenhum escopo adicionado.
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
                <TextField
                  label="Novo escopo"
                  value={newScope}
                  onChange={(e) => {
                    setNewScope(e.target.value);
                    setScopeError("");
                  }}
                  error={!!scopeError}
                  helperText={scopeError || SCOPE_FORMAT_HINT}
                  size="small"
                  sx={{ flex: 1, minWidth: 260 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addScope(newScope);
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => addScope(newScope)}
                  sx={{ mt: 0.5 }}
                >
                  Adicionar
                </Button>
              </Box>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1, flexWrap: "wrap" }}>
                <TextField
                  select
                  label="Ou montar a partir da fonte"
                  value={helperSource}
                  onChange={(e) => setHelperSource(e.target.value)}
                  size="small"
                  sx={{ minWidth: 260 }}
                >
                  {sources.map((s) => (
                    <MenuItem key={s.sourceKey} value={s.sourceKey}>
                      {s.emoji} {s.label} ({s.sourceKey})
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  size="small"
                  variant="text"
                  disabled={!helperSource}
                  onClick={() => addScope(buildSourceWildcardScope(helperSource))}
                >
                  Adicionar {helperSource ? buildSourceWildcardScope(helperSource) : "…"}
                </Button>
              </Box>
            </Box>

            {saveError && <Alert severity="error">{saveError}</Alert>}

            <Button
              variant="contained"
              disabled={saving || !memberId || !githubHandle.trim() || scopes.length === 0}
              onClick={handleAddOwnership}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
              sx={{ alignSelf: "flex-start" }}
            >
              Salvar organizer
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <ModalConfirm
        open={!!deleteTarget}
        title="Remover ownership?"
        description={`@${deleteTarget?.githubHandle} perderá a permissão de editar os eventos dos escopos mapeados. A remoção é imediata.`}
        confirmLabel="Remover ownership"
        variant="error"
        loading={deleting}
        error={deleteError}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Stack>
  );
}

// ─── Aba 3: Ativação de features em evento externo ───────────────────────────

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

function ActivationTab({ apiUrl, authFetch, events, sourceLabel, initialSelected }: TabCommonProps): React.JSX.Element {
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
        const res = await authFetch(`${externalApiUrl(apiUrl, key)}/participants`);
        const data = await parseAuthJson<ExternalParticipant[]>(res, setParticipantsError);
        if (data) setParticipants(Array.isArray(data) ? data : []);
      } catch {
        setParticipantsError("Erro inesperado ao carregar participantes.");
      }
    },
    [apiUrl, authFetch]
  );

  // Ingressos (feature payments) — endpoint de gestão (owner/admin).
  // 404 = evento sem feature payments → lista vazia, seção escondida.
  const fetchTicketTypes = useCallback(
    async (key: string) => {
      setTicketsError("");
      try {
        const res = await authFetch(`${externalApiUrl(apiUrl, key)}/ticket-types/manage`);
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
    [apiUrl, authFetch]
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
        const res = await authFetch(`${externalApiUrl(apiUrl, key)}/activation`);
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
    [apiUrl, authFetch, fetchParticipants, fetchTicketTypes]
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
      const res = await authFetch(`${externalApiUrl(apiUrl, eventKey)}/activate`, {
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
      const price = Number.parseFloat(ticketForm.price.replace(",", "."));
      if (Number.isNaN(price) || price < 0) {
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
      const res = await authFetch(`${externalApiUrl(apiUrl, eventKey)}/ticket-types`, {
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
      const res = await authFetch(`${apiUrl}/events/external/ticket-types/${editingTicketId}`, {
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
      const res = await authFetch(`${apiUrl}/events/external/ticket-types/${ticket.id}`, {
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
      const res = await authFetch(`${externalApiUrl(apiUrl, eventKey)}/participants/import`, {
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
      const res = await authFetch(`${externalApiUrl(apiUrl, eventKey)}/participants/rematch`, {
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
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
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
                        <Typography variant="body2" fontWeight={700}>
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
                  <Typography variant="subtitle1" fontWeight={700} gutterBottom>
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
                  <Typography variant="subtitle1" fontWeight={700} gutterBottom>
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
                      <Typography variant="subtitle1" fontWeight={700}>
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
                          component={Link}
                          href={`/admin/eventos-checkin?event=${EXTERNAL_PREFIX}${eventKey}`}
                        >
                          Check-in
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<OpenInNewIcon />}
                          component={Link}
                          href={`/transparencia?project=${encodeURIComponent(communityProjectKey)}`}
                        >
                          Caixa
                        </Button>
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => setReimbursementDialogOpen(true)}
                        >
                          Lançar despesa
                        </Button>
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
                            <Typography variant="body2" fontWeight={600}>{ticket.name}</Typography>
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

// ─── Página ──────────────────────────────────────────────────────────────────

export default function AdminEventOverridesPage(): React.JSX.Element {
  const { ready, isLoggedIn, isAdmin, isEventOrganizer, authFetch } = useAuth();
  const canAccess = isAdmin || isEventOrganizer;

  const { siteConfig } = useDocusaurusContext();
  const configuredApiUrl =
    (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";
  const apiUrl = resolveApiUrl(configuredApiUrl, siteConfig.url);
  const history = useHistory();

  const [tab, setTab] = useState(0);
  const [eventsIndex, setEventsIndex] = useState<EventIndexFile | null>(null);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [preselect, setPreselect] = useState<{ sourceKey: string; eventId: string } | null>(null);

  // Deep-link: /admin/overrides?tab=N&sourceKey=<source:sourceId>&eventId=<id>
  // (padrão window.location.search, igual a eventos-checkin).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = Number.parseInt(params.get("tab") ?? "", 10);
    if (!Number.isNaN(tabParam) && tabParam >= 0 && tabParam <= 2) setTab(tabParam);
    const sourceKey = params.get("sourceKey");
    const eventId = params.get("eventId");
    if (sourceKey && eventId) setPreselect({ sourceKey, eventId });
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !canAccess) {
      history.replace("/");
    }
  }, [ready, isLoggedIn, canAccess, history]);

  // Aba 1 (Organizers) é admin-only — deep-link para ela cai na aba 0.
  useEffect(() => {
    if (ready && !isAdmin && tab === 1) setTab(0);
  }, [ready, isAdmin, tab]);

  useEffect(() => {
    if (!ready || !isLoggedIn || !canAccess) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(EVENTS_MANIFEST_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as EventIndexFile;
        if (!cancelled) setEventsIndex(data);
      } catch {
        if (!cancelled) setLoadError("Não foi possível carregar a lista de eventos externos.");
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, isLoggedIn, canAccess]);

  const externalEvents = useMemo(
    () => (eventsIndex?.events ?? []).filter((e) => e.source !== "internal"),
    [eventsIndex]
  );
  const externalSources = useMemo(
    () => (eventsIndex?.sources ?? []).filter((s) => s.source !== "internal"),
    [eventsIndex]
  );
  const sourceLabel = useCallback(
    (sourceKey: string) => {
      const s = eventsIndex?.sources.find((x) => x.sourceKey === sourceKey);
      return s ? `${s.emoji} ${s.label}` : sourceKey;
    },
    [eventsIndex]
  );

  // Pré-seleção via query string: procura o evento no index; se não achar, ignora.
  const preselectedEvent = useMemo(
    () =>
      preselect
        ? externalEvents.find(
            (e) => e.sourceKey === preselect.sourceKey && e.id === preselect.eventId
          ) ?? null
        : null,
    [preselect, externalEvents]
  );

  if (!ready || !isLoggedIn || !canAccess) {
    return (
      <Layout title="Overrides de Eventos">
        <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout
      title="Overrides de Eventos"
      description="Overrides de metadados, organizers e ativação de features em eventos externos"
    >
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h4" fontWeight={800}>
            Eventos Externos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Overrides de metadados (salvos no banco de dados), mapeamento de organizers e ativação
            de features em eventos externos
          </Typography>
        </Box>

        <AdminNavbar active="/admin/overrides" />

        {loadError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {loadError}
          </Alert>
        )}

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab label="Override de metadados" />
          <Tab label="Organizers" disabled={!isAdmin} />
          <Tab label="Ativação de features" />
        </Tabs>

        {eventsLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TabPanel value={tab} index={0}>
              <OverrideTab
                apiUrl={apiUrl}
                authFetch={authFetch}
                events={externalEvents}
                sourceLabel={sourceLabel}
                initialSelected={preselectedEvent}
              />
            </TabPanel>
            <TabPanel value={tab} index={1}>
              {isAdmin ? (
                <OrganizersTab apiUrl={apiUrl} authFetch={authFetch} sources={externalSources} />
              ) : (
                <Alert severity="warning">Somente admins podem gerenciar organizers.</Alert>
              )}
            </TabPanel>
            <TabPanel value={tab} index={2}>
              <ActivationTab
                apiUrl={apiUrl}
                authFetch={authFetch}
                events={externalEvents}
                sourceLabel={sourceLabel}
                initialSelected={preselectedEvent}
              />
            </TabPanel>
          </>
        )}
      </Container>
    </Layout>
  );
}

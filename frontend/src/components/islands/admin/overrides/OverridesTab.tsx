/**
 * Port da aba 1 (`OverrideTab`) de `src/pages/admin/overrides.tsx` (Docusaurus)
 * — editor de override de metadados de evento externo.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { extractErrorMessage } from "../../../../lib/auth-fetch-helpers";
import { API_URL } from "../../../../lib/config";
import ExternalEventAutocomplete from "./ExternalEventAutocomplete";
import EventOverrideHistory from "./EventOverrideHistory";
import ModalConfirm from "../ui/ModalConfirm";
import {
  EMPTY_OVERRIDE_FORM,
  SUMMARY_MAX_LENGTH,
  SPEAKERS_MAX,
  TAGS_MAX,
  buildExtendData,
  computeCompleteness,
  formStateFromExtendData,
  generateSpeakerId,
  type EventOverride,
  type EventSpeaker,
  type OverrideFormState,
} from "./override-form";
import {
  formatEventDate,
  overrideApiUrl,
  type EventSummary,
  type TabCommonProps,
} from "./shared";

export default function OverridesTab({
  authFetch,
  events,
  sourceLabel,
  initialSelected,
}: TabCommonProps): JSX.Element {
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
      const base = `${API_URL}${overrideApiUrl(ev.sourceKey, ev.id)}`;
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
    [],
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
        ? overrideApiUrl(selected.sourceKey, selected.id)
        : "/events/overrides";
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
      const res = await authFetch(overrideApiUrl(selected.sourceKey, selected.id), {
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
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
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
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }} gutterBottom>
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
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }} gutterBottom>
                    Completude do evento
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1.5 }}>
                    <LinearProgress
                      variant="determinate"
                      value={completeness.percent}
                      sx={{ flex: 1, height: 8, borderRadius: 4 }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
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

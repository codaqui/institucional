import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import MuiIslandProvider from "../../MuiIslandProvider";
import PageContainer from "../ui/PageContainer";
import PaginationControls from "../../ui/PaginationControls";
import { useAuth } from "../../../../lib/use-auth";
import { extractErrorMessage, parseAuthJson } from "../../../../lib/auth-fetch-helpers";
import { DEFAULT_PAGE_SIZE, rangeLabel, type PaginatedResponse } from "../../../../lib/pagination";

type ProjectStatus = "draft" | "proposed" | "active" | "finished" | "canceled";

interface EntityOption { id: string; name: string }
interface ScheduleForm { numero: string; descricao: string; carga: string }
interface ManagedProject {
  id: string;
  kind: string | null;
  name: string;
  entityId: string;
  partnershipId: string | null;
  summary: string | null;
  isPublic: boolean;
  status: ProjectStatus;
  startsAt: string | null;
  endsAt: string | null;
  registrationStartsAt: string | null;
  registrationEndsAt: string | null;
  odsPrimary: number | null;
  odsSecondary: number[];
  targetCommunity: string | null;
  justification: string | null;
  objective: string | null;
  skillsDeveloped: string | null;
  methodology: string | null;
  totalHours: number | null;
  schedule: Array<{ numero: number; descricao: string; carga: number }> | null;
  maxParticipants: number | null;
  internalNotes: string | null;
}

const STATUS_LABELS: Record<ProjectStatus, string> = { draft: "Rascunho", proposed: "Proposto", active: "Ativo", finished: "Finalizado", canceled: "Cancelado" };
const EMPTY_FORM = {
  name: "", entityId: "", kind: "projeto", summary: "", isPublic: true,
  startsAt: "", endsAt: "", registrationStartsAt: "", registrationEndsAt: "",
  odsPrimary: "4", odsSecondary: "", targetCommunity: "", justification: "",
  objective: "", skillsDeveloped: "", methodology: "", totalHours: "",
  maxParticipants: "", mentorMemberId: "", coMentors: "", internalNotes: "",
};

function ProjectsAdminInner() {
  const { ready, isLoggedIn, isAdmin, user, authFetch } = useAuth();
  const canAccess = isAdmin || (user?.roles.includes("diretor") ?? false);
  const [items, setItems] = useState<ManagedProject[]>([]);
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [entityId, setEntityId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState<{ severity: "success" | "error"; message: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedProject | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [schedule, setSchedule] = useState<ScheduleForm[]>([{ numero: "1", descricao: "", carga: "" }]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [finishTarget, setFinishTarget] = useState<ManagedProject | null>(null);
  const [reportUrl, setReportUrl] = useState("");

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams({ page: String(page), limit: String(DEFAULT_PAGE_SIZE) });
    if (status) params.set("status", status);
    if (entityId) params.set("entityId", entityId);
    try {
      const response = await authFetch(`/projects?${params.toString()}`);
      const result = await parseAuthJson<PaginatedResponse<ManagedProject>>(response, setLoadError);
      if (!result) return;
      setItems(Array.isArray(result.data) ? result.data : []);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch {
      setLoadError("Não foi possível carregar os projetos.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, page, status, entityId]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !canAccess) {
      window.location.replace("/");
      return;
    }
    void loadProjects();
  }, [ready, isLoggedIn, canAccess, loadProjects]);

  useEffect(() => {
    if (!ready || !isLoggedIn || !canAccess) return;
    void authFetch(`/entities?page=1&limit=${DEFAULT_PAGE_SIZE}`).then(async (response) => {
      const result = await parseAuthJson<PaginatedResponse<EntityOption>>(response, setLoadError);
      if (result) setEntities(Array.isArray(result.data) ? result.data : []);
    }).catch(() => setLoadError("Não foi possível carregar as entidades."));
  }, [ready, isLoggedIn, canAccess, authFetch]);

  const openProject = (project: ManagedProject | null) => {
    setEditing(project);
    setForm(project ? {
      name: project.name,
      entityId: project.entityId,
      kind: project.kind ?? "projeto",
      summary: project.summary ?? "",
      isPublic: project.isPublic,
      startsAt: project.startsAt ?? "",
      endsAt: project.endsAt ?? "",
      registrationStartsAt: project.registrationStartsAt ?? "",
      registrationEndsAt: project.registrationEndsAt ?? "",
      odsPrimary: project.odsPrimary?.toString() ?? "4",
      odsSecondary: project.odsSecondary.join(", "),
      targetCommunity: project.targetCommunity ?? "",
      justification: project.justification ?? "",
      objective: project.objective ?? "",
      skillsDeveloped: project.skillsDeveloped ?? "",
      methodology: project.methodology ?? "",
      totalHours: project.totalHours?.toString() ?? "",
      maxParticipants: project.maxParticipants?.toString() ?? "",
      mentorMemberId: "",
      coMentors: "",
      internalNotes: project.internalNotes ?? "",
    } : { ...EMPTY_FORM, entityId: entities[0]?.id ?? "" });
    setSchedule(project?.schedule?.map((item) => ({ numero: String(item.numero), descricao: item.descricao, carga: String(item.carga) })) ?? [{ numero: "1", descricao: "", carga: "" }]);
    setFormError("");
    setFormOpen(true);
  };

  const saveProject = async (nextStatus: "draft" | "proposed") => {
    setSaving(true);
    setFormError("");
    const base = { name: form.name.trim(), entityId: form.entityId, status: nextStatus };
    const payload = nextStatus === "draft" ? base : {
      ...base,
      kind: form.kind,
      summary: form.summary.trim(),
      isPublic: form.isPublic,
      startsAt: form.startsAt,
      endsAt: form.endsAt,
      registrationStartsAt: form.registrationStartsAt,
      registrationEndsAt: form.registrationEndsAt,
      odsPrimary: Number(form.odsPrimary),
      odsSecondary: form.odsSecondary.split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value > 0),
      targetCommunity: form.targetCommunity.trim(),
      justification: form.justification.trim(),
      objective: form.objective.trim(),
      skillsDeveloped: form.skillsDeveloped.trim(),
      methodology: form.methodology.trim(),
      totalHours: Number(form.totalHours),
      schedule: schedule.map((item) => ({ numero: Number(item.numero), descricao: item.descricao.trim(), carga: Number(item.carga) })),
      maxParticipants: Number(form.maxParticipants),
      mentorMemberId: form.mentorMemberId.trim(),
      ...(form.coMentors.trim() ? { coMentors: form.coMentors.split(",").map((value) => value.trim()).filter(Boolean) } : {}),
      ...(form.internalNotes.trim() ? { internalNotes: form.internalNotes.trim() } : {}),
    };
    try {
      const response = await authFetch(editing ? `/projects/${editing.id}` : "/projects", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setFormError(await extractErrorMessage(response, "Não foi possível salvar o projeto."));
        return;
      }
      setFormOpen(false);
      setFeedback({ severity: "success", message: nextStatus === "draft" ? "Rascunho salvo." : "Projeto completo salvo como proposta." });
      await loadProjects();
    } catch {
      setFormError("Não foi possível salvar o projeto.");
    } finally {
      setSaving(false);
    }
  };

  const transition = async (project: ManagedProject, nextStatus: "active" | "canceled") => {
    const action = nextStatus === "active" ? "Ativar" : "Cancelar";
    if (!window.confirm(`${action} "${project.name}"?`)) return;
    setBusyId(project.id);
    setFeedback(null);
    try {
      const response = await authFetch(`/projects/${project.id}`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
      if (!response.ok) {
        setFeedback({ severity: "error", message: await extractErrorMessage(response, `Não foi possível ${action.toLocaleLowerCase("pt-BR")} o projeto.`) });
        return;
      }
      setFeedback({ severity: "success", message: `Projeto ${nextStatus === "active" ? "ativado" : "cancelado"}.` });
      await loadProjects();
    } catch {
      setFeedback({ severity: "error", message: "Não foi possível alterar o projeto." });
    } finally {
      setBusyId(null);
    }
  };

  const finishProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!finishTarget) return;
    setSaving(true);
    setFeedback(null);
    try {
      const response = await authFetch(`/projects/${finishTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "finished", reportDiscussionUrl: reportUrl.trim() }),
      });
      if (!response.ok) {
        setFeedback({ severity: "error", message: await extractErrorMessage(response, "Não foi possível finalizar o projeto.") });
        return;
      }
      setFinishTarget(null);
      setFeedback({ severity: "success", message: "Projeto finalizado." });
      await loadProjects();
    } catch {
      setFeedback({ severity: "error", message: "Não foi possível finalizar o projeto." });
    } finally {
      setSaving(false);
    }
  };

  const updateSchedule = (index: number, field: keyof ScheduleForm, value: string) => {
    setSchedule((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  };

  if (!ready) return <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}><CircularProgress aria-label="Carregando autenticação" /></Box>;
  if (!isLoggedIn || !canAccess) return null;

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3, justifyContent: "space-between", alignItems: { sm: "center" } }}>
        <Box><Typography variant="h4" component="h2" sx={{ fontWeight: 800 }}>Projetos de extensão</Typography><Typography variant="body2" color="text.secondary">Rascunhos, propostas, ativação e acompanhamento</Typography></Box>
        <Button variant="contained" onClick={() => openProject(null)}>Novo projeto</Button>
      </Stack>
      {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}
      {feedback && <Alert severity={feedback.severity} sx={{ mb: 2 }} onClose={() => setFeedback(null)}>{feedback.message}</Alert>}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        <TextField fullWidth size="small" label="Filtrar por status" select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value as ProjectStatus | ""); }}><MenuItem value="">Todos</MenuItem>{Object.entries(STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
        <TextField fullWidth size="small" label="Filtrar por entidade" select value={entityId} onChange={(event) => { setPage(1); setEntityId(event.target.value); }}><MenuItem value="">Todas</MenuItem>{entities.map((entity) => <MenuItem key={entity.id} value={entity.id}>{entity.name}</MenuItem>)}</TextField>
      </Stack>

      {(() => {
        if (loading) {
          return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress aria-label="Carregando projetos" /></Box>;
        }
        if (items.length === 0) {
          return <Typography color="text.secondary" sx={{ textAlign: "center", py: 6 }}>Nenhum projeto encontrado.</Typography>;
        }
        return (
          <>
            <TableContainer component={Box} tabIndex={0} role="region" aria-label="Projetos cadastrados" sx={{ overflowX: "auto" }}>
              <Table size="small"><TableHead><TableRow><TableCell>Projeto</TableCell><TableCell>Status</TableCell><TableCell>Período</TableCell><TableCell align="right">Ações</TableCell></TableRow></TableHead>
                <TableBody>{items.map((project) => <TableRow key={project.id}>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{project.name}</Typography><Typography variant="caption" color="text.secondary">{entities.find((entity) => entity.id === project.entityId)?.name ?? "Entidade"}</Typography></TableCell>
                  <TableCell><Chip size="small" variant="outlined" label={STATUS_LABELS[project.status]} /></TableCell>
                  <TableCell>{project.startsAt ? `${project.startsAt} — ${project.endsAt}` : "Não definido"}</TableCell>
                  <TableCell align="right"><Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                    {["draft", "proposed"].includes(project.status) && <Button size="small" onClick={() => openProject(project)}>Editar</Button>}
                    {project.status === "proposed" && <Button size="small" variant="contained" disabled={busyId === project.id} onClick={() => void transition(project, "active")}>Ativar</Button>}
                    {project.status === "active" && <Button size="small" disabled={busyId === project.id} onClick={() => { setReportUrl(""); setFinishTarget(project); }}>Finalizar</Button>}
                    {!["finished", "canceled"].includes(project.status) && <Button size="small" color="error" disabled={busyId === project.id} onClick={() => void transition(project, "canceled")}>Cancelar</Button>}
                  </Stack></TableCell>
                </TableRow>)}</TableBody>
              </Table>
            </TableContainer>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", my: 1 }}>{rangeLabel(page, DEFAULT_PAGE_SIZE, total)}</Typography>
            <PaginationControls page={page} totalPages={totalPages} onChange={setPage} itemLabel="projetos" />
          </>
        );
      })()}

      <Dialog open={formOpen} onClose={() => !saving && setFormOpen(false)} fullWidth maxWidth="md">
        <form onSubmit={(event) => event.preventDefault()}>
          <DialogTitle>{editing ? "Editar projeto" : "Novo projeto"}</DialogTitle>
          <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <Alert severity="info">Salve o rascunho com nome e entidade. Para propor, preencha todos os campos obrigatórios e designe o mentor principal.</Alert>
            <TextField label="Nome" name="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <TextField label="Entidade" name="entityId" select required disabled={Boolean(editing)} value={form.entityId} onChange={(event) => setForm({ ...form, entityId: event.target.value })}>{entities.map((entity) => <MenuItem key={entity.id} value={entity.id}>{entity.name}</MenuItem>)}</TextField>
            <TextField label="Tipo de iniciativa" select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}><MenuItem value="programa">Programa</MenuItem><MenuItem value="projeto">Projeto</MenuItem><MenuItem value="oficina">Oficina</MenuItem><MenuItem value="evento">Evento</MenuItem><MenuItem value="prestacao_servicos">Prestação de serviços</MenuItem></TextField>
            <TextField label="Resumo" multiline minRows={2} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField fullWidth label="Início do projeto" type="date" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField fullWidth label="Fim do projeto" type="date" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField fullWidth label="Início das inscrições" type="date" value={form.registrationStartsAt} onChange={(event) => setForm({ ...form, registrationStartsAt: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField fullWidth label="Fim das inscrições" type="date" value={form.registrationEndsAt} onChange={(event) => setForm({ ...form, registrationEndsAt: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField fullWidth label="ODS principal" type="number" value={form.odsPrimary} onChange={(event) => setForm({ ...form, odsPrimary: event.target.value })} slotProps={{ htmlInput: { min: 1, max: 17 } }} />
              <TextField fullWidth label="ODS secundárias" value={form.odsSecondary} onChange={(event) => setForm({ ...form, odsSecondary: event.target.value })} helperText="Números separados por vírgula." />
              <TextField fullWidth label="Carga horária total" type="number" value={form.totalHours} onChange={(event) => setForm({ ...form, totalHours: event.target.value })} slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }} />
              <TextField fullWidth label="Vagas" type="number" value={form.maxParticipants} onChange={(event) => setForm({ ...form, maxParticipants: event.target.value })} slotProps={{ htmlInput: { min: 0 } }} />
            </Stack>
            <TextField label="Público da comunidade" value={form.targetCommunity} onChange={(event) => setForm({ ...form, targetCommunity: event.target.value })} />
            <TextField label="Justificativa" multiline minRows={2} value={form.justification} onChange={(event) => setForm({ ...form, justification: event.target.value })} />
            <TextField label="Objetivo" multiline minRows={2} value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} />
            <TextField label="Competências desenvolvidas" multiline minRows={2} value={form.skillsDeveloped} onChange={(event) => setForm({ ...form, skillsDeveloped: event.target.value })} />
            <TextField label="Metodologia" multiline minRows={2} value={form.methodology} onChange={(event) => setForm({ ...form, methodology: event.target.value })} />
            <Typography variant="h6" component="h3">Encontros</Typography>
            {schedule.map((item, index) => <Stack direction={{ xs: "column", sm: "row" }} spacing={1} key={`schedule-${item.numero}`}>
              <TextField label="Número" type="number" value={item.numero} onChange={(event) => updateSchedule(index, "numero", event.target.value)} sx={{ width: { sm: 100 } }} />
              <TextField fullWidth label={`Descrição do encontro ${index + 1}`} value={item.descricao} onChange={(event) => updateSchedule(index, "descricao", event.target.value)} />
              <TextField label="Carga" type="number" value={item.carga} onChange={(event) => updateSchedule(index, "carga", event.target.value)} sx={{ width: { sm: 120 } }} />
              <Button type="button" aria-label={`Remover encontro ${index + 1}`} disabled={schedule.length === 1} onClick={() => setSchedule((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remover</Button>
            </Stack>)}
            <Button type="button" onClick={() => setSchedule((current) => [...current, { numero: String(current.length + 1), descricao: "", carga: "" }])}>Adicionar encontro</Button>
            <TextField label="ID do mentor principal" value={form.mentorMemberId} onChange={(event) => setForm({ ...form, mentorMemberId: event.target.value })} helperText={editing ? "Informe novamente o UUID do mentor para confirmar a designation." : "UUID do membro que será o mentor principal."} />
            <TextField label="IDs de co-mentores" value={form.coMentors} onChange={(event) => setForm({ ...form, coMentors: event.target.value })} helperText="Opcional; UUIDs separados por vírgula." />
            <TextField label="Notas internas" multiline minRows={2} value={form.internalNotes} onChange={(event) => setForm({ ...form, internalNotes: event.target.value })} />
            <FormControlLabel control={<Checkbox checked={form.isPublic} onChange={(event) => setForm({ ...form, isPublic: event.target.checked })} />} label="Exibir publicamente quando ativo" />
          </Stack></DialogContent>
          <DialogActions sx={{ flexWrap: "wrap" }}><Button type="button" onClick={() => setFormOpen(false)}>Fechar</Button>{(!editing || editing.status === "draft") && <Button type="submit" disabled={saving} onClick={(event) => { event.preventDefault(); void saveProject("draft"); }}>{saving ? "Salvando…" : "Salvar rascunho"}</Button>}<Button type="submit" variant="contained" disabled={saving} onClick={(event) => { event.preventDefault(); void saveProject("proposed"); }}>{saving ? "Salvando…" : "Salvar proposta"}</Button></DialogActions>
        </form>
      </Dialog>

      <Dialog open={finishTarget !== null} onClose={() => !saving && setFinishTarget(null)} fullWidth maxWidth="sm">
        <form onSubmit={(event) => void finishProject(event)}>
          <DialogTitle>Finalizar projeto</DialogTitle>
          <DialogContent><Stack spacing={2} sx={{ pt: 1 }}><Typography variant="body2" color="text.secondary">{finishTarget?.name}</Typography><TextField label="URL do relatório" type="url" required autoFocus value={reportUrl} onChange={(event) => setReportUrl(event.target.value)} helperText="Discussion com o relatório final do projeto." /></Stack></DialogContent>
          <DialogActions><Button type="button" onClick={() => setFinishTarget(null)}>Cancelar</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? "Finalizando…" : "Confirmar finalização"}</Button></DialogActions>
        </form>
      </Dialog>
    </PageContainer>
  );
}

export default function ProjectsAdminApp() {
  return <MuiIslandProvider><ProjectsAdminInner /></MuiIslandProvider>;
}

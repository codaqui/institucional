import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MuiIslandProvider from "../../MuiIslandProvider";
import PageContainer from "../ui/PageContainer";
import AdminLoadFeedback from "../ui/AdminLoadFeedback";
import DataTable from "../ui/DataTable";
import ProjectFormDialog from "./ProjectFormDialog";
import { formatProjectPeriod } from "../../../../lib/project-period";
import { useAuth } from "../../../../lib/use-auth";
import {
  extractErrorMessage,
  parseAuthJson,
} from "../../../../lib/auth-fetch-helpers";
import {
  DEFAULT_PAGE_SIZE,
  rangeLabel,
  type PaginatedResponse,
} from "../../../../lib/pagination";
import type { ManagedProject, ProjectCategory } from "./project-form";

type ProjectStatus = ManagedProject["status"];
type CategoryFilter = ProjectCategory | "all";

const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  extension: "Projetos de extensão",
  program: "Programas",
  campaign: "Campanhas comunitárias",
  open_source: "Open Source",
};

interface EntityOption {
  id: string;
  name: string;
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Rascunho",
  proposed: "Proposto",
  active: "Ativo",
  finished: "Finalizado",
  canceled: "Cancelado",
};

function ProjectsAdminInner() {
  const { ready, isLoggedIn, isAdmin, user, authFetch } = useAuth();
  const canAccess = isAdmin || (user?.roles.includes("diretor") ?? false);
  const [items, setItems] = useState<ManagedProject[]>([]);
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [entityId, setEntityId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState<{
    severity: "success" | "error";
    message: string;
  } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedProject | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [finishTarget, setFinishTarget] = useState<ManagedProject | null>(null);
  const [reportUrl, setReportUrl] = useState("");

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams({
      page: String(page),
      limit: String(DEFAULT_PAGE_SIZE),
      category,
    });
    if (status) params.set("status", status);
    if (entityId) params.set("entityId", entityId);
    try {
      const response = await authFetch(`/projects?${params.toString()}`);
      const result = await parseAuthJson<PaginatedResponse<ManagedProject>>(
        response,
        setLoadError,
      );
      if (!result) return;
      setItems(Array.isArray(result.data) ? result.data : []);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch {
      setLoadError("Não foi possível carregar os projetos.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, page, category, status, entityId]);

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
    const loadEntities = async () => {
      const allEntities: EntityOption[] = [];
      let currentPage = 1;
      let pages = 1;
      do {
        const response = await authFetch(`/entities?page=${currentPage}&limit=${DEFAULT_PAGE_SIZE}`);
        const result = await parseAuthJson<PaginatedResponse<EntityOption>>(
          response,
          setLoadError,
        );
        if (!result) return;
        allEntities.push(...(Array.isArray(result.data) ? result.data : []));
        pages = result.totalPages;
        currentPage += 1;
      } while (currentPage <= pages);
      setEntities(allEntities);
    };
    void loadEntities().catch(() => setLoadError("Não foi possível carregar as entidades."));
  }, [ready, isLoggedIn, canAccess, authFetch]);

  const openProject = (project: ManagedProject | null) => {
    setEditing(project);
    setFormOpen(true);
  };

  const handleSaved = async (nextStatus: "draft" | "proposed") => {
    setFormOpen(false);
    setFeedback({
      severity: "success",
      message:
        nextStatus === "draft"
          ? "Rascunho salvo."
          : "Projeto completo salvo como proposta.",
    });
    await loadProjects();
  };

  const transition = async (
    project: ManagedProject,
    nextStatus: "active" | "canceled",
  ) => {
    const action = nextStatus === "active" ? "Ativar" : "Cancelar";
    if (!window.confirm(`${action} "${project.name}"?`)) return;
    setBusyId(project.id);
    setFeedback(null);
    try {
      const response = await authFetch(`/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        setFeedback({
          severity: "error",
          message: await extractErrorMessage(
            response,
            `Não foi possível ${action.toLocaleLowerCase("pt-BR")} o projeto.`,
          ),
        });
        return;
      }
      setFeedback({
        severity: "success",
        message: `Projeto ${nextStatus === "active" ? "ativado" : "cancelado"}.`,
      });
      await loadProjects();
    } catch {
      setFeedback({
        severity: "error",
        message: "Não foi possível alterar o projeto.",
      });
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
        body: JSON.stringify({
          status: "finished",
          reportDiscussionUrl: reportUrl.trim(),
        }),
      });
      if (!response.ok) {
        setFeedback({
          severity: "error",
          message: await extractErrorMessage(
            response,
            "Não foi possível finalizar o projeto.",
          ),
        });
        return;
      }
      setFinishTarget(null);
      setFeedback({ severity: "success", message: "Projeto finalizado." });
      await loadProjects();
    } catch {
      setFeedback({
        severity: "error",
        message: "Não foi possível finalizar o projeto.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!ready)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
        <CircularProgress aria-label="Carregando autenticação" />
      </Box>
    );
  if (!isLoggedIn || !canAccess) return null;

  return (
    <PageContainer>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          mb: 3,
          justifyContent: "space-between",
          alignItems: { sm: "center" },
        }}
      >
        <Box>
          <Typography variant="h4" component="h2" sx={{ fontWeight: 800 }}>
            Projetos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Rascunhos, propostas, ativação e acompanhamento
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => openProject(null)}>
          Novo projeto
        </Button>
      </Stack>
      <AdminLoadFeedback
        error={loadError}
        onRetry={() => void loadProjects()}
        itemLabel="projetos"
      />
      {feedback && (
        <Alert
          severity={feedback.severity}
          sx={{ mb: 2 }}
          onClose={() => setFeedback(null)}
        >
          {feedback.message}
        </Alert>
      )}

      <Tabs
        value={category}
        onChange={(_event, nextCategory: CategoryFilter) => {
          setPage(1);
          setCategory(nextCategory);
        }}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Filtrar projetos por categoria"
        sx={{ mb: 3 }}
      >
        <Tab value="all" label="Todas as categorias" />
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <Tab key={value} value={value} label={label} />
        ))}
      </Tabs>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          fullWidth
          size="small"
          label="Filtrar por status"
          select
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value as ProjectStatus | "");
          }}
        >
          <MenuItem value="">Todos</MenuItem>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          fullWidth
          size="small"
          label="Filtrar por entidade"
          select
          value={entityId}
          onChange={(event) => {
            setPage(1);
            setEntityId(event.target.value);
          }}
        >
          <MenuItem value="">Todas</MenuItem>
          {entities.map((entity) => (
            <MenuItem key={entity.id} value={entity.id}>
              {entity.name}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {(() => {
        if (loading) {
          return <AdminLoadFeedback loading itemLabel="projetos" />;
        }
        if (items.length === 0) {
          return (
            <Alert severity="info" sx={{ mb: 2 }}>
              Nenhum projeto encontrado. Crie o primeiro projeto para começar.
            </Alert>
          );
        }
        return (
          <>
            <DataTable
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              itemLabel="projetos"
              tableContainerSx={{ overflowX: "auto" }}
              table={
              <Table
                size="small"
                sx={{
                  "@media (max-width: 600px)": {
                    display: "block",
                    "& thead": { display: "none" },
                    "& tbody, & tr, & td": { display: "block" },
                    "& tr": {
                      mb: 2,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                      p: 1.5,
                    },
                    "& td": {
                      display: "flex",
                      gap: 1,
                      borderBottom: 0,
                      px: 0,
                      py: 0.5,
                    },
                    "& td::before": {
                      content: 'attr(data-label) ": "',
                      flexShrink: 0,
                      fontWeight: 700,
                    },
                    "& td:last-child": { display: "block" },
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>Projeto</TableCell>
                    <TableCell>Categoria</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Período</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell data-label="Projeto">
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {project.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {entities.find(
                            (entity) => entity.id === project.entityId,
                          )?.name ?? "Entidade"}
                        </Typography>
                      </TableCell>
                      <TableCell data-label="Categoria">
                        <Chip
                          size="small"
                          variant="outlined"
                          label={CATEGORY_LABELS[project.category ?? "extension"]}
                        />
                      </TableCell>
                      <TableCell data-label="Status">
                        <Chip
                          size="small"
                          variant="outlined"
                          label={STATUS_LABELS[project.status]}
                        />
                      </TableCell>
                      <TableCell data-label="Período">
                        {formatProjectPeriod(project.startsAt, project.endsAt)}
                      </TableCell>
                      <TableCell align="right" data-label="Ações">
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}
                        >
                          {project.canonicalUrl && (
                            <Button
                              size="small"
                              href={project.canonicalUrl}
                              target={project.canonicalUrl.startsWith("https://") ? "_blank" : undefined}
                              rel={project.canonicalUrl.startsWith("https://") ? "noopener noreferrer" : undefined}
                            >
                              Abrir destino
                            </Button>
                          )}
                          {["draft", "proposed"].includes(project.status) && (
                            <Button
                              size="small"
                              onClick={() => openProject(project)}
                            >
                              Editar
                            </Button>
                          )}
                          {project.status === "proposed" && (
                            <Button
                              size="small"
                              variant="contained"
                              disabled={busyId === project.id}
                              onClick={() => void transition(project, "active")}
                            >
                              Ativar
                            </Button>
                          )}
                          {project.status === "active" && (
                            <Button
                              size="small"
                              disabled={busyId === project.id}
                              onClick={() => {
                                setReportUrl("");
                                setFinishTarget(project);
                              }}
                            >
                              Finalizar
                            </Button>
                          )}
                          {!["finished", "canceled"].includes(
                            project.status,
                          ) && (
                            <Button
                              size="small"
                              color="error"
                              disabled={busyId === project.id}
                              onClick={() =>
                                void transition(project, "canceled")
                              }
                            >
                              Cancelar
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            }
            />
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: "center", my: 1 }}
            >
              {rangeLabel(page, DEFAULT_PAGE_SIZE, total)}
            </Typography>
          </>
        );
      })()}

      <ProjectFormDialog
        open={formOpen}
        project={editing}
        entities={entities}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      <Dialog
        open={finishTarget !== null}
        onClose={() => !saving && setFinishTarget(null)}
        fullWidth
        maxWidth="sm"
      >
        <form onSubmit={(event) => void finishProject(event)}>
          <DialogTitle>Finalizar projeto</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {finishTarget?.name}
              </Typography>
              <TextField
                label="URL do relatório"
                type="url"
                required
                autoFocus
                value={reportUrl}
                onChange={(event) => setReportUrl(event.target.value)}
                helperText="Discussion com o relatório final do projeto."
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => setFinishTarget(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? "Finalizando…" : "Confirmar finalização"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </PageContainer>
  );
}

export default function ProjectsAdminApp() {
  return (
    <MuiIslandProvider>
      <ProjectsAdminInner />
    </MuiIslandProvider>
  );
}

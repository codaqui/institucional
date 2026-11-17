import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useAuth } from "../../../../lib/use-auth";
import type { Project } from "../../../../data/projects";
import { extractErrorMessage } from "../../../../lib/auth-fetch-helpers";
import ProjectMentorFields from "./ProjectMentorFields";
import ProjectResourcesFields from "./ProjectResourcesFields";
import {
  ODS_OPTIONS,
  buildProjectPayload,
  createFormRowId,
  createProjectFormFromOpenSource,
  createProjectFormFromProject,
  validateProjectForm,
  type ManagedProject,
  type ProjectFormValues,
} from "./project-form";

interface EntityOption {
  id: string;
  name: string;
}

interface ProjectFormDialogProps {
  readonly open: boolean;
  readonly project: ManagedProject | null;
  readonly sourceProject?: Project | null;
  readonly entities: EntityOption[];
  readonly onClose: () => void;
  readonly onSaved: (status: "draft" | "proposed") => Promise<void>;
}

export default function ProjectFormDialog({
  open,
  project,
  sourceProject = null,
  entities,
  onClose,
  onSaved,
}: ProjectFormDialogProps): React.JSX.Element {
  const { authFetch } = useAuth();
  const [form, setForm] = useState<ProjectFormValues>(() =>
    createProjectFormFromProject(project),
  );
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(project
      ? createProjectFormFromProject(project, entities[0]?.id ?? "")
      : sourceProject
        ? createProjectFormFromOpenSource(sourceProject, entities[0]?.id ?? "")
        : createProjectFormFromProject(null, entities[0]?.id ?? ""));
    setFormError("");
  }, [open, project, sourceProject, entities]);

  const updateField = <K extends keyof ProjectFormValues>(
    key: K,
    value: ProjectFormValues[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async (status: "draft" | "proposed") => {
    if (status === "proposed") {
      const errors = validateProjectForm(form);
      if (errors.length > 0) {
        setFormError(errors.join(" "));
        return;
      }
    }
    setSaving(true);
    setFormError("");
    try {
      const response = await authFetch(
        project ? `/projects/${project.id}` : "/projects",
        {
          method: project ? "PATCH" : "POST",
          body: JSON.stringify(buildProjectPayload(form, status)),
        },
      );
      if (!response.ok) {
        setFormError(
          await extractErrorMessage(
            response,
            "Não foi possível salvar o projeto.",
          ),
        );
        return;
      }
      await onSaved(status);
    } catch {
      setFormError("Não foi possível salvar o projeto.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      fullWidth
      maxWidth="md"
    >
      <form onSubmit={(event) => event.preventDefault()}>
        <DialogTitle>{project ? "Editar projeto" : "Novo projeto"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <Alert severity="info">
              Salve o rascunho com nome e entidade. Para propor, preencha todos
              os campos obrigatórios e designe o mentor principal.
            </Alert>
            {sourceProject && (
              <Alert severity="info">
                A origem open source permanece na vitrine. Revise os dados antes de salvar.{" "}
                <Link href={sourceProject.href} target="_blank" rel="noopener noreferrer">Origem open source</Link>
              </Alert>
            )}
            <TextField
              label="Nome"
              required
              value={form.name}
              disabled={saving}
              onChange={(event) => updateField("name", event.target.value)}
            />
            <TextField
              label="Entidade"
              select
              required
              disabled={Boolean(project) || saving}
              value={form.entityId}
              onChange={(event) => updateField("entityId", event.target.value)}
            >
              {entities.map((entity) => (
                <MenuItem key={entity.id} value={entity.id}>
                  {entity.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Tipo de iniciativa"
              select
              value={form.kind}
              disabled={saving}
              onChange={(event) =>
                updateField(
                  "kind",
                  event.target.value as ProjectFormValues["kind"],
                )
              }
            >
              <MenuItem value="programa">Programa</MenuItem>
              <MenuItem value="projeto">Projeto</MenuItem>
              <MenuItem value="oficina">Oficina</MenuItem>
              <MenuItem value="evento">Evento</MenuItem>
              <MenuItem value="prestacao_servicos">
                Prestação de serviços
              </MenuItem>
            </TextField>
            <TextField
              label="Resumo"
              multiline
              minRows={2}
              value={form.summary}
              disabled={saving}
              onChange={(event) => updateField("summary", event.target.value)}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                fullWidth
                label="Início do projeto"
                type="date"
                value={form.startsAt}
                disabled={saving}
                onChange={(event) =>
                  updateField("startsAt", event.target.value)
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                fullWidth
                label="Fim do projeto"
                type="date"
                value={form.endsAt}
                disabled={saving}
                onChange={(event) => updateField("endsAt", event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                fullWidth
                label="Início das inscrições"
                type="date"
                value={form.registrationStartsAt}
                disabled={saving}
                onChange={(event) =>
                  updateField("registrationStartsAt", event.target.value)
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                fullWidth
                label="Fim das inscrições"
                type="date"
                value={form.registrationEndsAt}
                disabled={saving}
                onChange={(event) =>
                  updateField("registrationEndsAt", event.target.value)
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                fullWidth
                label="ODS principal"
                select
                value={form.odsPrimary}
                disabled={saving}
                onChange={(event) =>
                  updateField("odsPrimary", Number(event.target.value))
                }
              >
                {ODS_OPTIONS.map((ods) => (
                  <MenuItem key={ods.value} value={ods.value}>
                    {ods.value} — {ods.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                label="ODS secundárias"
                select
                value={form.odsSecondary}
                disabled={saving}
                slotProps={{ select: { multiple: true } }}
                onChange={(event) =>
                  updateField(
                    "odsSecondary",
                    Array.isArray(event.target.value)
                      ? event.target.value.map(Number)
                      : [],
                  )
                }
              >
                {ODS_OPTIONS.filter((ods) => ods.value !== form.odsPrimary).map(
                  (ods) => (
                    <MenuItem key={ods.value} value={ods.value}>
                      {ods.value} — {ods.label}
                    </MenuItem>
                  ),
                )}
              </TextField>
              <TextField
                fullWidth
                label="Carga horária total"
                type="number"
                value={form.totalHours}
                disabled={saving}
                onChange={(event) =>
                  updateField("totalHours", event.target.value)
                }
                slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
              />
              <TextField
                fullWidth
                label="Vagas"
                type="number"
                value={form.maxParticipants}
                disabled={saving}
                onChange={(event) =>
                  updateField("maxParticipants", event.target.value)
                }
                slotProps={{ htmlInput: { min: 0 } }}
              />
            </Stack>
            <TextField
              label="Público da comunidade"
              value={form.targetCommunity}
              disabled={saving}
              onChange={(event) =>
                updateField("targetCommunity", event.target.value)
              }
            />
            <TextField
              label="Justificativa"
              multiline
              minRows={2}
              value={form.justification}
              disabled={saving}
              onChange={(event) =>
                updateField("justification", event.target.value)
              }
            />
            <TextField
              label="Objetivo"
              multiline
              minRows={2}
              value={form.objective}
              disabled={saving}
              onChange={(event) => updateField("objective", event.target.value)}
            />
            <TextField
              label="Competências desenvolvidas"
              multiline
              minRows={2}
              value={form.skillsDeveloped}
              disabled={saving}
              onChange={(event) =>
                updateField("skillsDeveloped", event.target.value)
              }
            />
            <TextField
              label="Metodologia"
              multiline
              minRows={2}
              value={form.methodology}
              disabled={saving}
              onChange={(event) =>
                updateField("methodology", event.target.value)
              }
            />

            <Typography variant="h6" component="h3">
              Encontros
            </Typography>
            {form.schedule.map((item, index) => (
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                key={item.id}
              >
                <TextField
                  label="Número"
                  type="number"
                  value={item.numero}
                  disabled={saving}
                  onChange={(event) =>
                    updateField(
                      "schedule",
                      form.schedule.map((current, itemIndex) =>
                        itemIndex === index
                          ? { ...current, numero: event.target.value }
                          : current,
                      ),
                    )
                  }
                  sx={{ width: { sm: 100 } }}
                />
                <TextField
                  fullWidth
                  label={`Descrição do encontro ${index + 1}`}
                  value={item.descricao}
                  disabled={saving}
                  onChange={(event) =>
                    updateField(
                      "schedule",
                      form.schedule.map((current, itemIndex) =>
                        itemIndex === index
                          ? { ...current, descricao: event.target.value }
                          : current,
                      ),
                    )
                  }
                />
                <TextField
                  label="Carga"
                  type="number"
                  value={item.carga}
                  disabled={saving}
                  onChange={(event) =>
                    updateField(
                      "schedule",
                      form.schedule.map((current, itemIndex) =>
                        itemIndex === index
                          ? { ...current, carga: event.target.value }
                          : current,
                      ),
                    )
                  }
                  sx={{ width: { sm: 120 } }}
                />
                <Button
                  type="button"
                  aria-label={`Remover encontro ${index + 1}`}
                  disabled={saving || form.schedule.length === 1}
                  onClick={() =>
                    updateField(
                      "schedule",
                      form.schedule.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    )
                  }
                >
                  Remover
                </Button>
              </Stack>
            ))}
            <Button
              type="button"
              disabled={saving}
              onClick={() =>
                updateField("schedule", [
                  ...form.schedule,
                  {
                    id: createFormRowId(),
                    numero: String(form.schedule.length + 1),
                    descricao: "",
                    carga: "",
                  },
                ])
              }
            >
              Adicionar encontro
            </Button>

            <ProjectMentorFields
              mentor={form.mentor}
              coMentors={form.coMentors}
              disabled={saving}
              onChange={(mentor, coMentors) =>
                setForm((current) => ({ ...current, mentor, coMentors }))
              }
            />
            <ProjectResourcesFields
              supportPartners={form.supportPartners}
              budgetItems={form.budgetItems}
              attachments={form.attachments}
              disabled={saving}
              onChange={(values) =>
                setForm((current) => ({ ...current, ...values }))
              }
            />
            <TextField
              label="Notas internas"
              multiline
              minRows={2}
              value={form.internalNotes}
              disabled={saving}
              onChange={(event) =>
                updateField("internalNotes", event.target.value)
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.isPublic}
                  disabled={saving}
                  onChange={(event) =>
                    updateField("isPublic", event.target.checked)
                  }
                />
              }
              label="Exibir publicamente quando ativo"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap" }}>
          <Button type="button" disabled={saving} onClick={onClose}>
            Fechar
          </Button>
          {(!project || project.status === "draft") && (
            <Button
              type="submit"
              disabled={saving}
              onClick={(event) => {
                event.preventDefault();
                void save("draft");
              }}
            >
              {saving ? "Salvando…" : "Salvar rascunho"}
            </Button>
          )}
          <Button
            type="submit"
            variant="contained"
            disabled={saving}
            onClick={(event) => {
              event.preventDefault();
              void save("proposed");
            }}
          >
            {saving ? "Salvando…" : "Salvar proposta"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

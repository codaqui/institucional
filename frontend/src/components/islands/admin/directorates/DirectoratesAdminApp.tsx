import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { useMyDesignations } from "../../../../lib/use-designations";
import {
  extractErrorMessage,
  parseAuthJson,
} from "../../../../lib/auth-fetch-helpers";
import {
  DEFAULT_PAGE_SIZE,
  rangeLabel,
  type PaginatedResponse,
} from "../../../../lib/pagination";

interface Directorate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DirectorateForm {
  name: string;
  slug: string;
  description: string;
}

type FormErrors = Partial<Record<keyof DirectorateForm, string>>;
type DesignationKind = "director" | "volunteer";

const EMPTY_FORM: DirectorateForm = { name: "", slug: "", description: "" };

function validateFormField(
  field: keyof DirectorateForm,
  value: string,
): string {
  const trimmed = value.trim();
  if (field === "name") {
    if (!trimmed) return "Informe o nome da diretoria.";
    if (trimmed.length < 2) return "O nome deve ter pelo menos 2 caracteres.";
  }
  if (field === "slug") {
    if (!trimmed) return "Informe um slug para a diretoria.";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)) {
      return "Use apenas letras minúsculas, números e hífens.";
    }
  }
  return "";
}

function DirectoratesAdminInner(): React.JSX.Element | null {
  const { ready, isLoggedIn, isAdmin, user, authFetch } = useAuth();
  const {
    data: designations,
    error: designationsError,
    refresh: refreshDesignations,
  } = useMyDesignations();
  const isDirector = user?.roles.includes("diretor") ?? false;
  const canAccess = isAdmin || isDirector;

  const [items, setItems] = useState<Directorate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<{
    severity: "success" | "error";
    message: string;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Directorate | null>(null);
  const [form, setForm] = useState<DirectorateForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [designationTarget, setDesignationTarget] = useState<{
    directorate: Directorate;
    designation: DesignationKind;
  } | null>(null);
  const [memberId, setMemberId] = useState("");
  const [memberIdError, setMemberIdError] = useState("");
  const [designationError, setDesignationError] = useState("");

  const loadDirectorates = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams({
      page: String(page),
      limit: String(DEFAULT_PAGE_SIZE),
    });
    if (search) params.set("search", search);
    try {
      const res = await authFetch(`/directorates/manage?${params.toString()}`);
      const result = await parseAuthJson<PaginatedResponse<Directorate>>(
        res,
        setLoadError,
      );
      if (!result) return;
      setItems(Array.isArray(result.data) ? result.data : []);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch {
      setLoadError("Não foi possível carregar as diretorias.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, page, search]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !canAccess) {
      window.location.replace("/");
      return;
    }
    void loadDirectorates();
  }, [ready, isLoggedIn, canAccess, loadDirectorates]);

  const canEdit = useCallback(
    (directorate: Directorate) =>
      isAdmin ||
      designations.some(
        (designation) =>
          designation.targetType === "directorate" &&
          designation.targetId === directorate.id &&
          designation.designation === "director",
      ),
    [designations, isAdmin],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (directorate: Directorate) => {
    setEditing(directorate);
    setForm({
      name: directorate.name,
      slug: directorate.slug,
      description: directorate.description ?? "",
    });
    setFormErrors({});
    setFormError("");
    setFormOpen(true);
  };

  const updateFormField = (field: keyof DirectorateForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validateOnBlur = (field: keyof DirectorateForm) => {
    const error = validateFormField(field, form[field]);
    if (error) setFormErrors((current) => ({ ...current, [field]: error }));
  };

  const saveDirectorate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors: FormErrors = {
      name: validateFormField("name", form.name) || undefined,
      slug: validateFormField("slug", form.slug) || undefined,
    };
    setFormErrors(errors);
    if (errors.name || errors.slug) {
      document
        .getElementById(errors.name ? "directorate-name" : "directorate-slug")
        ?.focus();
      return;
    }

    const action = editing ? "Salvar alterações" : "Criar diretoria";
    if (!window.confirm(`${action} para "${form.name.trim()}"?`)) return;

    setSaving(true);
    setFormError("");
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
    };
    try {
      const res = await authFetch(
        editing ? `/directorates/${editing.id}` : "/directorates",
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        setFormError(
          await extractErrorMessage(res, "Não foi possível salvar a diretoria."),
        );
        return;
      }
      setFormOpen(false);
      setFeedback({ severity: "success", message: "Diretoria salva com sucesso." });
      await Promise.all([refreshDesignations(), loadDirectorates()]);
    } catch {
      setFormError("Não foi possível salvar a diretoria.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (directorate: Directorate) => {
    const action = directorate.isActive ? "Desativar" : "Ativar";
    if (!window.confirm(`${action} "${directorate.name}"?`)) return;

    setBusyId(directorate.id);
    setFeedback(null);
    try {
      const res = await authFetch(`/directorates/${directorate.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !directorate.isActive }),
      });
      if (!res.ok) {
        setFeedback({
          severity: "error",
          message: await extractErrorMessage(
            res,
            `Não foi possível ${action.toLowerCase()} a diretoria.`,
          ),
        });
        return;
      }
      setFeedback({
        severity: "success",
        message: `Diretoria ${directorate.isActive ? "desativada" : "ativada"} com sucesso.`,
      });
      await Promise.all([refreshDesignations(), loadDirectorates()]);
    } catch {
      setFeedback({
        severity: "error",
        message: `Não foi possível ${action.toLowerCase()} a diretoria.`,
      });
    } finally {
      setBusyId(null);
    }
  };

  const openDesignation = (
    directorate: Directorate,
    designation: DesignationKind,
  ) => {
    setDesignationTarget({ directorate, designation });
    setMemberId("");
    setMemberIdError("");
    setDesignationError("");
  };

  const grantDesignation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!designationTarget) return;
    const trimmedMemberId = memberId.trim();
    if (!trimmedMemberId) {
      setMemberIdError("Informe o ID do membro.");
      document.getElementById("designation-member-id")?.focus();
      return;
    }
    const label = designationTarget.designation === "director" ? "diretor" : "voluntário";
    if (
      !window.confirm(
        `Conceder ${label} em "${designationTarget.directorate.name}" para este membro?`,
      )
    ) {
      return;
    }

    setSaving(true);
    setDesignationError("");
    try {
      const res = await authFetch("/designations", {
        method: "POST",
        body: JSON.stringify({
          memberId: trimmedMemberId,
          targetType: "directorate",
          targetId: designationTarget.directorate.id,
          designation: designationTarget.designation,
        }),
      });
      if (!res.ok) {
        setDesignationError(
          await extractErrorMessage(res, "Não foi possível conceder a designation."),
        );
        return;
      }
      setDesignationTarget(null);
      setFeedback({ severity: "success", message: "Designation concedida com sucesso." });
      await Promise.all([refreshDesignations(), loadDirectorates()]);
    } catch {
      setDesignationError("Não foi possível conceder a designation.");
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!isLoggedIn || !canAccess) return null;

  return (
    <PageContainer>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ mb: 3, alignItems: { sm: "center" }, justifyContent: "space-between" }}
      >
        <Box>
          <Typography variant="h4" component="h2" sx={{ fontWeight: 800 }}>
            Diretorias
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Diretorias e vínculos organizacionais geridos por designations
          </Typography>
        </Box>
        {isAdmin && (
          <Button variant="contained" onClick={openCreate}>
            Nova diretoria
          </Button>
        )}
      </Stack>

      {(designationsError || loadError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {designationsError || loadError}
        </Alert>
      )}
      {feedback && (
        <Alert severity={feedback.severity} sx={{ mb: 2 }} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      <Box
        component="form"
        role="search"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
        sx={{ display: "flex", gap: 1, mb: 3 }}
      >
        <TextField
          label="Buscar diretorias"
          name="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          fullWidth
          size="small"
        />
        <Button type="submit" variant="outlined">
          Buscar
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : items.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: "center", py: 6 }}>
          Nenhuma diretoria encontrada.
        </Typography>
      ) : (
        <>
          <TableContainer component={Box} sx={{ mb: 2 }}>
            <Table size="small" aria-label="Diretorias cadastradas">
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Slug</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((directorate) => (
                  <TableRow key={directorate.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {directorate.name}
                      </Typography>
                      {directorate.description && (
                        <Typography variant="caption" color="text.secondary">
                          {directorate.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{directorate.slug}</TableCell>
                    <TableCell>
                      <Chip
                        label={directorate.isActive ? "Ativa" : "Inativa"}
                        color={directorate.isActive ? "success" : "default"}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                        {canEdit(directorate) && (
                          <>
                            <Button size="small" onClick={() => openEdit(directorate)}>
                              Editar
                            </Button>
                            <Button
                              size="small"
                              color={directorate.isActive ? "warning" : "success"}
                              disabled={busyId === directorate.id}
                              onClick={() => void toggleActive(directorate)}
                            >
                              {directorate.isActive ? "Desativar" : "Ativar"}
                            </Button>
                          </>
                        )}
                        {isAdmin && (
                          <>
                            <Button size="small" onClick={() => openDesignation(directorate, "director")}>
                              Conceder diretor
                            </Button>
                            <Button size="small" onClick={() => openDesignation(directorate, "volunteer")}>
                              Conceder voluntário
                            </Button>
                          </>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mb: 1 }}>
            {rangeLabel(page, DEFAULT_PAGE_SIZE, total)}
          </Typography>
          <PaginationControls
            page={page}
            totalPages={totalPages}
            onChange={setPage}
            itemLabel="diretorias"
          />
        </>
      )}

      <Dialog open={formOpen} onClose={() => !saving && setFormOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={(event) => void saveDirectorate(event)} noValidate>
          <DialogTitle>{editing ? "Editar diretoria" : "Nova diretoria"}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {formError && <Alert severity="error">{formError}</Alert>}
              <TextField
                id="directorate-name"
                label="Nome da diretoria"
                name="name"
                required
                autoFocus
                value={form.name}
                onChange={(event) => updateFormField("name", event.target.value)}
                onBlur={() => validateOnBlur("name")}
                error={Boolean(formErrors.name)}
                helperText={formErrors.name}
                slotProps={{ htmlInput: { maxLength: 120 } }}
              />
              <TextField
                id="directorate-slug"
                label="Slug"
                name="slug"
                required
                value={form.slug}
                onChange={(event) => updateFormField("slug", event.target.value)}
                onBlur={() => validateOnBlur("slug")}
                error={Boolean(formErrors.slug)}
                helperText={formErrors.slug ?? "Ex.: tecnologia"}
                slotProps={{
                  htmlInput: {
                    maxLength: 80,
                    autoCapitalize: "off",
                    autoCorrect: "off",
                    spellCheck: false,
                  },
                }}
              />
              <TextField
                id="directorate-description"
                label="Descrição"
                name="description"
                multiline
                minRows={3}
                value={form.description}
                onChange={(event) => updateFormField("description", event.target.value)}
                slotProps={{ htmlInput: { maxLength: 2000 } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" disabled={saving} onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar diretoria"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={designationTarget !== null}
        onClose={() => !saving && setDesignationTarget(null)}
        fullWidth
        maxWidth="sm"
      >
        <form onSubmit={(event) => void grantDesignation(event)} noValidate>
          <DialogTitle>
            Conceder {designationTarget?.designation === "director" ? "diretor" : "voluntário"}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {designationTarget?.directorate.name}
              </Typography>
              {designationError && <Alert severity="error">{designationError}</Alert>}
              <TextField
                id="designation-member-id"
                label="ID do membro"
                name="memberId"
                required
                autoFocus
                value={memberId}
                onChange={(event) => {
                  setMemberId(event.target.value);
                  setMemberIdError("");
                }}
                onBlur={() => {
                  if (!memberId.trim()) setMemberIdError("Informe o ID do membro.");
                }}
                error={Boolean(memberIdError)}
                helperText={memberIdError ?? "UUID do membro que receberá a designation."}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" disabled={saving} onClick={() => setDesignationTarget(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? "Concedendo…" : "Conceder designation"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </PageContainer>
  );
}

export default function DirectoratesAdminApp(): React.JSX.Element {
  return (
    <MuiIslandProvider>
      <DirectoratesAdminInner />
    </MuiIslandProvider>
  );
}

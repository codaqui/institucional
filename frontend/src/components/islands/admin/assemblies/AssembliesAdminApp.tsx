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
import {
  extractErrorMessage,
  parseAuthJson,
} from "../../../../lib/auth-fetch-helpers";
import {
  DEFAULT_PAGE_SIZE,
  rangeLabel,
  type PaginatedResponse,
} from "../../../../lib/pagination";
import type {
  Assembly,
  AssemblyStatus,
  AssemblyType,
} from "../../../../data/assemblies";

interface AssemblyFormState {
  type: AssemblyType;
  title: string;
  scheduledAt: string;
  agendaSummary: string;
  discussionUrl: string;
  ataPdfUrl: string;
  notaryBook: string;
  notaryPage: string;
  notaryRegisteredAt: string;
}

type FormErrors = Partial<Record<keyof AssemblyFormState, string>>;

const DISCUSSION_URL_PATTERN =
  /^https:\/\/github\.com\/codaqui\/institucional\/discussions\/[1-9]\d*$/;

const EMPTY_FORM: AssemblyFormState = {
  type: "ordinaria",
  title: "",
  scheduledAt: "",
  agendaSummary: "",
  discussionUrl: "",
  ataPdfUrl: "",
  notaryBook: "",
  notaryPage: "",
  notaryRegisteredAt: "",
};

const STATUS_LABELS: Record<AssemblyStatus, string> = {
  scheduled: "Agendada",
  held: "Realizada",
  canceled: "Cancelada",
};

function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toDateInput(value: string): string {
  return value ? value.slice(0, 10) : "";
}

function formFromAssembly(assembly: Assembly): AssemblyFormState {
  return {
    type: assembly.type,
    title: assembly.title,
    scheduledAt: toDateTimeLocal(assembly.scheduledAt),
    agendaSummary: assembly.agendaSummary,
    discussionUrl: assembly.discussionUrl,
    ataPdfUrl: assembly.ataPdfUrl ?? "",
    notaryBook: assembly.notaryRegistry?.book ?? "",
    notaryPage: assembly.notaryRegistry?.page ?? "",
    notaryRegisteredAt: toDateInput(assembly.notaryRegistry?.registeredAt ?? ""),
  };
}

function hasNotaryInput(form: AssemblyFormState): boolean {
  return Boolean(
    form.notaryBook.trim() ||
      form.notaryPage.trim() ||
      form.notaryRegisteredAt,
  );
}

function validateFormField(
  field: keyof AssemblyFormState,
  form: AssemblyFormState,
  editing: Assembly | null,
  requireOfficialDocuments: boolean,
): string {
  const value = form[field].trim();
  if (field === "title" && !value) return "Informe o título da assembleia.";
  if (field === "agendaSummary" && !value) return "Informe o resumo da pauta.";
  if (field === "scheduledAt") {
    if (!value) return "Informe a data e hora agendada.";
    if (Number.isNaN(new Date(value).getTime())) return "Informe uma data válida.";
  }
  if (field === "discussionUrl" && !editing) {
    if (!DISCUSSION_URL_PATTERN.test(value)) {
      return "Use a URL exata de uma Discussion do repositório codaqui/institucional.";
    }
  }
  if (field === "ataPdfUrl") {
    if (requireOfficialDocuments && !value) return "Informe a URL do PDF da ata.";
    if (value) {
      try {
        const url = new URL(value);
        if (url.protocol !== "https:") return "A URL do PDF deve usar HTTPS.";
      } catch {
        return "Informe uma URL válida para o PDF da ata.";
      }
    }
  }
  if (field === "notaryBook" && (requireOfficialDocuments || hasNotaryInput(form)) && !value) {
    return "Informe o livro do cartório.";
  }
  if (field === "notaryPage" && (requireOfficialDocuments || hasNotaryInput(form)) && !value) {
    return "Informe a página do cartório.";
  }
  if (field === "notaryRegisteredAt" && (requireOfficialDocuments || hasNotaryInput(form))) {
    if (!value) return "Informe a data de registro.";
    if (Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())) {
      return "Informe uma data de registro válida.";
    }
  }
  return "";
}

function validateForm(
  form: AssemblyFormState,
  editing: Assembly | null,
  isAdmin: boolean,
  requireOfficialDocuments: boolean,
): FormErrors {
  const fields: Array<keyof AssemblyFormState> = [
    "title",
    "scheduledAt",
    "agendaSummary",
  ];
  if (!editing) fields.push("discussionUrl");
  if (isAdmin) {
    fields.push("ataPdfUrl", "notaryBook", "notaryPage", "notaryRegisteredAt");
  }
  return Object.fromEntries(
    fields
      .map((field) => [
        field,
        validateFormField(field, form, editing, requireOfficialDocuments) || undefined,
      ])
      .filter(([, error]) => Boolean(error)),
  ) as FormErrors;
}

function notaryPayload(form: AssemblyFormState) {
  if (!hasNotaryInput(form)) return null;
  return {
    book: form.notaryBook.trim(),
    page: form.notaryPage.trim(),
    registeredAt: `${form.notaryRegisteredAt}T00:00:00.000Z`,
  };
}

function firstErrorField(errors: FormErrors): keyof AssemblyFormState | undefined {
  const fields: Array<keyof AssemblyFormState> = [
    "title",
    "scheduledAt",
    "agendaSummary",
    "discussionUrl",
    "ataPdfUrl",
    "notaryBook",
    "notaryPage",
    "notaryRegisteredAt",
  ];
  return fields.find((field) => Boolean(errors[field]));
}

const FIELD_IDS: Record<keyof AssemblyFormState, string> = {
  type: "assembly-type",
  title: "assembly-title",
  scheduledAt: "assembly-scheduled-at",
  agendaSummary: "assembly-agenda",
  discussionUrl: "assembly-discussion",
  ataPdfUrl: "assembly-pdf",
  notaryBook: "assembly-notary-book",
  notaryPage: "assembly-notary-page",
  notaryRegisteredAt: "assembly-notary-date",
};

interface DocumentFieldsProps {
  form: AssemblyFormState;
  errors: FormErrors;
  idPrefix?: string;
  onChange: (field: keyof AssemblyFormState, value: string) => void;
  onBlur: (field: keyof AssemblyFormState) => void;
}

function DocumentFields({
  form,
  errors,
  idPrefix = "assembly",
  onChange,
  onBlur,
}: Readonly<DocumentFieldsProps>) {
  const id = (field: keyof AssemblyFormState) =>
    idPrefix === "assembly" ? FIELD_IDS[field] : `${idPrefix}-${field}`;
  return (
    <>
      <Typography component="h3" variant="subtitle1" sx={{ pt: 1, fontWeight: 700 }}>
        Ata e cartório (somente admin)
      </Typography>
      <TextField
        id={id("ataPdfUrl")}
        label="URL do PDF da ata"
        name="ataPdfUrl"
        type="url"
        value={form.ataPdfUrl}
        onChange={(event) => onChange("ataPdfUrl", event.target.value)}
        onBlur={() => onBlur("ataPdfUrl")}
        error={Boolean(errors.ataPdfUrl)}
        helperText={errors.ataPdfUrl ?? "Link HTTPS em um dos serviços aceitos pela Associação."}
        slotProps={{ htmlInput: { maxLength: 2048, autoCapitalize: "off", spellCheck: false } }}
      />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          id={id("notaryBook")}
          label="Livro do cartório"
          name="notaryBook"
          fullWidth
          value={form.notaryBook}
          onChange={(event) => onChange("notaryBook", event.target.value)}
          onBlur={() => onBlur("notaryBook")}
          error={Boolean(errors.notaryBook)}
          helperText={errors.notaryBook}
          slotProps={{ htmlInput: { maxLength: 80 } }}
        />
        <TextField
          id={id("notaryPage")}
          label="Página do cartório"
          name="notaryPage"
          fullWidth
          value={form.notaryPage}
          onChange={(event) => onChange("notaryPage", event.target.value)}
          onBlur={() => onBlur("notaryPage")}
          error={Boolean(errors.notaryPage)}
          helperText={errors.notaryPage}
          slotProps={{ htmlInput: { maxLength: 40 } }}
        />
      </Stack>
      <TextField
        id={id("notaryRegisteredAt")}
        label="Data de registro"
        name="notaryRegisteredAt"
        type="date"
        value={form.notaryRegisteredAt}
        onChange={(event) => onChange("notaryRegisteredAt", event.target.value)}
        onBlur={() => onBlur("notaryRegisteredAt")}
        error={Boolean(errors.notaryRegisteredAt)}
        helperText={errors.notaryRegisteredAt}
        slotProps={{ inputLabel: { shrink: true } }}
      />
    </>
  );
}

function AssembliesAdminInner(): React.JSX.Element | null {
  const { ready, isLoggedIn, isAdmin, user, authFetch } = useAuth();
  const canAccess = isAdmin || (user?.roles.includes("diretor") ?? false);
  const [items, setItems] = useState<Assembly[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [status, setStatus] = useState<AssemblyStatus | "">("");
  const [type, setType] = useState<AssemblyType | "">("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState<{
    severity: "success" | "error";
    message: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Assembly | null>(null);
  const [form, setForm] = useState<AssemblyFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState("");

  const [transition, setTransition] = useState<{
    kind: "held" | "canceled";
    assembly: Assembly;
  } | null>(null);
  const [heldAt, setHeldAt] = useState("");
  const [heldAtError, setHeldAtError] = useState("");
  const [transitionForm, setTransitionForm] = useState<AssemblyFormState>(EMPTY_FORM);
  const [transitionErrors, setTransitionErrors] = useState<FormErrors>({});
  const [transitionError, setTransitionError] = useState("");

  const loadAssemblies = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams({
      page: String(page),
      limit: String(DEFAULT_PAGE_SIZE),
    });
    if (status) params.set("status", status);
    if (type) params.set("type", type);
    try {
      const response = await authFetch(`/assemblies?${params.toString()}`);
      const result = await parseAuthJson<PaginatedResponse<Assembly>>(
        response,
        setLoadError,
      );
      if (!result) return;
      setItems(Array.isArray(result.data) ? result.data : []);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch {
      setLoadError("Não foi possível carregar as assembleias.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, page, status, type]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !canAccess) {
      window.location.replace("/");
      return;
    }
    void loadAssemblies();
  }, [ready, isLoggedIn, canAccess, loadAssemblies]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (assembly: Assembly) => {
    setEditing(assembly);
    setForm(formFromAssembly(assembly));
    setFormErrors({});
    setFormError("");
    setFormOpen(true);
  };

  const updateForm = (
    field: keyof AssemblyFormState,
    value: string,
    target: "main" | "transition" = "main",
  ) => {
    const setTarget = target === "main" ? setForm : setTransitionForm;
    const setTargetErrors = target === "main" ? setFormErrors : setTransitionErrors;
    setTarget((current) => ({ ...current, [field]: value }));
    setTargetErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validateOnBlur = (
    field: keyof AssemblyFormState,
    target: "main" | "transition" = "main",
  ) => {
    const currentForm = target === "main" ? form : transitionForm;
    const setTargetErrors = target === "main" ? setFormErrors : setTransitionErrors;
    const requireOfficialDocuments =
      target === "transition"
        ? transition?.assembly.type === "oficial"
        : editing?.type === "oficial" && editing.status === "held";
    const error = validateFormField(
      field,
      currentForm,
      target === "main" ? editing : transition?.assembly ?? null,
      requireOfficialDocuments,
    );
    if (error) setTargetErrors((current) => ({ ...current, [field]: error }));
  };

  const saveAssembly = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requireOfficialDocuments =
      editing?.type === "oficial" && editing.status === "held";
    const errors = validateForm(form, editing, isAdmin, requireOfficialDocuments);
    setFormErrors(errors);
    const firstError = firstErrorField(errors);
    if (firstError) {
      document.getElementById(FIELD_IDS[firstError])?.focus();
      return;
    }

    setBusy(true);
    setFormError("");
    const payload = {
      ...(!editing ? { type: form.type, discussionUrl: form.discussionUrl.trim() } : {}),
      title: form.title.trim(),
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      agendaSummary: form.agendaSummary.trim(),
      ...(isAdmin
        ? {
            ataPdfUrl: form.ataPdfUrl.trim() || null,
            notaryRegistry: notaryPayload(form),
          }
        : {}),
    };
    try {
      const response = await authFetch(
        editing ? `/assemblies/${editing.id}` : "/assemblies",
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        setFormError(
          await extractErrorMessage(response, "Não foi possível salvar a assembleia."),
        );
        return;
      }
      setFormOpen(false);
      setFeedback({ severity: "success", message: "Assembleia salva com sucesso." });
      await loadAssemblies();
    } catch {
      setFormError("Não foi possível salvar a assembleia.");
    } finally {
      setBusy(false);
    }
  };

  const openTransition = (assembly: Assembly, kind: "held" | "canceled") => {
    setTransition({ assembly, kind });
    setHeldAt(toDateTimeLocal(assembly.heldAt ?? assembly.scheduledAt));
    setHeldAtError("");
    setTransitionForm(formFromAssembly(assembly));
    setTransitionErrors({});
    setTransitionError("");
  };

  const runTransition = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!transition) return;
    const { assembly, kind } = transition;
    let payload: Record<string, unknown> = { status: kind };
    if (kind === "held") {
      const heldTime = new Date(heldAt).getTime();
      const scheduledTime = new Date(assembly.scheduledAt).getTime();
      if (!heldAt || Number.isNaN(heldTime)) {
        setHeldAtError("Informe a data e hora da realização.");
        document.getElementById("assembly-held-at")?.focus();
        return;
      }
      if (heldTime < scheduledTime) {
        setHeldAtError("A realização não pode ser anterior ao agendamento.");
        document.getElementById("assembly-held-at")?.focus();
        return;
      }
      const errors = validateForm(
        transitionForm,
        assembly,
        isAdmin,
        assembly.type === "oficial",
      );
      setTransitionErrors(errors);
      const firstError = firstErrorField(errors);
      if (firstError) {
        document.getElementById(`held-${firstError}`)?.focus();
        return;
      }
      payload = {
        ...payload,
        heldAt: new Date(heldAt).toISOString(),
        ...(isAdmin
          ? {
              ataPdfUrl: transitionForm.ataPdfUrl.trim() || null,
              notaryRegistry: notaryPayload(transitionForm),
            }
          : {}),
      };
    }

    setBusy(true);
    setTransitionError("");
    try {
      const response = await authFetch(`/assemblies/${assembly.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setTransitionError(
          await extractErrorMessage(
            response,
            kind === "held"
              ? "Não foi possível realizar a assembleia."
              : "Não foi possível cancelar a assembleia.",
          ),
        );
        return;
      }
      setTransition(null);
      setFeedback({
        severity: "success",
        message: kind === "held" ? "Assembleia realizada." : "Assembleia cancelada.",
      });
      await loadAssemblies();
    } catch {
      setTransitionError(
        kind === "held"
          ? "Não foi possível realizar a assembleia."
          : "Não foi possível cancelar a assembleia.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
        <CircularProgress aria-label="Carregando autenticação" />
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
            Assembleias
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Agendamento, pauta, realização, cancelamento, ata e cartório
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate}>
          Nova assembleia
        </Button>
      </Stack>

      {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}
      {feedback && (
        <Alert severity={feedback.severity} sx={{ mb: 2 }} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          label="Filtrar por status"
          select
          size="small"
          fullWidth
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value as AssemblyStatus | "");
          }}
        >
          <MenuItem value="">Todos os status</MenuItem>
          <MenuItem value="scheduled">Agendadas</MenuItem>
          <MenuItem value="held">Realizadas</MenuItem>
          <MenuItem value="canceled">Canceladas</MenuItem>
        </TextField>
        <TextField
          label="Filtrar por tipo"
          select
          size="small"
          fullWidth
          value={type}
          onChange={(event) => {
            setPage(1);
            setType(event.target.value as AssemblyType | "");
          }}
        >
          <MenuItem value="">Todos os tipos</MenuItem>
          <MenuItem value="ordinaria">Ordinárias</MenuItem>
          <MenuItem value="oficial">Oficiais</MenuItem>
        </TextField>
      </Stack>

      {(() => {
        if (loading) {
          return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress aria-label="Carregando assembleias" />
            </Box>
          );
        }
        if (items.length === 0) {
          return (
            <Typography color="text.secondary" sx={{ textAlign: "center", py: 6 }}>
              Nenhuma assembleia encontrada.
            </Typography>
          );
        }
        return (
          <>
            <TableContainer component={Box} sx={{ mb: 2, overflowX: "auto" }}>
              <Table size="small" aria-label="Assembleias cadastradas">
                <TableHead>
                  <TableRow>
                    <TableCell>Assembleia</TableCell>
                    <TableCell>Agendamento</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((assembly) => (
                    <TableRow key={assembly.id}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {assembly.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {assembly.type === "oficial" ? "Oficial" : "Ordinária"} nº {assembly.number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <time dateTime={assembly.scheduledAt}>
                          {new Intl.DateTimeFormat("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(assembly.scheduledAt))}
                        </time>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={STATUS_LABELS[assembly.status]}
                          color={assembly.status === "held" ? "success" : assembly.status === "canceled" ? "error" : "default"}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <Button
                            size="small"
                            aria-label={`Editar assembleia ${assembly.title}`}
                            onClick={() => openEdit(assembly)}
                          >
                            Editar
                          </Button>
                          {assembly.status === "scheduled" && (
                            <>
                              <Button
                                size="small"
                                color="success"
                                aria-label={`Realizar assembleia ${assembly.title}`}
                                onClick={() => openTransition(assembly, "held")}
                              >
                                Realizar
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                aria-label={`Cancelar assembleia ${assembly.title}`}
                                onClick={() => openTransition(assembly, "canceled")}
                              >
                                Cancelar
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
              itemLabel="assembleias"
            />
          </>
        );
      })()}

      <Dialog open={formOpen} onClose={() => !busy && setFormOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={(event) => void saveAssembly(event)} noValidate>
          <DialogTitle>{editing ? "Editar assembleia" : "Nova assembleia"}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {formError && <Alert severity="error">{formError}</Alert>}
              <TextField
                id="assembly-type"
                label="Tipo de assembleia"
                name="type"
                select
                required
                disabled={Boolean(editing)}
                value={form.type}
                onChange={(event) => updateForm("type", event.target.value)}
              >
                <MenuItem value="ordinaria">Ordinária</MenuItem>
                <MenuItem value="oficial">Oficial</MenuItem>
              </TextField>
              <TextField
                id="assembly-title"
                label="Título"
                name="title"
                required
                autoFocus
                value={form.title}
                onChange={(event) => updateForm("title", event.target.value)}
                onBlur={() => validateOnBlur("title")}
                error={Boolean(formErrors.title)}
                helperText={formErrors.title}
                slotProps={{ htmlInput: { maxLength: 160 } }}
              />
              <TextField
                id="assembly-scheduled-at"
                label="Data e hora agendada"
                name="scheduledAt"
                type="datetime-local"
                required
                value={form.scheduledAt}
                onChange={(event) => updateForm("scheduledAt", event.target.value)}
                onBlur={() => validateOnBlur("scheduledAt")}
                error={Boolean(formErrors.scheduledAt)}
                helperText={formErrors.scheduledAt}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                id="assembly-agenda"
                label="Resumo da pauta"
                name="agendaSummary"
                required
                multiline
                minRows={4}
                value={form.agendaSummary}
                onChange={(event) => updateForm("agendaSummary", event.target.value)}
                onBlur={() => validateOnBlur("agendaSummary")}
                error={Boolean(formErrors.agendaSummary)}
                helperText={formErrors.agendaSummary}
                slotProps={{ htmlInput: { maxLength: 1000 } }}
              />
              <TextField
                id="assembly-discussion"
                label="URL da Discussion"
                name="discussionUrl"
                type="url"
                required={!editing}
                disabled={Boolean(editing)}
                value={form.discussionUrl}
                onChange={(event) => updateForm("discussionUrl", event.target.value)}
                onBlur={() => validateOnBlur("discussionUrl")}
                error={Boolean(formErrors.discussionUrl)}
                helperText={formErrors.discussionUrl ?? "https://github.com/codaqui/institucional/discussions/<número>"}
                slotProps={{ htmlInput: { maxLength: 2048, autoCapitalize: "off", autoCorrect: "off", spellCheck: false } }}
              />
              {isAdmin && (
                <DocumentFields
                  form={form}
                  errors={formErrors}
                  onChange={(field, value) => updateForm(field, value)}
                  onBlur={(field) => validateOnBlur(field)}
                />
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" disabled={busy} onClick={() => setFormOpen(false)}>
              Voltar
            </Button>
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? "Salvando…" : "Salvar assembleia"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={transition !== null}
        onClose={() => !busy && setTransition(null)}
        fullWidth
        maxWidth="sm"
      >
        {transition?.kind === "held" ? (
          <form onSubmit={(event) => void runTransition(event)} noValidate>
            <DialogTitle>Realizar assembleia</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {transition.assembly.title}
                </Typography>
                {transitionError && <Alert severity="error">{transitionError}</Alert>}
                <TextField
                  id="assembly-held-at"
                  label="Data e hora da realização"
                  name="heldAt"
                  type="datetime-local"
                  required
                  autoFocus
                  value={heldAt}
                  onChange={(event) => {
                    setHeldAt(event.target.value);
                    setHeldAtError("");
                  }}
                  onBlur={() => {
                    if (!heldAt) setHeldAtError("Informe a data e hora da realização.");
                  }}
                  error={Boolean(heldAtError)}
                  helperText={heldAtError}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                {isAdmin && (
                  <DocumentFields
                    form={transitionForm}
                    errors={transitionErrors}
                    idPrefix="held"
                    onChange={(field, value) => updateForm(field, value, "transition")}
                    onBlur={(field) => validateOnBlur(field, "transition")}
                  />
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button type="button" disabled={busy} onClick={() => setTransition(null)}>
                Voltar
              </Button>
              <Button type="submit" variant="contained" color="success" disabled={busy}>
                {busy ? "Salvando…" : "Confirmar realização"}
              </Button>
            </DialogActions>
          </form>
        ) : (
          <>
            <DialogTitle>Cancelar assembleia</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                {transitionError && <Alert severity="error">{transitionError}</Alert>}
                <Typography>
                  Confirmar o cancelamento de “{transition?.assembly.title}”? A assembleia permanecerá pública como cancelada.
                </Typography>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button autoFocus disabled={busy} onClick={() => setTransition(null)}>
                Voltar
              </Button>
              <Button
                variant="contained"
                color="error"
                disabled={busy}
                onClick={() => void runTransition()}
              >
                {busy ? "Cancelando…" : "Confirmar cancelamento"}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </PageContainer>
  );
}

export default function AssembliesAdminApp(): React.JSX.Element {
  return (
    <MuiIslandProvider>
      <AssembliesAdminInner />
    </MuiIslandProvider>
  );
}

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

interface ManagedCommunity {
  id: string;
  slug: string;
  name: string;
  description: string;
  emoji: string;
  logoUrl: string;
  location: string | null;
  founded: number | null;
  level: "parceira" | "integrada";
  status: "proposed" | "active" | "suspended" | "exited";
  sealStatus: "none" | "applied" | "sealed";
  siteEnabled: boolean;
  siteDomain: string | null;
}

interface CommunityForm {
  name: string;
  slug: string;
  description: string;
  emoji: string;
  logoUrl: string;
  location: string;
  founded: string;
  level: ManagedCommunity["level"];
  status: ManagedCommunity["status"];
  siteEnabled: boolean;
  siteDomain: string;
}

type FormErrors = Partial<Record<"name" | "slug", string>>;

const EMPTY_FORM: CommunityForm = {
  name: "",
  slug: "",
  description: "",
  emoji: "",
  logoUrl: "",
  location: "",
  founded: "",
  level: "parceira",
  status: "active",
  siteEnabled: false,
  siteDomain: "",
};

function validateName(value: string): string {
  if (!value.trim()) return "Informe o nome da comunidade.";
  if (value.trim().length < 2) return "O nome deve ter pelo menos 2 caracteres.";
  return "";
}

function validateSlug(value: string): string {
  if (!value.trim()) return "Informe um slug para a comunidade.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.trim())) {
    return "Use apenas letras minúsculas, números e hífens.";
  }
  return "";
}

function CommunitiesAdminInner(): React.JSX.Element | null {
  const { ready, isLoggedIn, isAdmin, authFetch } = useAuth();
  const { error: designationsError, refresh: refreshDesignations } = useMyDesignations();
  const [items, setItems] = useState<ManagedCommunity[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
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
  const [saving, setSaving] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedCommunity | null>(null);
  const [form, setForm] = useState<CommunityForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState("");

  const [sealTarget, setSealTarget] = useState<ManagedCommunity | null>(null);
  const [sealNotes, setSealNotes] = useState("");
  const [sealValidUntil, setSealValidUntil] = useState("");
  const [sealError, setSealError] = useState("");

  const [responsibleTarget, setResponsibleTarget] = useState<ManagedCommunity | null>(null);
  const [memberId, setMemberId] = useState("");
  const [memberIdError, setMemberIdError] = useState("");
  const [responsibleError, setResponsibleError] = useState("");

  const loadCommunities = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams({
      page: String(page),
      limit: String(DEFAULT_PAGE_SIZE),
    });
    if (search) params.set("search", search);
    try {
      const response = await authFetch(`/communities/manage?${params.toString()}`);
      const result = await parseAuthJson<PaginatedResponse<ManagedCommunity>>(
        response,
        setLoadError,
      );
      if (!result) return;
      setItems(Array.isArray(result.data) ? result.data : []);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch {
      setLoadError("Não foi possível carregar as comunidades.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, page, search]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !isAdmin) {
      window.location.replace("/");
      return;
    }
    void loadCommunities();
  }, [ready, isLoggedIn, isAdmin, loadCommunities]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (community: ManagedCommunity) => {
    setEditing(community);
    setForm({
      name: community.name,
      slug: community.slug,
      description: community.description,
      emoji: community.emoji,
      logoUrl: community.logoUrl,
      location: community.location ?? "",
      founded: community.founded?.toString() ?? "",
      level: community.level,
      status: community.status,
      siteEnabled: community.siteEnabled,
      siteDomain: community.siteDomain ?? "",
    });
    setFormErrors({});
    setFormError("");
    setFormOpen(true);
  };

  const updateForm = <K extends keyof CommunityForm>(field: K, value: CommunityForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "name" || field === "slug") {
      setFormErrors((current) => ({ ...current, [field]: undefined }));
    }
  };

  const saveCommunity = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = {
      name: validateName(form.name) || undefined,
      slug: validateSlug(form.slug) || undefined,
    };
    setFormErrors(errors);
    if (errors.name || errors.slug) {
      document.getElementById(errors.name ? "community-name" : "community-slug")?.focus();
      return;
    }
    const action = editing ? "Salvar alterações" : "Criar comunidade";
    if (!window.confirm(`${action} para "${form.name.trim()}"?`)) return;

    setSaving(true);
    setFormError("");
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      emoji: form.emoji.trim(),
      logoUrl: form.logoUrl.trim(),
      location: form.location.trim() || (editing ? null : undefined),
      founded: form.founded ? Number(form.founded) : editing ? null : undefined,
      level: form.level,
      status: form.status,
      siteEnabled: form.siteEnabled,
      siteDomain: form.siteDomain.trim() || (editing ? null : undefined),
    };
    try {
      const response = await authFetch(
        editing ? `/communities/${editing.id}` : "/communities",
        { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );
      if (!response.ok) {
        setFormError(await extractErrorMessage(response, "Não foi possível salvar a comunidade."));
        return;
      }
      setFormOpen(false);
      setFeedback({ severity: "success", message: "Comunidade salva com sucesso." });
      await loadCommunities();
    } catch {
      setFormError("Não foi possível salvar a comunidade.");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (
    community: ManagedCommunity,
    confirmation: string,
    path: string,
    init: RequestInit,
    successMessage: string,
    errorMessage: string,
  ) => {
    if (!window.confirm(confirmation)) return;
    setBusyId(community.id);
    setFeedback(null);
    try {
      const response = await authFetch(path, init);
      if (!response.ok) {
        setFeedback({
          severity: "error",
          message: await extractErrorMessage(response, errorMessage),
        });
        return;
      }
      setFeedback({ severity: "success", message: successMessage });
      await loadCommunities();
    } catch {
      setFeedback({ severity: "error", message: errorMessage });
    } finally {
      setBusyId(null);
    }
  };

  const openSeal = (community: ManagedCommunity) => {
    setSealTarget(community);
    setSealNotes("");
    setSealValidUntil("");
    setSealError("");
  };

  const grantSeal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sealTarget) return;
    if (sealNotes.trim().length < 3) {
      setSealError("Descreva a avaliação manual em pelo menos 3 caracteres.");
      document.getElementById("seal-notes")?.focus();
      return;
    }
    if (!window.confirm(`Conceder o selo para "${sealTarget.name}"?`)) return;

    setSaving(true);
    setSealError("");
    try {
      const response = await authFetch(`/communities/${sealTarget.id}/seal`, {
        method: "POST",
        body: JSON.stringify({
          notes: sealNotes.trim(),
          ...(sealValidUntil ? { validUntil: sealValidUntil } : {}),
        }),
      });
      if (!response.ok) {
        setSealError(await extractErrorMessage(response, "Não foi possível conceder o selo."));
        return;
      }
      setSealTarget(null);
      setFeedback({ severity: "success", message: "Selo concedido com sucesso." });
      await loadCommunities();
    } catch {
      setSealError("Não foi possível conceder o selo.");
    } finally {
      setSaving(false);
    }
  };

  const openResponsible = (community: ManagedCommunity) => {
    setResponsibleTarget(community);
    setMemberId("");
    setMemberIdError("");
    setResponsibleError("");
  };

  const assignResponsible = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!responsibleTarget) return;
    if (!memberId.trim()) {
      setMemberIdError("Informe o ID do membro.");
      document.getElementById("responsible-member-id")?.focus();
      return;
    }
    if (!window.confirm(`Atribuir o responsável de "${responsibleTarget.name}"?`)) return;

    setSaving(true);
    setResponsibleError("");
    try {
      const response = await authFetch("/designations", {
        method: "POST",
        body: JSON.stringify({
          memberId: memberId.trim(),
          targetType: "community",
          targetId: responsibleTarget.id,
          designation: "responsible",
        }),
      });
      if (!response.ok) {
        setResponsibleError(
          await extractErrorMessage(response, "Não foi possível atribuir o responsável."),
        );
        return;
      }
      setResponsibleTarget(null);
      setFeedback({ severity: "success", message: "Responsável atribuído com sucesso." });
      await Promise.all([refreshDesignations(), loadCommunities()]);
    } catch {
      setResponsibleError("Não foi possível atribuir o responsável.");
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
        <CircularProgress aria-label="Carregando autenticação" />
      </Box>
    );
  }
  if (!isLoggedIn || !isAdmin) return null;

  return (
    <PageContainer>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ mb: 3, alignItems: { sm: "center" }, justifyContent: "space-between" }}
      >
        <Box>
          <Typography variant="h4" component="h2" sx={{ fontWeight: 800 }}>
            Comunidades
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Cadastro, nível, selo e responsáveis das comunidades
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate}>
          Nova comunidade
        </Button>
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
          label="Buscar comunidades"
          name="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          fullWidth
          size="small"
        />
        <Button type="submit" variant="outlined">Buscar</Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress aria-label="Carregando comunidades" />
        </Box>
      ) : items.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: "center", py: 6 }}>
          Nenhuma comunidade encontrada.
        </Typography>
      ) : (
        <>
          <TableContainer component={Box} sx={{ mb: 2, overflowX: "auto" }}>
            <Table size="small" aria-label="Comunidades cadastradas">
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Nível</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Selo</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((community) => (
                  <TableRow key={community.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {community.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {community.slug}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={community.level === "integrada" ? "Integrada" : "Parceira"}
                        color={community.level === "integrada" ? "primary" : "default"}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{community.status}</TableCell>
                    <TableCell>{community.sealStatus}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <Button size="small" onClick={() => openEdit(community)}>Editar</Button>
                        <Button
                          size="small"
                          disabled={busyId === community.id}
                          onClick={() => void runAction(
                            community,
                            `Alterar o nível de "${community.name}"?`,
                            `/communities/${community.id}`,
                            {
                              method: "PATCH",
                              body: JSON.stringify({
                                level: community.level === "integrada" ? "parceira" : "integrada",
                              }),
                            },
                            "Nível da comunidade atualizado.",
                            "Não foi possível alterar o nível.",
                          )}
                        >
                          {community.level === "integrada" ? "Tornar parceira" : "Tornar integrada"}
                        </Button>
                        <Button
                          size="small"
                          disabled={busyId === community.id}
                          onClick={() => void runAction(
                            community,
                            `Solicitar selo para "${community.name}"?`,
                            `/communities/${community.id}/seal/request`,
                            { method: "POST" },
                            "Solicitação de selo registrada.",
                            "Não foi possível solicitar o selo.",
                          )}
                        >
                          Solicitar selo
                        </Button>
                        <Button size="small" onClick={() => openSeal(community)}>Conceder selo</Button>
                        <Button size="small" onClick={() => openResponsible(community)}>
                          Atribuir responsável
                        </Button>
                        <Button
                          size="small"
                          color={community.status === "exited" ? "success" : "error"}
                          disabled={busyId === community.id}
                          onClick={() => {
                            const exiting = community.status !== "exited";
                            void runAction(
                              community,
                              exiting
                                ? `Excluir "${community.name}" da listagem pública? O cadastro será marcado como saída.`
                                : `Reativar "${community.name}"?`,
                              `/communities/${community.id}`,
                              {
                                method: "PATCH",
                                body: JSON.stringify({ status: exiting ? "exited" : "active" }),
                              },
                              exiting ? "Comunidade marcada como saída." : "Comunidade reativada.",
                              "Não foi possível alterar o status.",
                            );
                          }}
                        >
                          {community.status === "exited" ? "Reativar" : "Excluir"}
                        </Button>
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
            itemLabel="comunidades"
          />
        </>
      )}

      <Dialog open={formOpen} onClose={() => !saving && setFormOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={(event) => void saveCommunity(event)} noValidate>
          <DialogTitle>{editing ? "Editar comunidade" : "Nova comunidade"}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {formError && <Alert severity="error">{formError}</Alert>}
              <TextField
                id="community-name"
                label="Nome da comunidade"
                name="name"
                required
                autoFocus
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                onBlur={() => {
                  const error = validateName(form.name);
                  if (error) setFormErrors((current) => ({ ...current, name: error }));
                }}
                error={Boolean(formErrors.name)}
                helperText={formErrors.name}
                slotProps={{ htmlInput: { maxLength: 160 } }}
              />
              <TextField
                id="community-slug"
                label="Slug"
                name="slug"
                required
                value={form.slug}
                onChange={(event) => updateForm("slug", event.target.value)}
                onBlur={() => {
                  const error = validateSlug(form.slug);
                  if (error) setFormErrors((current) => ({ ...current, slug: error }));
                }}
                error={Boolean(formErrors.slug)}
                helperText={formErrors.slug ?? "Ex.: minha-comunidade"}
                slotProps={{ htmlInput: { maxLength: 80, autoCapitalize: "off", spellCheck: false } }}
              />
              <TextField
                label="Descrição"
                name="description"
                multiline
                minRows={3}
                value={form.description}
                onChange={(event) => updateForm("description", event.target.value)}
                slotProps={{ htmlInput: { maxLength: 5000 } }}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Emoji"
                  value={form.emoji}
                  onChange={(event) => updateForm("emoji", event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 16 } }}
                  fullWidth
                />
                <TextField
                  label="Ano de fundação"
                  type="number"
                  value={form.founded}
                  onChange={(event) => updateForm("founded", event.target.value)}
                  slotProps={{ htmlInput: { min: 0 } }}
                  fullWidth
                />
              </Stack>
              <TextField
                label="URL do logo"
                type="url"
                value={form.logoUrl}
                onChange={(event) => updateForm("logoUrl", event.target.value)}
                helperText="URL pública ou caminho local iniciado por /img/."
              />
              <TextField
                label="Localização"
                value={form.location}
                onChange={(event) => updateForm("location", event.target.value)}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Nível"
                  select
                  value={form.level}
                  onChange={(event) => updateForm("level", event.target.value as ManagedCommunity["level"])}
                  fullWidth
                >
                  <MenuItem value="parceira">Parceira</MenuItem>
                  <MenuItem value="integrada">Integrada</MenuItem>
                </TextField>
                <TextField
                  label="Status"
                  select
                  value={form.status}
                  onChange={(event) => updateForm("status", event.target.value as ManagedCommunity["status"])}
                  fullWidth
                >
                  <MenuItem value="proposed">Proposta</MenuItem>
                  <MenuItem value="active">Ativa</MenuItem>
                  <MenuItem value="suspended">Suspensa</MenuItem>
                  <MenuItem value="exited">Saída</MenuItem>
                </TextField>
              </Stack>
              <TextField
                label="Domínio do site"
                value={form.siteDomain}
                onChange={(event) => updateForm("siteDomain", event.target.value)}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.siteEnabled}
                    onChange={(event) => updateForm("siteEnabled", event.target.checked)}
                  />
                }
                label="Site próprio habilitado"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" disabled={saving} onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar comunidade"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={sealTarget !== null} onClose={() => !saving && setSealTarget(null)} fullWidth maxWidth="sm">
        <form onSubmit={(event) => void grantSeal(event)} noValidate>
          <DialogTitle>Conceder selo</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">{sealTarget?.name}</Typography>
              {sealError && <Alert severity="error">{sealError}</Alert>}
              <TextField
                id="seal-notes"
                label="Notas da avaliação"
                required
                autoFocus
                multiline
                minRows={3}
                value={sealNotes}
                onChange={(event) => setSealNotes(event.target.value)}
                helperText="Registre a avaliação manual da diretoria."
                slotProps={{ htmlInput: { maxLength: 4000 } }}
              />
              <TextField
                label="Validade"
                type="date"
                value={sealValidUntil}
                onChange={(event) => setSealValidUntil(event.target.value)}
                helperText="Opcional; sem data, o backend concede um ano de validade."
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" disabled={saving} onClick={() => setSealTarget(null)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? "Concedendo…" : "Confirmar concessão"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={responsibleTarget !== null}
        onClose={() => !saving && setResponsibleTarget(null)}
        fullWidth
        maxWidth="sm"
      >
        <form onSubmit={(event) => void assignResponsible(event)} noValidate>
          <DialogTitle>Atribuir responsável</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">{responsibleTarget?.name}</Typography>
              {responsibleError && <Alert severity="error">{responsibleError}</Alert>}
              <TextField
                id="responsible-member-id"
                label="ID do membro"
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
                helperText={memberIdError ?? "UUID do membro que receberá a designation responsible."}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" disabled={saving} onClick={() => setResponsibleTarget(null)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? "Atribuindo…" : "Confirmar responsável"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </PageContainer>
  );
}

export default function CommunitiesAdminApp(): React.JSX.Element {
  return (
    <MuiIslandProvider>
      <CommunitiesAdminInner />
    </MuiIslandProvider>
  );
}

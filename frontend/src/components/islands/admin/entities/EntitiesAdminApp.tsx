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

type EntityType = "empresa" | "instituicao_ensino" | "ong" | "governo" | "outro";

interface ManagedEntity {
  id: string;
  slug: string;
  name: string;
  type: EntityType;
  cnpj: string | null;
  website: string | null;
  contactEmail: string | null;
  isActive: boolean;
}

interface Partnership {
  id: string;
  entityId: string;
  kind: "termo" | "pontual";
  startedAt: string;
  endsAt: string | null;
  status: "active" | "ended" | "canceled";
  notes: string | null;
}

const ENTITY_TYPES: Array<{ value: EntityType; label: string }> = [
  { value: "ong", label: "ONG" },
  { value: "empresa", label: "Empresa" },
  { value: "instituicao_ensino", label: "Instituição de ensino" },
  { value: "governo", label: "Governo" },
  { value: "outro", label: "Outro" },
];

const EMPTY_ENTITY = { name: "", slug: "", type: "ong" as EntityType, cnpj: "", website: "", contactEmail: "", isActive: true };
const EMPTY_PARTNERSHIP = { kind: "termo" as "termo" | "pontual", startedAt: "", endsAt: "", notes: "" };

function EntitiesAdminInner() {
  const { ready, isLoggedIn, isAdmin, user, authFetch } = useAuth();
  const canAccess = isAdmin || (user?.roles.includes("diretor") ?? false);
  const [items, setItems] = useState<ManagedEntity[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedEntity | null>(null);
  const [form, setForm] = useState(EMPTY_ENTITY);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [partnershipEntity, setPartnershipEntity] = useState<ManagedEntity | null>(null);
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [partnershipForm, setPartnershipForm] = useState(EMPTY_PARTNERSHIP);
  const [partnershipError, setPartnershipError] = useState("");
  const [partnershipsLoading, setPartnershipsLoading] = useState(false);

  const loadEntities = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams({ page: String(page), limit: String(DEFAULT_PAGE_SIZE) });
    if (search) params.set("search", search);
    try {
      const response = await authFetch(`/entities?${params.toString()}`);
      if (!response.ok) {
        setLoadError(await extractErrorMessage(response, "Não foi possível carregar as entidades."));
        return;
      }
      const result = await parseAuthJson<PaginatedResponse<ManagedEntity>>(response, setLoadError);
      if (!result) return;
      setItems(Array.isArray(result.data) ? result.data : []);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch {
      setLoadError("Não foi possível carregar as entidades.");
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
    void loadEntities();
  }, [ready, isLoggedIn, canAccess, loadEntities]);

  const openEntity = (entity: ManagedEntity | null) => {
    setEditing(entity);
    setForm(entity ? {
      name: entity.name,
      slug: entity.slug,
      type: entity.type,
      cnpj: entity.cnpj ?? "",
      website: entity.website ?? "",
      contactEmail: entity.contactEmail ?? "",
      isActive: entity.isActive,
    } : EMPTY_ENTITY);
    setFormError("");
    setFormOpen(true);
  };

  const saveEntity = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const response = await authFetch(editing ? `/entities/${editing.id}` : "/entities", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          isActive: form.isActive,
          ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
          ...(form.cnpj.trim() ? { cnpj: form.cnpj.trim() } : {}),
          ...(form.website.trim() ? { website: form.website.trim() } : {}),
          ...(form.contactEmail.trim() ? { contactEmail: form.contactEmail.trim() } : {}),
        }),
      });
      if (!response.ok) {
        setFormError(await extractErrorMessage(response, "Não foi possível salvar a entidade."));
        return;
      }
      setFormOpen(false);
      setFeedback("Entidade salva com sucesso.");
      await loadEntities();
    } catch {
      setFormError("Não foi possível salvar a entidade.");
    } finally {
      setSaving(false);
    }
  };

  const loadPartnerships = useCallback(async (entityId: string) => {
    setPartnershipsLoading(true);
    setPartnershipError("");
    try {
      const response = await authFetch(`/entities/${entityId}/partnerships`);
      const result = await parseAuthJson<Partnership[]>(response, setPartnershipError);
      if (result) setPartnerships(Array.isArray(result) ? result : []);
    } catch {
      setPartnershipError("Não foi possível carregar as parcerias.");
    } finally {
      setPartnershipsLoading(false);
    }
  }, [authFetch]);

  const openPartnerships = (entity: ManagedEntity) => {
    setPartnershipEntity(entity);
    setPartnershipForm(EMPTY_PARTNERSHIP);
    setPartnerships([]);
    void loadPartnerships(entity.id);
  };

  const savePartnership = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!partnershipEntity) return;
    setSaving(true);
    setPartnershipError("");
    try {
      const response = await authFetch(`/entities/${partnershipEntity.id}/partnerships`, {
        method: "POST",
        body: JSON.stringify({
          kind: partnershipForm.kind,
          startedAt: partnershipForm.startedAt,
          ...(partnershipForm.endsAt ? { endsAt: partnershipForm.endsAt } : {}),
          ...(partnershipForm.notes.trim() ? { notes: partnershipForm.notes.trim() } : {}),
        }),
      });
      if (!response.ok) {
        setPartnershipError(await extractErrorMessage(response, "Não foi possível salvar a parceria."));
        return;
      }
      setPartnershipForm(EMPTY_PARTNERSHIP);
      await loadPartnerships(partnershipEntity.id);
    } catch {
      setPartnershipError("Não foi possível salvar a parceria.");
    } finally {
      setSaving(false);
    }
  };

  const endPartnership = async (partnership: Partnership) => {
    if (!window.confirm("Encerrar esta parceria?")) return;
    setActionError("");
    try {
      const response = await authFetch(`/partnerships/${partnership.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "ended" }),
      });
      if (!response.ok) {
        setPartnershipError(await extractErrorMessage(response, "Não foi possível encerrar a parceria."));
        return;
      }
      if (partnershipEntity) await loadPartnerships(partnershipEntity.id);
    } catch {
      setPartnershipError("Não foi possível encerrar a parceria.");
    }
  };

  if (!ready) return <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}><CircularProgress aria-label="Carregando autenticação" /></Box>;
  if (!isLoggedIn || !canAccess) return null;

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3, justifyContent: "space-between", alignItems: { sm: "center" } }}>
        <Box>
          <Typography variant="h4" component="h2" sx={{ fontWeight: 800 }}>Entidades</Typography>
          <Typography variant="body2" color="text.secondary">Entidades jurídicas e parcerias dos projetos de extensão</Typography>
        </Box>
        <Button variant="contained" onClick={() => openEntity(null)}>Nova entidade</Button>
      </Stack>

      {(loadError || actionError) && <Alert severity="error" sx={{ mb: 2 }}>{loadError || actionError}</Alert>}
      {feedback && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setFeedback("")}>{feedback}</Alert>}

      <Box component="form" role="search" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }} sx={{ display: "flex", gap: 1, mb: 3 }}>
        <TextField fullWidth size="small" label="Buscar entidades" name="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
        <Button type="submit" variant="outlined">Buscar</Button>
      </Box>

      {(() => {
        if (loading) {
          return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress aria-label="Carregando entidades" /></Box>;
        }
        if (items.length === 0) {
          return <Typography color="text.secondary" sx={{ textAlign: "center", py: 6 }}>Nenhuma entidade encontrada.</Typography>;
        }
        return (
          <>
            <TableContainer component={Box} tabIndex={0} role="region" aria-label="Entidades cadastradas" sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead><TableRow><TableCell>Nome</TableCell><TableCell>Tipo</TableCell><TableCell>Status</TableCell><TableCell align="right">Ações</TableCell></TableRow></TableHead>
                <TableBody>
                  {items.map((entity) => (
                    <TableRow key={entity.id}>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{entity.name}</Typography><Typography variant="caption" color="text.secondary">{entity.slug}</Typography></TableCell>
                      <TableCell>{ENTITY_TYPES.find((item) => item.value === entity.type)?.label ?? entity.type}</TableCell>
                      <TableCell><Chip size="small" variant="outlined" label={entity.isActive ? "Ativa" : "Inativa"} color={entity.isActive ? "success" : "default"} /></TableCell>
                      <TableCell align="right"><Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}><Button size="small" onClick={() => openEntity(entity)}>Editar</Button><Button size="small" onClick={() => openPartnerships(entity)}>Parcerias</Button></Stack></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", my: 1 }}>{rangeLabel(page, DEFAULT_PAGE_SIZE, total)}</Typography>
            <PaginationControls page={page} totalPages={totalPages} onChange={setPage} itemLabel="entidades" />
          </>
        );
      })()}

      <Dialog open={formOpen} onClose={() => !saving && setFormOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={(event) => void saveEntity(event)}>
          <DialogTitle>{editing ? "Editar entidade" : "Nova entidade"}</DialogTitle>
          <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField label="Nome" name="name" required autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} slotProps={{ htmlInput: { minLength: 2, maxLength: 160 } }} />
            <TextField label="Slug" name="slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} helperText="Opcional; derivado do nome quando não informado." />
            <TextField label="Tipo" name="type" select required value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as EntityType })}>{ENTITY_TYPES.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}</TextField>
            <TextField label="CNPJ" name="cnpj" value={form.cnpj} onChange={(event) => setForm({ ...form, cnpj: event.target.value })} />
            <TextField label="Website" name="website" type="url" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
            <TextField label="E-mail de contato" name="contactEmail" type="email" autoComplete="email" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} />
            <FormControlLabel control={<Checkbox checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />} label="Entidade ativa" />
          </Stack></DialogContent>
          <DialogActions><Button type="button" onClick={() => setFormOpen(false)}>Cancelar</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? "Salvando…" : "Salvar entidade"}</Button></DialogActions>
        </form>
      </Dialog>

      <Dialog open={partnershipEntity !== null} onClose={() => !saving && setPartnershipEntity(null)} fullWidth maxWidth="md">
        <DialogTitle>Parcerias — {partnershipEntity?.name}</DialogTitle>
        <DialogContent><Stack spacing={3} sx={{ pt: 1 }}>
          {partnershipError && <Alert severity="error">{partnershipError}</Alert>}
          {(() => {
            if (partnershipsLoading) return <CircularProgress aria-label="Carregando parcerias" />;
            if (partnerships.length === 0) return <Typography color="text.secondary">Nenhuma parceria cadastrada.</Typography>;
            return (
              <Stack component="ul" spacing={1} sx={{ listStyle: "none", p: 0, m: 0 }}>
                {partnerships.map((partnership) => (
                  <Stack component="li" direction={{ xs: "column", sm: "row" }} key={partnership.id} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
                    <Box><Typography variant="body2">{partnership.kind === "termo" ? "Termo" : "Pontual"} · {partnership.startedAt}</Typography><Typography variant="caption" color="text.secondary">{partnership.notes}</Typography></Box>
                    {partnership.status === "active" ? <Button size="small" color="error" onClick={() => void endPartnership(partnership)}>Encerrar</Button> : <Chip size="small" label={partnership.status} />}
                  </Stack>
                ))}
              </Stack>
            );
          })()}
          <Box component="form" onSubmit={(event) => void savePartnership(event)} sx={{ display: "grid", gap: 2 }}>
            <Typography variant="h6" component="h3">Nova parceria</Typography>
            <TextField label="Modalidade" name="kind" select value={partnershipForm.kind} onChange={(event) => setPartnershipForm({ ...partnershipForm, kind: event.target.value as "termo" | "pontual" })}><MenuItem value="termo">Termo</MenuItem><MenuItem value="pontual">Pontual</MenuItem></TextField>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField fullWidth label="Data de início" name="startedAt" type="date" required value={partnershipForm.startedAt} onChange={(event) => setPartnershipForm({ ...partnershipForm, startedAt: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField fullWidth label="Data de término" name="endsAt" type="date" value={partnershipForm.endsAt} onChange={(event) => setPartnershipForm({ ...partnershipForm, endsAt: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>
            <TextField label="Observações" name="notes" multiline minRows={2} value={partnershipForm.notes} onChange={(event) => setPartnershipForm({ ...partnershipForm, notes: event.target.value })} slotProps={{ htmlInput: { maxLength: 2000 } }} />
            <Button type="submit" variant="contained" disabled={saving}>{saving ? "Salvando…" : "Salvar parceria"}</Button>
          </Box>
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setPartnershipEntity(null)}>Fechar</Button></DialogActions>
      </Dialog>
    </PageContainer>
  );
}

export default function EntitiesAdminApp() {
  return <MuiIslandProvider><EntitiesAdminInner /></MuiIslandProvider>;
}

import { useCallback, useEffect, useState } from "react";
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
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MuiIslandProvider from "../../MuiIslandProvider";
import PageContainer from "../ui/PageContainer";
import PaginationControls from "../../ui/PaginationControls";
import { useAuth } from "../../../../lib/use-auth";
import { useMyDesignations } from "../../../../lib/use-designations";
import { extractErrorMessage, parseAuthJson } from "../../../../lib/auth-fetch-helpers";
import { DEFAULT_PAGE_SIZE } from "../../../../lib/pagination";
import type { PublicCity, PublicInstitution } from "../../../../data/universities";

interface ManageCity extends PublicCity {
  isActive: boolean;
}

interface ManageInstitution extends PublicInstitution {
  contactEmail: string | null;
  cityId: string | null;
  isActive: boolean;
}

interface ManagePayload {
  generatedAt: string;
  cities: ManageCity[];
  institutions: ManageInstitution[];
}

interface AmbassadorApplication {
  id: string;
  targetId: string;
  status: "pending" | "active" | "removed";
  applicationNotes: string | null;
  validUntil?: string | null;
  member: { id: string; name: string; githubHandle: string; avatarUrl: string } | null;
}

interface CityForm {
  name: string;
  uf: string;
  isActive: boolean;
}

interface InstitutionForm {
  name: string;
  slug: string;
  website: string;
  contactEmail: string;
  cityId: string;
  isActive: boolean;
}

const APPLICATION_STATUS_LABELS: Record<AmbassadorApplication["status"], string> = {
  active: "Ativa",
  pending: "Pendente",
  removed: "Encerrada",
};

const EMPTY_CITY: CityForm = { name: "", uf: "", isActive: true };
const EMPTY_INSTITUTION: InstitutionForm = { name: "", slug: "", website: "", contactEmail: "", cityId: "", isActive: true };

function UniversitiesAdminInner() {
  const { ready, isLoggedIn, isAdmin, authFetch } = useAuth();
  const { data: designations, loading: designationsLoading } = useMyDesignations();
  const canManage = isAdmin || designations.some((item) =>
    item.targetType === "program" && item.targetKey === "universitario" && item.designation === "manager",
  );
  const [cities, setCities] = useState<ManageCity[]>([]);
  const [institutions, setInstitutions] = useState<ManageInstitution[]>([]);
  const [applications, setApplications] = useState<AmbassadorApplication[]>([]);
  const [myApplications, setMyApplications] = useState<AmbassadorApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [cityDialog, setCityDialog] = useState(false);
  const [editingCity, setEditingCity] = useState<ManageCity | null>(null);
  const [cityForm, setCityForm] = useState<CityForm>(EMPTY_CITY);
  const [institutionDialog, setInstitutionDialog] = useState(false);
  const [editingInstitution, setEditingInstitution] = useState<ManageInstitution | null>(null);
  const [institutionForm, setInstitutionForm] = useState<InstitutionForm>(EMPTY_INSTITUTION);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadOwnApplications = useCallback(async () => {
    try {
      const response = await authFetch("/universities/ambassador-applications/my");
      const result = await parseAuthJson<AmbassadorApplication[]>(response, setLoadError);
      if (result) setMyApplications(Array.isArray(result) ? result : []);
    } catch {
      setLoadError("Não foi possível carregar suas candidaturas.");
    }
  }, [authFetch]);

  const loadManage = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [manageResponse, applicationsResponse] = await Promise.all([
        authFetch("/universities/manage"),
        authFetch("/universities/ambassador-applications"),
      ]);
      const manage = await parseAuthJson<ManagePayload>(manageResponse, setLoadError);
      const pending = await parseAuthJson<AmbassadorApplication[]>(applicationsResponse, setLoadError);
      if (manage) {
        setCities(Array.isArray(manage.cities) ? manage.cities : []);
        setInstitutions(Array.isArray(manage.institutions) ? manage.institutions : []);
      }
      if (pending) setApplications(Array.isArray(pending) ? pending : []);
    } catch {
      setLoadError("Não foi possível carregar o Codaqui Universitário.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!ready || designationsLoading) return;
    if (!isLoggedIn) {
      window.location.replace("/");
      return;
    }
    void loadOwnApplications();
    if (canManage) void loadManage();
  }, [ready, designationsLoading, isLoggedIn, canManage, loadOwnApplications, loadManage]);

  const openCity = (city: ManageCity | null) => {
    setEditingCity(city);
    setCityForm(city ? { name: city.name, uf: city.uf, isActive: city.isActive } : EMPTY_CITY);
    setFormError("");
    setCityDialog(true);
  };

  const openInstitution = (institution: ManageInstitution | null) => {
    setEditingInstitution(institution);
    setInstitutionForm(institution ? {
      name: institution.name,
      slug: institution.slug,
      website: institution.website ?? "",
      contactEmail: institution.contactEmail ?? "",
      cityId: institution.cityId ?? institution.city?.id ?? "",
      isActive: institution.isActive,
    } : { ...EMPTY_INSTITUTION, cityId: cities.find((city) => city.isActive)?.id ?? "" });
    setFormError("");
    setInstitutionDialog(true);
  };

  const saveCity = async () => {
    if (!cityForm.name.trim() || cityForm.uf.trim().length !== 2) {
      setFormError("Informe o nome da cidade e a UF com duas letras.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const response = await authFetch(editingCity ? `/universities/cities/${editingCity.id}` : "/universities/cities", {
        method: editingCity ? "PATCH" : "POST",
        body: JSON.stringify({ name: cityForm.name.trim(), uf: cityForm.uf.trim(), isActive: cityForm.isActive }),
      });
      if (!response.ok) {
        setFormError(await extractErrorMessage(response, "Não foi possível salvar a cidade."));
        return;
      }
      setCityDialog(false);
      setFeedback("Cidade salva.");
      await loadManage();
    } catch {
      setFormError("Não foi possível salvar a cidade.");
    } finally {
      setSaving(false);
    }
  };

  const saveInstitution = async () => {
    if (!institutionForm.name.trim() || !institutionForm.cityId) {
      setFormError("Informe o nome e a cidade da IES.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const response = await authFetch(editingInstitution ? `/universities/institutions/${editingInstitution.id}` : "/universities/institutions", {
        method: editingInstitution ? "PATCH" : "POST",
        body: JSON.stringify({
          name: institutionForm.name.trim(),
          slug: institutionForm.slug.trim() || undefined,
          website: institutionForm.website.trim() || undefined,
          contactEmail: institutionForm.contactEmail.trim() || undefined,
          cityId: institutionForm.cityId,
          isActive: institutionForm.isActive,
        }),
      });
      if (!response.ok) {
        setFormError(await extractErrorMessage(response, "Não foi possível salvar a IES."));
        return;
      }
      setInstitutionDialog(false);
      setFeedback("IES salva.");
      await loadManage();
    } catch {
      setFormError("Não foi possível salvar a IES.");
    } finally {
      setSaving(false);
    }
  };

  const decideApplication = async (application: AmbassadorApplication, decision: "confirm" | "reject") => {
    if (decision === "reject" && !window.confirm(`Rejeitar candidatura de ${application.member?.name ?? "membro"}?`)) return;
    setBusyId(application.id);
    setActionError("");
    setFeedback("");
    try {
      const response = await authFetch(`/universities/ambassador-applications/${application.id}/${decision}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        setActionError(await extractErrorMessage(response, "Não foi possível avaliar a candidatura."));
        return;
      }
      setApplications((current) => current.filter((item) => item.id !== application.id));
      setPage(1);
      setFeedback(decision === "confirm" ? "Posse confirmada." : "Candidatura rejeitada.");
    } catch {
      setActionError("Não foi possível avaliar a candidatura.");
    } finally {
      setBusyId(null);
    }
  };

  if (!ready || designationsLoading || !isLoggedIn) {
    return <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}><CircularProgress aria-label="Carregando autenticação" /></Box>;
  }

  const totalPages = Math.ceil(applications.length / DEFAULT_PAGE_SIZE);
  const visibleApplications = applications.slice((page - 1) * DEFAULT_PAGE_SIZE, page * DEFAULT_PAGE_SIZE);

  return (
    <PageContainer>
      <Typography variant="h4" component="h2" sx={{ fontWeight: 800 }}>Codaqui Universitário</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Cidades, instituições de ensino e posses de embaixadores.
      </Typography>
      {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}
      {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
      {feedback && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setFeedback("")}>{feedback}</Alert>}

      {myApplications.length > 0 && (
        <Box component="section" aria-labelledby="my-university-applications" sx={{ mb: 4 }}>
          <Typography id="my-university-applications" variant="h5" component="h3" sx={{ mb: 2 }}>Minhas candidaturas</Typography>
          <Grid container spacing={2}>
            {myApplications.map((application) => (
              <Grid key={application.id} size={{ xs: 12, md: 6 }}>
                <Card variant="outlined"><CardContent>
                  <Chip size="small" label={APPLICATION_STATUS_LABELS[application.status]} />
                  {application.applicationNotes && <Typography variant="body2" sx={{ mt: 2 }}>{application.applicationNotes}</Typography>}
                  {application.status === "active" && application.targetId && (
                    <Button component="a" href={`/admin/eventos?institutionId=${application.targetId}`} variant="contained" sx={{ mt: 2 }}>
                      Criar evento na minha IES
                    </Button>
                  )}
                </CardContent></Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {canManage && loading && <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress aria-label="Carregando programa" /></Box>}
      {canManage && !loading && (
        <>
          <Box component="section" aria-labelledby="university-cities" sx={{ mb: 4 }}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography id="university-cities" variant="h5" component="h3">Cidades</Typography>
              <Button variant="contained" onClick={() => openCity(null)}>Nova cidade</Button>
            </Stack>
            <Grid container spacing={2}>
              {cities.map((city) => (
                <Grid key={city.id} size={{ xs: 12, sm: 6, md: 4 }}><Card variant="outlined"><CardContent>
                  <Typography variant="h6" component="h4">{city.name}/{city.uf}</Typography>
                  {!city.isActive && <Chip size="small" label="Cidade inativa" sx={{ mb: 1 }} />}
                  <Button
                    size="small"
                    aria-label={`${city.isActive ? "Editar" : "Reativar"} cidade ${city.name}`}
                    onClick={() => openCity(city)}
                  >
                    {city.isActive ? "Editar cidade" : "Reativar cidade"}
                  </Button>
                </CardContent></Card></Grid>
              ))}
            </Grid>
          </Box>

          <Box component="section" aria-labelledby="university-institutions" sx={{ mb: 4 }}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography id="university-institutions" variant="h5" component="h3">Instituições</Typography>
              <Button variant="contained" onClick={() => openInstitution(null)}>Nova IES</Button>
            </Stack>
            <Grid container spacing={2}>
              {institutions.map((institution) => (
                <Grid key={institution.id} size={{ xs: 12, sm: 6, md: 4 }}><Card variant="outlined"><CardContent>
                  <Typography variant="h6" component="h4">{institution.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{institution.city ? `${institution.city.name}/${institution.city.uf}` : "Sem cidade"}</Typography>
                  {!institution.isActive && <Chip size="small" label="IES inativa" sx={{ mb: 1 }} />}
                  <Button
                    size="small"
                    aria-label={`${institution.isActive ? "Editar" : "Reativar"} IES ${institution.name}`}
                    onClick={() => openInstitution(institution)}
                  >
                    {institution.isActive ? "Editar IES" : "Reativar IES"}
                  </Button>
                </CardContent></Card></Grid>
              ))}
            </Grid>
          </Box>

          <Box component="section" aria-labelledby="university-applications">
            <Typography id="university-applications" variant="h5" component="h3" sx={{ mb: 2 }}>Candidaturas pendentes</Typography>
            {applications.length === 0 ? <Typography color="text.secondary">Nenhuma candidatura pendente.</Typography> : (
              <Grid container spacing={2}>
                {visibleApplications.map((application) => (
                  <Grid key={application.id} size={{ xs: 12, md: 6 }}><Card variant="outlined"><CardContent>
                    <Typography variant="h6" component="h4">{application.member?.name ?? "Membro"}</Typography>
                    <Typography variant="body2" color="text.secondary">@{application.member?.githubHandle ?? "desconhecido"}</Typography>
                    <Typography variant="body2" sx={{ my: 2, whiteSpace: "pre-wrap" }}>{application.applicationNotes}</Typography>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                      {isAdmin && <Button variant="contained" disabled={busyId === application.id} onClick={() => void decideApplication(application, "confirm")}>Confirmar posse de {application.member?.name ?? "membro"}</Button>}
                      <Button color="error" disabled={busyId === application.id} onClick={() => void decideApplication(application, "reject")}>Rejeitar candidatura de {application.member?.name ?? "membro"}</Button>
                    </Stack>
                  </CardContent></Card></Grid>
                ))}
              </Grid>
            )}
            <PaginationControls page={page} totalPages={totalPages} onChange={setPage} itemLabel="candidaturas" />
          </Box>
        </>
      )}

      <Dialog open={cityDialog} onClose={() => setCityDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingCity ? "Editar cidade" : "Nova cidade"}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Nome da cidade" value={cityForm.name} onChange={(event) => setCityForm({ ...cityForm, name: event.target.value })} fullWidth />
          <TextField label="UF" value={cityForm.uf} onChange={(event) => setCityForm({ ...cityForm, uf: event.target.value.toUpperCase().slice(0, 2) })} fullWidth />
          <FormControlLabel control={<Checkbox checked={cityForm.isActive} onChange={(event) => setCityForm({ ...cityForm, isActive: event.target.checked })} />} label="Cidade ativa" />
          {formError && <Alert severity="error">{formError}</Alert>}
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setCityDialog(false)}>Voltar</Button><Button variant="contained" disabled={saving} onClick={() => void saveCity()}>Salvar cidade</Button></DialogActions>
      </Dialog>

      <Dialog open={institutionDialog} onClose={() => setInstitutionDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingInstitution ? "Editar IES" : "Nova IES"}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Nome da IES" value={institutionForm.name} onChange={(event) => setInstitutionForm({ ...institutionForm, name: event.target.value })} fullWidth />
          <TextField label="Slug (opcional)" value={institutionForm.slug} onChange={(event) => setInstitutionForm({ ...institutionForm, slug: event.target.value })} fullWidth />
          <TextField label="Site (opcional)" value={institutionForm.website} onChange={(event) => setInstitutionForm({ ...institutionForm, website: event.target.value })} fullWidth />
          <TextField label="E-mail de contato (opcional)" value={institutionForm.contactEmail} onChange={(event) => setInstitutionForm({ ...institutionForm, contactEmail: event.target.value })} fullWidth />
          <TextField select label="Cidade" value={institutionForm.cityId} onChange={(event) => setInstitutionForm({ ...institutionForm, cityId: event.target.value })} fullWidth>
            {cities
              .filter((city) => city.isActive || city.id === editingInstitution?.cityId)
              .map((city) => (
                <MenuItem key={city.id} value={city.id} disabled={!city.isActive}>
                  {city.name}/{city.uf}{!city.isActive ? " (inativa)" : ""}
                </MenuItem>
              ))}
          </TextField>
          <FormControlLabel control={<Checkbox checked={institutionForm.isActive} onChange={(event) => setInstitutionForm({ ...institutionForm, isActive: event.target.checked })} />} label="IES ativa" />
          {formError && <Alert severity="error">{formError}</Alert>}
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setInstitutionDialog(false)}>Voltar</Button><Button variant="contained" disabled={saving} onClick={() => void saveInstitution()}>Salvar IES</Button></DialogActions>
      </Dialog>
    </PageContainer>
  );
}

export default function UniversitiesAdminApp() {
  return <MuiIslandProvider><UniversitiesAdminInner /></MuiIslandProvider>;
}

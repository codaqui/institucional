import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { useAuth } from "../../../lib/use-auth";
import { extractErrorMessage, parseAuthJson } from "../../../lib/auth-fetch-helpers";

interface Membership {
  projectId: string;
  projectSlug: string | null;
  projectName: string;
  role: "participant" | "mentor";
  status: "draft" | "proposed" | "active" | "finished" | "canceled" | null;
  joinedAt: string;
}

interface ProjectHour {
  id: string;
  sourceType: string;
  sourceId: string;
  hours: number;
  status: "pending" | "approved" | "rejected";
}

interface Certificate {
  code: string;
  memberName: string;
  projectName: string;
  hoursAtIssue: number;
  issuedAt: string;
}

const STATUS_LABELS = { draft: "Rascunho", proposed: "Proposto", active: "Ativo", finished: "Finalizado", canceled: "Cancelado" };

export default function MemberProjectsIsland() {
  const { ready, isLoggedIn, authFetch } = useAuth();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [hours, setHours] = useState<ProjectHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [projectsResponse, hoursResponse] = await Promise.all([authFetch("/projects/my"), authFetch("/hours/me")]);
      const projects = await parseAuthJson<Membership[]>(projectsResponse, setError);
      const entries = await parseAuthJson<ProjectHour[]>(hoursResponse, setError);
      if (projects) setMemberships(Array.isArray(projects) ? projects.filter((item) => item.role === "participant") : []);
      if (entries) setHours(Array.isArray(entries) ? entries : []);
    } catch {
      setError("Não foi possível carregar seus projetos.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (ready && isLoggedIn) void load();
  }, [ready, isLoggedIn, load]);

  const issueCertificate = async (projectId: string) => {
    setBusyId(projectId);
    setError("");
    try {
      const response = await authFetch(`/project-certificates/projects/${projectId}`, {
        method: "POST",
        body: JSON.stringify({ kind: "participant" }),
      });
      if (!response.ok) {
        setError(await extractErrorMessage(response, "Não foi possível emitir a declaração."));
        return;
      }
      const issued = await response.json() as { code: string };
      const ownedResponse = await authFetch(`/project-certificates/${encodeURIComponent(issued.code)}`);
      const owned = await parseAuthJson<Omit<Certificate, "code">>(ownedResponse, setError);
      if (owned) setCertificate({ ...owned, code: issued.code });
    } catch {
      setError("Não foi possível emitir a declaração.");
    } finally {
      setBusyId(null);
    }
  };

  if (!ready || loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress aria-label="Carregando projetos" /></Box>;
  if (!isLoggedIn) return null;

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      {memberships.length === 0 ? (
        <Typography color="text.secondary">Você ainda não participa de projetos de extensão. <a href="/projetos">Conheça os projetos abertos</a>.</Typography>
      ) : memberships.map((membership) => {
        const projectHours = hours.filter((entry) => entry.sourceType === "extension_project" && entry.sourceId === membership.projectId);
        const approved = projectHours.filter((entry) => entry.status === "approved").reduce((sum, entry) => sum + Number(entry.hours), 0);
        const pending = projectHours.filter((entry) => entry.status === "pending").reduce((sum, entry) => sum + Number(entry.hours), 0);
        return (
          <Card variant="outlined" key={membership.projectId}>
            <CardContent>
              <Stack spacing={1.5}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
                  <Typography variant="h6" component="h3">{membership.projectName}</Typography>
                  <Chip size="small" variant="outlined" label={membership.status ? STATUS_LABELS[membership.status] : "Projeto"} />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {approved} horas aprovadas{pending > 0 ? ` · ${pending} horas pendentes` : ""}
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  {membership.projectSlug && membership.status === "active" && <Button component="a" href={`/projetos/${membership.projectSlug}`} size="small">Ver projeto</Button>}
                  {membership.status === "finished" && <Button variant="contained" size="small" disabled={busyId === membership.projectId} onClick={() => void issueCertificate(membership.projectId)}>{busyId === membership.projectId ? "Emitindo…" : "Emitir declaração"}</Button>}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={certificate !== null} onClose={() => setCertificate(null)} fullWidth maxWidth="sm">
        <DialogTitle>Declaração de participação</DialogTitle>
        <DialogContent>
          {certificate && <Stack spacing={1} sx={{ py: 2 }}>
            <Typography>A Codaqui declara que <strong>{certificate.memberName}</strong> participou do projeto <strong>{certificate.projectName}</strong>.</Typography>
            <Typography>Carga horária aprovada: <strong>{certificate.hoursAtIssue} horas</strong>.</Typography>
            <Typography>Emitido em {new Date(certificate.issuedAt).toLocaleDateString("pt-BR")}.</Typography>
            <Typography variant="body2" color="text.secondary">Código de verificação: {certificate.code}</Typography>
            <Button component="a" href={`/projetos/comprovante?code=${encodeURIComponent(certificate.code)}`} target="_blank" rel="noopener noreferrer">Abrir verificação pública</Button>
          </Stack>}
        </DialogContent>
        <DialogActions className="no-print"><Button onClick={() => setCertificate(null)}>Fechar</Button><Button variant="contained" onClick={() => globalThis.print()}>Imprimir / salvar PDF</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}

import { useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { extractErrorMessage } from "../../../lib/auth-fetch-helpers";
import { useAuth } from "../../../lib/use-auth";
import type { PublicInstitution } from "../../../data/universities";

interface UniversityApplicationIslandProps {
  readonly institutions: PublicInstitution[];
}

export default function UniversityApplicationIsland({ institutions }: Readonly<UniversityApplicationIslandProps>) {
  const { ready, isLoggedIn, authFetch, login } = useAuth();
  const [institutionId, setInstitutionId] = useState(institutions[0]?.id ?? "");
  const [applicationNotes, setApplicationNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!institutionId) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await authFetch(`/universities/institutions/${institutionId}/ambassador-applications`, {
        method: "POST",
        body: JSON.stringify({ applicationNotes: applicationNotes.trim() }),
      });
      if (!response.ok) {
        setError(await extractErrorMessage(response, "Não foi possível registrar a candidatura."));
        return;
      }
      setApplicationNotes("");
      setSuccess("Candidatura registrada. O gestor avaliará sua solicitação.");
    } catch {
      setError("Não foi possível registrar a candidatura. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return <CircularProgress size={24} aria-label="Carregando autenticação" />;
  if (!isLoggedIn) {
    return (
      <Button variant="contained" onClick={() => login({ returnTo: globalThis.location.pathname })}>
        Entrar com GitHub para se candidatar
      </Button>
    );
  }
  if (institutions.length === 0) {
    return <Alert severity="info">Nenhuma IES disponível para candidatura no momento.</Alert>;
  }

  return (
    <Box component="form" onSubmit={submit} sx={{ display: "grid", gap: 2, maxWidth: 620 }}>
      <Typography component="h3" variant="h6" sx={{ fontWeight: 700 }}>
        Quero ser embaixador
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Escolha uma IES e conte por que você quer representar a Codaqui nela.
      </Typography>
      {institutions.some((institution) => institution.ambassador) && (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {institutions.filter((institution) => institution.ambassador).map((institution) => (
            <Chip key={institution.id} color="success" variant="outlined" label={`${institution.name} já possui embaixador ativo`} />
          ))}
        </Box>
      )}
      <Box component="label" htmlFor="institution" sx={{ fontWeight: 600 }}>
        Instituição
      </Box>
      <Box
        component="select"
        id="institution"
        name="institutionId"
        required
        value={institutionId}
        onChange={(event) => setInstitutionId(event.target.value)}
        sx={{
          minHeight: 48,
          width: "100%",
          px: 1.5,
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          bgcolor: "background.paper",
          color: "text.primary",
          font: "inherit",
        }}
      >
        {institutions.map((institution) => (
          <option key={institution.id} value={institution.id}>
            {institution.name}{institution.city ? ` — ${institution.city.name}/${institution.city.uf}` : ""}
          </option>
        ))}
      </Box>
      <Box component="label" htmlFor="application-notes" sx={{ fontWeight: 600 }}>
        Motivação
      </Box>
      <Box
        component="textarea"
        id="application-notes"
        name="applicationNotes"
        required
        rows={4}
        minLength={10}
        maxLength={2000}
        value={applicationNotes}
        onChange={(event) => setApplicationNotes(event.target.value)}
        aria-describedby="application-notes-help"
        sx={{
          width: "100%",
          p: 1.5,
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          bgcolor: "background.paper",
          color: "text.primary",
          font: "inherit",
          resize: "vertical",
        }}
      />
      <Typography id="application-notes-help" variant="body2" color="text.secondary">
        Entre 10 e 2000 caracteres. Ela será visível somente ao gestor e ao admin.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      <Button type="submit" variant="contained" disabled={busy || !institutionId}>
        {busy ? "Enviando…" : "Enviar candidatura"}
      </Button>
    </Box>
  );
}

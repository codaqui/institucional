/**
 * Página de edição de perfil do membro (`/membro/editar`) — port de
 * `src/pages/membro/editar.tsx` (Docusaurus).
 *
 * Bio (280 chars) + LinkedIn via `GET`/`PUT /members/me`. Nome, avatar e
 * GitHub são sincronizados pela conta GitHub (somente leitura aqui).
 */
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MuiIslandProvider from "../MuiIslandProvider";
import { useAuth } from "../../../lib/use-auth";

function EditarPerfilInner() {
  const { ready, isLoggedIn, authFetch } = useAuth();

  const [bio, setBio] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn) {
      window.location.replace("/");
      return;
    }
    authFetch("/members/me")
      .then((r) => r.json())
      .then((data) => {
        setBio(data.bio ?? "");
        setLinkedinUrl(data.linkedinUrl ?? "");
      })
      .catch(() => {});
  }, [ready, isLoggedIn, authFetch]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const res = await authFetch("/members/me", {
        method: "PUT",
        body: JSON.stringify({ bio, linkedinUrl }),
      });
      if (!res.ok) throw new Error("Erro ao salvar.");
      setSuccess(true);
    } catch {
      setError("Não foi possível salvar as alterações. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (!ready || !isLoggedIn) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Typography variant="h5" sx={{ fontWeight: 800 }} gutterBottom>
        Editar Perfil
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Nome, avatar e GitHub são sincronizados automaticamente com sua conta GitHub.
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Perfil atualizado com sucesso!
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <TextField
          label="Bio"
          multiline
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Conte um pouco sobre você…"
          slotProps={{ htmlInput: { maxLength: 280 } }}
          helperText={`${bio.length}/280`}
        />
        <TextField
          label="LinkedIn (URL completa)"
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
          placeholder="https://linkedin.com/in/seu-perfil"
          type="url"
        />
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : undefined}
          >
            {saving ? "Salvando…" : "Salvar"}
          </Button>
          <Button variant="text" color="inherit" href="/membro">
            Cancelar
          </Button>
        </Box>
      </Box>
    </Container>
  );
}

export default function EditarPerfilApp() {
  return (
    <MuiIslandProvider>
      <EditarPerfilInner />
    </MuiIslandProvider>
  );
}

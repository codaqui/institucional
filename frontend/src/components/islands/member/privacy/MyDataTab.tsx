import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import SaveIcon from "@mui/icons-material/Save";
import { useAuth } from "../../../../lib/use-auth";

interface VisibilityField {
  key: string;
  label: string;
  source: string;
  purpose: string;
}

interface VisibilityResponse {
  visibility: Record<string, boolean>;
  fields: VisibilityField[];
  marketingEmailOptIn?: boolean;
  marketingSuppressed?: boolean;
}

export default function MyDataTab() {
  const { user, ready, isLoggedIn, authFetch } = useAuth();
  const [fields, setFields] = useState<VisibilityField[]>([]);
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [marketingEmailOptIn, setMarketingEmailOptIn] = useState(false);
  const [marketingSuppressed, setMarketingSuppressed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMarketing, setSavingMarketing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!ready || !isLoggedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await authFetch("/members/me/visibility");
        if (!res.ok) throw new Error("Não foi possível carregar a visibilidade.");
        const data = (await res.json()) as VisibilityResponse;
        if (!cancelled) {
          setFields(data.fields);
          setVisibility(data.visibility);
          setMarketingEmailOptIn(Boolean(data.marketingEmailOptIn));
          setMarketingSuppressed(Boolean(data.marketingSuppressed));
        }
      } catch {
        if (!cancelled) setError("Não foi possível carregar a visibilidade.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, isLoggedIn, authFetch]);

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await authFetch("/members/me/visibility", {
        method: "PATCH",
        body: JSON.stringify(visibility),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(data?.message ?? "Não foi possível salvar.");
        return;
      }
      const data = (await res.json()) as VisibilityResponse;
      setVisibility(data.visibility);
      setSuccess("Visibilidade atualizada.");
    } catch {
      setError("Erro inesperado ao salvar a visibilidade.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 800 }}>
          Meus dados e privacidade
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Entenda o que coletamos e escolha o que aparece no seu perfil público.
        </Typography>
      </Box>

      <Alert severity="info">
        Alterações passam a valer no perfil público após o próximo refresh ou build da página.
      </Alert>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h3" sx={{ fontWeight: 700 }} gutterBottom>
            Dados da conta
          </Typography>
          <Typography variant="body2"><strong>Nome:</strong> {user?.name}</Typography>
          <Typography variant="body2"><strong>GitHub:</strong> @{user?.handle}</Typography>
          <Typography variant="body2">
            <strong>E-mail:</strong> {user?.email} (somente leitura e nunca é público)
          </Typography>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h3" sx={{ fontWeight: 700 }} gutterBottom>
            Visibilidade por campo
          </Typography>
          <Grid container spacing={2}>
            {fields.map((field) => (
              <Grid key={field.key} size={{ xs: 12, sm: 6 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={visibility[field.key] ?? false}
                      onChange={(_, checked) =>
                        setVisibility((current) => ({ ...current, [field.key]: checked }))
                      }
                    />
                  }
                  label={field.label}
                  labelPlacement="end"
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", ml: 5 }}>
                  {field.source} · {field.purpose}
                </Typography>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Box>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          disabled={saving}
          onClick={save}
        >
          {saving ? "Salvando…" : "Salvar visibilidade"}
        </Button>
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" component="h3" sx={{ fontWeight: 700 }} gutterBottom>
                Comunicações promocionais e campanhas
              </Typography>
              <Typography id="marketing-consent-help" variant="body2" color="text.secondary">
                Preferência independente para receber boletins, novidades, divulgação de iniciativas e campanhas promocionais da Codaqui. Esta escolha não afeta e-mails estritamente transacionais (como confirmações de inscrição, certificados, doações ou segurança da conta) nem o opt-in de acompanhamento pós-evento.
              </Typography>
            </Box>

            {marketingSuppressed && (
              <Alert severity="info">
                Este endereço possui um descadastro promocional ativo. Para voltar a receber comunicações promocionais, ative a chave abaixo e confirme explicitamente a reativação.
              </Alert>
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={marketingEmailOptIn}
                  slotProps={{ input: { "aria-describedby": "marketing-consent-help" } }}
                  onChange={(_, checked) => setMarketingEmailOptIn(checked)}
                />
              }
              label="Receber comunicações promocionais e campanhas de divulgação"
            />

            <Box>
              <Button
                variant="outlined"
                disabled={savingMarketing}
                onClick={async () => {
                  setSavingMarketing(true);
                  setError("");
                  setSuccess("");
                  try {
                    const res = await authFetch("/members/me/marketing-consent", {
                      method: "PATCH",
                      body: JSON.stringify({ marketingEmailOptIn }),
                    });
                    if (!res.ok) {
                      const data = (await res.json().catch(() => null)) as { message?: string } | null;
                      setError(
                        data?.message ??
                          "Não foi possível atualizar a preferência promocional.",
                      );
                      return;
                    }
                    const data = (await res.json()) as {
                      marketingEmailOptIn: boolean;
                      marketingSuppressed: boolean;
                    };
                    setMarketingEmailOptIn(Boolean(data.marketingEmailOptIn));
                    setMarketingSuppressed(Boolean(data.marketingSuppressed));
                    setSuccess("Preferência de comunicações promocionais atualizada.");
                  } catch {
                    setError(
                      "Erro inesperado ao salvar a preferência promocional.",
                    );
                  } finally {
                    setSavingMarketing(false);
                  }
                }}
              >
                {savingMarketing
                  ? "Salvando preferência…"
                  : marketingSuppressed && marketingEmailOptIn
                    ? "Confirmar reativação promocional"
                    : "Salvar preferência promocional"}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

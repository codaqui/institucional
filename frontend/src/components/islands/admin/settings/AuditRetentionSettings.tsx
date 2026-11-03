import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import MuiIslandProvider from "../../MuiIslandProvider";
import PageContainer from "../ui/PageContainer";
import { useAuth } from "../../../../lib/use-auth";
import {
  extractErrorMessage,
  parseAuthJson,
} from "../../../../lib/auth-fetch-helpers";

interface AuditRetentionPolicy {
  retentionDays: number;
  source: "setting" | "env";
}

function validateRetention(value: string): string {
  const days = Number(value);
  if (!Number.isInteger(days) || days < 7 || days > 365) {
    return "Informe um número inteiro entre 7 e 365.";
  }
  return "";
}

function AuditRetentionSettingsInner(): React.JSX.Element | null {
  const { ready, isLoggedIn, isAdmin, authFetch } = useAuth();
  const [retentionDays, setRetentionDays] = useState("");
  const [source, setSource] = useState<AuditRetentionPolicy["source"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [feedback, setFeedback] = useState<{
    severity: "success" | "error";
    message: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const loadPolicy = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await authFetch("/settings/audit-retention");
      const policy = await parseAuthJson<AuditRetentionPolicy>(res, setLoadError);
      if (!policy) return;
      setRetentionDays(String(policy.retentionDays));
      setSource(policy.source);
    } catch {
      setLoadError("Não foi possível carregar a retenção de auditoria.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !isAdmin) {
      window.location.replace("/");
      return;
    }
    void loadPolicy();
  }, [ready, isLoggedIn, isAdmin, loadPolicy]);

  const savePolicy = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = validateRetention(retentionDays);
    setFieldError(error);
    setFeedback(null);
    if (error) {
      document.getElementById("audit-retention-days")?.focus();
      return;
    }
    const days = Number(retentionDays);
    if (!window.confirm(`Alterar a retenção operacional para ${days} dias?`)) return;

    setSaving(true);
    try {
      const res = await authFetch("/settings/audit-retention", {
        method: "PUT",
        body: JSON.stringify({ retentionDays: days }),
      });
      if (!res.ok) {
        setFeedback({
          severity: "error",
          message: await extractErrorMessage(
            res,
            "Não foi possível salvar a retenção de auditoria.",
          ),
        });
        return;
      }
      setSource("setting");
      setFeedback({
        severity: "success",
        message: "Retenção de auditoria salva com sucesso.",
      });
    } catch {
      setFeedback({
        severity: "error",
        message: "Não foi possível salvar a retenção de auditoria.",
      });
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
  if (!isLoggedIn || !isAdmin) return null;

  return (
    <PageContainer>
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Typography variant="h4" component="h2" sx={{ fontWeight: 800 }}>
          Configurações
        </Typography>
        <Typography color="text.secondary">
          Políticas administrativas da Associação
        </Typography>
      </Stack>

      {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}
      {feedback && (
        <Alert severity={feedback.severity} sx={{ mb: 2 }} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      <Card variant="outlined" sx={{ maxWidth: 640 }}>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" component="h3">
                Retenção de auditoria
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Logs operacionais expiram após o período configurado. Logs de governo são permanentes.
              </Typography>
            </Box>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                <CircularProgress aria-label="Carregando retenção" />
              </Box>
            ) : (
              <Box component="form" onSubmit={(event) => void savePolicy(event)} noValidate>
                <Stack spacing={2}>
                  {source && <Chip size="small" label={`Origem: ${source}`} sx={{ alignSelf: "flex-start" }} />}
                  <TextField
                    id="audit-retention-days"
                    label="Retenção operacional (dias)"
                    name="retentionDays"
                    type="number"
                    required
                    value={retentionDays}
                    onChange={(event) => {
                      setRetentionDays(event.target.value);
                      setFieldError("");
                    }}
                    onBlur={() => setFieldError(validateRetention(retentionDays))}
                    error={Boolean(fieldError)}
                    helperText={fieldError ?? "Número inteiro entre 7 e 365 dias."}
                    slotProps={{ htmlInput: { min: 7, max: 365, step: 1, inputMode: "numeric" } }}
                  />
                  <Button type="submit" variant="contained" disabled={saving} sx={{ alignSelf: "flex-start" }}>
                    {saving ? "Salvando…" : "Salvar retenção"}
                  </Button>
                </Stack>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default function AuditRetentionSettings(): React.JSX.Element {
  return (
    <MuiIslandProvider>
      <AuditRetentionSettingsInner />
    </MuiIslandProvider>
  );
}

import React, { useCallback, useEffect, useState } from "react";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import { useLocation } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import { resolveApiUrl } from "../../lib/api-url";

// ---------------------------------------------------------------------------
// Verificação pública de certificados (GET /events/certificates/verify/:code)
// ---------------------------------------------------------------------------

interface VerifyResult {
  valid: boolean;
  attendeeName?: string;
  eventTitle?: string;
  eventStartAt?: string;
}

/** Formata data ISO de forma defensiva (null quando ausente/inválida). */
function formatDateSafe(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR");
}

export default function CertificadoVerificarPage(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const configuredApiUrl =
    (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";
  const apiUrl = resolveApiUrl(configuredApiUrl, siteConfig.url);
  const location = useLocation();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  const verify = useCallback(
    async (rawCode: string) => {
      const trimmed = rawCode.trim();
      if (!trimmed) return;
      setLoading(true);
      setResult(null);
      setNotFound(false);
      setError("");
      try {
        const res = await fetch(
          `${apiUrl}/events/certificates/verify/${encodeURIComponent(trimmed)}`
        );
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) {
          setError("Não foi possível verificar o certificado agora. Tente novamente.");
          return;
        }
        const data = (await res.json()) as VerifyResult;
        if (data.valid) {
          setResult(data);
        } else {
          setNotFound(true);
        }
      } catch {
        setError("Não foi possível verificar o certificado agora. Tente novamente.");
      } finally {
        setLoading(false);
      }
    },
    [apiUrl]
  );

  // Auto-verifica quando o código vem na query string (?codigo=) — ex.: via QR code.
  useEffect(() => {
    const param = new URLSearchParams(location.search).get("codigo");
    if (param) {
      setCode(param);
      void verify(param);
    }
  }, [location.search, verify]);

  const eventDate = formatDateSafe(result?.eventStartAt);

  return (
    <Layout
      title="Verificar certificado"
      description="Verifique a autenticidade de um certificado de participação da Associação Codaqui."
    >
      <Container maxWidth="sm" sx={{ py: { xs: 4, md: 6 } }}>
        <Stack spacing={3}>
          <Box sx={{ textAlign: "center" }}>
            <WorkspacePremiumIcon color="primary" sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="h4" fontWeight={800} gutterBottom>
              Verificar certificado
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Confirme a autenticidade de um certificado de participação emitido pela
              Associação Codaqui usando o código de verificação.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="Código de verificação"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              size="small"
              fullWidth
              onKeyDown={(e) => {
                if (e.key === "Enter") void verify(code);
              }}
            />
            <Button
              variant="contained"
              disabled={loading || !code.trim()}
              onClick={() => void verify(code)}
              sx={{ whiteSpace: "nowrap" }}
            >
              Verificar
            </Button>
          </Stack>

          {loading && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "center", py: 2 }}>
              <CircularProgress size={28} />
              <Skeleton variant="rounded" height={120} sx={{ width: "100%" }} />
            </Box>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {!loading && notFound && (
            <Card
              variant="outlined"
              sx={{ borderColor: "error.main", bgcolor: "error.main", backgroundImage: "none" }}
            >
              <CardContent sx={{ textAlign: "center" }}>
                <CancelIcon sx={{ fontSize: 48, color: "error.contrastText" }} />
                <Typography variant="h6" fontWeight={800} sx={{ color: "error.contrastText" }}>
                  Certificado inválido
                </Typography>
                <Typography variant="body2" sx={{ color: "error.contrastText" }}>
                  Nenhum certificado válido foi encontrado para este código. Confira se o
                  código foi digitado corretamente.
                </Typography>
              </CardContent>
            </Card>
          )}

          {!loading && result?.valid && (
            <Card variant="outlined" sx={{ borderColor: "success.main", borderWidth: 2 }}>
              <CardContent sx={{ textAlign: "center" }}>
                <CheckCircleIcon color="success" sx={{ fontSize: 48 }} />
                <Typography variant="h6" fontWeight={800} color="success.main">
                  Certificado válido
                </Typography>
                <Typography variant="body1" sx={{ mt: 2 }}>
                  <strong>{result.attendeeName}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  participou do evento
                </Typography>
                <Typography variant="body1" fontWeight={700}>
                  {result.eventTitle}
                </Typography>
                {eventDate && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    realizado em {eventDate}
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}

          <Box sx={{ textAlign: "center" }}>
            <Button component={Link} href="/eventos" variant="text" size="small">
              Ver eventos da comunidade
            </Button>
          </Box>
        </Stack>
      </Container>
    </Layout>
  );
}

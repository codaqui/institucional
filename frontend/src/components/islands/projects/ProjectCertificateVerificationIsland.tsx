import { useEffect, useState } from "react";
import { Alert, Card, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
import { resolveApiUrl } from "../../../lib/api-url";

interface VerificationResult {
  valid: boolean;
  kind: string;
  memberName: string;
  projectName: string;
  hoursAtIssue: number;
  issuedAt: string;
}

export default function ProjectCertificateVerificationIsland({
  code,
  fetchImpl = fetch,
}: Readonly<{ code: string; fetchImpl?: typeof fetch }>) {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl = resolveApiUrl(import.meta.env.SITE);
    void fetchImpl(`${apiUrl}/project-certificates/verify/${encodeURIComponent(code)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Comprovante não encontrado.");
        setResult(await response.json() as VerificationResult);
      })
      .catch((error: unknown) => setError(error instanceof Error ? error.message : "Não foi possível verificar o comprovante."))
      .finally(() => setLoading(false));
  }, [code, fetchImpl]);

  if (loading) return <CircularProgress size={28} aria-label="Verificando comprovante" />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!result) return null;

  return (
    <Card variant="outlined" sx={{ maxWidth: 640 }}>
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="h6" component="h2">Comprovante válido</Typography>
          <Typography><strong>Titular:</strong> {result.memberName}</Typography>
          <Typography><strong>Projeto:</strong> {result.projectName}</Typography>
          <Typography><strong>Horas aprovadas:</strong> {result.hoursAtIssue} horas</Typography>
          <Typography><strong>Emitido em:</strong> {new Date(result.issuedAt).toLocaleDateString("pt-BR")}</Typography>
          <Typography variant="body2" color="text.secondary">Código: {code}</Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

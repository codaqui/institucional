import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MuiIslandProvider from "../MuiIslandProvider";
import { resolveApiUrl } from "../../../lib/api-url";

interface UnsubscribeResponse {
  ok: boolean;
  status: "unsubscribed" | "invalid_or_expired";
  message: string;
}

function UnsubscribeInner() {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<UnsubscribeResponse | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token")?.trim() ?? "";

    if (!token) {
      setResult({
        ok: false,
        status: "invalid_or_expired",
        message:
          "Link de descadastro inválido ou expirado. Caso seja membro, gerencie suas preferências em Meus dados.",
      });
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const apiUrl = resolveApiUrl(import.meta.env.SITE);
        const res = await fetch(
          `${apiUrl}/campaigns/unsubscribe?token=${encodeURIComponent(token)}`,
          { method: "GET", credentials: "omit" },
        );
        const data = (await res.json().catch(() => null)) as UnsubscribeResponse | null;
        if (cancelled) return;
        if (data && typeof data.message === "string") {
          setResult(data);
        } else {
          setResult({
            ok: false,
            status: "invalid_or_expired",
            message:
              "Link de descadastro inválido ou expirado. Caso seja membro, gerencie suas preferências em Meus dados.",
          });
        }
      } catch {
        if (!cancelled) {
          setResult({
            ok: false,
            status: "invalid_or_expired",
            message:
              "Não foi possível processar a solicitação no momento. Tente novamente em instantes ou acesse Meus dados.",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Box sx={{ maxWidth: 640, mx: "auto", py: 6, px: 2 }}>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={3}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
              Preferências de comunicação promocional
            </Typography>

            {loading ? (
              <Box
                 sx={{ display: "flex", alignItems: "center", gap: 2, py: 3 }}
                role="status"
                aria-live="polite"
              >
                <CircularProgress size={24} />
                <Typography variant="body1">
                  Processando sua solicitação de descadastro…
                </Typography>
              </Box>
            ) : (
              <Alert
                severity={result?.status === "unsubscribed" ? "success" : "info"}
                role="status"
                aria-live="polite"
              >
                {result?.message}
              </Alert>
            )}

            <Typography variant="body2" color="text.secondary">
              O descadastro promocional interrompe o envio de boletins, novidades e campanhas de divulgação. Comunicações estritamente transacionais (como comprovantes de inscrição, certificados ou segurança da conta) permanecem vinculadas às respectivas ações.
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Button variant="outlined" href="/membro">
                Acessar Meus dados
              </Button>
              <Button variant="text" href="/sobre/privacidade">
                Política de Privacidade
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

export default function UnsubscribeIsland() {
  return (
    <MuiIslandProvider>
      <UnsubscribeInner />
    </MuiIslandProvider>
  );
}

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SyncIcon from "@mui/icons-material/Sync";
import { useAuth } from "../../../../lib/use-auth";
import { extractErrorMessage } from "../../../../lib/auth-fetch-helpers";

type ReconciliationResult = {
  status: "created" | "already_exists" | "no_fee";
  paymentIntentId: string;
  chargeId: string;
  balanceTransactionId: string;
  feeReferenceId: string;
  feeCents: number;
  transactionId?: string;
};

type Feedback = {
  severity: "success" | "info" | "error";
  message: string;
  referenceId?: string;
};

export default function StripeFeeReconciliationPanel(): React.JSX.Element {
  const { authFetch } = useAuth();
  const [paymentIntentId, setPaymentIntentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedId = paymentIntentId.trim();
    if (!/^pi_[A-Za-z0-9]+$/.test(normalizedId)) {
      setFeedback({
        severity: "error",
        message: "Informe um PaymentIntent válido no formato pi_...",
      });
      return;
    }

    setLoading(true);
    setFeedback(null);
    try {
      const response = await authFetch("/stripe/reconcile-fee", {
        method: "POST",
        body: JSON.stringify({ paymentIntentId: normalizedId }),
      });
      if (!response.ok) {
        setFeedback({
          severity: "error",
          message: await extractErrorMessage(
            response,
            "Não foi possível reconciliar a taxa.",
          ),
        });
        return;
      }

      const data = (await response.json()) as ReconciliationResult;
      const amount = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(data.feeCents / 100);
      if (data.status === "created") {
        setFeedback({
          severity: "success",
          message: `Taxa de ${amount} criada no ledger.`,
          referenceId: data.feeReferenceId,
        });
      } else if (data.status === "already_exists") {
        setFeedback({
          severity: "info",
          message:
            "A taxa já estava registrada; nenhum lançamento foi duplicado.",
          referenceId: data.feeReferenceId,
        });
      } else {
        setFeedback({
          severity: "info",
          message: "A balance transaction não possui taxa a registrar.",
          referenceId: data.feeReferenceId,
        });
      }
    } catch {
      setFeedback({
        severity: "error",
        message:
          "Erro inesperado ao consultar a reconciliação. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2} component="form" onSubmit={handleSubmit}>
          <Box>
            <Typography variant="h6" component="h3" gutterBottom>
              Reconciliação de taxas Stripe
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Consulta o PaymentIntent no Stripe e cria somente a taxa ausente
              no ledger. Se ela já existir, nenhum lançamento será duplicado.
            </Typography>
          </Box>

          <TextField
            label="PaymentIntent"
            placeholder="pi_..."
            value={paymentIntentId}
            onChange={(event) => setPaymentIntentId(event.target.value)}
            autoComplete="off"
            fullWidth
            required
            disabled={loading}
            helperText="Informe o ID pi_... da doação que deseja verificar."
          />

          <Box>
            <Button
              type="submit"
              variant="contained"
              startIcon={
                loading ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <SyncIcon />
                )
              }
              disabled={loading}
            >
              {loading ? "Consultando..." : "Consultar e reconciliar"}
            </Button>
          </Box>

          {feedback && (
            <Alert severity={feedback.severity}>
              {feedback.message}
              {feedback.referenceId && (
                <Typography
                  variant="caption"
                  sx={{ display: "block", mt: 0.5, wordBreak: "break-all" }}
                >
                  {feedback.referenceId}
                </Typography>
              )}
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

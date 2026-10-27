/**
 * Comprovante de compra autenticado (`/eventos/comprovante?order=`) — port de
 * `src/pages/eventos/comprovante.tsx` (Docusaurus).
 *
 * Recibo de pedido de ingresso via `GET /events/orders/:orderId/receipt`.
 * Deslogado, dispara o login GitHub com `returnTo` preservando o `?order=`.
 */
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PrintIcon from "@mui/icons-material/Print";
import MuiIslandProvider from "../MuiIslandProvider";
import PageContainer from "../admin/ui/PageContainer";
import { useAuth } from "../../../lib/use-auth";
import { formatBRL } from "../../../lib/transaction";

interface ReceiptItem {
  ticketName: string;
  quantity: number;
  unitPriceCents: number;
}

interface ReceiptAttendee {
  name: string;
  email: string;
}

interface ReceiptData {
  orderId: string;
  eventTitle: string;
  buyerName: string;
  buyerEmail: string;
  attendees: ReceiptAttendee[];
  items: ReceiptItem[];
  totalCents: number;
  paidAt: string | null;
  termsVersion: string;
  verificationCode: string;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR");
}

function ReceiptSkeleton(): React.JSX.Element {
  return (
    <Stack spacing={2}>
      <Skeleton variant="text" width="60%" height={40} />
      <Skeleton variant="rectangular" height={120} />
      <Skeleton variant="text" width="40%" />
    </Stack>
  );
}

function ReceiptError({
  message,
}: {
  readonly message: string | null;
}): React.JSX.Element {
  return <Alert severity="error">{message ?? "Erro ao carregar comprovante."}</Alert>;
}

function ReceiptBody({
  receipt,
}: {
  readonly receipt: ReceiptData;
}): React.JSX.Element {
  return (
    <>
      <Stack
        spacing={2}
        sx={{
          mb: 3,
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
        }}
      >
        <Box>
          <Typography variant="overline" color="text.secondary">
            Comprovante de compra
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {receipt.eventTitle || "Ingresso"}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<PrintIcon />}
          onClick={() => globalThis.print()}
        >
          Imprimir
        </Button>
      </Stack>

      <Divider sx={{ mb: 3 }} />

      <Stack spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            Código de verificação
          </Typography>
          <Typography variant="h6" sx={{ fontFamily: "monospace", fontWeight: 700 }}>
            {receipt.verificationCode}
          </Typography>
        </Box>

        <Box>
          <Typography variant="body2" color="text.secondary">
            Pedido
          </Typography>
          <Typography variant="body1">{receipt.orderId}</Typography>
        </Box>

        <Box>
          <Typography variant="body2" color="text.secondary">
            Comprador
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {receipt.buyerName || "—"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {receipt.buyerEmail || "—"}
          </Typography>
        </Box>

        {receipt.attendees.length > 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary">
              Participante{receipt.attendees.length > 1 ? "s" : ""}
            </Typography>
            {receipt.attendees.map((a) => (
              <Typography key={a.email} variant="body1">
                {a.name} — {a.email}
              </Typography>
            ))}
          </Box>
        )}

        <Box>
          <Typography variant="body2" color="text.secondary">
            Pago em
          </Typography>
          <Typography variant="body1">{formatDateTime(receipt.paidAt)}</Typography>
        </Box>
      </Stack>

      <Divider sx={{ mb: 3 }} />

      <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
        Itens
      </Typography>
      <Stack spacing={1.5} sx={{ mb: 3 }}>
        {receipt.items.map((item) => (
          <Stack
            key={`${item.ticketName}-${item.unitPriceCents}`}
            direction="row"
            sx={{ justifyContent: "space-between", alignItems: "center" }}
          >
            <Typography variant="body1">
              {item.quantity}x {item.ticketName}
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {formatBRL((item.unitPriceCents * item.quantity) / 100)}
            </Typography>
          </Stack>
        ))}
      </Stack>

      <Divider sx={{ mb: 2 }} />

      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Total
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          {formatBRL(receipt.totalCents / 100)}
        </Typography>
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: "block" }}>
        Termos de compra aceitos: {receipt.termsVersion}
      </Typography>
    </>
  );
}

function ReceiptContent({
  error,
  loading,
  receipt,
}: {
  readonly error: string | null;
  readonly loading: boolean;
  readonly receipt: ReceiptData | null;
}): React.JSX.Element {
  if (error) return <ReceiptError message={error} />;
  if (loading || !receipt) return <ReceiptSkeleton />;
  return <ReceiptBody receipt={receipt} />;
}

function ReceiptInner(): React.JSX.Element {
  const { authFetch, isLoggedIn, ready, login } = useAuth();

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderId = new URLSearchParams(window.location.search).get("order");

  useEffect(() => {
    if (!ready || !orderId) return;
    if (!isLoggedIn) {
      login({
        returnTo: `${window.location.pathname}${window.location.search}`,
      });
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    authFetch(`/events/orders/${orderId}/receipt`)
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          const msg = await res.text().catch(() => "");
          setError(msg || "Não foi possível carregar o comprovante.");
          return;
        }
        const data = (await res.json()) as ReceiptData;
        setReceipt(data);
      })
      .catch(() => {
        if (active) setError("Erro inesperado ao carregar o comprovante.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ready, isLoggedIn, orderId, login, authFetch]);

  return (
    <PageContainer sx={{ maxWidth: "md" }}>
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <ReceiptContent error={error} loading={loading} receipt={receipt} />
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default function ReceiptApp(): React.JSX.Element {
  return (
    <MuiIslandProvider>
      <ReceiptInner />
    </MuiIslandProvider>
  );
}

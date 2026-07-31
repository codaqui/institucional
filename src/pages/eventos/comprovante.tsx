import React, { useEffect, useState } from "react";
import Layout from "@theme/Layout";
import { useLocation } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import { useAuth } from "../../hooks/useAuth";
import { resolveApiUrl } from "../../lib/api-url";
import { formatBRL } from "../../utils/transaction";

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

function ReceiptError({ message }: { readonly message: string | null }): React.JSX.Element {
  return <Alert severity="error">{message ?? "Erro ao carregar comprovante."}</Alert>;
}

function ReceiptBody({ receipt }: { readonly receipt: ReceiptData }): React.JSX.Element {
  return (
    <>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="overline" color="text.secondary">
            Comprovante de compra
          </Typography>
          <Typography variant="h4" fontWeight={800}>
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
          <Typography variant="h6" fontFamily="monospace" fontWeight={700}>
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
          <Typography variant="body1" fontWeight={600}>
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

      <Typography variant="h6" fontWeight={700} gutterBottom>
        Itens
      </Typography>
      <Stack spacing={1.5} sx={{ mb: 3 }}>
        {receipt.items.map((item) => (
          <Stack
            key={`${item.ticketName}-${item.unitPriceCents}`}
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="body1">
              {item.quantity}x {item.ticketName}
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {formatBRL((item.unitPriceCents * item.quantity) / 100)}
            </Typography>
          </Stack>
        ))}
      </Stack>

      <Divider sx={{ mb: 2 }} />

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6" fontWeight={700}>
          Total
        </Typography>
        <Typography variant="h5" fontWeight={800}>
          {formatBRL(receipt.totalCents / 100)}
        </Typography>
      </Stack>

      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 3 }}>
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

export default function EventReceiptPage(): React.JSX.Element {
  const location = useLocation();
  const { authFetch, isLoggedIn, ready, login } = useAuth();
  const { siteConfig } = useDocusaurusContext();
  const configuredApiUrl =
    (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";
  const apiUrl = resolveApiUrl(configuredApiUrl, siteConfig.url);

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderId = new URLSearchParams(location.search).get("order");

  useEffect(() => {
    if (!ready || !orderId) return;
    if (!isLoggedIn) {
      login({ returnTo: `${location.pathname}${location.search}` });
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    authFetch(`${apiUrl}/events/orders/${orderId}/receipt`)
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
  }, [ready, isLoggedIn, orderId, apiUrl, login, location.pathname, location.search, authFetch]);

  return (
    <Layout title="Comprovante de compra" description="Comprovante de compra de ingresso">
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent sx={{ p: { xs: 3, md: 5 } }}>
            <ReceiptContent error={error} loading={loading} receipt={receipt} />
          </CardContent>
        </Card>
      </Container>
    </Layout>
  );
}

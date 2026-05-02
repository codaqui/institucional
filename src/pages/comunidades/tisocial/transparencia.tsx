import React, { useEffect, useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Skeleton,
  Stack,
  Typography,
  Alert,
} from "@mui/material";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import VerifiedIcon from "@mui/icons-material/Verified";
import FavoriteIcon from "@mui/icons-material/Favorite";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { type CommunityBalance, formatBRL } from "@site/src/utils/transaction";
import TransactionTable from "@site/src/components/TransactionTable";
import community from "@site/comunidades/tisocial/community.config";
import { resolveApiUrl } from "@site/src/lib/api-url";

const accent = community.theme.primary;
const accentDark = community.theme.primaryDark;

export default function TiSocialTransparencia(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const configuredApiUrl =
    typeof siteConfig.customFields?.apiUrl === "string"
      ? siteConfig.customFields.apiUrl
      : "http://localhost:3001";
  const apiUrl = resolveApiUrl(configuredApiUrl, siteConfig.url);

  const [balance, setBalance] = useState<CommunityBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiUrl}/ledger/community-balances`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: CommunityBalance[]) => {
        if (cancelled) return;
        const found = data.find((b) => b.projectKey === community.slug);
        setBalance(found ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar saldo");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  return (
    <Layout
      title={`Transparência — ${community.shortName}`}
      description={`Saldo e movimentações da conta ${community.name} no ledger Codaqui.`}
    >
      {/* Hero */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%)`,
          color: "#fff",
          py: { xs: 6, md: 8 },
        }}
      >
        <Container maxWidth="lg">
          <Stack spacing={2} maxWidth={760}>
            <Chip
              icon={<VerifiedIcon sx={{ color: "#fff !important" }} />}
              label="Transparência financeira"
              sx={{
                bgcolor: "rgba(255,255,255,0.18)",
                color: "#fff",
                width: "fit-content",
                fontWeight: 600,
                "& .MuiChip-icon": { color: "#fff" },
              }}
            />
            <Typography variant="h2" component="h1" fontWeight={800}>
              📊 Transparência da {community.shortName}
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.95, fontWeight: 400 }}>
              Toda doação para a {community.shortName} é registrada no ledger contábil
              da Associação Codaqui. Aqui você acompanha o saldo e cada movimentação em
              tempo real.
            </Typography>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        {error && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Não foi possível carregar o saldo no momento ({error}). Tente novamente em
            instantes ou veja o painel global.
          </Alert>
        )}

        {/* Cards superiores: saldo + meta */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Card
              variant="outlined"
              sx={{
                borderColor: accent,
                borderWidth: 2,
                height: "100%",
                background: `linear-gradient(135deg, ${accent}10 0%, ${accent}05 100%)`,
              }}
            >
              <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <Box
                    sx={{
                      bgcolor: accent,
                      color: "#fff",
                      borderRadius: 2,
                      p: 1.2,
                      display: "flex",
                    }}
                  >
                    <AccountBalanceWalletIcon sx={{ fontSize: 32 }} />
                  </Box>
                  <Box>
                    <Typography
                      variant="overline"
                      color="text.secondary"
                      sx={{ letterSpacing: 1.2, fontWeight: 700 }}
                    >
                      Saldo atual
                    </Typography>
                    {loading ? (
                      <Skeleton width={220} height={56} />
                    ) : (
                      <Typography
                        variant="h2"
                        fontWeight={800}
                        sx={{ color: accent, lineHeight: 1.1 }}
                      >
                        {balance ? formatBRL(balance.balance) : formatBRL(0)}
                      </Typography>
                    )}
                  </Box>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Disponível para os projetos da {community.shortName}. 100% das doações
                  são alocadas para essa conta antes de serem distribuídas.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <Card variant="outlined" sx={{ height: "100%" }}>
              <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                  <ReceiptLongIcon sx={{ color: accent }} />
                  <Typography variant="h6" fontWeight={700}>
                    Como funciona
                  </Typography>
                </Stack>
                <Stack spacing={1.5}>
                  <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                    <Chip
                      label="1"
                      size="small"
                      sx={{ bgcolor: accent, color: "#fff", fontWeight: 700, minWidth: 28 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      Cada doação cria uma transação no ledger (entrada).
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                    <Chip
                      label="2"
                      size="small"
                      sx={{ bgcolor: accent, color: "#fff", fontWeight: 700, minWidth: 28 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      Pagamentos para fornecedores e reembolsos saem como saídas.
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                    <Chip
                      label="3"
                      size="small"
                      sx={{ bgcolor: accent, color: "#fff", fontWeight: 700, minWidth: 28 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      Tudo é público, auditável e detalhado nas movimentações abaixo.
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Movimentações */}
        <Card variant="outlined" sx={{ mb: 4 }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              spacing={1}
              sx={{ mb: 2 }}
            >
              <Box>
                <Typography variant="h5" fontWeight={800}>
                  Movimentações
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Histórico completo da conta no ledger.{" "}
                  {balance && (
                    <Box component="span" sx={{ fontFamily: "monospace", fontSize: "0.85em" }}>
                      ({balance.projectKey})
                    </Box>
                  )}
                </Typography>
              </Box>
              {balance && (
                <Chip
                  label="Atualizado em tempo real"
                  size="small"
                  sx={{ bgcolor: `${accent}20`, color: accent, fontWeight: 600 }}
                />
              )}
            </Stack>
            <Divider sx={{ mb: 2 }} />
            {loading && <Skeleton variant="rectangular" height={300} />}
            {!loading && balance && (
              <TransactionTable
                accountId={balance.id}
                accountName={balance.name}
                apiUrl={apiUrl}
              />
            )}
            {!loading && !balance && !error && (
              <Alert severity="info">
                Nenhuma conta encontrada para esta comunidade ainda. As primeiras
                doações criarão o histórico.
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* CTAs finais */}
        <Card variant="outlined" sx={{ bgcolor: "action.hover" }}>
          <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ md: "center" }}
              justifyContent="space-between"
            >
              <Box>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Quer fazer parte dessa transparência?
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Apoie a {community.shortName} ou veja o painel completo da Codaqui.
                </Typography>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  component={Link}
                  to={`${community.basePath}/apoiar`}
                  variant="contained"
                  size="large"
                  startIcon={<FavoriteIcon />}
                  sx={{
                    bgcolor: accent,
                    fontWeight: 700,
                    textTransform: "none",
                    "&:hover": { bgcolor: accentDark },
                  }}
                >
                  Apoiar
                </Button>
                <Button
                  component={Link}
                  to="/transparencia"
                  variant="outlined"
                  size="large"
                  endIcon={<OpenInNewIcon />}
                  sx={{
                    borderColor: accent,
                    color: accent,
                    fontWeight: 600,
                    textTransform: "none",
                    "&:hover": { borderColor: accentDark, bgcolor: `${accent}10` },
                  }}
                >
                  Painel completo (Codaqui)
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Layout>
  );
}

import React, { useEffect, useState } from "react";
import Layout from "@theme/Layout";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Skeleton from "@mui/material/Skeleton";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import CodeIcon from "@mui/icons-material/Code";
import FavoriteIcon from "@mui/icons-material/Favorite";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PeopleIcon from "@mui/icons-material/People";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import Link from "@docusaurus/Link";
import { communities } from "../data/communities";
import PageHero from "../components/PageHero";
import StatCard from "../components/StatCard";
import TransactionTable from "../components/TransactionTable";
import {
  type CommunityBalance,
  type TransparencyStats,
  formatBRL,
} from "../utils/transaction";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function TransparenciaPage(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://api.localhost:8000";

  const [balances, setBalances] = useState<CommunityBalance[] | null>(null);
  const [stats, setStats] = useState<TransparencyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    fetch(`${apiUrl}/ledger/community-balances`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: CommunityBalance[]) => setBalances(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    fetch(`${apiUrl}/ledger/transparency-stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: TransparencyStats | null) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, [apiUrl]);

  const totalBalance = balances?.reduce((sum, b) => sum + b.balance, 0) ?? 0;

  return (
    <Layout
      title="Transparência Financeira"
      description="Acompanhe em tempo real os saldos e movimentações financeiras de cada comunidade parceira da Codaqui."
    >
      <PageHero
        eyebrow="Portal de Transparência"
        title="Finanças Abertas"
        subtitle="Toda doação é registrada em contabilidade de dupla partida e visível aqui em tempo real. Sem segredos."
      />

      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>

        {/* ── KPIs ── */}
        <Grid container spacing={3} sx={{ mb: 6 }}>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<AccountBalanceWalletIcon sx={{ fontSize: 36 }} />}
              value={loading ? <Skeleton width={100} sx={{ mx: "auto" }} /> : formatBRL(totalBalance)}
              label="Saldo total"
              color="primary.main"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<TrendingUpIcon sx={{ fontSize: 36 }} />}
              value={statsLoading ? <Skeleton width={100} sx={{ mx: "auto" }} /> : formatBRL(stats?.totalReceived ?? 0)}
              label="Total recebido"
              color="success.main"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<TrendingDownIcon sx={{ fontSize: 36 }} />}
              value={statsLoading ? <Skeleton width={100} sx={{ mx: "auto" }} /> : formatBRL(stats?.totalExpenses ?? 0)}
              label="Total investido"
              color="warning.main"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<PeopleIcon sx={{ fontSize: 36 }} />}
              value={statsLoading ? <Skeleton width={40} sx={{ mx: "auto" }} /> : (stats?.uniqueDonors ?? 0)}
              label="Doadores identificados"
              color="secondary.main"
            />
          </Grid>
        </Grid>

        {/* ── Community Summary Cards ── */}
        {!loading && stats?.communityStats && stats.communityStats.length > 0 && (
          <>
            <Typography variant="h5" fontWeight={800} sx={{ mb: 2 }}>
              Resumo por Comunidade
            </Typography>
            <Grid container spacing={2} sx={{ mb: 5 }}>
              {stats.communityStats.map((cs) => {
                const meta = communities.find((c) => c.id === cs.projectKey);
                const balance = balances?.find((b) => b.projectKey === cs.projectKey);
                const maxFlow = Math.max(cs.totalIn, cs.totalOut, 1);
                return (
                  <Grid key={cs.projectKey} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Card variant="outlined" sx={{
                      height: "100%", transition: "all 0.2s",
                      "&:hover": { boxShadow: 4, transform: "translateY(-2px)" },
                    }}>
                      <CardContent>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                          <Avatar src={meta?.logo} alt={meta?.name ?? cs.name} sx={{ width: 36, height: 36, fontSize: "1rem" }}>
                            {meta?.emoji ?? "💰"}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={700} noWrap>{meta?.name ?? cs.name}</Typography>
                            {meta?.location && <Typography variant="caption" color="text.secondary" noWrap>{meta.location}</Typography>}
                          </Box>
                          <Typography variant="h6" fontWeight={800} color={balance && balance.balance > 0 ? "success.main" : "text.primary"}>
                            {balance ? formatBRL(balance.balance) : "—"}
                          </Typography>
                        </Box>

                        <Stack spacing={1}>
                          <Box>
                            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.3 }}>
                              <Typography variant="caption" color="success.main" fontWeight={600}>
                                ↑ Entradas: {formatBRL(cs.totalIn)}
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={(cs.totalIn / maxFlow) * 100}
                              color="success"
                              sx={{ height: 6, borderRadius: 3 }}
                            />
                          </Box>
                          <Box>
                            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.3 }}>
                              <Typography variant="caption" color="warning.main" fontWeight={600}>
                                ↓ Saídas: {formatBRL(cs.totalOut)}
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={(cs.totalOut / maxFlow) * 100}
                              color="warning"
                              sx={{ height: 6, borderRadius: 3 }}
                            />
                          </Box>
                        </Stack>

                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1.5 }}>
                          <Chip
                            icon={<SwapHorizIcon />}
                            label={`${cs.txCount} movimentações`}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: "0.7rem" }}
                          />
                          <Button
                            size="small"
                            variant="text"
                            component={Link}
                            href="/participe/apoiar"
                            sx={{ fontSize: "0.72rem", textTransform: "none", fontWeight: 700 }}
                          >
                            Apoiar →
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </>
        )}

        {/* ── Info ── */}
        <Alert severity="info" sx={{ mb: 4 }}>
          Os saldos são atualizados em tempo real pelo backend. Para contribuir, acesse{" "}
          <Link href="/participe/apoiar">a página de Apoio</Link>. A API completa está
          documentada em{" "}
          <Link href={`${apiUrl}/docs`} target="_blank" rel="noopener noreferrer">
            {apiUrl}/docs
          </Link>
          .
        </Alert>

        {/* ── Error state ── */}
        {error && (
          <Alert severity="warning" sx={{ mb: 4 }}>
            Não foi possível conectar ao backend:{" "}
            <strong>{error}</strong>. Em produção o backend estará disponível.
          </Alert>
        )}

        {/* ── Empty state ── */}
        {!loading && balances?.length === 0 && (
          <Alert severity="info">
            Nenhuma carteira comunitária foi encontrada ainda. Seja o primeiro a{" "}
            <Link href="/participe/apoiar">fazer uma doação</Link>!
          </Alert>
        )}

        {/* ── Tabs + Transaction Table ── */}
        {!loading && balances && balances.length > 0 && (
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            {/* Tab header */}
            <Box
              sx={{
                borderBottom: 1,
                borderColor: "divider",
                px: { xs: 0, sm: 2 },
                overflowX: "auto",
              }}
            >
              <Tabs
                value={activeTab}
                onChange={(_, v: number) => setActiveTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                aria-label="Comunidades parceiras"
              >
                {balances.map((b, i) => {
                  const meta = communities.find((c) => c.id === b.projectKey);
                  return (
                    <Tab
                      key={b.id}
                      id={`tab-community-${i}`}
                      aria-controls={`tabpanel-community-${i}`}
                      label={
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Avatar
                            src={meta?.logo}
                            alt={meta?.name ?? b.projectKey}
                            sx={{ width: 22, height: 22, fontSize: "0.75rem" }}
                          >
                            {meta?.emoji ?? "💰"}
                          </Avatar>
                          <Box>
                            <Typography
                              variant="caption"
                              display="block"
                              fontWeight={700}
                              sx={{ lineHeight: 1.2 }}
                            >
                              {meta?.name ?? b.name}
                            </Typography>
                            <Typography
                              variant="caption"
                              display="block"
                              color={b.balance > 0 ? "success.main" : "text.secondary"}
                              fontWeight={700}
                              sx={{ lineHeight: 1.2 }}
                            >
                              {formatBRL(b.balance)}
                            </Typography>
                          </Box>
                        </Box>
                      }
                      sx={{ textTransform: "none", minWidth: 140, alignItems: "flex-start" }}
                    />
                  );
                })}
              </Tabs>
            </Box>

            {/* Community detail + table */}
            {balances.map((b, i) => {
              const meta = communities.find((c) => c.id === b.projectKey);
              return (
                <Box
                  key={b.id}
                  role="tabpanel"
                  id={`tabpanel-community-${i}`}
                  aria-labelledby={`tab-community-${i}`}
                  hidden={activeTab !== i}
                  sx={{ p: { xs: 2, sm: 3 } }}
                >
                  {activeTab === i && (
                    <>
                      {/* Community header */}
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: { xs: "flex-start", sm: "center" },
                          flexDirection: { xs: "column", sm: "row" },
                          gap: 2,
                          mb: 3,
                        }}
                      >
                        <Avatar
                          src={meta?.logo}
                          alt={meta?.name ?? b.projectKey}
                          sx={{ width: 52, height: 52, fontSize: "1.5rem" }}
                        >
                          {meta?.emoji ?? "💰"}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" fontWeight={800}>
                            {meta?.name ?? b.name}
                          </Typography>
                          {meta?.location && (
                            <Typography variant="caption" color="text.secondary">
                              {meta.location}
                            </Typography>
                          )}
                          {meta?.description && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mt: 0.5, maxWidth: 600 }}
                            >
                              {meta.description.slice(0, 160)}…
                            </Typography>
                          )}
                        </Box>
                        <Card
                          variant="outlined"
                          sx={{
                            px: 2,
                            py: 1.5,
                            textAlign: "center",
                            minWidth: 140,
                            borderColor: b.balance > 0 ? "success.main" : "divider",
                          }}
                        >
                          <Typography variant="caption" color="text.secondary" display="block">
                            Saldo atual
                          </Typography>
                          <Typography
                            variant="h5"
                            fontWeight={800}
                            color={b.balance > 0 ? "success.main" : "text.primary"}
                          >
                            {formatBRL(b.balance)}
                          </Typography>
                        </Card>
                      </Box>

                      {/* Tags */}
                      {meta?.tags && meta.tags.length > 0 && (
                        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 2 }}>
                          {meta.tags.map((t) => (
                            <Chip
                              key={t}
                              label={t}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: "0.7rem" }}
                            />
                          ))}
                        </Box>
                      )}

                      <Divider sx={{ mb: 2 }} />

                      {/* Transactions table */}
                      <Typography variant="subtitle2" fontWeight={700} color="text.secondary" gutterBottom>
                        Movimentações
                      </Typography>
                      <TransactionTable
                        accountId={b.id}
                        accountName={meta?.name ?? b.name}
                        apiUrl={apiUrl}
                      />
                    </>
                  )}
                </Box>
              );
            })}
          </Card>
        )}

        {/* Skeleton for tabs while loading */}
        {loading && (
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <Box sx={{ p: 3 }}>
              <Skeleton height={40} width="60%" sx={{ mb: 2 }} />
              <Skeleton height={24} width="90%" />
              <Skeleton height={24} width="80%" />
              <Skeleton height={200} sx={{ mt: 2 }} />
            </Box>
          </Card>
        )}

        {/* ── Recent Donors Wall ── */}
        {!statsLoading && stats?.recentDonors && stats.recentDonors.length > 0 && (
          <>
            <Divider sx={{ my: 6 }} />
            <Box sx={{ textAlign: "center", mb: 4 }}>
              <FavoriteIcon sx={{ color: "primary.main", fontSize: 32, mb: 1 }} />
              <Typography variant="h5" fontWeight={800} gutterBottom>
                Últimos Apoiadores
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Reconhecemos publicamente quem apoia a comunidade. Obrigado por fazer a diferença! 💚
              </Typography>
            </Box>
            <Grid container spacing={2} justifyContent="center" sx={{ mb: 4 }}>
              {stats.recentDonors.map((donor, idx) => (
                <Grid key={`${donor.handle}-${idx}`} size={{ xs: 6, sm: 4, md: 2.4 }}>
                  <Card variant="outlined" sx={{
                    textAlign: "center", py: 2, px: 1,
                    transition: "all 0.2s",
                    "&:hover": { boxShadow: 4, transform: "translateY(-2px)" },
                  }}>
                    <Avatar
                      src={`https://github.com/${donor.handle.replace("@", "")}.png?size=64`}
                      alt={donor.handle}
                      sx={{ width: 48, height: 48, mx: "auto", mb: 1 }}
                    />
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {donor.handle}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                      {donor.communityName}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.5, fontSize: "0.65rem" }}>
                      {new Date(donor.date).toLocaleDateString("pt-BR")}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
            <Box sx={{ textAlign: "center", mb: 2 }}>
              <Button
                variant="outlined"
                color="primary"
                component={Link}
                href="/participe/apoiar"
                startIcon={<FavoriteIcon />}
                sx={{ fontWeight: 700, borderRadius: 2, textTransform: "none" }}
              >
                Faça parte desta lista — apoie agora
              </Button>
            </Box>
          </>
        )}

        <Divider sx={{ my: 8 }} />

        {/* ── Metodologia ── */}
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography variant="h4" fontWeight={800} gutterBottom>
              Como funciona
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              Usamos <strong>contabilidade de dupla partida</strong>: cada doação cria dois
              lançamentos — um débito na conta de entrada (Stripe Income) e um crédito na
              carteira virtual da comunidade escolhida. Isso garante que nenhum valor apareça
              ou desapareça sem rastreamento completo.
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              O backend NestJS valida cada pagamento diretamente com a API da Stripe via
              Webhook antes de registrar qualquer transação. Pagamentos não confirmados nunca
              chegam ao sistema.
            </Typography>
            <Box sx={{ display: "flex", gap: 2, mt: 2, flexWrap: "wrap" }}>
              <Link
                href="/participe/apoiar"
                style={{ fontWeight: 700, color: "inherit" }}
              >
                Fazer uma doação →
              </Link>
              <Link
                href="https://github.com/codaqui/institucional"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontWeight: 600,
                  color: "inherit",
                  opacity: 0.7,
                }}
              >
                Código aberto <OpenInNewIcon sx={{ fontSize: "1rem" }} />
              </Link>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Card
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: 3,
                background: (t) =>
                  t.palette.mode === "dark"
                    ? "rgba(34,197,94,0.06)"
                    : "rgba(34,197,94,0.04)",
                borderColor: "primary.main",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <CodeIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>
                  API REST pública
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Todos os dados aqui exibidos estão disponíveis via API REST documentada.
                Qualquer pessoa pode consultar os saldos e transações programaticamente.
              </Typography>
              <Box component="pre" sx={{
                bgcolor: "action.hover",
                borderRadius: 1,
                p: 1.5,
                fontSize: "0.75rem",
                overflowX: "auto",
                mb: 2,
              }}>
                {"GET /ledger/community-balances\nGET /ledger/accounts/:id/transactions\n     ?page=1&limit=10"}
              </Box>
              <Link
                href={`${apiUrl}/docs`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontWeight: 700,
                  color: "inherit",
                }}
              >
                Ver documentação completa <OpenInNewIcon sx={{ fontSize: "1rem" }} />
              </Link>
            </Card>
          </Grid>
        </Grid>

      </Container>
    </Layout>
  );
}

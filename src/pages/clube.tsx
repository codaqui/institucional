import React, { useEffect, useState } from "react";
import Layout from "@theme/Layout";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import TabPanel from "../components/TabPanel";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import FavoriteIcon from "@mui/icons-material/Favorite";
import LockIcon from "@mui/icons-material/Lock";
import TokenIcon from "@mui/icons-material/Token";
import { useAuth } from "../hooks/useAuth";
import PageHero from "../components/PageHero";

interface Raffle {
  id: string;
  title: string;
  description: string | null;
  costInCoins: number;
  status: string;
  closesAt: string;
}

interface PastRaffle {
  id: string;
  title: string;
  status: "closed" | "drawn" | "canceled";
  closesAt: string;
  drawAt: string | null;
  winnerDisplay: string | null;
  totalCoinsGenerated: number;
  drawSeed: string | null;
  drawAlgorithm: string | null;
  algorithmCodeUrl: string;
}

interface ClubWallet {
  id: string;
  balances: Record<string, number>;
  frozenTypes: string[];
}

interface RaffleStats {
  participantCount: number;
  totalCoins: number;
}

interface MyRaffleEntry {
  raffleId: string;
  coinsSpent: number;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCoinLabel(coinType: string): string {
  if (coinType === "sort_coin") return "SortCoin";
  return coinType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function raffleFilterLabel(filter: "open" | "past" | "all"): string {
  if (filter === "open") return "Em aberto";
  if (filter === "past") return "Realizados";
  return "Todos";
}

function raffleActionLabel(args: {
  isLoggedIn: boolean;
  isFrozen: boolean;
  canAfford: boolean;
  entered: boolean;
  costInCoins: number;
}): string {
  if (!args.isLoggedIn) return "Entrar com GitHub";
  if (args.isFrozen) return "Carteira congelada";
  if (!args.canAfford) return "SortCoins insuficientes";
  if (args.entered) return `Aumentar participação (+${args.costInCoins})`;
  return "Participar";
}

function pastRaffleStatusLabel(status: PastRaffle["status"]): string {
  if (status === "drawn") return "Sorteado";
  if (status === "canceled") return "Cancelado";
  return "Encerrado";
}

export default function ClubePage(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const apiUrl =
    (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";
  const { user, ready, isLoggedIn, login, authFetch } = useAuth();

  const [wallet, setWallet] = useState<ClubWallet | null>(null);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState<string | null>(null);
  const [enteredRaffles, setEnteredRaffles] = useState<Set<string>>(new Set());
  const [myCoinsByRaffle, setMyCoinsByRaffle] = useState<Record<string, number>>({});
  const [raffleStats, setRaffleStats] = useState<Record<string, RaffleStats>>({});
  const [pastRaffles, setPastRaffles] = useState<PastRaffle[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [enterError, setEnterError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [raffleFilter, setRaffleFilter] = useState<"open" | "past" | "all">("open");

  useEffect(() => {
    async function loadRafflesAndStats() {
      try {
        const rafflesRes = await fetch(`${apiUrl}/club/raffles`);
        const data = (rafflesRes.ok ? await rafflesRes.json() : []) as Raffle[];
        const currentRaffles = data ?? [];
        setRaffles(currentRaffles);
        setLoading(false);

        if (currentRaffles.length === 0) {
          setRaffleStats({});
          return;
        }

        const items = await Promise.all(
          currentRaffles.map(async (raffle) => {
            try {
              const statsRes = await fetch(`${apiUrl}/club/raffles/${raffle.id}/stats`);
              const stats = (statsRes.ok
                ? await statsRes.json()
                : { participantCount: 0, totalCoins: 0 }) as RaffleStats;
              return { raffleId: raffle.id, stats };
            } catch {
              return {
                raffleId: raffle.id,
                stats: { participantCount: 0, totalCoins: 0 },
              };
            }
          }),
        );
        const nextStats: Record<string, RaffleStats> = {};
        for (const item of items) {
          nextStats[item.raffleId] = item.stats;
        }
        setRaffleStats(nextStats);
      } catch {
        setLoading(false);
      }
    }

    void loadRafflesAndStats();
  }, [apiUrl]);

  const loadHistory = async () => {
    if (pastRaffles.length > 0 || historyLoading) return;
    setHistoryLoading(true);
    const data = await fetch(`${apiUrl}/club/raffles/history`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
    setPastRaffles(data ?? []);
    setHistoryLoading(false);
  };

  // Auto-load history when entering the Sorteios tab
  useEffect(() => {
    if (activeTab === 0) loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (!isLoggedIn) return;
    Promise.all([
      authFetch("/club/wallet").then((r) => (r.ok ? r.json() : null)),
      authFetch("/club/raffles/my-entries").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([walletData, entries]: [ClubWallet | null, MyRaffleEntry[]]) => {
        setWallet(walletData);
        const enteredIds = new Set((entries ?? []).map((entry) => entry.raffleId));
        const coinsMap: Record<string, number> = {};
        for (const entry of entries ?? []) {
          coinsMap[entry.raffleId] = entry.coinsSpent;
        }
        setEnteredRaffles(enteredIds);
        setMyCoinsByRaffle(coinsMap);
      })
      .catch(() => undefined);
  }, [isLoggedIn, authFetch]);

  const sortCoins = wallet?.balances?.sort_coin ?? 0;
  const isFrozen = wallet?.frozenTypes?.includes("sort_coin") ?? false;
  const walletCoins = wallet?.balances ?? {};
  const hasWalletCoins = Object.keys(walletCoins).length > 0;

  const enterRaffle = async (raffleId: string) => {
    if (!isLoggedIn) {
      login({ returnTo: "/clube" });
      return;
    }
    setEnterError(null);
    setEntering(raffleId);
    try {
      const res = await authFetch(`/club/raffles/${raffleId}/enter`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setEnteredRaffles((prev) => new Set([...prev, raffleId]));
        setMyCoinsByRaffle((prev) => ({
          ...prev,
          [raffleId]: (prev[raffleId] ?? 0) + (raffles.find((raffle) => raffle.id === raffleId)?.costInCoins ?? 0),
        }));
        // Reload wallet to reflect coin deduction
        authFetch("/club/wallet")
          .then((r) => (r.ok ? r.json() : null))
          .then((data: ClubWallet | null) => setWallet(data));
        fetch(`${apiUrl}/club/raffles/${raffleId}/stats`)
          .then((r) => (r.ok ? r.json() : null))
          .then((stats: RaffleStats | null) => {
            if (!stats) return;
            setRaffleStats((prev) => ({ ...prev, [raffleId]: stats }));
          })
          .catch(() => undefined);
      } else {
        const err = await res.json().catch(() => ({}));
        setEnterError(
          (err as { message?: string }).message ?? "Erro ao entrar no sorteio.",
        );
      }
    } catch {
      setEnterError("Erro de conexão. Tente novamente.");
    }
    setEntering(null);
  };

  return (
    <Layout
      title="Clube Codaqui"
      description="SortCoins, sorteios e benefícios exclusivos para apoiadores da Codaqui."
    >
      <PageHero
        eyebrow="Clube Codaqui"
        title="Suas moedas, seus sorteios"
        subtitle="Cada real doado vira 1 SortCoin — a primeira das moedas do Clube. Use coins para participar de sorteios e benefícios exclusivos."
      />

      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
        {/* ── Wallet summary ── */}
        {ready && isLoggedIn && (
          <Card
            sx={{
              mb: 4,
              background: (t) =>
                `linear-gradient(135deg, ${t.palette.primary.main}22 0%, ${t.palette.primary.dark}11 100%)`,
              border: "1.5px solid",
              borderColor: "primary.main",
              borderRadius: 3,
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: hasWalletCoins ? 2 : 0, flexWrap: "wrap" }}>
                <TokenIcon sx={{ fontSize: 40, color: "primary.main" }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Carteira de {user?.name ?? user?.handle}
                  </Typography>
                  {isFrozen && (
                    <Chip
                      icon={<LockIcon />}
                      label="Carteira congelada"
                      color="error"
                      size="small"
                      variant="outlined"
                      sx={{ mt: 0.5 }}
                    />
                  )}
                </Box>
              </Box>
              {hasWalletCoins ? (
                <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
                  {Object.entries(walletCoins).map(([coinType, balance]) => (
                    <Box key={coinType}>
                      <Typography variant="h4" fontWeight={800} color="primary.main" lineHeight={1}>
                        {(balance as number).toLocaleString("pt-BR")}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatCoinLabel(coinType)}
                        {(wallet?.frozenTypes ?? []).includes(coinType) && (
                          <Chip label="Congelada" size="small" color="error" variant="outlined" sx={{ ml: 0.5, height: 18 }} />
                        )}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Nenhuma moeda na carteira ainda.{" "}
                  <Button size="small" variant="text" href="/participe/apoiar" sx={{ p: 0, minWidth: 0, textTransform: "none" }}>
                    Apoie para acumular
                  </Button>
                </Typography>
              )}
            </CardContent>
          </Card>
        )}

        {ready && !isLoggedIn && (
          <Alert
            severity="info"
            sx={{ mb: 4 }}
            action={
              <Button
                onClick={() => login({ returnTo: "/clube" })}
                size="small"
                variant="outlined"
              >
                Entrar com GitHub
              </Button>
            }
          >
            Faça login para ver seu saldo de SortCoins e participar dos
            sorteios.
          </Alert>
        )}

        {enterError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setEnterError(null)}>
            {enterError}
          </Alert>
        )}

        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Tabs
              value={activeTab}
              onChange={(_, value) => setActiveTab(value)}
              variant="scrollable"
              allowScrollButtonsMobile
            >
              <Tab label="Sorteios" />
              <Tab label="Moedas" />
              <Tab label="Como funciona" />
            </Tabs>
          </CardContent>
        </Card>

        <TabPanel value={activeTab} index={0}>
          <>
            {/* Filter chips */}
            <Stack direction="row" spacing={1} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
              {(["open", "past", "all"] as const).map((f) => (
                <Chip
                  key={f}
                  label={raffleFilterLabel(f)}
                  variant={raffleFilter === f ? "filled" : "outlined"}
                  color={raffleFilter === f ? "primary" : "default"}
                  onClick={() => setRaffleFilter(f)}
                  size="small"
                />
              ))}
            </Stack>

            {/* Open raffles */}
            {(raffleFilter === "open" || raffleFilter === "all") && (
              <>
                <Typography
                  variant="h5"
                  fontWeight={700}
                  gutterBottom
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  <EmojiEventsIcon color="primary" /> Sorteios abertos
                </Typography>

                {loading && (
                  <Grid container spacing={3}>
                    {[1, 2, 3].map((i) => (
                      <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                        <Skeleton variant="rounded" height={220} />
                      </Grid>
                    ))}
                  </Grid>
                )}

                {!loading && raffles.length === 0 && (
                  <Box sx={{ textAlign: "center", py: 6 }}>
                    <EmojiEventsIcon
                      sx={{ fontSize: 64, color: "text.disabled", mb: 2 }}
                    />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      Nenhum sorteio aberto no momento.
                    </Typography>
                    <Typography variant="body2" color="text.disabled">
                      Fique de olho — novos sorteios são publicados regularmente!
                    </Typography>
                  </Box>
                )}

                {!loading && raffles.length > 0 && (
                  <Grid container spacing={3}>
                    {raffles.map((raffle) => {
                      const entered = enteredRaffles.has(raffle.id);
                      const myCoinsInRaffle = myCoinsByRaffle[raffle.id] ?? 0;
                      const currentStats = raffleStats[raffle.id] ?? { participantCount: 0, totalCoins: 0 };
                      const currentChance =
                        currentStats.totalCoins > 0
                          ? (myCoinsInRaffle / currentStats.totalCoins) * 100
                          : 0;
                      const entryChance =
                        currentStats.totalCoins > 0
                          ? (raffle.costInCoins / currentStats.totalCoins) * 100
                          : 0;
                      const canAfford = sortCoins >= raffle.costInCoins;
                      const isEntering = entering === raffle.id;

                      return (
                        <Grid key={raffle.id} size={{ xs: 12, sm: 6, md: 4 }}>
                          <Card
                            sx={{
                              height: "100%",
                              display: "flex",
                              flexDirection: "column",
                              "&:hover": { boxShadow: 6 },
                              transition: "box-shadow .2s",
                            }}
                          >
                            <CardContent sx={{ flexGrow: 1 }}>
                              <Typography variant="h6" fontWeight={700} gutterBottom>
                                {raffle.title}
                              </Typography>
                              {raffle.description && (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{ mb: 2 }}
                                >
                                  {raffle.description}
                                </Typography>
                              )}
                              <Stack
                                direction="row"
                                spacing={1}
                                flexWrap="wrap"
                                useFlexGap
                                sx={{ mb: 1 }}
                              >
                                <Chip
                                  icon={<TokenIcon sx={{ fontSize: 14 }} />}
                                  label={`${raffle.costInCoins.toLocaleString("pt-BR")} SortCoins`}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                />
                                <Chip
                                  label={`Até ${formatDate(raffle.closesAt)}`}
                                  size="small"
                                  variant="outlined"
                                />
                                <Chip
                                  label={`${currentStats.participantCount} participantes`}
                                  size="small"
                                  variant="outlined"
                                />
                                <Chip
                                  label={`Chance por entrada agora: ${entryChance.toFixed(2)}%`}
                                  size="small"
                                  variant="outlined"
                                />
                                {isLoggedIn && myCoinsInRaffle > 0 && (
                                  <Chip
                                    label={`Sua chance atual: ${currentChance.toFixed(2)}%`}
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                  />
                                )}
                              </Stack>
                            </CardContent>

                            <Box sx={{ px: 2, pb: 2 }}>
                              <Button
                                fullWidth
                                variant="contained"
                                color={entered ? "success" : "primary"}
                                onClick={() => enterRaffle(raffle.id)}
                                disabled={
                                  isEntering ||
                                  (isLoggedIn && !canAfford) ||
                                  (isLoggedIn && isFrozen)
                                }
                                startIcon={
                                  isEntering ? (
                                    <CircularProgress size={16} color="inherit" />
                                  ) : undefined
                                }
                              >
                                {raffleActionLabel({
                                  isLoggedIn,
                                  isFrozen,
                                  canAfford,
                                  entered,
                                  costInCoins: raffle.costInCoins,
                                })}
                              </Button>
                            </Box>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                )}
              </>
            )}

            {/* Past raffles */}
            {(raffleFilter === "past" || raffleFilter === "all") && (
              <Box sx={{ mt: raffleFilter === "all" ? 5 : 0 }}>
                {raffleFilter === "all" && (
                  <Divider sx={{ mb: 4 }} />
                )}
                <Typography
                  variant="h5"
                  fontWeight={700}
                  gutterBottom
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  <EmojiEventsIcon color="disabled" /> Sorteios anteriores
                </Typography>
                {historyLoading ? (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                    <CircularProgress size={22} />
                  </Box>
                ) : (
                  <>
                    {pastRaffles.length === 0 ? (
                      <Alert severity="info">Nenhum sorteio realizado ainda.</Alert>
                    ) : (
                      <Stack spacing={2}>
                        {pastRaffles.map((raffle) => (
                          <Card key={raffle.id} variant="outlined">
                        <CardContent>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, flexWrap: "wrap" }}>
                            <Box>
                              <Typography variant="subtitle1" fontWeight={700}>
                                {raffle.title}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {pastRaffleStatusLabel(raffle.status)} · {new Date(raffle.closesAt).toLocaleDateString("pt-BR")}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {raffle.totalCoinsGenerated} SortCoins no pot
                              </Typography>
                            </Box>
                            {raffle.status === "drawn" && (
                              <Box sx={{ textAlign: "right" }}>
                                <Chip
                                  icon={<FavoriteIcon sx={{ fontSize: 14 }} />}
                                  label={raffle.winnerDisplay ?? "Vencedor sorteado"}
                                  size="small"
                                  color="success"
                                  variant="outlined"
                                />
                                {raffle.algorithmCodeUrl && (
                                  <Box sx={{ mt: 1 }}>
                                    <Button
                                      size="small"
                                      variant="text"
                                      href={raffle.algorithmCodeUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      sx={{ px: 0, fontSize: "0.7rem" }}
                                    >
                                      Ver algoritmo
                                    </Button>
                                  </Box>
                                )}
                              </Box>
                            )}
                          </Box>
                          {raffle.status === "drawn" && raffle.drawSeed && (
                            <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 1 }}>
                              Seed: {raffle.drawSeed} · Algoritmo: {raffle.drawAlgorithm}
                            </Typography>
                          )}
                        </CardContent>
                          </Card>
                        ))}
                      </Stack>
                    )}
                  </>
                )}
              </Box>
            )}
          </>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Moedas da sua carteira
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    O Clube suporta múltiplas moedas. Hoje a principal é SortCoin, e novas moedas podem ser habilitadas por função/campanha.
                  </Typography>
                  <Stack spacing={1.25}>
                    {hasWalletCoins ? (
                      Object.entries(walletCoins).map(([coinType, balance]) => (
                        <Box
                          key={coinType}
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            p: 1.25,
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 1,
                          }}
                        >
                          <Typography variant="body2" fontWeight={600}>
                            {formatCoinLabel(coinType)}
                          </Typography>
                          <Stack direction="row" spacing={1}>
                            <Chip label={Number(balance).toLocaleString("pt-BR")} size="small" color="primary" />
                            {(wallet?.frozenTypes ?? []).includes(coinType) && (
                              <Chip label="Congelada" size="small" color="error" variant="outlined" />
                            )}
                          </Stack>
                        </Box>
                      ))
                    ) : (
                      <Alert severity="info">
                        Faça login para ver os saldos da sua carteira multi-moeda.
                      </Alert>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Conceito de moedas no Clube
                  </Typography>
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>SortCoin:</strong> usada em sorteios e benefícios do Clube.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Moedas futuras:</strong> poderão representar missões, eventos ou campanhas específicas.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Status congelada:</strong> a moeda existe na carteira, mas está temporariamente bloqueada para uso.
                    </Typography>
                  </Stack>
                  <Button
                    variant="outlined"
                    size="small"
                    href="/participe/apoiar"
                    sx={{ mt: 2 }}
                  >
                    Quero apoiar e acumular moedas
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                Como funciona o Clube Codaqui?
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
                O Clube é um sistema de benefícios para quem apoia a Codaqui. Cada real doado se transforma em moedas que dão acesso a sorteios e benefícios exclusivos.
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent>
                  <Typography variant="overline" color="primary" fontWeight={700}>1. Apoie</Typography>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Doe e acumule moedas
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Cada R$&nbsp;1 doado à Codaqui vira 1 SortCoin na sua carteira. Em breve outras moedas poderão ser ganhas por missões, eventos e campanhas.
                  </Typography>
                  <Button variant="contained" size="small" href="/participe/apoiar">
                    Quero apoiar
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent>
                  <Typography variant="overline" color="primary" fontWeight={700}>2. Participe</Typography>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Entre nos sorteios
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Use suas moedas para entrar em sorteios de cursos, livros e gadgets. Quanto mais moedas você usa em um sorteio, maior sua chance de ganhar.
                  </Typography>
                  <Button variant="outlined" size="small" onClick={() => setActiveTab(0)}>
                    Ver sorteios abertos
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent>
                  <Typography variant="overline" color="secondary" fontWeight={700}>Empresa</Typography>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    CLUB Business
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Empresas apoiadoras ganham moedas para distribuir às suas equipes e visibilidade na página de patrocinadores.
                  </Typography>
                  <Button variant="outlined" color="secondary" size="small" href="/patrocinadores">
                    Ver patrocinadores
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Card
                sx={{
                  bgcolor: "action.hover",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                }}
              >
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                    Transparência total
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Os sorteios usam um algoritmo público e auditável. O seed e o código do sorteio ficam registrados permanentemente — qualquer pessoa pode verificar o resultado.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Container>
    </Layout>
  );
}

// Port da aba "Sorteios" de src/pages/clube.tsx (Docusaurus) para ilha React
// (MUI v9, deep imports, client:visible). Busca os dados públicos
// (/club/raffles, /club/raffles/:id/stats, /club/raffles/history) e consome o
// snapshot de auth/carteira publicado pela ClubWalletIsland via CustomEvents —
// contrato em lib/club.ts. O POST de participação é executado pela
// ClubWalletIsland (dona da sessão); aqui só disparamos o pedido.
import React, { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import FavoriteIcon from "@mui/icons-material/Favorite";
import TokenIcon from "@mui/icons-material/Token";
import MuiIslandProvider from "./MuiIslandProvider";
import { resolveApiUrl } from "../../lib/api-url";
import {
  CLUB_INITIAL_WALLET_STATE,
  CLUB_RAFFLE_ENTERED_EVENT,
  CLUB_WALLET_STATE_EVENT,
  announceClubRafflesReady,
  formatClubDate,
  pastRaffleStatusLabel,
  raffleActionLabel,
  raffleFilterLabel,
  requestEnterRaffle,
  type ClubPastRaffle,
  type ClubRaffle,
  type ClubRaffleStats,
  type ClubWalletState,
} from "../../lib/club";

function ClubRafflesInner(): React.JSX.Element {
  const apiUrl = resolveApiUrl(import.meta.env.SITE);

  const [raffles, setRaffles] = useState<ClubRaffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [raffleStats, setRaffleStats] = useState<Record<string, ClubRaffleStats>>({});
  const [pastRaffles, setPastRaffles] = useState<ClubPastRaffle[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [raffleFilter, setRaffleFilter] = useState<"open" | "past" | "all">("open");
  const [walletState, setWalletState] = useState<ClubWalletState>(
    CLUB_INITIAL_WALLET_STATE,
  );

  useEffect(() => {
    async function loadRafflesAndStats() {
      try {
        const rafflesRes = await fetch(`${apiUrl}/club/raffles`);
        const data = (rafflesRes.ok ? await rafflesRes.json() : []) as ClubRaffle[];
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
              const stats = (
                statsRes.ok
                  ? await statsRes.json()
                  : { participantCount: 0, totalCoins: 0 }
              ) as ClubRaffleStats;
              return { raffleId: raffle.id, stats };
            } catch {
              return {
                raffleId: raffle.id,
                stats: { participantCount: 0, totalCoins: 0 },
              };
            }
          }),
        );
        const nextStats: Record<string, ClubRaffleStats> = {};
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

  // O original carregava o histórico ao entrar na aba Sorteios; como esta
  // ilha É o conteúdo da aba, o mount (client:visible) é o equivalente.
  useEffect(() => {
    setHistoryLoading(true);
    fetch(`${apiUrl}/club/raffles/history`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPastRaffles(data ?? []))
      .catch(() => setPastRaffles([]))
      .finally(() => setHistoryLoading(false));
  }, [apiUrl]);

  // Consome o snapshot de auth/carteira e anuncia presença para receber a
  // re-publicação (esta ilha hidrata depois da ClubWalletIsland).
  useEffect(() => {
    const onState = (event: Event) => {
      setWalletState((event as CustomEvent<ClubWalletState>).detail);
    };
    globalThis.addEventListener(CLUB_WALLET_STATE_EVENT, onState);
    announceClubRafflesReady();
    return () => globalThis.removeEventListener(CLUB_WALLET_STATE_EVENT, onState);
  }, []);

  // Entrada confirmada → re-busca as stats do sorteio (participantes/chance).
  useEffect(() => {
    const onEntered = (event: Event) => {
      const { raffleId } = (event as CustomEvent<{ raffleId: string }>).detail;
      fetch(`${apiUrl}/club/raffles/${raffleId}/stats`)
        .then((r) => (r.ok ? r.json() : null))
        .then((stats: ClubRaffleStats | null) => {
          if (!stats) return;
          setRaffleStats((prev) => ({ ...prev, [raffleId]: stats }));
        })
        .catch(() => undefined);
    };
    globalThis.addEventListener(CLUB_RAFFLE_ENTERED_EVENT, onEntered);
    return () =>
      globalThis.removeEventListener(CLUB_RAFFLE_ENTERED_EVENT, onEntered);
  }, [apiUrl]);

  const { isLoggedIn, isFrozen, sortCoins, enteringRaffleId } = walletState;
  const enteredRaffles = new Set(walletState.enteredRaffleIds);
  const myCoinsByRaffle = walletState.myCoinsByRaffle;

  return (
    <>
      {/* Filter chips */}
      <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 3, flexWrap: "wrap" }}>
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
            gutterBottom
            sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}
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
              <EmojiEventsIcon sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
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
                const currentStats = raffleStats[raffle.id] ?? {
                  participantCount: 0,
                  totalCoins: 0,
                };
                const currentChance =
                  currentStats.totalCoins > 0
                    ? (myCoinsInRaffle / currentStats.totalCoins) * 100
                    : 0;
                const entryChance =
                  currentStats.totalCoins > 0
                    ? (raffle.costInCoins / currentStats.totalCoins) * 100
                    : 0;
                const canAfford = sortCoins >= raffle.costInCoins;
                const isEntering = enteringRaffleId === raffle.id;

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
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
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
                          useFlexGap
                          sx={{ mb: 1, flexWrap: "wrap" }}
                        >
                          <Chip
                            icon={<TokenIcon sx={{ fontSize: 14 }} />}
                            label={`${raffle.costInCoins.toLocaleString("pt-BR")} SortCoins`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                          <Chip
                            label={`Até ${formatClubDate(raffle.closesAt)}`}
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
                          onClick={() => requestEnterRaffle(raffle.id, raffle.costInCoins)}
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
          {raffleFilter === "all" && <Divider sx={{ mb: 4 }} />}
          <Typography
            variant="h5"
            gutterBottom
            sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}
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
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: 2,
                            flexWrap: "wrap",
                          }}
                        >
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                              {raffle.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {pastRaffleStatusLabel(raffle.status)} ·{" "}
                              {new Date(raffle.closesAt).toLocaleDateString("pt-BR")}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mt: 0.5 }}
                            >
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
                          <Typography
                            variant="caption"
                            color="text.disabled"
                            sx={{ display: "block", mt: 1 }}
                          >
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
  );
}

export default function ClubRafflesIsland(): React.JSX.Element {
  return (
    <MuiIslandProvider>
      <ClubRafflesInner />
    </MuiIslandProvider>
  );
}

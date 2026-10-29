// Port da parte autenticada de src/pages/clube.tsx (Docusaurus) para ilha
// React (MUI v9, deep imports, client:only). Renderiza o cartão de carteira no
// topo de /clube (ou o CTA de login) e a lista de saldos da aba "Moedas" (via
// portal em #club-wallet-balances, montado estaticamente pelo clube.astro).
// Publica o estado para a ClubRafflesIsland e executa o POST de participação —
// contrato de eventos em lib/club.ts.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LockIcon from "@mui/icons-material/Lock";
import TokenIcon from "@mui/icons-material/Token";
import MuiIslandProvider from "./MuiIslandProvider";
import { useAuth } from "../../lib/use-auth";
import {
  CLUB_ENTER_RAFFLE_EVENT,
  CLUB_RAFFLES_READY_EVENT,
  formatCoinLabel,
  notifyRaffleEntered,
  publishClubWalletState,
  type ClubMyRaffleEntry,
  type ClubWallet,
  type ClubWalletState,
} from "../../lib/club";

function ClubWalletInner(): React.JSX.Element {
  const { user, ready, isLoggedIn, login, authFetch } = useAuth();

  const [wallet, setWallet] = useState<ClubWallet | null>(null);
  const [enteredRaffles, setEnteredRaffles] = useState<Set<string>>(new Set());
  const [myCoinsByRaffle, setMyCoinsByRaffle] = useState<Record<string, number>>({});
  const [entering, setEntering] = useState<string | null>(null);
  const [enterError, setEnterError] = useState<string | null>(null);
  const [balancesTarget, setBalancesTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setBalancesTarget(document.getElementById("club-wallet-balances"));
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    Promise.all([
      authFetch("/club/wallet").then((r) => (r.ok ? r.json() : null)),
      authFetch("/club/raffles/my-entries").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([walletData, entries]: [ClubWallet | null, ClubMyRaffleEntry[]]) => {
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

  const enterRaffle = useCallback(
    async (raffleId: string, costInCoins: number) => {
      if (!ready) return;
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
            [raffleId]: (prev[raffleId] ?? 0) + costInCoins,
          }));
          // Reload wallet to reflect coin deduction
          authFetch("/club/wallet")
            .then((r) => (r.ok ? r.json() : null))
            .then((data: ClubWallet | null) => setWallet(data));
          notifyRaffleEntered(raffleId);
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
    },
    [ready, isLoggedIn, login, authFetch],
  );

  // Pedidos de participação vindos da ClubRafflesIsland.
  useEffect(() => {
    const onEnter = (event: Event) => {
      const detail = (
        event as CustomEvent<{ raffleId: string; costInCoins: number }>
      ).detail;
      void enterRaffle(detail.raffleId, detail.costInCoins);
    };
    globalThis.addEventListener(CLUB_ENTER_RAFFLE_EVENT, onEnter);
    return () => globalThis.removeEventListener(CLUB_ENTER_RAFFLE_EVENT, onEnter);
  }, [enterRaffle]);

  // Publica o snapshot a cada mudança e o re-publica quando a ilha de
  // sorteios anuncia presença (ela hidrata depois, com client:visible).
  const stateRef = useRef<ClubWalletState | null>(null);
  stateRef.current = {
    ready,
    isLoggedIn,
    sortCoins,
    isFrozen,
    enteredRaffleIds: [...enteredRaffles],
    myCoinsByRaffle,
    enteringRaffleId: entering,
  };

  useEffect(() => {
    if (stateRef.current) publishClubWalletState(stateRef.current);
  }, [ready, isLoggedIn, sortCoins, isFrozen, enteredRaffles, myCoinsByRaffle, entering]);

  useEffect(() => {
    const rebroadcast = () => {
      if (stateRef.current) publishClubWalletState(stateRef.current);
    };
    globalThis.addEventListener(CLUB_RAFFLES_READY_EVENT, rebroadcast);
    return () =>
      globalThis.removeEventListener(CLUB_RAFFLES_READY_EVENT, rebroadcast);
  }, []);

  const balancesContent = hasWalletCoins ? (
    <Stack spacing={1.25}>
      {Object.entries(walletCoins).map(([coinType, balance]) => (
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
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {formatCoinLabel(coinType)}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Chip
              label={Number(balance).toLocaleString("pt-BR")}
              size="small"
              color="primary"
            />
            {(wallet?.frozenTypes ?? []).includes(coinType) && (
              <Chip label="Congelada" size="small" color="error" variant="outlined" />
            )}
          </Stack>
        </Box>
      ))}
    </Stack>
  ) : (
    <Alert severity="info">
      Faça login para ver os saldos da sua carteira multi-moeda.
    </Alert>
  );

  return (
    <>
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
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                mb: hasWalletCoins ? 2 : 0,
                flexWrap: "wrap",
              }}
            >
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
              <Stack direction="row" spacing={3} useFlexGap sx={{ flexWrap: "wrap" }}>
                {Object.entries(walletCoins).map(([coinType, balance]) => (
                  <Box key={coinType}>
                    <Typography
                      variant="h4"
                      color="primary.main"
                      sx={{ fontWeight: 800, lineHeight: 1 }}
                    >
                      {(balance as number).toLocaleString("pt-BR")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatCoinLabel(coinType)}
                      {(wallet?.frozenTypes ?? []).includes(coinType) && (
                        <Chip
                          label="Congelada"
                          size="small"
                          color="error"
                          variant="outlined"
                          sx={{ ml: 0.5, height: 18 }}
                        />
                      )}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Nenhuma moeda na carteira ainda.{" "}
                <Button
                  size="small"
                  variant="text"
                  href="/participe/apoiar"
                  sx={{ p: 0, minWidth: 0, textTransform: "none" }}
                >
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
          Faça login para ver seu saldo de SortCoins e participar dos sorteios.
        </Alert>
      )}

      {enterError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setEnterError(null)}>
          {enterError}
        </Alert>
      )}

      {balancesTarget && createPortal(balancesContent, balancesTarget)}
    </>
  );
}

export default function ClubWalletIsland(): React.JSX.Element {
  return (
    <MuiIslandProvider>
      <ClubWalletInner />
    </MuiIslandProvider>
  );
}

// Port da parte dinâmica de
// comunidades/shared/components/CommunityTransparenciaPage.tsx para ilha React
// dos builds tenant da Fase 0.5: mesmo `useCommunityBalance(community.slug)`
// (fetch em /ledger/community-balances filtrando por projectKey) + card de
// saldo + card "Como funciona" + Movimentações com TransactionTable da conta.
//
// O shell estático (hero accent + CTA final) fica na página
// src-tenants/<slug>/pages/transparencia.astro; o painel global da Codaqui
// (TransparencyApp) continua sem props — esta ilha é o equivalente
// community-scoped usado pelos sites whitelabel.
import React, { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import MuiIslandProvider from "./MuiIslandProvider";
import TransactionTable from "./TransactionTable";
import { resolveApiUrl } from "../../lib/api-url";
import { type CommunityBalance, formatBRL } from "../../lib/transaction";

export interface CommunityTransparencyProps {
  /** projectKey da comunidade no ledger (config.slug, ex.: "tisocial"). */
  readonly slug: string;
}

function useCommunityBalance(projectKey: string): {
  balance: CommunityBalance | null;
  loading: boolean;
  error: string | null;
  apiUrl: string;
} {
  const apiUrl = resolveApiUrl(import.meta.env.SITE);
  const [balance, setBalance] = useState<CommunityBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiUrl}/ledger/community-balances`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: CommunityBalance[]) => {
        if (cancelled) return;
        setBalance(data.find((b) => b.projectKey === projectKey) ?? null);
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
  }, [apiUrl, projectKey]);

  return { balance, loading, error, apiUrl };
}

const COMO_FUNCIONA = [
  "Cada doação cria uma transação no ledger (entrada).",
  "Pagamentos para fornecedores e reembolsos saem como saídas.",
  "Tudo é público, auditável e detalhado nas movimentações abaixo.",
];

function CommunityTransparencyInner({
  slug,
}: CommunityTransparencyProps): React.JSX.Element {
  const { balance, loading, error, apiUrl } = useCommunityBalance(slug);

  return (
    <>
      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Não foi possível carregar o saldo no momento ({error}). Tente
          novamente em instantes ou veja o painel global.
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card
            variant="outlined"
            sx={{
              borderColor: "var(--community-primary)",
              borderWidth: 2,
              height: "100%",
              bgcolor: "action.hover",
            }}
          >
            <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
              <Stack
                direction="row"
                spacing={2}
                sx={{ mb: 2, alignItems: "center" }}
              >
                <Box
                  sx={{
                    bgcolor: "var(--community-primary)",
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
                      sx={{
                        fontWeight: 800,
                        color: "var(--community-primary)",
                        lineHeight: 1.1,
                      }}
                    >
                      {balance ? formatBRL(balance.balance) : formatBRL(0)}
                    </Typography>
                  )}
                </Box>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Disponível para os projetos desta comunidade. 100% das doações
                são alocadas para essa conta antes de serem distribuídas.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ mb: 2, alignItems: "center" }}
              >
                <ReceiptLongIcon sx={{ color: "var(--community-primary)" }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Como funciona
                </Typography>
              </Stack>
              <Stack spacing={1.5}>
                {COMO_FUNCIONA.map((text, idx) => (
                  <Box
                    key={text}
                    sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}
                  >
                    <Chip
                      label={String(idx + 1)}
                      size="small"
                      sx={{
                        bgcolor: "var(--community-primary)",
                        color: "#fff",
                        fontWeight: 700,
                        minWidth: 28,
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {text}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card variant="outlined" sx={{ mb: 4 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{
              mb: 2,
              justifyContent: "space-between",
              alignItems: { xs: "flex-start", sm: "center" },
            }}
          >
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Movimentações
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Histórico completo da conta no ledger.{" "}
                {balance && (
                  <Box
                    component="span"
                    sx={{ fontFamily: "monospace", fontSize: "0.85em" }}
                  >
                    ({balance.projectKey})
                  </Box>
                )}
              </Typography>
            </Box>
            {balance && (
              <Chip
                label="Atualizado em tempo real"
                size="small"
                sx={{
                  bgcolor: "color-mix(in srgb, var(--community-primary) 12%, transparent)",
                  color: "var(--community-primary)",
                  fontWeight: 600,
                }}
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
    </>
  );
}

export default function CommunityTransparencyIsland(
  props: CommunityTransparencyProps,
): React.JSX.Element {
  return (
    <MuiIslandProvider>
      <CommunityTransparencyInner {...props} />
    </MuiIslandProvider>
  );
}

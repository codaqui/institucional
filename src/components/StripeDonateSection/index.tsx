import React, { useState } from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import FavoriteIcon from "@mui/icons-material/Favorite";
import GitHubIcon from "@mui/icons-material/GitHub";
import LockIcon from "@mui/icons-material/Lock";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SelectableCard from "../SelectableCard";
import { communities } from "../../data/communities";
import { useAuth } from "../../hooks/useAuth";

const PRESET_AMOUNTS = [
  { label: "R$ 10", cents: 1000 },
  { label: "R$ 25", cents: 2500 },
  { label: "R$ 50", cents: 5000 },
  { label: "R$ 100", cents: 10000 },
  { label: "R$ 200", cents: 20000 },
];

/** Limite em centavos para doação anônima */
const ANONYMOUS_LIMIT_CENTS = 10_000;

export interface StripeDonateSectionProps {
  /** When set, the community selector is hidden and locked to this id. */
  lockedCommunityId?: string;
  /**
   * When true, suppresses all auth UI (login banners, "Doando como" chip, login-required CTA).
   * Donations above R$ 100 are blocked client-side with a soft error since auth is unavailable.
   * Use on community pages that don't share an auth cookie with the main domain.
   */
  disableAuth?: boolean;
}

export default function StripeDonateSection({
  lockedCommunityId,
  disableAuth = false,
}: StripeDonateSectionProps = {}) {
  const { siteConfig } = useDocusaurusContext();
  const apiUrl =
    typeof siteConfig.customFields?.apiUrl === "string"
      ? siteConfig.customFields.apiUrl
      : "http://localhost:3001";
  const { user, isLoggedIn, ready, authFetch, login } = useAuth();

  const initialCommunityId =
    lockedCommunityId && communities.some((c) => c.id === lockedCommunityId)
      ? lockedCommunityId
      : communities[0].id;
  const [selectedCommunity, setSelectedCommunity] = useState<string>(initialCommunityId);
  const [selectedAmount, setSelectedAmount] = useState<number>(2500);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const community = communities.find((c) => c.id === selectedCommunity) || communities[0];
  const amountLabel = PRESET_AMOUNTS.find((a) => a.cents === selectedAmount)?.label ?? "";
  const requiresLogin =
    !disableAuth && selectedAmount > ANONYMOUS_LIMIT_CENTS && !isLoggedIn;
  const blockedAnonAmount =
    disableAuth && selectedAmount > ANONYMOUS_LIMIT_CENTS;

  let donateIcon = <FavoriteIcon />;
  if (loading) {
    donateIcon = <CircularProgress size={18} color="inherit" />;
  } else if (requiresLogin) {
    donateIcon = <GitHubIcon />;
  }

  let donateLabel = `Apoiar com ${amountLabel}`;
  if (loading) {
    donateLabel = "Redirecionando…";
  } else if (requiresLogin) {
    donateLabel = "Entrar com GitHub para continuar";
  }

  const handleDonate = async () => {
    if (blockedAnonAmount) {
      setError(
        "Doações acima de R$ 100 só estão disponíveis em codaqui.dev/participe/apoiar.",
      );
      return;
    }
    if (requiresLogin) {
      login(); // redireciona para GitHub OAuth
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${apiUrl}/stripe/checkout-session`, {
        method: "POST",
        body: JSON.stringify({ amount: selectedAmount, communityId: selectedCommunity }),
      });

      if (res.status === 401) {
        setError("É necessário fazer login com GitHub para doações acima de R$ 100.");
        return;
      }
      if (!res.ok) throw new Error("Falha ao criar sessão de pagamento.");

      const data = await res.json();
      if (data.url) globalThis.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
        <FavoriteIcon sx={{ color: "error.main" }} />
        <Typography variant="h5" fontWeight={700}>
          Doe para uma comunidade
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        100% rastreado no{" "}
        <a href="/transparencia" style={{ color: "inherit", fontWeight: 600 }}>
          Portal de Transparência
        </a>{" "}
        . Doações anônimas aceitas até R$ 100.
      </Typography>

      {/* ── Passo 1: Comunidade ── */}
      {!lockedCommunityId && (
        <>
          <Typography variant="overline" color="text.secondary" letterSpacing={1.5}>
            1 · Comunidade
          </Typography>
          <Grid container spacing={1.5} sx={{ mt: 0.5, mb: 3 }}>
            {communities.map((c) => {
              const active = selectedCommunity === c.id;
              return (
                <Grid key={c.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <SelectableCard
                    selected={active}
                    onClick={() => setSelectedCommunity(c.id)}
                    primary={c.name}
                    secondary={c.location}
                    avatar={c.logo}
                    avatarFallback={c.emoji}
                    compact
                  />
                </Grid>
              );
            })}
          </Grid>
        </>
      )}

      {/* ── Passo 2: Valor ── */}
      <Typography variant="overline" color="text.secondary" letterSpacing={1.5}>
        {lockedCommunityId ? "1 · Valor" : "2 · Valor"}
      </Typography>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 0.5, mb: 3 }}>
        {PRESET_AMOUNTS.map((a) => {
          const active = selectedAmount === a.cents;
          const needsLogin = a.cents > ANONYMOUS_LIMIT_CENTS && !isLoggedIn;
          return (
            <Box
              key={a.cents}
              component="button"
              onClick={() => setSelectedAmount(a.cents)}
              sx={{
                px: 3,
                py: 1,
                fontWeight: 700,
                fontSize: "0.95rem",
                fontFamily: "inherit",
                borderRadius: 2,
                border: "2px solid",
                borderColor: active ? "primary.main" : "divider",
                bgcolor: active ? "primary.main" : "background.paper",
                color: active ? "common.white" : "text.primary",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                transition: "all 0.15s ease",
                "&:hover": {
                  borderColor: "primary.main",
                  transform: "translateY(-1px)",
                },
              }}
            >
              {a.label}
              {needsLogin && <LockIcon sx={{ fontSize: "0.8rem", opacity: 0.6 }} />}
            </Box>
          );
        })}
      </Box>

      {/* ── Banner de login (se necessário) ── */}
      {ready && requiresLogin && (
        <Alert
          severity="info"
          icon={<LockIcon />}
          sx={{ mb: 2 }}
          action={
            <Button
              size="small"
              startIcon={<GitHubIcon />}
              onClick={() => login()}
            >
              Entrar com GitHub
            </Button>
          }
        >
          Doações acima de R$ 100 requerem login para fins de transparência fiscal.
        </Alert>
      )}

      {/* ── Aviso quando auth está desabilitada (contexto de comunidade) ── */}
      {disableAuth && blockedAnonAmount && (
        <Alert severity="warning" icon={<LockIcon />} sx={{ mb: 2 }}>
          Para doações acima de R$ 100, acesse a página principal de doação em{" "}
          <a href="/participe/apoiar" style={{ fontWeight: 600 }}>codaqui.dev/participe/apoiar</a>.
        </Alert>
      )}

      {/* ── Usuário logado ── */}
      {!disableAuth && ready && isLoggedIn && user && (
        <Chip
          avatar={<Avatar src={user.avatarUrl} alt={user.name} sx={{ width: 20, height: 20 }} />}
          label={`Doando como @${user.handle}`}
          size="small"
          variant="outlined"
          color="primary"
          sx={{ mb: 2 }}
        />
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* ── Resumo reativo ── */}
      <Card
        variant="outlined"
        sx={{
          borderColor: requiresLogin ? "warning.main" : "primary.main",
          borderWidth: 2,
          bgcolor: "action.hover",
          mb: 2,
        }}
      >
        <CardContent sx={{ pb: "16px !important" }}>
          <Stack spacing={1.5}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Comunidade
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Avatar src={community.logo} alt={community.name} sx={{ width: 20, height: 20, fontSize: "0.7rem" }}>
                  {community.emoji}
                </Avatar>
                <Typography variant="body2" fontWeight={700}>{community.name}</Typography>
              </Box>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">Valor</Typography>
              <Typography variant="h6" fontWeight={800} color="primary.main">{amountLabel}</Typography>
            </Box>

            <Divider />

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CreditCardIcon sx={{ fontSize: "1rem", color: "text.secondary" }} />
              <Typography variant="caption" color="text.secondary">
                Cartão de crédito · Apple Pay · Google Pay (via Stripe)
              </Typography>
            </Box>

            <Button
              variant="contained"
              color={requiresLogin ? "warning" : "primary"}
              size="large"
              fullWidth
              disabled={loading}
              onClick={handleDonate}
              startIcon={donateIcon}
              endIcon={!loading && !requiresLogin && <OpenInNewIcon />}
              sx={{ fontWeight: 700, borderRadius: 2, mt: 0.5 }}
            >
              {donateLabel}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="caption" color="text.secondary">
        Após o pagamento, o valor é registrado automaticamente no{" "}
        <a href="/transparencia" style={{ color: "inherit" }}>Portal de Transparência</a>.
      </Typography>
    </Box>
  );
}

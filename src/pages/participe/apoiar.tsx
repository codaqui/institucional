import React, { useCallback, useEffect, useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import { useLocation } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import FavoriteIcon from "@mui/icons-material/Favorite";
import GitHubIcon from "@mui/icons-material/GitHub";
import LockIcon from "@mui/icons-material/Lock";
import StarIcon from "@mui/icons-material/Star";
import TipsAndUpdatesIcon from "@mui/icons-material/TipsAndUpdates";
import { communities } from "../../data/communities";
import { useAuth } from "../../hooks/useAuth";
import PageHero from "../../components/PageHero";

// ─── Constantes ──────────────────────────────────────────────────────────────

const PRESET_AMOUNTS = [
  { label: "R$ 10", cents: 1000 },
  { label: "R$ 25", cents: 2500 },
  { label: "R$ 50", cents: 5000 },
  { label: "R$ 100", cents: 10000 },
  { label: "R$ 200", cents: 20000 },
];

type RecurringInterval = "month" | "year";
type DonationMode = "once" | RecurringInterval;

const DONATION_MODES: { value: DonationMode; label: string; description: string; recommended?: boolean }[] = [
  { value: "once",  label: "Única",   description: "Pagamento único, sem compromisso." },
  { value: "month", label: "Mensal",  description: "Cobrança automática todo mês. Cancele quando quiser.", recommended: true },
  { value: "year",  label: "Anual",   description: "Cobrança anual com menor fricção." },
];

const ANONYMOUS_LIMIT_CENTS = 10_000;

const TESOURO: DonationTarget = {
  id: "tesouro-geral",
  name: "Tesouro Codaqui",
  emoji: "🏦",
  description: "Suporta a associação diretamente: eventos, infraestrutura e programas.",
  logo: undefined,
};

const DONATION_TARGETS: DonationTarget[] = [
  TESOURO,
  ...communities.map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    description: c.description,
    logo: c.logo,
  })),
];

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface DonationTarget {
  id: string;
  name: string;
  emoji: string;
  description: string;
  logo?: string;
}

interface WalletBalance {
  id: string;
  projectKey: string;
  name: string;
  balance: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents);

// ─── Embedded Checkout Dialog ───...

import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";

interface EmbeddedCheckoutDialogProps {
  readonly open: boolean;
  readonly clientSecret: string | null;
  readonly stripeKey: string;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
}

function EmbeddedCheckoutDialog({
  open,
  clientSecret,
  stripeKey,
  onClose,
  onSuccess,
}: EmbeddedCheckoutDialogProps) {
  // Inicialização cacheada do stripe js para não recarregar em re-renders
  const [stripePromise, setStripePromise] = useState<any>(null);

  useEffect(() => {
    if (open && stripeKey && !stripePromise) {
      setStripePromise(loadStripe(stripeKey));
    }
  }, [open, stripeKey, stripePromise]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderTop: 3, borderColor: "primary.main", minHeight: 400 } } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CreditCardIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>Finalizar Doação</Typography>
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Fechar checkout">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 0, pb: "0 !important", minHeight: 400 }}>
        {!stripeKey && (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Alert severity="error">
              A chave pública do Stripe não está configurada (STRIPE_PUBLISHABLE_KEY indefinida).
            </Alert>
          </Box>
        )}
        
        {stripeKey && stripePromise && clientSecret && (
          <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret, onComplete: onSuccess }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        )}
      </DialogContent>
    </Dialog>
  );
}



// ─── Componente principal ────────────────────────────────────────────────────

export default function ApoiarPage(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";
  const stripeKey = (siteConfig.customFields?.stripePublishableKey as string) ?? "";
  const { user, ready, isLoggedIn, authFetch, login } = useAuth();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const status = params.get("status");

  // ── Estado das carteiras ──
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(true);

  // ── Estado do formulário ──
  const [target, setTarget] = useState<string>("tesouro-geral");
  const [amount, setAmount] = useState<number>(2500);
  const [mode, setMode] = useState<DonationMode>("month");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Estado do checkout embutido ──
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [donationSuccess, setDonationSuccess] = useState(false);

  const selected = DONATION_TARGETS.find((t) => t.id === target) ?? TESOURO;
  const amountLabel = PRESET_AMOUNTS.find((a) => a.cents === amount)?.label ?? formatBRL(amount / 100);
  const isRecurring = mode !== "once";
  const requiresLogin = amount > ANONYMOUS_LIMIT_CENTS && !isLoggedIn;

  // ── Busca saldos ──
  const fetchBalances = useCallback(() => {
    setBalancesLoading(true);
    fetch(`${apiUrl}/ledger/community-balances`)
      .then((r) => r.json())
      .then((data: WalletBalance[]) => setBalances(Array.isArray(data) ? data : []))
      .catch(() => setBalances([]))
      .finally(() => setBalancesLoading(false));
  }, [apiUrl]);

  useEffect(() => {
    fetchBalances();
    if (status === "success") {
      const t = setTimeout(fetchBalances, 3500);
      return () => clearTimeout(t);
    }
  }, [fetchBalances, status]);

  // ── Inicia checkout ──
  const handleDonate = async () => {
    if (requiresLogin && !isLoggedIn) { login(); return; }
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        amount,
        communityId: target,
        uiMode: "embedded_page",
      };
      if (isRecurring) body.recurring = { interval: mode };

      const res = await authFetch(`${apiUrl}/stripe/checkout-session`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        setError("Login com GitHub é necessário para continuar.");
        return;
      }
      if (!res.ok) throw new Error("Falha ao criar sessão de pagamento.");

      const data = await res.json();
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setCheckoutOpen(true);
      } else if (data.url) {
        // fallback hosted
        globalThis.location.href = data.url;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckoutSuccess = () => {
    setCheckoutOpen(false);
    setDonationSuccess(true);
    setTimeout(fetchBalances, 3500);
  };

  const getBalance = (targetId: string) => {
    const w = balances.find((b) => b.projectKey === targetId);
    return w ? w.balance : 0;
  };

  const modeConfig = DONATION_MODES.find((m) => m.value === mode) ?? DONATION_MODES[0];

  return (
    <Layout
      title="Apoiar a Codaqui"
      description="Doe diretamente para a Codaqui ou para uma comunidade parceira. 100% transparente."
    >
      <PageHero
        eyebrow="Quero Apoiar"
        title="Apoie a Codaqui"
        subtitle="Toda contribuição financia tecnologia acessível. Veja em tempo real para onde vai cada real."
      />

      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>

        {/* ── Alertas de retorno ── */}
        <Collapse in={donationSuccess || status === "success"}>
          <Alert
            severity="success"
            icon={<CheckCircleIcon />}
            sx={{ mb: 4, fontSize: "1rem" }}
            onClose={() => {
              setDonationSuccess(false);
              globalThis.history.replaceState(null, "", "/participe/apoiar");
            }}
          >
            <strong>Doação realizada!</strong> Obrigado pelo apoio. O saldo será
            atualizado em instantes após a confirmação do Stripe.
          </Alert>
        </Collapse>
        <Collapse in={status === "cancelled"}>
          <Alert
            severity="info"
            sx={{ mb: 4 }}
            onClose={() => globalThis.history.replaceState(null, "", "/participe/apoiar")}
          >
            Pagamento cancelado. Você pode tentar novamente abaixo.
          </Alert>
        </Collapse>

        <Grid container spacing={5}>

          {/* ── Coluna esquerda: Saldos/Destino ── */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Box sx={{ position: { md: "sticky" }, top: { md: 24 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                <AccountBalanceIcon sx={{ color: "primary.main" }} />
                <Typography variant="h5" fontWeight={800}>Carteiras</Typography>
                <Chip label="tempo real" size="small" color="success" variant="outlined" sx={{ fontSize: "0.7rem" }} />
              </Box>

              {/* Tesouro */}
              <Card
                variant="outlined"
                onClick={() => setTarget("tesouro-geral")}
                sx={{
                  mb: 1.5, cursor: "pointer", transition: "all 0.18s ease",
                  borderColor: target === "tesouro-geral" ? "primary.main" : "divider",
                  borderWidth: target === "tesouro-geral" ? 2 : 1,
                  "&:hover": { borderColor: "primary.main", boxShadow: 2 },
                }}
              >
                <CardContent sx={{ display: "flex", alignItems: "center", gap: 1.5, py: "12px !important" }}>
                  <Typography sx={{ fontSize: "1.5rem", lineHeight: 1 }}>🏦</Typography>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={700}>Tesouro Codaqui</Typography>
                    <Typography variant="caption" color="text.secondary">Associação geral</Typography>
                  </Box>
                  <Box sx={{ textAlign: "right" }}>
                    {balancesLoading
                      ? <Skeleton width={60} />
                      : <Typography variant="body2" fontWeight={700} color="primary.main">
                          {formatBRL(getBalance("tesouro-geral"))}
                        </Typography>
                    }
                    {target === "tesouro-geral" && <CheckCircleIcon sx={{ color: "primary.main", fontSize: "0.9rem" }} />}
                  </Box>
                </CardContent>
              </Card>

              {/* Comunidades */}
              {communities.map((c) => (
                <Card
                  key={c.id}
                  variant="outlined"
                  onClick={() => setTarget(c.id)}
                  sx={{
                    mb: 1.5, cursor: "pointer", transition: "all 0.18s ease",
                    borderColor: target === c.id ? "primary.main" : "divider",
                    borderWidth: target === c.id ? 2 : 1,
                    "&:hover": { borderColor: "primary.main", boxShadow: 2 },
                  }}
                >
                  <CardContent sx={{ display: "flex", alignItems: "center", gap: 1.5, py: "12px !important" }}>
                    <Avatar src={c.logo} alt={c.name} sx={{ width: 32, height: 32, fontSize: "1rem" }}>
                      {c.emoji}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} noWrap>{c.name}</Typography>
                      {c.location && <Typography variant="caption" color="text.secondary" noWrap>{c.location}</Typography>}
                    </Box>
                    <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                      {balancesLoading
                        ? <Skeleton width={55} />
                        : <Typography variant="body2" fontWeight={700} color="primary.main">
                            {formatBRL(getBalance(c.id))}
                          </Typography>
                      }
                      {target === c.id && <CheckCircleIcon sx={{ color: "primary.main", fontSize: "0.9rem" }} />}
                    </Box>
                  </CardContent>
                </Card>
              ))}

              <Button
                fullWidth variant="text" size="small"
                startIcon={<AccountBalanceWalletIcon />}
                component={Link} href="/transparencia"
                sx={{ mt: 1, color: "text.secondary", fontSize: "0.78rem" }}
              >
                Portal de Transparência →
              </Button>
            </Box>
          </Grid>

          {/* ── Coluna direita: Formulário ── */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography variant="h5" fontWeight={800} gutterBottom>Fazer uma Doação</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Selecione a carteira à esquerda, o valor e a frequência. Doações anônimas aceitas até{" "}
              <strong>R$ 100</strong> (única ou recorrente).
            </Typography>

            {/* Destino selecionado */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3, p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
              <Typography sx={{ fontSize: "1.4rem" }}>{selected.emoji}</Typography>
              <Box>
                <Typography variant="body2" fontWeight={700}>{selected.name}</Typography>
                <Typography variant="caption" color="text.secondary">{selected.description?.slice(0, 80)}</Typography>
              </Box>
            </Box>

            {/* ── Frequência ── */}
            <Typography variant="overline" color="text.secondary" letterSpacing={1.5} sx={{ mb: 1, display: "block" }}>
              Frequência
            </Typography>
            <ToggleButtonGroup
              value={mode}
              exclusive
              onChange={(_, v) => { if (v) setMode(v); }}
              size="small"
              sx={{ mb: 0.5, "& .MuiToggleButton-root": { px: 2.5, fontWeight: 600, textTransform: "none" } }}
            >
              {DONATION_MODES.map((m) => (
                <ToggleButton key={m.value} value={m.value} sx={m.recommended ? {
                  "&.Mui-selected": { bgcolor: "primary.main", color: "common.white", "&:hover": { bgcolor: "primary.dark" } },
                } : undefined}>
                  {m.value !== "once" && <AutorenewIcon sx={{ fontSize: "0.9rem", mr: 0.5 }} />}
                  {m.label}
                  {m.recommended && (
                    <StarIcon sx={{ fontSize: "0.75rem", ml: 0.5, color: mode === m.value ? "common.white" : "warning.main" }} />
                  )}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              {modeConfig.description}
              {isRecurring && " Cancele a qualquer momento pelo Stripe."}
            </Typography>

            {/* Nudge para mensal quando "Única" selecionada */}
            <Collapse in={mode === "once"}>
              <Box sx={{
                display: "flex", alignItems: "center", gap: 1,
                mb: 2, p: 1.5, borderRadius: 2,
                bgcolor: "action.hover", border: "1px dashed", borderColor: "primary.light",
              }}>
                <TipsAndUpdatesIcon sx={{ color: "primary.main", fontSize: "1.1rem" }} />
                <Typography variant="caption" color="text.secondary">
                  <strong>Dica:</strong> apoio mensal gera impacto contínuo e pode ser cancelado a qualquer momento.{" "}
                  <Box
                    component="span"
                    onClick={() => setMode("month")}
                    sx={{ color: "primary.main", cursor: "pointer", fontWeight: 700, textDecoration: "underline" }}
                  >
                    Tornar mensal →
                  </Box>
                </Typography>
              </Box>
            </Collapse>

            {/* Card de impacto quando recorrente */}
            <Collapse in={isRecurring}>
              <Box sx={{
                display: "flex", alignItems: "center", gap: 1.5,
                mb: 2, p: 1.5, borderRadius: 2,
                bgcolor: "primary.main", color: "common.white",
              }}>
                <FavoriteIcon sx={{ fontSize: "1.2rem" }} />
                <Typography variant="caption" fontWeight={600}>
                  {mode === "month"
                    ? `${amountLabel}/mês = ${formatBRL((amount * 12) / 100)}/ano de impacto contínuo 💚`
                    : `${amountLabel}/ano de apoio contínuo para a comunidade 💚`}
                </Typography>
              </Box>
            </Collapse>

            {/* ── Valor ── */}
            <Typography variant="overline" color="text.secondary" letterSpacing={1.5} sx={{ mb: 1, display: "block" }}>
              Valor {isRecurring ? `(por ${modeConfig.label.toLowerCase()})` : "da Doação"}
            </Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }}>
              {PRESET_AMOUNTS.map((a) => {
                const active = amount === a.cents;
                const needsLoginHint = a.cents > ANONYMOUS_LIMIT_CENTS && !isLoggedIn;
                const isPopular = a.cents === 2500;
                return (
                  <Box key={a.cents} sx={{ position: "relative" }}>
                    {isPopular && (
                      <Chip
                        label="Popular"
                        size="small"
                        color="primary"
                        sx={{
                          position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
                          fontSize: "0.6rem", height: 18, zIndex: 1,
                          "& .MuiChip-label": { px: 0.8 },
                        }}
                      />
                    )}
                    <Box
                      component="button"
                      onClick={() => setAmount(a.cents)}
                      sx={{
                        px: 2.5, py: 0.9, fontWeight: 700, fontSize: "0.92rem",
                        fontFamily: "inherit", borderRadius: 2, border: "2px solid",
                        borderColor: active ? "primary.main" : "divider",
                        bgcolor: active ? "primary.main" : "background.paper",
                        color: active ? "common.white" : "text.primary",
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 0.5,
                        transition: "all 0.15s ease",
                        "&:hover": { borderColor: "primary.main", transform: "translateY(-1px)" },
                      }}
                    >
                      {a.label}
                      {needsLoginHint && !active && <LockIcon sx={{ fontSize: "0.75rem", opacity: 0.5 }} />}
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {/* ── Identidade ── */}
            <Typography variant="overline" color="text.secondary" letterSpacing={1.5} sx={{ mb: 1, display: "block" }}>
              Identidade
            </Typography>
            <Box sx={{ mb: 3 }}>
              {ready ? (
                <IdentityStatus
                  isLoggedIn={isLoggedIn}
                  user={user}
                  isRecurring={isRecurring}
                  amount={amount}
                  login={login}
                />
              ) : (
                <Skeleton height={40} />
              )}
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {/* ── Resumo + CTA ── */}
            <Card
              variant="outlined"
              sx={{
                borderColor: requiresLogin && !isLoggedIn ? "warning.main" : "primary.main",
                borderWidth: 2,
                bgcolor: "action.hover",
              }}
            >
              <CardContent sx={{ pb: "16px !important" }}>
                <Stack spacing={1.5}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="body2" color="text.secondary">Destino</Typography>
                    <Typography variant="body2" fontWeight={700}>{selected.emoji} {selected.name}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="body2" color="text.secondary">Frequência</Typography>
                    <Chip
                      size="small"
                      label={modeConfig.label}
                      color={isRecurring ? "info" : "default"}
                      variant="outlined"
                      icon={isRecurring ? <AutorenewIcon /> : undefined}
                    />
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="body2" color="text.secondary">Valor</Typography>
                    <Typography variant="h6" fontWeight={800} color="primary.main">{amountLabel}</Typography>
                  </Box>
                  <Divider />
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CreditCardIcon sx={{ fontSize: "0.9rem", color: "text.secondary" }} />
                    <Typography variant="caption" color="text.secondary">
                      Cartão · Apple Pay · Google Pay (via Stripe)
                    </Typography>
                  </Box>

                  <DonateButton
                    isLoggedIn={isLoggedIn}
                    requiresLogin={requiresLogin}
                    loading={loading}
                    isRecurring={isRecurring}
                    mode={mode}
                    amountLabel={amountLabel}
                    handleDonate={handleDonate}
                  />
                </Stack>
              </CardContent>
            </Card>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
              Após o pagamento, o valor é registrado no{" "}
              <Link href="/transparencia">Portal de Transparência</Link>.{" "}
              {isRecurring && "Assinaturas podem ser canceladas pelo painel do Stripe."}
            </Typography>
          </Grid>
        </Grid>
      </Container>

      {/* ── Checkout embutido ── */}
      <EmbeddedCheckoutDialog
        open={checkoutOpen}
        clientSecret={clientSecret}
        stripeKey={stripeKey}
        onClose={() => setCheckoutOpen(false)}
        onSuccess={handleCheckoutSuccess}
      />
    </Layout>
  );
}

// ─── Sub-components para redução de complexidade ───

interface IdentityStatusProps {
  readonly isLoggedIn: boolean;
  readonly user: any;
  readonly isRecurring: boolean;
  readonly amount: number;
  readonly login: () => void;
}

function IdentityStatus({ isLoggedIn, user, isRecurring, amount, login }: IdentityStatusProps) {
  if (isLoggedIn && user) {
    return (
      <Chip
        avatar={<Avatar src={user.avatarUrl} alt={user.name} sx={{ width: "22px !important", height: "22px !important" }} />}
        label={`Doando como @${user.handle}`}
        variant="outlined"
        color="primary"
      />
    );
  }

  if (amount > ANONYMOUS_LIMIT_CENTS) {
    return (
      <Alert
        severity="info"
        icon={<LockIcon />}
        action={
          <Button size="small" startIcon={<GitHubIcon />} onClick={login} variant="outlined" color="inherit">
            Entrar
          </Button>
        }
      >
        Doações acima de R$ 100 requerem login para transparência fiscal.
      </Alert>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      <Chip label={isRecurring ? "Assinatura anônima" : "Doação anônima"} size="small" variant="outlined" />
      <Button size="small" startIcon={<GitHubIcon />} onClick={login} variant="text" sx={{ fontSize: "0.8rem" }}>
        Ou entrar com GitHub
      </Button>
    </Box>
  );
}

interface DonateButtonProps {
  readonly isLoggedIn: boolean;
  readonly requiresLogin: boolean;
  readonly loading: boolean;
  readonly isRecurring: boolean;
  readonly mode: string;
  readonly amountLabel: string;
  readonly handleDonate: () => void;
}

function DonateButton({
  isLoggedIn,
  requiresLogin,
  loading,
  isRecurring,
  mode,
  amountLabel,
  handleDonate,
}: DonateButtonProps) {
  const showGitHub = requiresLogin && !isLoggedIn;
  const buttonPrefix = isRecurring ? "Assinar" : "Apoiar";
  
  let recurrenceSuffix = "";
  if (isRecurring) {
    recurrenceSuffix = mode === "month" ? "/mês" : "/ano";
  }
  
  const buttonTextLabel = `${buttonPrefix} com ${amountLabel}${recurrenceSuffix}`;
  
  let buttonLabelText = buttonTextLabel;
  if (loading) {
    buttonLabelText = "Preparando…";
  } else if (showGitHub) {
    buttonLabelText = "Entrar com GitHub para continuar";
  }

  let startIcon = <FavoriteIcon />;
  if (loading) {
    startIcon = <CircularProgress size={18} color="inherit" />;
  } else if (showGitHub) {
    startIcon = <GitHubIcon />;
  }

  return (
    <Button
      variant="contained"
      color={showGitHub ? "warning" : "primary"}
      size="large"
      fullWidth
      disabled={loading}
      onClick={handleDonate}
      startIcon={startIcon}
      sx={{ fontWeight: 700, borderRadius: 2, mt: 0.5 }}
    >
      {buttonLabelText}
    </Button>
  );
}

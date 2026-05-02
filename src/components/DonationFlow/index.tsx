/**
 * DonationFlow — componente reutilizável de fluxo de doação Stripe.
 *
 * Reusa o flow rico (frequência mensal/única/anual + valor + identidade +
 * checkout embedado) entre a página principal `/participe/apoiar` e páginas
 * de comunidades parceiras (`/comunidades/<slug>/apoiar`).
 *
 * Props relevantes para variantes whitelabel:
 *  - `lockedTargetId`: trava o destino (esconde a coluna de carteiras)
 *  - `hideWallets`: esconde a coluna de carteiras mas permite trocar
 *    pelos destinos derivados de `communities`
 *  - `disableAuth`: suprime UI de auth e bloqueia >R$100 (uso em domínios
 *    de comunidade que não compartilham cookie)
 *  - `accentColor` / `accentColorDark`: cor primária do CTA
 */

import React, { useCallback, useEffect, useState } from "react";
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
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { communities } from "@site/src/data/communities";
import { useAuth, type AuthUser } from "@site/src/hooks/useAuth";
import { resolveApiUrl } from "@site/src/lib/api-url";

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

interface DonationTarget {
  id: string;
  name: string;
  emoji: string;
  description: string;
  logo?: string;
}

const TESOURO: DonationTarget = {
  id: "tesouro-geral",
  name: "Tesouro Codaqui",
  emoji: "🏦",
  description: "Suporta a associação diretamente: eventos, infraestrutura e programas.",
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

interface WalletBalance {
  id: string;
  projectKey: string;
  name: string;
  balance: number;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

// ─── Embedded Checkout Dialog ────────────────────────────────────────────────

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
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

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

// ─── Subcomponentes ──────────────────────────────────────────────────────────

interface IdentityStatusProps {
  readonly isLoggedIn: boolean;
  readonly user: AuthUser | null;
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
  readonly mode: DonationMode;
  readonly amountLabel: string;
  readonly handleDonate: () => void;
  readonly accentColor?: string;
  readonly accentColorDark?: string;
}

function DonateButton({
  isLoggedIn, requiresLogin, loading, isRecurring, mode, amountLabel, handleDonate,
  accentColor, accentColorDark,
}: DonateButtonProps) {
  let label = `Apoiar com ${amountLabel}`;
  if (loading) label = "Redirecionando…";
  else if (isRecurring) label = `Apoiar com ${amountLabel}/${mode === "month" ? "mês" : "ano"}`;
  else if (requiresLogin && !isLoggedIn) label = "Entrar com GitHub para continuar";

  let icon: React.ReactNode = <FavoriteIcon />;
  if (loading) icon = <CircularProgress size={18} color="inherit" />;
  else if (requiresLogin && !isLoggedIn) icon = <GitHubIcon />;
  else if (isRecurring) icon = <AutorenewIcon />;

  return (
    <Button
      variant="contained"
      size="large"
      fullWidth
      disabled={loading}
      onClick={handleDonate}
      startIcon={icon}
      sx={{
        py: 1.5, fontWeight: 700, fontSize: "1rem", textTransform: "none",
        ...(accentColor && {
          bgcolor: accentColor,
          "&:hover": { bgcolor: accentColorDark ?? accentColor },
        }),
      }}
    >
      {label}
    </Button>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export interface DonationFlowProps {
  /** Trava o destino e esconde toda UI de seleção. */
  readonly lockedTargetId?: string;
  /** Esconde a coluna de carteiras (mas permite trocar destino se não lockado). */
  readonly hideWallets?: boolean;
  /**
   * Suprime totalmente UI de auth (sem banner, sem login CTA, bloqueia >R$100).
   * Use em páginas de visualização (não em formulários de doação).
   */
  readonly disableAuth?: boolean;
  /** Slug da comunidade para tracking no fluxo OAuth (callback whitelabel). */
  readonly authCommunitySlug?: string;
  /** Cor primária do CTA. Default: primary do tema. */
  readonly accentColor?: string;
  readonly accentColorDark?: string;
  /** Texto do título da seção do formulário. Default: "Fazer uma Doação". */
  readonly title?: string;
  /** Subtítulo do formulário. */
  readonly subtitle?: string;
}

export default function DonationFlow({
  lockedTargetId,
  hideWallets = false,
  disableAuth = false,
  authCommunitySlug,
  accentColor,
  accentColorDark,
  title = "Fazer uma Doação",
  subtitle,
}: DonationFlowProps): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const configuredApiUrl =
    (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";
  const apiUrl = resolveApiUrl(configuredApiUrl, siteConfig.url);
  const stripeKey = (siteConfig.customFields?.stripePublishableKey as string) ?? "";
  const { user, ready, isLoggedIn, authFetch, login } = useAuth();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const status = params.get("status");

  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(true);

  const initialTarget =
    lockedTargetId && DONATION_TARGETS.some((t) => t.id === lockedTargetId)
      ? lockedTargetId
      : "tesouro-geral";
  const [target, setTarget] = useState<string>(initialTarget);
  const [amount, setAmount] = useState<number>(2500);
  const [mode, setMode] = useState<DonationMode>("month");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anonymousAcknowledged, setAnonymousAcknowledged] = useState(false);

  // Form fica bloqueado até usuário escolher: entrar com GitHub OU prosseguir anônimo
  const formGated = !disableAuth && ready && !isLoggedIn && !anonymousAcknowledged;

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [donationSuccess, setDonationSuccess] = useState(false);

  const selected = DONATION_TARGETS.find((t) => t.id === target) ?? TESOURO;
  const amountLabel = PRESET_AMOUNTS.find((a) => a.cents === amount)?.label ?? formatBRL(amount / 100);
  const isRecurring = mode !== "once";
  const requiresLogin =
    !disableAuth && amount > ANONYMOUS_LIMIT_CENTS && !isLoggedIn;
  const blockedAnonAmount = disableAuth && amount > ANONYMOUS_LIMIT_CENTS;

  // Detecta deploy whitelabel (Cloudflare Worker em domínio próprio da
  // comunidade). Quando true, exibimos aviso de gestão de assinaturas — o
  // dashboard do membro vive na Codaqui canônica, não no domínio whitelabel.
  const isWhitelabelDeploy =
    typeof globalThis.window !== "undefined" &&
    apiUrl === globalThis.location.origin &&
    !globalThis.location.host.startsWith("localhost") &&
    !globalThis.location.host.endsWith(":3000") &&
    !globalThis.location.host.endsWith(":3030");
  const codaquiHomeUrl = `${siteConfig.url}${siteConfig.baseUrl}`;

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

  const triggerLogin = useCallback(() => {
    login({
      returnTo: location.pathname + (location.search || ""),
      communitySlug: authCommunitySlug ?? null,
    });
  }, [login, location.pathname, location.search, authCommunitySlug]);

  const handleDonate = async () => {
    if (blockedAnonAmount) {
      setError("Doações acima de R$ 100 só estão disponíveis em codaqui.dev/participe/apoiar.");
      return;
    }
    if (requiresLogin && !isLoggedIn) {
      triggerLogin();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        amount,
        communityId: target,
        uiMode: "embedded_page",
        // Mantém o usuário no contexto da comunidade ao retornar do Stripe.
        // Em deploys whitelabel (tisocial.org.br), `pathname` será
        // `/comunidades/tisocial/apoiar` em vez do default `/participe/apoiar`.
        returnPath:
          typeof globalThis.window !== "undefined"
            ? globalThis.location.pathname
            : undefined,
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

  const showWalletsColumn = !hideWallets && !lockedTargetId;

  const formColumn = (
    <>
      <Typography variant="h5" fontWeight={800} gutterBottom>{title}</Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {subtitle}
        </Typography>
      )}

      {/* ── Gate: login encorajado (forte) ── */}
      {!disableAuth && ready && !isLoggedIn && !anonymousAcknowledged && (
        <Card
          variant="outlined"
          sx={{
            mb: 3,
            borderColor: accentColor ?? "primary.main",
            borderWidth: 2,
            bgcolor: "action.hover",
          }}
        >
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <FavoriteIcon sx={{ color: accentColor ?? "primary.main", fontSize: 22 }} />
              <Typography variant="body1" fontWeight={800}>
                Como você quer doar?
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Doações identificadas geram recibo, histórico no painel e aparecem no Portal de Transparência.
              Recomendamos entrar com GitHub.
            </Typography>
            <Stack spacing={1.5}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={<GitHubIcon />}
                onClick={triggerLogin}
                sx={{
                  textTransform: "none",
                  fontWeight: 700,
                  py: 1.2,
                  ...(accentColor && {
                    bgcolor: accentColor,
                    "&:hover": { bgcolor: accentColorDark ?? accentColor },
                  }),
                }}
              >
                Entrar com GitHub e doar identificado
              </Button>
              <Button
                fullWidth
                variant="text"
                size="small"
                onClick={() => setAnonymousAcknowledged(true)}
                sx={{
                  textTransform: "none",
                  color: "text.secondary",
                  fontWeight: 500,
                  fontSize: "0.85rem",
                  "&:hover": { bgcolor: "transparent", textDecoration: "underline" },
                }}
              >
                Prefiro doar anonimamente (até R$ 100) →
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* ── Mini-aviso quando usuário escolheu anônimo ── */}
      {!disableAuth && ready && !isLoggedIn && anonymousAcknowledged && (
        <Alert
          severity="info"
          icon={<LockIcon />}
          action={
            <Button
              size="small"
              startIcon={<GitHubIcon />}
              onClick={triggerLogin}
              sx={{
                textTransform: "none",
                fontWeight: 600,
                ...(accentColor && { color: accentColor }),
              }}
            >
              Entrar
            </Button>
          }
          sx={{ mb: 3 }}
        >
          Doação anônima — limitado a R$ 100. Pode entrar com GitHub a qualquer momento.
        </Alert>
      )}

      {/* ── Chip discreto quando logado ── */}
      {!disableAuth && ready && isLoggedIn && user && (
        <Chip
          avatar={<Avatar src={user.avatarUrl} alt={user.name} sx={{ width: "22px !important", height: "22px !important" }} />}
          label={`Doando como @${user.handle}`}
          variant="outlined"
          sx={{
            mb: 3,
            borderColor: accentColor ?? "primary.main",
            color: accentColor ?? "primary.main",
            fontWeight: 600,
            "& .MuiChip-avatar": { ml: 0.5 },
          }}
        />
      )}

      {/* Destino selecionado */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3, p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
        <Typography sx={{ fontSize: "1.4rem" }}>{selected.emoji}</Typography>
        <Box>
          <Typography variant="body2" fontWeight={700}>{selected.name}</Typography>
          <Typography variant="caption" color="text.secondary">{selected.description?.slice(0, 80)}</Typography>
        </Box>
      </Box>

      {/* Wrapper gated: bloqueia frequência/valor/CTA até usuário escolher fluxo */}
      <Box
        sx={{
          position: "relative",
          ...(formGated && {
            opacity: 0.45,
            filter: "blur(2px)",
            pointerEvents: "none",
            userSelect: "none",
          }),
          transition: "opacity 0.25s, filter 0.25s",
        }}
        aria-disabled={formGated}
      >

      {/* Frequência */}
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
            "&.Mui-selected": {
              bgcolor: accentColor ?? "primary.main",
              color: "common.white",
              "&:hover": { bgcolor: accentColorDark ?? "primary.dark" },
            },
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

      {/* Nudge mensal */}
      <Collapse in={mode === "once"}>
        <Box sx={{
          display: "flex", alignItems: "center", gap: 1,
          mb: 2, p: 1.5, borderRadius: 2,
          bgcolor: "action.hover", border: "1px dashed",
          borderColor: accentColor ?? "primary.light",
        }}>
          <TipsAndUpdatesIcon sx={{ color: accentColor ?? "primary.main", fontSize: "1.1rem" }} />
          <Typography variant="caption" color="text.secondary">
            <strong>Dica:</strong> apoio mensal gera impacto contínuo e pode ser cancelado a qualquer momento.{" "}
            <Box
              component="span"
              onClick={() => setMode("month")}
              sx={{ color: accentColor ?? "primary.main", cursor: "pointer", fontWeight: 700, textDecoration: "underline" }}
            >
              Tornar mensal →
            </Box>
          </Typography>
        </Box>
      </Collapse>

      {/* Card de impacto recorrente */}
      <Collapse in={isRecurring}>
        <Box sx={{
          display: "flex", alignItems: "center", gap: 1.5,
          mb: 2, p: 1.5, borderRadius: 2,
          bgcolor: accentColor ?? "primary.main", color: "common.white",
        }}>
          <FavoriteIcon sx={{ fontSize: "1.2rem" }} />
          <Typography variant="caption" fontWeight={600}>
            {mode === "month"
              ? `${amountLabel}/mês = ${formatBRL((amount * 12) / 100)}/ano de impacto contínuo 💚`
              : `${amountLabel}/ano de apoio contínuo para a comunidade 💚`}
          </Typography>
        </Box>
      </Collapse>

      {/* Aviso de gestão de assinaturas em deploys whitelabel */}
      <Collapse in={isRecurring && isWhitelabelDeploy}>
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          Depois de doar, administre sua assinatura e benefícios pelo{" "}
          <a
            href={codaquiHomeUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontWeight: 600 }}
          >
            portal da Codaqui
          </a>{" "}
          ou pelo painel do Stripe enviado em seu e-mail.
        </Alert>
      </Collapse>

      {/* Valor */}
      <Typography variant="overline" color="text.secondary" letterSpacing={1.5} sx={{ mb: 1, display: "block" }}>
        Valor {isRecurring ? `(por ${modeConfig.label.toLowerCase()})` : "da Doação"}
      </Typography>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }}>
        {PRESET_AMOUNTS.map((a) => {
          const active = amount === a.cents;
          const needsLoginHint = !disableAuth && a.cents > ANONYMOUS_LIMIT_CENTS && !isLoggedIn;
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
                    ...(accentColor && { bgcolor: accentColor }),
                  }}
                />
              )}
              <Box
                component="button"
                onClick={() => setAmount(a.cents)}
                sx={{
                  px: 2.5, py: 0.9, fontWeight: 700, fontSize: "0.92rem",
                  fontFamily: "inherit", borderRadius: 2, border: "2px solid",
                  borderColor: active ? (accentColor ?? "primary.main") : "divider",
                  bgcolor: active ? (accentColor ?? "primary.main") : "background.paper",
                  color: active ? "common.white" : "text.primary",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 0.5,
                  transition: "all 0.15s ease",
                  "&:hover": { borderColor: accentColor ?? "primary.main", transform: "translateY(-1px)" },
                }}
              >
                {a.label}
                {needsLoginHint && !active && <LockIcon sx={{ fontSize: "0.75rem", opacity: 0.5 }} />}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Aviso quando auth desabilitada */}
      {disableAuth && blockedAnonAmount && (
        <Alert severity="warning" icon={<LockIcon />} sx={{ mb: 2 }}>
          Para doações acima de R$ 100, acesse a página principal:{" "}
          <Link to="/participe/apoiar" style={{ fontWeight: 600 }}>codaqui.dev/participe/apoiar</Link>.
        </Alert>
      )}

      {/* Identidade — removido (substituído pelo banner encorajado no topo) */}

      {/* Aviso de login necessário para valor > R$100 (anônimo bloqueado) */}
      {!disableAuth && requiresLogin && (
        <Alert severity="info" icon={<LockIcon />} sx={{ mb: 2 }}>
          Doações acima de R$ 100 requerem login para conformidade fiscal e transparência.{" "}
          <Box
            component="span"
            onClick={triggerLogin}
            sx={{ color: accentColor ?? "primary.main", cursor: "pointer", fontWeight: 700, textDecoration: "underline" }}
          >
            Entrar agora →
          </Box>
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Resumo + CTA */}
      <Card
        variant="outlined"
        sx={{
          borderColor: requiresLogin && !isLoggedIn ? "warning.main" : (accentColor ?? "primary.main"),
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
              <Typography
                variant="h6"
                fontWeight={800}
                sx={{ color: accentColor ?? "primary.main" }}
              >
                {amountLabel}
              </Typography>
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
              accentColor={accentColor}
              accentColorDark={accentColorDark}
            />
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
        Após o pagamento, o valor é registrado no{" "}
        <Link href="/transparencia">Portal de Transparência</Link>.{" "}
        {isRecurring && "Assinaturas podem ser canceladas pelo painel do Stripe."}
      </Typography>
      </Box>
    </>
  );

  return (
    <>
      {/* Alertas de retorno */}
      <Collapse in={donationSuccess || status === "success"}>
        <Alert
          severity="success"
          icon={<CheckCircleIcon />}
          sx={{ mb: 4, fontSize: "1rem" }}
          onClose={() => {
            setDonationSuccess(false);
            globalThis.history.replaceState(null, "", location.pathname);
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
          onClose={() => globalThis.history.replaceState(null, "", location.pathname)}
        >
          Pagamento cancelado. Você pode tentar novamente abaixo.
        </Alert>
      </Collapse>

      {showWalletsColumn ? (
        <Grid container spacing={5}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Box sx={{ position: { md: "sticky" }, top: { md: 24 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                <AccountBalanceIcon sx={{ color: accentColor ?? "primary.main" }} />
                <Typography variant="h5" fontWeight={800}>Carteiras</Typography>
                <Chip label="tempo real" size="small" color="success" variant="outlined" sx={{ fontSize: "0.7rem" }} />
              </Box>

              {DONATION_TARGETS.map((t) => {
                const active = target === t.id;
                return (
                  <Card
                    key={t.id}
                    variant="outlined"
                    onClick={() => setTarget(t.id)}
                    sx={{
                      mb: 1.5, cursor: "pointer", transition: "all 0.18s ease",
                      borderColor: active ? (accentColor ?? "primary.main") : "divider",
                      borderWidth: active ? 2 : 1,
                      "&:hover": { borderColor: accentColor ?? "primary.main", boxShadow: 2 },
                    }}
                  >
                    <CardContent sx={{ display: "flex", alignItems: "center", gap: 1.5, py: "12px !important" }}>
                      {t.logo
                        ? <Avatar src={t.logo} alt={t.name} sx={{ width: 32, height: 32, fontSize: "1rem" }}>{t.emoji}</Avatar>
                        : <Typography sx={{ fontSize: "1.5rem", lineHeight: 1 }}>{t.emoji}</Typography>}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700} noWrap>{t.name}</Typography>
                      </Box>
                      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                        {balancesLoading
                          ? <Skeleton width={55} />
                          : <Typography variant="body2" fontWeight={700} sx={{ color: accentColor ?? "primary.main" }}>
                              {formatBRL(getBalance(t.id))}
                            </Typography>
                        }
                        {active && <CheckCircleIcon sx={{ color: accentColor ?? "primary.main", fontSize: "0.9rem" }} />}
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}

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
          <Grid size={{ xs: 12, md: 7 }}>{formColumn}</Grid>
        </Grid>
      ) : (
        <Box sx={{ maxWidth: 720, mx: "auto" }}>{formColumn}</Box>
      )}

      <EmbeddedCheckoutDialog
        open={checkoutOpen}
        clientSecret={clientSecret}
        stripeKey={stripeKey}
        onClose={() => setCheckoutOpen(false)}
        onSuccess={handleCheckoutSuccess}
      />
    </>
  );
}

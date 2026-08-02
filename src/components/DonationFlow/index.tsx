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

import React from "react";
import Link from "@docusaurus/Link";
import { useLocation } from "@docusaurus/router";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import BusinessIcon from "@mui/icons-material/Business";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import FavoriteIcon from "@mui/icons-material/Favorite";
import GitHubIcon from "@mui/icons-material/GitHub";
import LockIcon from "@mui/icons-material/Lock";
import StarIcon from "@mui/icons-material/Star";
import TipsAndUpdatesIcon from "@mui/icons-material/TipsAndUpdates";
import { type AuthUser } from "@site/src/hooks/useAuth";
import StripeEmbeddedCheckoutDialog from "../StripeEmbeddedCheckoutDialog";
import { IdentityHandleChip, SupportPrimaryButton } from "../SupportCheckoutUi";
import {
  type DonationMode,
  DONATION_MODES,
  formatBRL,
  PRESET_AMOUNTS,
  useDonationFlow,
} from "./useDonationFlow";

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
  /** Callback para acionar a seção de doação empresarial (exibe botão "Apoiar como empresa →"). */
  readonly onCompanyClick?: () => void;
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
    <SupportPrimaryButton
      label={label}
      loading={loading}
      onClick={handleDonate}
      startIcon={icon}
      accentColor={accentColor}
      accentColorDark={accentColorDark}
    />
  );
}

interface DonationFormProps extends DonationFlowProps {
  readonly flow: ReturnType<typeof useDonationFlow>;
}

function AuthPromptSection({ accentColor, accentColorDark, triggerLogin, onAnonymous }: {
  readonly accentColor?: string;
  readonly accentColorDark?: string;
  readonly triggerLogin: () => void;
  readonly onAnonymous: () => void;
}): React.JSX.Element {
  return (
    <Card variant="outlined" sx={{ mb: 3, borderColor: accentColor ?? "primary.main", borderWidth: 2, bgcolor: "action.hover" }}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <FavoriteIcon sx={{ color: accentColor ?? "primary.main", fontSize: 22 }} />
          <Typography variant="body1" fontWeight={800}>Como você quer doar?</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Doações identificadas geram recibo, histórico no painel e aparecem no Portal de Transparência. Recomendamos entrar com GitHub — você será redirecionado de volta para esta página após a autenticação.
        </Typography>
        <Stack spacing={1.5}>
          <Button fullWidth variant="contained" size="large" startIcon={<GitHubIcon />} onClick={triggerLogin} sx={{ textTransform: "none", fontWeight: 700, py: 1.2, ...(accentColor && { bgcolor: accentColor, "&:hover": { bgcolor: accentColorDark ?? accentColor } }) }}>
            Entrar com GitHub e doar identificado
          </Button>
          <Button fullWidth variant="text" size="small" onClick={onAnonymous} sx={{ textTransform: "none", color: "text.secondary", fontWeight: 500, fontSize: "0.85rem", "&:hover": { bgcolor: "transparent", textDecoration: "underline" } }}>
            Prefiro doar anonimamente (até R$ 100) →
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function AnonymousNotice({ accentColor, triggerLogin }: {
  readonly accentColor?: string;
  readonly triggerLogin: () => void;
}): React.JSX.Element {
  return (
    <Alert severity="info" icon={<LockIcon />} sx={{ mb: 3 }} action={
      <Button size="small" startIcon={<GitHubIcon />} onClick={triggerLogin} sx={{ textTransform: "none", fontWeight: 600, ...(accentColor && { color: accentColor }) }}>
        Entrar
      </Button>
    }>
      Doação anônima — limitado a R$ 100. Pode entrar com GitHub a qualquer momento.
    </Alert>
  );
}

function LoggedInIdentity({ user, accentColor, onCompanyClick }: {
  readonly user: AuthUser;
  readonly accentColor?: string;
  readonly onCompanyClick?: () => void;
}): React.JSX.Element {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3, flexWrap: "wrap" }}>
      <IdentityHandleChip user={user} sx={{ borderColor: accentColor ?? "primary.main", color: accentColor ?? "primary.main", fontWeight: 600, "& .MuiChip-avatar": { ml: 0.5 } }} />
      {onCompanyClick && (
        <Button size="small" variant="outlined" startIcon={<BusinessIcon />} onClick={onCompanyClick} sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.82rem" }}>
          Empresa →
        </Button>
      )}
    </Box>
  );
}

function SelectedTarget({ selected }: { readonly selected: { emoji: string; name: string; description?: string } }): React.JSX.Element {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3, p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
      <Typography sx={{ fontSize: "1.4rem" }}>{selected.emoji}</Typography>
      <Box>
        <Typography variant="body2" fontWeight={700}>{selected.name}</Typography>
        <Typography variant="caption" color="text.secondary">{selected.description?.slice(0, 80)}</Typography>
      </Box>
    </Box>
  );
}

function FrequencySection({ mode, setMode, isRecurring, modeConfig, accentColor, accentColorDark, amountLabel, amount }: {
  readonly mode: DonationMode;
  readonly setMode: (value: DonationMode) => void;
  readonly isRecurring: boolean;
  readonly modeConfig: { label: string; description: string };
  readonly accentColor?: string;
  readonly accentColorDark?: string;
  readonly amountLabel: string;
  readonly amount: number;
}): React.JSX.Element {
  return (
    <>
      <Typography variant="overline" color="text.secondary" letterSpacing={1.5} sx={{ mb: 1, display: "block" }}>Frequência</Typography>
      <ToggleButtonGroup value={mode} exclusive onChange={(_, v) => { if (v) setMode(v); }} size="small" sx={{ mb: 0.5, "& .MuiToggleButton-root": { px: 2.5, fontWeight: 600, textTransform: "none" } }}>
        {DONATION_MODES.map((m) => (
          <ToggleButton key={m.value} value={m.value} sx={m.recommended ? { "&.Mui-selected": { bgcolor: accentColor ?? "primary.main", color: "common.white", "&:hover": { bgcolor: accentColorDark ?? "primary.dark" } } } : undefined}>
            {m.value !== "once" && <AutorenewIcon sx={{ fontSize: "0.9rem", mr: 0.5 }} />}
            {m.label}
            {m.recommended && <StarIcon sx={{ fontSize: "0.75rem", ml: 0.5, color: mode === m.value ? "common.white" : "warning.main" }} />}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        {modeConfig.description}{isRecurring && " Cancele a qualquer momento pelo Stripe."}
      </Typography>

      <Collapse in={mode === "once"}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, p: 1.5, borderRadius: 2, bgcolor: "action.hover", border: "1px dashed", borderColor: accentColor ?? "primary.light" }}>
          <TipsAndUpdatesIcon sx={{ color: accentColor ?? "primary.main", fontSize: "1.1rem" }} />
          <Typography variant="caption" color="text.secondary">
            <strong>Dica:</strong> apoio mensal gera impacto contínuo e pode ser cancelado a qualquer momento.{" "}
            <Box component="span" onClick={() => setMode("month")} sx={{ color: accentColor ?? "primary.main", cursor: "pointer", fontWeight: 700, textDecoration: "underline" }}>Tornar mensal →</Box>
          </Typography>
        </Box>
      </Collapse>

      <Collapse in={isRecurring}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2, p: 1.5, borderRadius: 2, bgcolor: accentColor ?? "primary.main", color: "common.white" }}>
          <FavoriteIcon sx={{ fontSize: "1.2rem" }} />
          <Typography variant="caption" fontWeight={600}>
            {mode === "month" ? `${amountLabel}/mês = ${formatBRL((amount * 12) / 100)}/ano de impacto contínuo 💚` : `${amountLabel}/ano de apoio contínuo para a comunidade 💚`}
          </Typography>
        </Box>
      </Collapse>
    </>
  );
}

function AmountSection({ amount, setAmount, isLoggedIn, disableAuth, accentColor }: {
  readonly amount: number;
  readonly setAmount: (value: number) => void;
  readonly isLoggedIn: boolean;
  readonly disableAuth: boolean;
  readonly accentColor?: string;
}): React.JSX.Element {
  const ANONYMOUS_LIMIT_CENTS = 10000;
  return (
    <>
      <Typography variant="overline" color="text.secondary" letterSpacing={1.5} sx={{ mb: 1, display: "block" }}>Valor</Typography>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }}>
        {PRESET_AMOUNTS.map((a) => {
          const active = amount === a.cents;
          const needsLoginHint = !disableAuth && a.cents > ANONYMOUS_LIMIT_CENTS && !isLoggedIn;
          const isPopular = a.cents === 2500;
          return (
            <Box key={a.cents} sx={{ position: "relative" }}>
              {isPopular && (
                <Chip label="Popular" size="small" color="primary" sx={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", fontSize: "0.6rem", height: 18, zIndex: 1, "& .MuiChip-label": { px: 0.8 }, ...(accentColor && { bgcolor: accentColor }) }} />
              )}
              <Box component="button" onClick={() => setAmount(a.cents)} sx={{ px: 2.5, py: 0.9, fontWeight: 700, fontSize: "0.92rem", fontFamily: "inherit", borderRadius: 2, border: "2px solid", borderColor: active ? (accentColor ?? "primary.main") : "divider", bgcolor: active ? (accentColor ?? "primary.main") : "background.paper", color: active ? "common.white" : "text.primary", cursor: "pointer", display: "flex", alignItems: "center", gap: 0.5, transition: "all 0.15s ease", "&:hover": { borderColor: accentColor ?? "primary.main", transform: "translateY(-1px)" } }}>
                {a.label}
                {needsLoginHint && !active && <LockIcon sx={{ fontSize: "0.75rem", opacity: 0.5 }} />}
              </Box>
            </Box>
          );
        })}
      </Box>
    </>
  );
}

function SummaryCard({ selected, modeConfig, isRecurring, amountLabel, isLoggedIn, requiresLogin, loading, handleDonate, accentColor, accentColorDark }: {
  readonly selected: { emoji: string; name: string };
  readonly modeConfig: { label: string };
  readonly isRecurring: boolean;
  readonly amountLabel: string;
  readonly isLoggedIn: boolean;
  readonly requiresLogin: boolean;
  readonly loading: boolean;
  readonly handleDonate: () => void;
  readonly accentColor?: string;
  readonly accentColorDark?: string;
}): React.JSX.Element {
  return (
    <Card variant="outlined" sx={{ borderColor: requiresLogin && !isLoggedIn ? "warning.main" : (accentColor ?? "primary.main"), borderWidth: 2, bgcolor: "action.hover" }}>
      <CardContent sx={{ pb: "16px !important" }}>
        <Stack spacing={1.5}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary">Destino</Typography>
            <Typography variant="body2" fontWeight={700}>{selected.emoji} {selected.name}</Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary">Frequência</Typography>
            <Chip size="small" label={modeConfig.label} color={isRecurring ? "info" : "default"} variant="outlined" icon={isRecurring ? <AutorenewIcon /> : undefined} />
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary">Valor</Typography>
            <Typography variant="h6" fontWeight={800} sx={{ color: accentColor ?? "primary.main" }}>{amountLabel}</Typography>
          </Box>
          <Divider />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CreditCardIcon sx={{ fontSize: "0.9rem", color: "text.secondary" }} />
            <Typography variant="caption" color="text.secondary">Cartão · Apple Pay · Google Pay (via Stripe)</Typography>
          </Box>
          <DonateButton
            isLoggedIn={isLoggedIn}
            requiresLogin={requiresLogin}
            loading={loading}
            isRecurring={isRecurring}
            mode={modeConfig.label as never}
            amountLabel={amountLabel}
            handleDonate={handleDonate}
            accentColor={accentColor}
            accentColorDark={accentColorDark}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}

function DonationForm({
  title = "Fazer uma Doação",
  subtitle,
  accentColor,
  accentColorDark,
  onCompanyClick,
  disableAuth,
  flow,
}: DonationFormProps): React.JSX.Element {
  const {
    user, ready, isLoggedIn,
    amount, setAmount,
    mode, setMode,
    loading, error,
    anonymousAcknowledged, setAnonymousAcknowledged,
    triggerLogin, handleDonate,
    selected, amountLabel, isRecurring, requiresLogin, blockedAnonAmount, formGated,
    modeConfig,
  } = flow;

  return (
    <>
      <Typography variant="h5" fontWeight={800} gutterBottom>{title}</Typography>
      {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{subtitle}</Typography>}

      {!formGated && !disableAuth && ready && !isLoggedIn && !anonymousAcknowledged && (
        <AuthPromptSection accentColor={accentColor} accentColorDark={accentColorDark} triggerLogin={triggerLogin} onAnonymous={() => setAnonymousAcknowledged(true)} />
      )}

      {!disableAuth && ready && !isLoggedIn && anonymousAcknowledged && (
        <AnonymousNotice accentColor={accentColor} triggerLogin={triggerLogin} />
      )}

      {!disableAuth && ready && isLoggedIn && user && (
        <LoggedInIdentity user={user} accentColor={accentColor} onCompanyClick={onCompanyClick} />
      )}

      <SelectedTarget selected={selected} />

      <Box
        sx={{
          position: "relative",
          ...(formGated && { opacity: 0.45, filter: "blur(2px)", pointerEvents: "none", userSelect: "none" }),
          transition: "opacity 0.25s, filter 0.25s",
        }}
        aria-disabled={formGated}
      >
        <FrequencySection
          mode={mode} setMode={setMode} isRecurring={isRecurring} modeConfig={modeConfig}
          accentColor={accentColor} accentColorDark={accentColorDark} amountLabel={amountLabel} amount={amount}
        />

        <AmountSection amount={amount} setAmount={setAmount} isLoggedIn={isLoggedIn} disableAuth={disableAuth} accentColor={accentColor} />

        {disableAuth && blockedAnonAmount && (
          <Alert severity="warning" icon={<LockIcon />} sx={{ mb: 2 }}>
            Para doações acima de R$ 100, acesse a página principal:{" "}
            <Link to="/participe/apoiar" style={{ fontWeight: 600 }}>codaqui.dev/participe/apoiar</Link>.
          </Alert>
        )}

        {!disableAuth && requiresLogin && (
          <Alert severity="info" icon={<LockIcon />} sx={{ mb: 2 }}>
            Doações acima de R$ 100 requerem login para conformidade fiscal e transparência.{" "}
            <Box component="span" onClick={triggerLogin} sx={{ color: accentColor ?? "primary.main", cursor: "pointer", fontWeight: 700, textDecoration: "underline" }}>
              Entrar agora →
            </Box>
          </Alert>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <SummaryCard
          selected={selected} modeConfig={modeConfig} isRecurring={isRecurring} amountLabel={amountLabel}
          isLoggedIn={isLoggedIn} requiresLogin={requiresLogin} loading={loading} handleDonate={handleDonate}
          accentColor={accentColor} accentColorDark={accentColorDark}
        />

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
          Após o pagamento, o valor é registrado no{" "}
          <Link href="/transparencia">Portal de Transparência</Link>.{" "}
          {isRecurring && "Assinaturas podem ser canceladas pelo painel do Stripe."}
        </Typography>
      </Box>
    </>
  );
}

interface WalletListProps {
  readonly flow: ReturnType<typeof useDonationFlow>;
  readonly accentColor?: string;
}

function WalletList({ flow, accentColor }: WalletListProps): React.JSX.Element {
  const { balancesLoading, target, setTarget, getBalance, DONATION_TARGETS } = flow;

  return (
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
  );
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
  onCompanyClick,
}: DonationFlowProps): React.JSX.Element {
  const flow = useDonationFlow({
    lockedTargetId,
    hideWallets,
    disableAuth,
    authCommunitySlug,
  });
  const location = useLocation();
  const {
    stripeKey,
    checkoutOpen, setCheckoutOpen,
    clientSecret,
    donationSuccess, setDonationSuccess,
    handleCheckoutSuccess,
    showWalletsColumn,
    status,
  } = flow;

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
            <WalletList flow={flow} accentColor={accentColor} />
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <DonationForm
              title={title}
              subtitle={subtitle}
              accentColor={accentColor}
              accentColorDark={accentColorDark}
              onCompanyClick={onCompanyClick}
              flow={flow}
            />
          </Grid>
        </Grid>
      ) : (
        <Box sx={{ maxWidth: 720, mx: "auto" }}>
          <DonationForm
            title={title}
            subtitle={subtitle}
            accentColor={accentColor}
            accentColorDark={accentColorDark}
            onCompanyClick={onCompanyClick}
            flow={flow}
          />
        </Box>
      )}

      <StripeEmbeddedCheckoutDialog
        open={checkoutOpen}
        title="Finalizar Doação"
        clientSecret={clientSecret}
        stripeKey={stripeKey}
        onClose={() => setCheckoutOpen(false)}
        onComplete={handleCheckoutSuccess}
        missingKeyMessage="A chave pública do Stripe não está configurada (STRIPE_PUBLISHABLE_KEY indefinida)."
      />
    </>
  );
}

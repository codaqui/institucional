import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { communities } from "@site/src/data/communities";
import { useAuth } from "@site/src/hooks/useAuth";
import { resolveApiUrl } from "@site/src/lib/api-url";
import {
  buildCheckoutBody,
  requestCheckoutSession,
} from "./helpers";

export const PRESET_AMOUNTS = [
  { label: "R$ 10", cents: 1000 },
  { label: "R$ 25", cents: 2500 },
  { label: "R$ 50", cents: 5000 },
  { label: "R$ 100", cents: 10000 },
  { label: "R$ 200", cents: 20000 },
];

export type RecurringInterval = "month" | "year";
export type DonationMode = "once" | RecurringInterval;

export const DONATION_MODES: { value: DonationMode; label: string; description: string; recommended?: boolean }[] = [
  { value: "once", label: "Única", description: "Pagamento único, sem compromisso." },
  { value: "month", label: "Mensal", description: "Cobrança automática todo mês. Cancele quando quiser.", recommended: true },
  { value: "year", label: "Anual", description: "Cobrança anual com menor fricção." },
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

export interface WalletBalance {
  id: string;
  projectKey: string;
  name: string;
  balance: number;
}

export const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export interface UseDonationFlowOptions {
  readonly lockedTargetId?: string;
  readonly hideWallets?: boolean;
  readonly disableAuth?: boolean;
  readonly authCommunitySlug?: string;
}

export interface UseDonationFlowResult {
  readonly apiUrl: string;
  readonly stripeKey: string;
  readonly codaquiHomeUrl: string;
  readonly user: ReturnType<typeof useAuth>["user"];
  readonly ready: boolean;
  readonly isLoggedIn: boolean;
  readonly login: ReturnType<typeof useAuth>["login"];
  readonly authFetch: ReturnType<typeof useAuth>["authFetch"];
  readonly balances: WalletBalance[];
  readonly balancesLoading: boolean;
  readonly target: string;
  readonly setTarget: (target: string) => void;
  readonly amount: number;
  readonly setAmount: (amount: number) => void;
  readonly mode: DonationMode;
  readonly setMode: (mode: DonationMode) => void;
  readonly loading: boolean;
  readonly error: string | null;
  readonly anonymousAcknowledged: boolean;
  readonly setAnonymousAcknowledged: (value: boolean) => void;
  readonly checkoutOpen: boolean;
  readonly setCheckoutOpen: (value: boolean) => void;
  readonly clientSecret: string | null;
  readonly donationSuccess: boolean;
  readonly setDonationSuccess: (value: boolean) => void;
  readonly triggerLogin: () => void;
  readonly handleDonate: () => Promise<void>;
  readonly handleCheckoutSuccess: () => void;
  readonly getBalance: (targetId: string) => number;
  readonly selected: DonationTarget;
  readonly amountLabel: string;
  readonly isRecurring: boolean;
  readonly requiresLogin: boolean;
  readonly blockedAnonAmount: boolean;
  readonly formGated: boolean;
  readonly modeConfig: (typeof DONATION_MODES)[0];
  readonly showWalletsColumn: boolean;
  readonly status: string | null;
  readonly DONATION_TARGETS: typeof DONATION_TARGETS;
  readonly PRESET_AMOUNTS: typeof PRESET_AMOUNTS;
  readonly DONATION_MODES: typeof DONATION_MODES;
  readonly ANONYMOUS_LIMIT_CENTS: typeof ANONYMOUS_LIMIT_CENTS;
}

export function useDonationFlow({
  lockedTargetId,
  hideWallets = false,
  disableAuth = false,
  authCommunitySlug,
}: UseDonationFlowOptions): UseDonationFlowResult {
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

  const initialTarget = useMemo(
    () =>
      lockedTargetId && DONATION_TARGETS.some((t) => t.id === lockedTargetId)
        ? lockedTargetId
        : "tesouro-geral",
    [lockedTargetId],
  );

  const [target, setTarget] = useState<string>(initialTarget);
  const [amount, setAmount] = useState<number>(2500);
  const [mode, setMode] = useState<DonationMode>("month");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anonymousAcknowledged, setAnonymousAcknowledged] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [donationSuccess, setDonationSuccess] = useState(false);

  const formGated = !disableAuth && ready && !isLoggedIn && !anonymousAcknowledged;

  const selected = DONATION_TARGETS.find((t) => t.id === target) ?? TESOURO;
  const amountLabel = PRESET_AMOUNTS.find((a) => a.cents === amount)?.label ?? formatBRL(amount / 100);
  const isRecurring = mode !== "once";
  const requiresLogin = !disableAuth && amount > ANONYMOUS_LIMIT_CENTS && !isLoggedIn;
  const blockedAnonAmount = disableAuth && amount > ANONYMOUS_LIMIT_CENTS;

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

  const handleDonate = useCallback(async () => {
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
    const body = buildCheckoutBody({ amount, target, isRecurring, mode });
    const result = await requestCheckoutSession(authFetch, apiUrl, body);
    setLoading(false);
    if (result.kind === "auth-required") {
      setError("Login com GitHub é necessário para continuar.");
      return;
    }
    if (result.kind === "error") {
      setError(result.error ?? "Erro inesperado.");
      return;
    }
    if (result.kind === "client-secret" && result.clientSecret) {
      setClientSecret(result.clientSecret);
      setCheckoutOpen(true);
      return;
    }
    if (result.kind === "redirect" && result.url) {
      globalThis.location.href = result.url;
    }
  }, [blockedAnonAmount, requiresLogin, isLoggedIn, triggerLogin, amount, target, isRecurring, mode, authFetch, apiUrl]);

  const handleCheckoutSuccess = useCallback(() => {
    setCheckoutOpen(false);
    setDonationSuccess(true);
    setTimeout(fetchBalances, 3500);
  }, [fetchBalances]);

  const getBalance = useCallback(
    (targetId: string) => {
      const w = balances.find((b) => b.projectKey === targetId);
      return w ? w.balance : 0;
    },
    [balances],
  );

  const modeConfig = DONATION_MODES.find((m) => m.value === mode) ?? DONATION_MODES[0];
  const showWalletsColumn = !hideWallets && !lockedTargetId;

  return {
    apiUrl,
    stripeKey,
    codaquiHomeUrl,
    user,
    ready,
    isLoggedIn,
    login,
    authFetch,
    balances,
    balancesLoading,
    target,
    setTarget,
    amount,
    setAmount,
    mode,
    setMode,
    loading,
    error,
    anonymousAcknowledged,
    setAnonymousAcknowledged,
    checkoutOpen,
    setCheckoutOpen,
    clientSecret,
    donationSuccess,
    setDonationSuccess,
    triggerLogin,
    handleDonate,
    handleCheckoutSuccess,
    getBalance,
    selected,
    amountLabel,
    isRecurring,
    requiresLogin,
    blockedAnonAmount,
    formGated,
    modeConfig,
    showWalletsColumn,
    status,
    DONATION_TARGETS,
    PRESET_AMOUNTS,
    DONATION_MODES,
    ANONYMOUS_LIMIT_CENTS,
  };
}

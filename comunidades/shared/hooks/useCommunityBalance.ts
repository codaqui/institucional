import { useEffect, useState } from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { type CommunityBalance } from "@site/src/utils/transaction";
import { resolveApiUrl } from "@site/src/lib/api-url";

export interface UseCommunityBalanceResult {
  balance: CommunityBalance | null;
  loading: boolean;
  error: string | null;
  apiUrl: string;
}

export function useCommunityBalance(projectKey: string): UseCommunityBalanceResult {
  const { siteConfig } = useDocusaurusContext();
  const configuredApiUrl =
    typeof siteConfig.customFields?.apiUrl === "string"
      ? siteConfig.customFields.apiUrl
      : "http://localhost:3001";
  const apiUrl = resolveApiUrl(configuredApiUrl, siteConfig.url);

  const [balance, setBalance] = useState<CommunityBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiUrl}/ledger/community-balances`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: CommunityBalance[]) => {
        if (cancelled) return;
        const found = data.find((b) => b.projectKey === projectKey);
        setBalance(found ?? null);
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

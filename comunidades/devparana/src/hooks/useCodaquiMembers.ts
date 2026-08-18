import { useEffect, useState } from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { resolveApiUrl } from "@site/src/lib/api-url";

export interface CodaquiMember {
  id: string;
  githubHandle: string;
  name: string;
  avatarUrl: string;
  bio?: string | null;
  linkedinUrl?: string | null;
  roles: string[];
  joinedAt?: string;
}

interface MembersResponse {
  data: CodaquiMember[];
  total: number;
  page: number;
  totalPages: number;
}

interface UseCodaquiMembersResult {
  members: CodaquiMember[];
  loading: boolean;
  error: string | null;
}

interface UseCodaquiMembersBatchResult {
  members: CodaquiMember[];
  loading: boolean;
  error: string | null;
}

export function useCodaquiMembers(): UseCodaquiMembersResult {
  const { siteConfig } = useDocusaurusContext();
  const configuredApiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";
  const apiUrl = resolveApiUrl(configuredApiUrl, siteConfig.url);

  const [members, setMembers] = useState<CodaquiMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadMembers(): Promise<void> {
      try {
        const res = await fetch(`${apiUrl}/members?limit=100`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Erro ao carregar membros: ${res.status}`);
        }
        const payload = (await res.json()) as MembersResponse;
        if (active) {
          setMembers(payload.data ?? []);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          if (err instanceof Error && err.name === "AbortError") {
            return;
          }
          setError(err instanceof Error ? err.message : "Erro ao carregar membros.");
          setLoading(false);
        }
      }
    }

    void loadMembers();

    return () => {
      active = false;
      controller.abort();
    };
  }, [apiUrl]);

  return { members, loading, error };
}

export function useCodaquiMembersBatch(
  handles: string[],
): UseCodaquiMembersBatchResult {
  const { siteConfig } = useDocusaurusContext();
  const configuredApiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";
  const apiUrl = resolveApiUrl(configuredApiUrl, siteConfig.url);

  const [members, setMembers] = useState<CodaquiMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const identifiersKey = handles.join("|");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const normalizedHandles = handles.map((h) => h.trim()).filter(Boolean);

    if (normalizedHandles.length === 0) {
      setMembers([]);
      setLoading(false);
      return;
    }

    async function loadMembers(): Promise<void> {
      try {
        const res = await fetch(`${apiUrl}/members/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handles: normalizedHandles }),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Erro ao carregar membros: ${res.status}`);
        }
        const payload = (await res.json()) as { data: CodaquiMember[] };
        if (active) {
          setMembers(payload.data ?? []);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          if (err instanceof Error && err.name === "AbortError") {
            return;
          }
          setError(err instanceof Error ? err.message : "Erro ao carregar membros.");
          setLoading(false);
        }
      }
    }

    void loadMembers();

    return () => {
      active = false;
      controller.abort();
    };
  }, [apiUrl, identifiersKey]);

  return { members, loading, error };
}

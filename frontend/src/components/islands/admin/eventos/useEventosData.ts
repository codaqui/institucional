/**
 * Hooks de dados do hub de eventos — port de `src/pages/admin/eventos.tsx`
 * (Docusaurus). `authFetch` recebe path (o hook `useAuth` do Astro já
 * prefixa `API_URL`); `${apiUrl}/...` virou `"/..."`.
 */

import { useCallback, useState } from "react";
import type { EventIndexFile, EventSummary } from "../../../../lib/events";
import { fetchEventsIndexMerged } from "../../../../lib/events-api";
import { parseAuthJson, extractErrorMessage } from "../../../../lib/auth-fetch-helpers";
import {
  PAGE_SIZE,
  type ExternalActivationItem,
  type ManagedEvent,
  type MemberOption,
  type OrganizersStaticFile,
  type SnapshotResult,
} from "./types";

export interface UseAdminEventosDataReturn {
  events: ManagedEvent[];
  setEvents: React.Dispatch<React.SetStateAction<ManagedEvent[]>>;
  internalTotal: number;
  setInternalTotal: React.Dispatch<React.SetStateAction<number>>;
  members: MemberOption[];
  loading: boolean;
  loadError: string;
  setLoadError: React.Dispatch<React.SetStateAction<string>>;
  externalEvents: EventSummary[];
  setExternalEvents: React.Dispatch<React.SetStateAction<EventSummary[]>>;
  externalSources: EventIndexFile["sources"];
  setExternalSources: React.Dispatch<React.SetStateAction<EventIndexFile["sources"]>>;
  externalLoading: boolean;
  externalError: string;
  setExternalError: React.Dispatch<React.SetStateAction<string>>;
  organizers: OrganizersStaticFile | null;
  setOrganizers: React.Dispatch<React.SetStateAction<OrganizersStaticFile | null>>;
  activations: ExternalActivationItem[];
  setActivations: React.Dispatch<React.SetStateAction<ExternalActivationItem[]>>;
  fetchEvents: (pageNum: number, useBackendPagination: boolean) => Promise<void>;
  fetchMembers: () => Promise<void>;
  fetchExternalData: () => Promise<void>;
  fetchOrganizers: () => Promise<void>;
  fetchActivations: () => Promise<void>;
}

export function useAdminEventosData(
  apiUrl: string,
  authFetch: (path: string, init?: RequestInit) => Promise<Response>,
): UseAdminEventosDataReturn {
  const [events, setEvents] = useState<ManagedEvent[]>([]);
  const [internalTotal, setInternalTotal] = useState(0);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [externalEvents, setExternalEvents] = useState<EventSummary[]>([]);
  const [externalSources, setExternalSources] = useState<EventIndexFile["sources"]>([]);
  const [externalLoading, setExternalLoading] = useState(true);
  const [externalError, setExternalError] = useState("");

  const [organizers, setOrganizers] = useState<OrganizersStaticFile | null>(null);
  const [activations, setActivations] = useState<ExternalActivationItem[]>([]);

  const fetchEvents = useCallback(
    async (pageNum: number, useBackendPagination: boolean) => {
      setLoading(true);
      setLoadError("");
      try {
        const url = useBackendPagination
          ? `/events?page=${pageNum}&limit=${PAGE_SIZE}`
          : `/events`;
        const res = await authFetch(url);
        if (useBackendPagination) {
          const data = await parseAuthJson<{
            events: ManagedEvent[];
            total: number;
            page: number;
            limit: number;
          }>(res, setLoadError);
          if (data) {
            setEvents(data.events);
            setInternalTotal(data.total);
          }
        } else {
          const data = await parseAuthJson<ManagedEvent[]>(res, setLoadError);
          if (data) setEvents(data);
          setInternalTotal(0);
        }
      } catch {
        setLoadError("Não foi possível carregar os eventos (backend indisponível).");
      } finally {
        setLoading(false);
      }
    },
    [authFetch],
  );

  const fetchMembers = useCallback(async () => {
    try {
      const res = await authFetch(`/admin/members`);
      if (res.ok) {
        const data = (await res.json()) as MemberOption[];
        setMembers(Array.isArray(data) ? data : []);
      }
    } catch {
      /* sem acesso à lista de membros — staff ainda pode ser removido */
    }
  }, [authFetch]);

  const fetchExternalData = useCallback(async () => {
    setExternalLoading(true);
    try {
      const data = await fetchEventsIndexMerged(apiUrl);
      setExternalEvents((data.events ?? []).filter((e) => e.source !== "internal"));
      setExternalSources((data.sources ?? []).filter((s) => s.source !== "internal"));
    } catch {
      setExternalError("Não foi possível carregar os eventos externos (snapshot estático).");
    } finally {
      setExternalLoading(false);
    }
  }, [apiUrl]);

  const fetchOrganizers = useCallback(async () => {
    try {
      const res = await authFetch("/events/organizers");
      if (!res.ok) return;
      setOrganizers((await res.json()) as OrganizersStaticFile);
    } catch {
      /* ownership indisponível */
    }
  }, [authFetch]);

  const fetchActivations = useCallback(async () => {
    try {
      const res = await authFetch(`/events/external/activations`);
      if (!res.ok) return;
      const data = (await res.json()) as ExternalActivationItem[];
      setActivations(Array.isArray(data) ? data : []);
    } catch {
      /* features externas são um plus do hub */
    }
  }, [authFetch]);

  return {
    events,
    setEvents,
    internalTotal,
    setInternalTotal,
    members,
    loading,
    loadError,
    setLoadError,
    externalEvents,
    setExternalEvents,
    externalSources,
    setExternalSources,
    externalLoading,
    externalError,
    setExternalError,
    organizers,
    setOrganizers,
    activations,
    setActivations,
    fetchEvents,
    fetchMembers,
    fetchExternalData,
    fetchOrganizers,
    fetchActivations,
  };
}

export interface UseAdminEventosSnapshotReturn {
  snapshotLoading: boolean;
  snapshotError: string;
  setSnapshotError: React.Dispatch<React.SetStateAction<string>>;
  snapshotResult: SnapshotResult | null;
  setSnapshotResult: React.Dispatch<React.SetStateAction<SnapshotResult | null>>;
  handleSnapshot: () => Promise<void>;
}

export function useAdminEventosSnapshot(
  authFetch: (path: string, init?: RequestInit) => Promise<Response>,
): UseAdminEventosSnapshotReturn {
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState("");
  const [snapshotResult, setSnapshotResult] = useState<SnapshotResult | null>(null);

  const handleSnapshot = useCallback(async () => {
    setSnapshotLoading(true);
    setSnapshotError("");
    setSnapshotResult(null);
    try {
      const res = await authFetch(`/events/internal/snapshot`, { method: "POST" });
      if (!res.ok) {
        setSnapshotError(await extractErrorMessage(res, "Erro ao sincronizar o snapshot."));
        return;
      }
      const data = (await res.json()) as {
        skipped?: boolean;
        prUrl?: string;
        prNumber?: number;
      };
      if (!data.skipped && data.prUrl) {
        setSnapshotResult({ prUrl: data.prUrl, prNumber: data.prNumber ?? null });
      } else {
        setSnapshotResult("skipped");
      }
    } catch {
      setSnapshotError("Erro inesperado ao sincronizar o snapshot.");
    } finally {
      setSnapshotLoading(false);
    }
  }, [authFetch]);

  return {
    snapshotLoading,
    snapshotError,
    setSnapshotError,
    snapshotResult,
    setSnapshotResult,
    handleSnapshot,
  };
}

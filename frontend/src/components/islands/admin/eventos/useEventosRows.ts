/**
 * Hook de montagem das linhas do hub (filtros, paginação, badges de
 * ownership/ativação) — port de `src/pages/admin/eventos.tsx` (Docusaurus).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { EventIndexFile, EventSummary } from "../../../../lib/events";
import type { AuthUser } from "../../../../lib/auth-client";
import {
  matchesCommunityFilter,
  matchesEditableFilter,
  matchesFeaturesFilter,
  matchesKindFilter,
  matchesOverrideFilter,
  matchesSearch,
  PAGE_SIZE,
  type ExternalActivationItem,
  type HubRow,
  type ManagedEvent,
  type OrganizersStaticFile,
} from "./types";

export interface UseAdminEventosRowsParams {
  events: ManagedEvent[];
  externalEvents: EventSummary[];
  externalSources: EventIndexFile["sources"];
  activations: ExternalActivationItem[];
  organizers: OrganizersStaticFile | null;
  user: AuthUser | null;
  isAdmin: boolean;
  internalTotal: number;
}

export interface UseAdminEventosRowsReturn {
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  showInternos: boolean;
  setShowInternos: React.Dispatch<React.SetStateAction<boolean>>;
  showExternos: boolean;
  setShowExternos: React.Dispatch<React.SetStateAction<boolean>>;
  onlyOverride: boolean;
  setOnlyOverride: React.Dispatch<React.SetStateAction<boolean>>;
  onlyEditable: boolean;
  setOnlyEditable: React.Dispatch<React.SetStateAction<boolean>>;
  onlyFeatures: boolean;
  setOnlyFeatures: React.Dispatch<React.SetStateAction<boolean>>;
  communityFilter: string;
  setCommunityFilter: React.Dispatch<React.SetStateAction<string>>;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  rows: HubRow[];
  filteredRows: HubRow[];
  pageCount: number;
  currentPage: number;
  pageRows: HubRow[];
  sourceLabel: (sourceKey: string) => string;
  useBackendPagination: boolean;
}

export function useAdminEventosRows({
  events,
  externalEvents,
  externalSources,
  activations,
  organizers,
  user,
  isAdmin,
  internalTotal,
}: UseAdminEventosRowsParams): UseAdminEventosRowsReturn {
  const [search, setSearch] = useState("");
  const [showInternos, setShowInternos] = useState(false);
  const [showExternos, setShowExternos] = useState(false);
  const [onlyOverride, setOnlyOverride] = useState(false);
  const [onlyEditable, setOnlyEditable] = useState(!isAdmin);
  const [onlyFeatures, setOnlyFeatures] = useState(false);
  const [communityFilter, setCommunityFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  const useBackendPagination = showInternos && !showExternos;

  useEffect(() => {
    setPage(1);
  }, [
    search,
    showInternos,
    showExternos,
    onlyOverride,
    onlyEditable,
    onlyFeatures,
    communityFilter,
  ]);

  const featuresByEventKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of activations) map.set(a.eventKey, a.features ?? []);
    return map;
  }, [activations]);

  const activationByEventKey = useMemo(() => {
    const map = new Map<string, ExternalActivationItem>();
    for (const a of activations) map.set(a.eventKey, a);
    return map;
  }, [activations]);

  const ownerByEventKey = useMemo(() => {
    const map = new Map<string, string>();
    if (!organizers) return map;
    for (const o of organizers.ownerships) {
      for (const scope of o.scope) {
        if (map.has(scope)) continue;
        map.set(scope, o.githubHandle);
      }
    }
    return map;
  }, [organizers]);

  const myScopes = useMemo(() => {
    if (!organizers || !user) return [] as string[];
    const handle = (user.handle ?? "").toLowerCase();
    return organizers.ownerships
      .filter((o) => o.memberId === user.sub || o.githubHandle.toLowerCase() === handle)
      .flatMap((o) => o.scope);
  }, [organizers, user]);

  const canEditExternal = useCallback(
    (ev: EventSummary) =>
      isAdmin ||
      myScopes.includes(`${ev.sourceKey}:${ev.id}`) ||
      myScopes.includes(`${ev.sourceKey}:*`),
    [isAdmin, myScopes],
  );

  const sourceLabel = useCallback(
    (sourceKey: string) => {
      const s = externalSources.find((x) => x.sourceKey === sourceKey);
      return s ? `${s.emoji} ${s.label}` : sourceKey;
    },
    [externalSources],
  );

  const rows = useMemo<HubRow[]>(() => {
    const internalRows: HubRow[] = events.map((event) => ({
      kind: "internal",
      key: `internal:${event.id}`,
      title: event.title,
      startAt: event.startAt,
      hasOverride: false,
      canEdit: true,
      features: [],
      event,
    }));
    const externalRows: HubRow[] = externalEvents.map((event) => {
      const eventKey = `${event.sourceKey}:${event.id}`;
      const activation = activationByEventKey.get(eventKey);
      return {
        kind: "external",
        key: `external:${eventKey}`,
        title: event.title,
        startAt: event.startAt,
        hasOverride: !!event.hasOverride,
        canEdit: canEditExternal(event),
        features: featuresByEventKey.get(eventKey) ?? [],
        communityProjectKey: activation?.communityProjectKey,
        ownerHandle: ownerByEventKey.get(eventKey),
        event,
      };
    });
    return [...internalRows, ...externalRows].sort((a, b) =>
      b.startAt.localeCompare(a.startAt),
    );
  }, [
    events,
    externalEvents,
    canEditExternal,
    featuresByEventKey,
    activationByEventKey,
    ownerByEventKey,
  ]);

  const matchesFilters = useCallback(
    (row: HubRow) =>
      matchesSearch(row, search) &&
      matchesKindFilter(row, showInternos, showExternos) &&
      matchesOverrideFilter(row, onlyOverride) &&
      matchesEditableFilter(row, onlyEditable) &&
      matchesFeaturesFilter(row, onlyFeatures) &&
      matchesCommunityFilter(row, communityFilter),
    [
      search,
      showInternos,
      showExternos,
      onlyOverride,
      onlyEditable,
      onlyFeatures,
      communityFilter,
    ],
  );

  const filteredRows = useMemo(() => rows.filter(matchesFilters), [rows, matchesFilters]);

  const pageCount = useBackendPagination
    ? Math.max(1, Math.ceil(internalTotal / PAGE_SIZE))
    : Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = useBackendPagination
    ? filteredRows
    : filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return {
    search,
    setSearch,
    showInternos,
    setShowInternos,
    showExternos,
    setShowExternos,
    onlyOverride,
    setOnlyOverride,
    onlyEditable,
    setOnlyEditable,
    onlyFeatures,
    setOnlyFeatures,
    communityFilter,
    setCommunityFilter,
    page,
    setPage,
    rows,
    filteredRows,
    pageCount,
    currentPage,
    pageRows,
    sourceLabel,
    useBackendPagination,
  };
}

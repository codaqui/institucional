/**
 * Port de `src/pages/admin/overrides.tsx` (Docusaurus) — painel de eventos
 * externos: overrides de metadados (salvos no banco de dados), mapeamento de
 * organizers e ativação de features. Shell de título/navegação fica no
 * AppLayout (astro).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import MuiIslandProvider from "../../MuiIslandProvider";
import PageContainer from "../ui/PageContainer";
import TabPanel from "../ui/TabPanel";
import ActivationTab from "./ActivationTab";
import OrganizersTab from "./OrganizersTab";
import OverridesTab from "./OverridesTab";
import { useAuth } from "../../../../lib/use-auth";
import { API_URL } from "../../../../lib/config";
import {
  EVENTS_MANIFEST_URL,
  type EventIndexFile,
  type EventSummary,
} from "../../../../lib/events";

function OverridesAppInner(): JSX.Element {
  const {
    ready,
    isLoggedIn,
    isAdmin,
    isFinanceAnalyzer,
    isEventFinance,
    isEventOrganizer,
    authFetch,
  } = useAuth();
  const canAccess = isAdmin || isEventOrganizer;
  const canReimburse = isAdmin || isFinanceAnalyzer || isEventFinance;

  const apiUrl = API_URL;

  const [tab, setTab] = useState(0);
  const [eventsIndex, setEventsIndex] = useState<EventIndexFile | null>(null);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [preselect, setPreselect] = useState<{ sourceKey: string; eventId: string } | null>(null);

  // Deep-link: /admin/overrides?tab=N&sourceKey=<source:sourceId>&eventId=<id>
  // (padrão window.location.search, igual a eventos-checkin).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = Number.parseInt(params.get("tab") ?? "", 10);
    if (!Number.isNaN(tabParam) && tabParam >= 0 && tabParam <= 2) setTab(tabParam);
    const sourceKey = params.get("sourceKey");
    const eventId = params.get("eventId");
    if (sourceKey && eventId) setPreselect({ sourceKey, eventId });
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !canAccess) {
      window.location.replace("/");
    }
  }, [ready, isLoggedIn, canAccess]);

  // Aba 1 (Organizers) é admin-only — deep-link para ela cai na aba 0.
  useEffect(() => {
    if (ready && !isAdmin && tab === 1) setTab(0);
  }, [ready, isAdmin, tab]);

  useEffect(() => {
    if (!ready || !isLoggedIn || !canAccess) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(EVENTS_MANIFEST_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as EventIndexFile;
        if (!cancelled) setEventsIndex(data);
      } catch {
        if (!cancelled) setLoadError("Não foi possível carregar a lista de eventos externos.");
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, isLoggedIn, canAccess]);

  const externalEvents = useMemo(
    () => (eventsIndex?.events ?? []).filter((e) => e.source !== "internal"),
    [eventsIndex],
  );
  const externalSources = useMemo(
    () => (eventsIndex?.sources ?? []).filter((s) => s.source !== "internal"),
    [eventsIndex],
  );
  const sourceLabel = useCallback(
    (sourceKey: string) => {
      const s = eventsIndex?.sources.find((x) => x.sourceKey === sourceKey);
      return s ? `${s.emoji} ${s.label}` : sourceKey;
    },
    [eventsIndex],
  );

  // Pré-seleção via query string: procura o evento no index; se não achar, ignora.
  const preselectedEvent = useMemo<EventSummary | null>(
    () =>
      preselect
        ? externalEvents.find(
            (e) => e.sourceKey === preselect.sourceKey && e.id === preselect.eventId,
          ) ?? null
        : null,
    [preselect, externalEvents],
  );

  if (!ready || !isLoggedIn || !canAccess) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <PageContainer>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" component="h2" sx={{ fontWeight: 800 }}>
          Eventos Externos
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Overrides de metadados (salvos no banco de dados), mapeamento de organizers e ativação
          de features em eventos externos
        </Typography>
      </Box>

      {loadError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {loadError}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Override de metadados" />
        <Tab label="Organizers" disabled={!isAdmin} />
        <Tab label="Ativação de features" />
      </Tabs>

      {eventsLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TabPanel value={tab} index={0}>
            <OverridesTab
              authFetch={authFetch}
              events={externalEvents}
              sourceLabel={sourceLabel}
              initialSelected={preselectedEvent}
            />
          </TabPanel>
          <TabPanel value={tab} index={1}>
            {isAdmin ? (
              <OrganizersTab authFetch={authFetch} sources={externalSources} />
            ) : (
              <Alert severity="warning">Somente admins podem gerenciar organizers.</Alert>
            )}
          </TabPanel>
          <TabPanel value={tab} index={2}>
            <ActivationTab
              apiUrl={apiUrl}
              authFetch={authFetch}
              events={externalEvents}
              sourceLabel={sourceLabel}
              initialSelected={preselectedEvent}
              canReimburse={canReimburse}
            />
          </TabPanel>
        </>
      )}
    </PageContainer>
  );
}

export default function OverridesApp(): JSX.Element {
  return (
    <MuiIslandProvider>
      <OverridesAppInner />
    </MuiIslandProvider>
  );
}

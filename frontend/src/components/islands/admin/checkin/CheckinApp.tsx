/**
 * Ilha de /admin/eventos-checkin — check-in mobile-first (QR/câmera + busca
 * manual) para eventos internos e externos.
 * Port de `src/pages/admin/eventos-checkin.tsx` (Docusaurus) para Astro:
 * `useHistory` → `window.location.replace`, `Layout`/`AdminPageContainer` →
 * `PageContainer` (o h1 fica na topbar do AppLayout — aqui começa em h2).
 *
 * Internos e externos filtram e paginam no backend. Deep-link
 * `?event=<id|external:<eventKey>>` pré-seleciona o evento.
 * A câmera exige HTTPS (mkcert local — ver DEVELOPMENT.md).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import MuiIslandProvider from "../../MuiIslandProvider";
import PageContainer from "../ui/PageContainer";
import QrScannerPanel from "./QrScannerPanel";
import ManualSearch, { type BatchCheckinResult } from "./ManualSearch";
import CertificateCenter from "./CertificateCenter";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import type {
  CertificateFilter,
  CertificateInviteBatch,
  CertificateInviteBatchProgress,
  CheckinResult,
  EventRegistration,
  ExternalActivationItem,
  ManagedEvent,
} from "./types";
import { CHECKIN_PAGE_SIZE, type PaginatedResponse } from "../../../../lib/pagination";
import {
  CAMERA_START_TIMEOUT_MS,
  EXTERNAL_PREFIX,
  formatDateTime,
  isCameraAvailable,
  translateCameraError,
  withTimeout,
} from "./checkin-utils";
import { useAuth } from "../../../../lib/use-auth";
import {
  parseAuthJson,
  extractErrorMessage,
} from "../../../../lib/auth-fetch-helpers";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

function CheckinInner(): React.JSX.Element {
  const { ready, isLoggedIn, authFetch } = useAuth();

  const [events, setEvents] = useState<ManagedEvent[]>([]);
  const [externalActivations, setExternalActivations] = useState<
    ExternalActivationItem[]
  >([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");

  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [regsLoading, setRegsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [registrationsPage, setRegistrationsPage] = useState(1);
  const [registrationsTotal, setRegistrationsTotal] = useState(0);
  const [registrationsTotalPages, setRegistrationsTotalPages] = useState(0);
  const [certificateFilter, setCertificateFilter] = useState<CertificateFilter>("all");

  const [manualToken, setManualToken] = useState("");
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [activeTab, setActiveTab] = useState<"scan" | "participants" | "certificates">("scan");

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  // qr-scanner instance — gerencia câmera, WebWorker e BarcodeDetector nativamente
  const scannerRef = useRef<QrScanner | null>(null);
  // Cooldown: evita repostar o mesmo token em scans consecutivos (3s)
  const lastScanRef = useRef<{ token: string; at: number } | null>(null);

  const cameraSupported = isCameraAvailable();

  // O escopo do backend habilita a lista por evento; o checker global sem staff
  // local permanece restrito ao scanner.
  const selectedManaged = events.find((e) => e.id === selectedEventId);
  const selectedExternal = externalActivations.find(
    (a) => `${EXTERNAL_PREFIX}${a.eventKey}` === selectedEventId,
  );
  const canUseList = !!(selectedManaged?.canUseList ?? selectedExternal?.canUseList);
  const canCheckinSelected =
    !!selectedManaged || !!selectedExternal?.features.includes("checkin");
  const canCertificateSelected =
    !!selectedManaged || !!selectedExternal?.features.includes("certificates");

  // ── Data loading ──────────────────────────────────────────────────────────

  const fetchRegistrations = useCallback(
    async (selection: string, query: string, page = 1, filter: CertificateFilter = "all") => {
      setRegsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(CHECKIN_PAGE_SIZE),
          certificateFilter: filter,
        });
        if (query.trim()) params.set("search", query.trim());
        const path = selection.startsWith(EXTERNAL_PREFIX)
          ? `/events/external/${encodeURIComponent(selection.slice(EXTERNAL_PREFIX.length))}/participants`
          : `/events/${selection}/registrations`;
        const res = await authFetch(`${path}?${params.toString()}`);
        const data = await parseAuthJson<EventRegistration[] | PaginatedResponse<EventRegistration>>(res, setLoadError);
        if (!data) return;
        const list = Array.isArray(data) ? data : data.data;
        setRegistrations(Array.isArray(list) ? list : []);
        setRegistrationsPage(Array.isArray(data) ? 1 : data.page);
        setRegistrationsTotal(Array.isArray(data) ? list.length : data.total);
        setRegistrationsTotalPages(Array.isArray(data) ? 1 : data.totalPages);
      } catch {
        setLoadError("Erro inesperado ao carregar inscrições.");
      } finally {
        setRegsLoading(false);
      }
    },
    [authFetch],
  );

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn) {
      window.location.replace("/");
      return;
    }
    void (async () => {
      setEventsLoading(true);
      try {
        const res = await authFetch("/events/checkin-scope");
        const data = await parseAuthJson<{
          managed?: ManagedEvent[];
          external?: ExternalActivationItem[];
        }>(res, setLoadError);
        if (!data) return;
        const manageable = (Array.isArray(data.managed) ? data.managed : []).filter(
          (e) => e.status !== "canceled" && e.status !== "cancelled",
        );
        setEvents(manageable);

        const externals = (Array.isArray(data.external) ? data.external : []).filter(
          (a) =>
            (a.features ?? []).includes("checkin") ||
            (a.features ?? []).includes("certificates"),
        );
        setExternalActivations(externals);

        // Seletor via query string: /admin/eventos-checkin?event=<id|external:<eventKey>>
        const params = new URLSearchParams(
          typeof window === "undefined" ? "" : window.location.search,
        );
        const fromQuery = params.get("event");
        if (fromQuery) {
          const isValidExternal =
            fromQuery.startsWith(EXTERNAL_PREFIX) &&
            externals.some((a) => a.eventKey === fromQuery.slice(EXTERNAL_PREFIX.length));
          const isValidInternal = manageable.some((e) => e.id === fromQuery);
          if (isValidExternal || isValidInternal) {
            setSelectedEventId(fromQuery);
          }
        }
      } catch {
        setLoadError("Erro inesperado ao carregar eventos.");
      } finally {
        setEventsLoading(false);
      }
    })();
  }, [ready, isLoggedIn, authFetch]);

  // Carrega a primeira página e os contadores locais ao trocar de evento
  useEffect(() => {
    if (!selectedEventId || !canUseList) {
      setRegistrations([]);
      setRegsLoading(false);
      return;
    }
    setResult(null);
    setRegistrations([]);
    setSearchQuery("");
    setCertificateFilter("all");
    fetchRegistrations(selectedEventId, "");
  }, [selectedEventId, canUseList, fetchRegistrations]);

  useEffect(() => {
    if (!selectedEventId) return;
    setActiveTab(canCheckinSelected || !canCertificateSelected ? "scan" : "certificates");
  }, [selectedEventId, canCheckinSelected, canCertificateSelected]);

  // ── Check-in ─────────────────────────────────────────────────────────────

  const handleCheckin = useCallback(
    async (token: string) => {
      const trimmed = token.trim();
      if (!trimmed || !selectedEventId || checkinLoading) return;
      const isExternal = selectedEventId.startsWith(EXTERNAL_PREFIX);
      const checkinUrl = isExternal
        ? `/events/external/${encodeURIComponent(selectedEventId.slice(EXTERNAL_PREFIX.length))}/checkin`
        : `/events/${selectedEventId}/checkin`;
      setCheckinLoading(true);
      setActiveTab("scan");
      try {
        const res = await authFetch(checkinUrl, {
          method: "POST",
          body: JSON.stringify({ token: trimmed }),
        });
        if (res.status === 404) {
          setResult({ kind: "invalid", message: "Token inválido — inscrição não encontrada." });
          return;
        }
        if (!res.ok) {
          setResult({
            kind: "invalid",
            message: await extractErrorMessage(res, "Erro ao confirmar presença."),
          });
          return;
        }
        const data = (await res.json()) as {
          status: "checked_in" | "already_checked_in";
          registration: {
            attendeeName: string;
            attendeeEmail: string;
            checkedInAt: string | null;
          };
        };
        if (data.status === "already_checked_in") {
          setResult({
            kind: "already_checked_in",
            attendeeName: data.registration?.attendeeName,
            checkedInAt: data.registration?.checkedInAt,
            message: `${data.registration?.attendeeName ?? "Participante"} já teve a presença confirmada.`,
          });
        } else {
          setResult({
            kind: "checked_in",
            attendeeName: data.registration?.attendeeName,
            checkedInAt: data.registration?.checkedInAt,
            message: `Presença confirmada: ${data.registration?.attendeeName ?? "participante"}.`,
          });
        }
        // Atualiza a página e os contadores locais sem bloquear o fluxo da porta
        if (canUseList) {
          fetchRegistrations(selectedEventId, searchQuery, registrationsPage, certificateFilter);
        }
      } catch {
        setResult({ kind: "invalid", message: "Erro inesperado ao confirmar presença." });
      } finally {
        setCheckinLoading(false);
        setManualToken("");
      }
    },
    [
      authFetch,
      selectedEventId,
      checkinLoading,
      canUseList,
      fetchRegistrations,
      searchQuery,
    ],
  );

  const handleBatchCheckin = useCallback(
    async (tokens: string[]): Promise<BatchCheckinResult[]> => {
      const isExternal = selectedEventId.startsWith(EXTERNAL_PREFIX);
      const url = isExternal
        ? `/events/external/${encodeURIComponent(selectedEventId.slice(EXTERNAL_PREFIX.length))}/checkin/batch`
        : `/events/${selectedEventId}/checkin/batch`;
      const res = await authFetch(url, {
        method: "POST",
        body: JSON.stringify({ tokens }),
      });
      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, "Erro ao confirmar presenças em lote."));
      }
      const results = (await res.json()) as BatchCheckinResult[];
      await fetchRegistrations(selectedEventId, searchQuery, registrationsPage, certificateFilter);
      return results;
    },
    [authFetch, certificateFilter, fetchRegistrations, registrationsPage, searchQuery, selectedEventId],
  );

  const handleGrantCertificate = useCallback(
    async (registrationId: string): Promise<EventRegistration> => {
      const res = await authFetch(`/events/registrations/${registrationId}/certificate/grant`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, "Erro ao conceder certificado."));
      }
      const updated = (await res.json()) as EventRegistration;
      setRegistrations((current) =>
        current.map((registration) =>
          registration.id === registrationId ? { ...registration, ...updated } : registration,
        ),
      );
      return updated;
    },
    [authFetch],
  );

  const handleInviteCertificates = useCallback(
    async (registrationIds: string[]): Promise<CertificateInviteBatch> => {
      const res = await authFetch("/events/certificate-invites/batch", {
        method: "POST",
        body: JSON.stringify({ registrationIds }),
      });
      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, "Erro ao enfileirar convites."));
      }
      return (await res.json()) as CertificateInviteBatch;
    },
    [authFetch],
  );

  const loadCertificateInviteBatch = useCallback(
    async (batchId: string): Promise<CertificateInviteBatchProgress> => {
      const res = await authFetch(`/events/certificate-invites/batches/${batchId}`);
      const data = await parseAuthJson<CertificateInviteBatchProgress>(res, setLoadError);
      if (!data) throw new Error("Não foi possível carregar o lote.");
      return data;
    },
    [authFetch],
  );

  const refreshCertificates = useCallback(
    () => fetchRegistrations(selectedEventId, searchQuery, registrationsPage, certificateFilter),
    [fetchRegistrations, selectedEventId, searchQuery, registrationsPage, certificateFilter],
  );

  // ── Câmera (qr-scanner by Nimiq) ─────────────────────────────────────────

  const stopCamera = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (cameraStarting || !videoRef.current) return;
    setCameraStarting(true);
    setCameraError("");
    try {
      // Verifica se o dispositivo tem câmera antes de instanciar
      const hasCamera = await withTimeout(QrScanner.hasCamera(), CAMERA_START_TIMEOUT_MS);
      if (!hasCamera) {
        setCameraError("Nenhuma câmera encontrada neste dispositivo.");
        return;
      }

      const scanner = new QrScanner(
        videoRef.current,
        (scanResult) => {
          const token = scanResult.data;
          const last = lastScanRef.current;
          const now = Date.now();
          // Cooldown de 3s: ignora leitura duplicada do mesmo token
          if (last?.token !== token || now - (last?.at ?? 0) > 3000) {
            lastScanRef.current = { token, at: now };
            handleCheckin(token);
          }
        },
        {
          // Câmera traseira preferencial (padrão mobile)
          preferredCamera: "environment",
          // Destaca visualmente a região de scan e o contorno do QR lido
          highlightScanRegion: true,
          highlightCodeOutline: true,
          returnDetailedScanResult: true,
          // Amostragem: até 5 scans/s é suficiente para check-in em porta
          maxScansPerSecond: 5,
          onDecodeError: () => {
            // Silencia erros de frame sem QR — comportamento normal durante o scan
          },
        },
      );

      scannerRef.current = scanner;
      await withTimeout(scanner.start(), CAMERA_START_TIMEOUT_MS);
      setCameraActive(true);
    } catch (err) {
      setCameraError(translateCameraError(err));
      stopCamera();
    } finally {
      setCameraStarting(false);
    }
  }, [handleCheckin, stopCamera, cameraStarting]);

  // Para câmera ao desmontar ou ao trocar de evento
  useEffect(() => () => stopCamera(), [stopCamera]);
  useEffect(() => {
    if (selectedEventId) stopCamera();
  }, [selectedEventId, stopCamera]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!ready || !isLoggedIn) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  const hasManagedSelection = events.some((e) => e.id === selectedEventId);
  const selectedExternalKey = selectedEventId.startsWith(EXTERNAL_PREFIX)
    ? selectedEventId.slice(EXTERNAL_PREFIX.length)
    : null;
  const hasSelection = !!(hasManagedSelection || selectedExternalKey);
  const presentCount = registrations.filter((r) => r.checkedInAt).length;

  return (
    <PageContainer sx={{ maxWidth: { xs: "100%", md: 960 } }}>
      <Typography component="h2" variant="h4" sx={{ fontWeight: 800 }} gutterBottom>
        Check-in
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Confirme presenças e gerencie certificados dos participantes.
      </Typography>

      {loadError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {loadError}
        </Alert>
      )}

      <FormControl fullWidth sx={{ mb: 2 }} disabled={eventsLoading}>
        <InputLabel>Evento</InputLabel>
        <Select
          value={selectedEventId}
          label="Evento"
          onChange={(event) => setSelectedEventId(event.target.value)}
        >
          {events.length > 0 && <ListSubheader>Eventos próprios</ListSubheader>}
          {events.map((ev) => (
            <MenuItem key={ev.id} value={ev.id}>
              {ev.title} — {formatDateTime(ev.startAt)}
            </MenuItem>
          ))}
          {externalActivations.length > 0 && (
            <ListSubheader>Eventos externos</ListSubheader>
          )}
          {externalActivations.map((a) => (
            <MenuItem key={a.eventKey} value={`${EXTERNAL_PREFIX}${a.eventKey}`}>
              {a.title || a.eventKey} (externo)
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {!eventsLoading && events.length === 0 && externalActivations.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Nenhum evento gerenciável encontrado.
        </Alert>
      )}

      {hasSelection && (
        <>
          {canUseList && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
              <Chip
                icon={<CheckCircleIcon />}
                label={`${presentCount} presente${presentCount === 1 ? "" : "s"} nesta página`}
                color="success"
                variant="outlined"
              />
              <Chip
                label={`${registrations.length} inscrito${registrations.length === 1 ? "" : "s"} nesta página`}
                variant="outlined"
              />
            </Box>
          )}

          <Tabs
            value={activeTab}
            onChange={(_, value) => setActiveTab(value as typeof activeTab)}
            aria-label="Fluxos de presença e certificados"
            variant="scrollable"
            allowScrollButtonsMobile
            sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
          >
            {canCheckinSelected && <Tab value="scan" label="Escanear" />}
            {canUseList && <Tab value="participants" label="Participantes" />}
            {canUseList && canCertificateSelected && (
              <Tab value="certificates" label="Certificados" />
            )}
          </Tabs>

          {activeTab === "scan" && canCheckinSelected && (
            <Box role="tabpanel" aria-label="Escanear">
              {result?.kind === "checked_in" && (
                <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
                  {result.message}
                  {result.checkedInAt && ` (${formatDateTime(result.checkedInAt)})`}
                </Alert>
              )}
              {result?.kind === "already_checked_in" && (
                <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
                  {result.message}
                  {result.checkedInAt &&
                    ` Check-in original: ${formatDateTime(result.checkedInAt)}.`}
                </Alert>
              )}
              {result?.kind === "invalid" && (
                <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 2 }}>
                  {result.message}
                </Alert>
              )}

              <QrScannerPanel
                cameraSupported={cameraSupported}
                cameraActive={cameraActive}
                cameraStarting={cameraStarting}
                cameraError={cameraError}
                videoRef={videoRef}
                onStart={() => {
                  void startCamera();
                }}
                onStop={stopCamera}
              />

              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                    Token manual
                  </Typography>
                  <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Token do QR Code"
                      value={manualToken}
                      onChange={(event) => setManualToken(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") handleCheckin(manualToken);
                      }}
                      placeholder="Cole ou digite o token"
                    />
                    <Button
                      variant="contained"
                      disabled={!manualToken.trim() || checkinLoading}
                      onClick={() => handleCheckin(manualToken)}
                    >
                      {checkinLoading ? <CircularProgress size={20} color="inherit" /> : "Confirmar"}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          )}

          {activeTab === "participants" && canUseList && (
            <Box role="tabpanel" aria-label="Participantes">
              <ManualSearch
                key={selectedEventId}
                registrations={registrations}
                regsLoading={regsLoading}
                searchQuery={searchQuery}
                checkinLoading={checkinLoading}
                canCheckinFeature={canCheckinSelected}
                page={registrationsPage}
                total={registrationsTotal}
                totalPages={registrationsTotalPages}
                onSearchQueryChange={setSearchQuery}
                onSearch={() => fetchRegistrations(selectedEventId, searchQuery, 1, certificateFilter)}
                onPageChange={(nextPage) => fetchRegistrations(selectedEventId, searchQuery, nextPage, certificateFilter)}
                onCheckin={(token) => {
                  void handleCheckin(token);
                }}
                onBatchCheckin={handleBatchCheckin}
              />
            </Box>
          )}

          {activeTab === "certificates" && canUseList && canCertificateSelected && (
            <Box role="tabpanel" aria-label="Certificados">
              <CertificateCenter
                registrations={registrations}
                onGrant={handleGrantCertificate}
                onInvite={handleInviteCertificates}
                onLoadBatch={loadCertificateInviteBatch}
                onRefresh={refreshCertificates}
                filter={certificateFilter}
                onFilterChange={(nextFilter) => {
                  setCertificateFilter(nextFilter);
                  void fetchRegistrations(selectedEventId, searchQuery, 1, nextFilter);
                }}
                page={registrationsPage}
                total={registrationsTotal}
                totalPages={registrationsTotalPages}
                onPageChange={(nextPage) => fetchRegistrations(selectedEventId, searchQuery, nextPage, certificateFilter)}
              />
            </Box>
          )}
        </>
      )}
    </PageContainer>
  );
}

export default function CheckinApp(): React.JSX.Element {
  return (
    <MuiIslandProvider>
      <CheckinInner />
    </MuiIslandProvider>
  );
}

/**
 * Ilha de /admin/eventos-checkin — check-in mobile-first (QR/câmera + busca
 * manual) para eventos internos e externos.
 * Port de `src/pages/admin/eventos-checkin.tsx` (Docusaurus) para Astro:
 * `useHistory` → `window.location.replace`, `Layout`/`AdminPageContainer` →
 * `PageContainer` (o h1 fica na topbar do AppLayout — aqui começa em h2).
 *
 * Internos filtram a lista no backend (`?query=`); externos filtram
 * client-side. Deep-link `?event=<id|external:<eventKey>>` pré-seleciona
 * o evento. A câmera exige HTTPS (mkcert local — ver DEVELOPMENT.md).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import MuiIslandProvider from "../../MuiIslandProvider";
import PageContainer from "../ui/PageContainer";
import QrScannerPanel from "./QrScannerPanel";
import ManualSearch from "./ManualSearch";
import type {
  CheckinResult,
  EventRegistration,
  ExternalActivationItem,
  ManagedEvent,
} from "./types";
import {
  CAMERA_START_TIMEOUT_MS,
  CHECKIN_ROLES,
  EXTERNAL_PREFIX,
  formatDateTime,
  getUserRoles,
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
  const { ready, isLoggedIn, isAdmin, user, authFetch } = useAuth();

  const roles = getUserRoles(user);
  const canAccess = isAdmin || CHECKIN_ROLES.some((r) => roles.includes(r));

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

  const [manualToken, setManualToken] = useState("");
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  // qr-scanner instance — gerencia câmera, WebWorker e BarcodeDetector nativamente
  const scannerRef = useRef<QrScanner | null>(null);
  // Cooldown: evita repostar o mesmo token em scans consecutivos (3s)
  const lastScanRef = useRef<{ token: string; at: number } | null>(null);

  const cameraSupported = isCameraAvailable();

  // A lista fica habilitada por evento: admin/organizer/host/owner/ativador podem buscar;
  // event_checker puro fica restrito ao scanner.
  const selectedManaged = events.find((e) => e.id === selectedEventId);
  const selectedExternal = externalActivations.find(
    (a) => `${EXTERNAL_PREFIX}${a.eventKey}` === selectedEventId,
  );
  const canUseList = !!(selectedManaged?.canUseList ?? selectedExternal?.canUseList);

  // ── Data loading ──────────────────────────────────────────────────────────

  const fetchRegistrations = useCallback(
    async (selection: string, query: string) => {
      setRegsLoading(true);
      try {
        if (selection.startsWith(EXTERNAL_PREFIX)) {
          // Externo: backend não filtra por query — busca é client-side.
          const eventKey = selection.slice(EXTERNAL_PREFIX.length);
          const res = await authFetch(
            `/events/external/${encodeURIComponent(eventKey)}/participants`,
          );
          const data = await parseAuthJson<EventRegistration[]>(res, setLoadError);
          if (!data) return;
          const list = Array.isArray(data) ? data : [];
          const q = query.trim().toLowerCase();
          setRegistrations(
            q
              ? list.filter(
                  (r) =>
                    (r.attendeeName ?? "").toLowerCase().includes(q) ||
                    r.attendeeEmail.toLowerCase().includes(q),
                )
              : list,
          );
          return;
        }
        const params = new URLSearchParams();
        if (query.trim()) params.set("query", query.trim());
        const qs = params.toString();
        const registrationsUrl = qs
          ? `/events/${selection}/registrations?${qs}`
          : `/events/${selection}/registrations`;
        const res = await authFetch(registrationsUrl);
        const data = await parseAuthJson<EventRegistration[]>(res, setLoadError);
        if (!data) return;
        setRegistrations(Array.isArray(data) ? data : []);
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
    if (!isLoggedIn || !canAccess) {
      window.location.replace("/");
      return;
    }
    (async () => {
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
          (a) => (a.features ?? []).includes("checkin"),
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
  }, [ready, isLoggedIn, canAccess, authFetch]);

  // Carrega a lista completa (contador de presentes) ao trocar de evento
  useEffect(() => {
    if (!selectedEventId || !canUseList) {
      setRegistrations([]);
      setRegsLoading(false);
      return;
    }
    setResult(null);
    setRegistrations([]);
    setSearchQuery("");
    fetchRegistrations(selectedEventId, "");
  }, [selectedEventId, canUseList, fetchRegistrations]);

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
        // Atualiza a lista (contador de presentes) sem bloquear o fluxo da porta
        if (canUseList) {
          fetchRegistrations(selectedEventId, searchQuery);
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

  if (!ready || !isLoggedIn || !canAccess) {
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
    <PageContainer sx={{ maxWidth: { xs: "100%", sm: 640 } }}>
      <Typography component="h2" variant="h4" sx={{ fontWeight: 800 }} gutterBottom>
        Check-in
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Leia o QR Code do participante
        {canUseList ? " ou busque pelo nome/e-mail" : ""}.
      </Typography>

      {loadError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {loadError}
        </Alert>
      )}

      {/* ── Seletor de evento ── */}
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
            <Chip
              icon={<CheckCircleIcon />}
              label={`${presentCount} presente${presentCount === 1 ? "" : "s"}`}
              color="success"
              variant="outlined"
            />
            {canUseList && (
              <Chip
                label={`${registrations.length} inscrito${registrations.length === 1 ? "" : "s"} na lista`}
                variant="outlined"
              />
            )}
          </Box>

          {/* ── Feedback do último check-in ── */}
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

          {/* ── Token manual ── */}
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                Token manual
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
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

          {canUseList && (
            <ManualSearch
              registrations={registrations}
              regsLoading={regsLoading}
              searchQuery={searchQuery}
              checkinLoading={checkinLoading}
              onSearchQueryChange={setSearchQuery}
              onSearch={() => fetchRegistrations(selectedEventId, searchQuery)}
              onCheckin={(token) => {
                void handleCheckin(token);
              }}
            />
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

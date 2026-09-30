import React, { useCallback, useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import Layout from "@theme/Layout";
import { useHistory } from "@docusaurus/router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import SearchIcon from "@mui/icons-material/Search";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import VideocamIcon from "@mui/icons-material/Videocam";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useAuth } from "../../hooks/useAuth";
import type { AuthUser } from "../../hooks/useAuth";
import AdminPageContainer from "../../components/AdminPageContainer";
import { parseAuthJson, extractErrorMessage } from "../../hooks/authFetchHelpers";

// ---------------------------------------------------------------------------
// Types (contrato do backend — Fase 2 do EVENT_PLAN)
// ---------------------------------------------------------------------------

interface ManagedEvent {
  id: string;
  title: string;
  startAt: string;
  status: string;
  canUseList: boolean;
}

/** Ativação de features em evento externo (GET /events/checkin-scope). */
interface ExternalActivationItem {
  id: string;
  eventKey: string;
  features: string[];
  title?: string;
  canUseList: boolean;
}

interface EventRegistration {
  id: string;
  attendeeName: string | null;
  attendeeEmail: string;
  status: string;
  checkedInAt: string | null;
  checkinToken: string;
  member: {
    id: string;
    name: string | null;
    githubHandle: string | null;
  } | null;
  payer: {
    id: string;
    name: string | null;
    githubHandle: string | null;
  } | null;
  ticketType: {
    name: string | null;
  } | null;
  order: {
    id: string;
    status: string;
    totalCents: number;
    quantity: number;
    paidAt: string | null;
  } | null;
}

interface CheckinResult {
  kind: "checked_in" | "already_checked_in" | "invalid";
  attendeeName?: string;
  checkedInAt?: string | null;
  message: string;
}

/** Prefixo do valor do seletor para eventos externos: `external:<eventKey>`. */
const EXTERNAL_PREFIX = "external:";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Multi-role: o backend expõe `roles: string[]` na sessão (migração Fase 2). */
function getUserRoles(user: AuthUser | null): string[] {
  return user?.roles ?? [];
}

const CHECKIN_ROLES = ["admin", "event_organizer", "event_checker"];

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function formatOrderStatus(status: string): string {
  if (status === "paid") return "Pago";
  if (status === "refunded") return "Reembolsado";
  return status;
}

/**
 * Verifica se a câmera pode ser usada (getUserMedia disponível).
 * Pode retornar false em HTTP não-seguro ou em ambientes sem câmera.
 */
export const isCameraAvailable = (): boolean =>
  typeof window !== "undefined" &&
  typeof navigator !== "undefined" &&
  typeof navigator.mediaDevices !== "undefined" &&
  typeof navigator.mediaDevices.getUserMedia === "function";

/**
 * Timeout defensivo para ativação da câmera. Em alguns navegadores/ambientes
 * (ex.: Firefox headless sem câmera, drivers quebrados) `getUserMedia` e
 * `enumerateDevices` nunca resolvem — sem timeout a UI trava em "Ativando...".
 */
const CAMERA_START_TIMEOUT_MS = 15000;

/**
 * Race de uma promise com timeout. A promise original sempre recebe handlers,
 * então uma resolução tardia (após o timeout) não vira unhandled rejection.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Object.assign(new Error("camera start timeout"), { name: "CameraTimeoutError" })),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Traduz erros de câmera (DOMException.name de getUserMedia) em mensagem amigável PT-BR.
 * Exportada para facilitar testes unitários.
 */
export function translateCameraError(err: unknown): string {
  if (err instanceof Error) {
    const name = (err as DOMException).name ?? "";
    if (name === "CameraTimeoutError") {
      return "A câmera demorou para responder. Verifique se outro aplicativo não está usando a câmera e tente novamente.";
    }
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "Permissão de câmera negada. Toque no ícone de cadeado na barra de endereços e permita o acesso à câmera.";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "Nenhuma câmera encontrada neste dispositivo.";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "A câmera está sendo usada por outro aplicativo. Feche-o e tente novamente.";
    }
    if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
      return "A câmera não pôde ser iniciada. Tente novamente.";
    }
    if (name === "AbortError") {
      return "A inicialização da câmera foi interrompida. Tente novamente.";
    }
  }
  return "Não foi possível acessar a câmera. Verifique a permissão do navegador ou use a busca manual.";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EventosCheckinPage(): React.JSX.Element {
  const { ready, isLoggedIn, isAdmin, user, authFetch } = useAuth();
  const history = useHistory();

  const roles = getUserRoles(user);
  const canAccess = isAdmin || CHECKIN_ROLES.some((r) => roles.includes(r));

  const [events, setEvents] = useState<ManagedEvent[]>([]);
  const [externalActivations, setExternalActivations] = useState<ExternalActivationItem[]>([]);
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
  const scannerRef = useRef<import("qr-scanner").default | null>(null);
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
      history.replace("/");
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

        const externals = (Array.isArray(data.external) ? data.external : []).filter((a) =>
          (a.features ?? []).includes("checkin"),
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
  }, [ready, isLoggedIn, canAccess, history, authFetch]);

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
  //
  // qr-scanner abstrai toda a complexidade de câmera:
  //   • Usa BarcodeDetector nativa (Chrome/Android) quando disponível → <1 frame latency
  //   • Fallback via WebWorker + canvas (Safari/Firefox/Samsung) → não bloqueia a UI
  //   • Gerencia getUserMedia, loadedmetadata, facingMode e cleanup internamente
  //
  // Responsabilidades que ficam aqui:
  //   • Instanciar/destruir o QrScanner quando o usuário ativa/para a câmera
  //   • Cooldown de 3s por token para evitar disparos duplos na mesma leitura

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
      const hasCamera = await withTimeout(
        QrScanner.hasCamera(),
        CAMERA_START_TIMEOUT_MS,
      );
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
      <Layout title="Check-in de Eventos">
        <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  const hasManagedSelection = events.some((e) => e.id === selectedEventId);
  const selectedExternalKey = selectedEventId.startsWith(EXTERNAL_PREFIX)
    ? selectedEventId.slice(EXTERNAL_PREFIX.length)
    : null;
  const hasSelection = !!(hasManagedSelection || selectedExternalKey);
  const presentCount = registrations.filter((r) => r.checkedInAt).length;

  return (
    <Layout title="Check-in de Eventos" description="Credenciamento de participantes">
      {/* maxWidth="sm" + ações empilhadas: tela pensada para o celular na porta do evento */}
      <AdminPageContainer sx={{ maxWidth: { xs: "100%", sm: 640 } }}>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          Check-in
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Leia o QR Code do participante
          {canUseList ? " ou busque pelo nome/e-mail" : ""}.
        </Typography>

        {loadError && <Alert severity="error" sx={{ mb: 3 }}>{loadError}</Alert>}

        {/* ── Seletor de evento ── */}
        <FormControl fullWidth sx={{ mb: 2 }} disabled={eventsLoading}>
          <InputLabel>Evento</InputLabel>
          <Select
            value={selectedEventId}
            label="Evento"
            onChange={(e) => setSelectedEventId(e.target.value)}
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

            {/* ── Leitura por câmera ── */}
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                  <QrCodeScannerIcon color="primary" />
                  <Typography variant="subtitle1" fontWeight={700}>
                    Ler QR Code pela câmera
                  </Typography>
                </Box>

                {/* Câmera indisponível no contexto (HTTP, iframe sem permissão, etc.) */}
                {!cameraSupported && (
                  <Alert severity="info" sx={{ mb: 1.5 }}>
                    A câmera não está disponível neste navegador. Use o campo de token manual
                    abaixo ou acesse via Chrome em um dispositivo com câmera.
                  </Alert>
                )}

                {cameraError && (
                  <Alert severity="error" sx={{ mb: 1.5 }}>
                    {cameraError}
                  </Alert>
                )}

                {/*
                  O <video> é sempre renderizado (ref estável) e NUNCA fica
                  `display:none`: o construtor do qr-scanner detecta vídeo
                  escondido e o zera (width/height/opacity = 0) para "proteger"
                  o Safari — com isso a preview ficava invisível mesmo com o
                  stream ativo. A visibilidade é controlada pelo wrapper, e o
                  vídeo permanece `display:block` para a lib.
                  A lib injeta o overlay de destaque de região no elemento pai
                  do vídeo (o wrapper), escondendo-o junto quando inativo.
                */}
                <div
                  id="checkin-camera-preview-wrapper"
                  style={{ display: cameraActive ? "block" : "none", marginBottom: 12 }}
                >
                  <video
                    id="checkin-camera-preview"
                    ref={videoRef}
                    muted
                    playsInline
                    style={{
                      width: "100%",
                      borderRadius: 8,
                      backgroundColor: "black",
                      display: "block",
                    }}
                  />
                </div>

                {cameraSupported && (
                  <Button
                    id="checkin-camera-toggle"
                    fullWidth
                    variant={cameraActive ? "outlined" : "contained"}
                    color={cameraActive ? "error" : "primary"}
                    size="large"
                    disabled={cameraStarting}
                    startIcon={cameraActive ? <StopCircleIcon /> : <VideocamIcon />}
                    onClick={cameraActive ? stopCamera : startCamera}
                  >
                    {cameraActive
                      ? "Parar câmera"
                      : cameraStarting
                        ? "Ativando..."
                        : "Ativar câmera"}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* ── Token manual ── */}
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                  Token manual
                </Typography>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Token do QR Code"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCheckin(manualToken);
                    }}
                    placeholder="Cole ou digite o token"
                  />
                  <Button
                    variant="contained"
                    disabled={!manualToken.trim() || checkinLoading}
                    onClick={() => handleCheckin(manualToken)}
                  >
                    {checkinLoading ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      "Confirmar"
                    )}
                  </Button>
                </Box>
              </CardContent>
            </Card>

            {canUseList && (
              <>
                <Divider sx={{ my: 2 }} />

                {/* ── Busca por nome/e-mail ── */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                  <PersonSearchIcon color="primary" />
                  <Typography variant="subtitle1" fontWeight={700}>
                    Buscar participante
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Nome ou e-mail"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") fetchRegistrations(selectedEventId, searchQuery);
                    }}
                  />
                  <IconButton
                    aria-label="Buscar participante"
                    onClick={() => fetchRegistrations(selectedEventId, searchQuery)}
                    disabled={regsLoading}
                  >
                    <SearchIcon />
                  </IconButton>
                </Box>

                {regsLoading && (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                    <CircularProgress size={28} />
                  </Box>
                )}
                {!regsLoading && registrations.length === 0 && (
                  <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>
                    Nenhuma inscrição encontrada.
                  </Typography>
                )}
                {!regsLoading && registrations.length > 0 && (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    {registrations.map((reg) => (
                      <Card key={reg.id} variant="outlined">
                        <CardContent sx={{ py: "12px !important" }}>
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 1,
                              flexWrap: "wrap",
                            }}
                          >
                            <Box>
                              <Typography variant="body2" fontWeight={700}>
                                {reg.attendeeName ?? reg.member?.name ?? reg.attendeeEmail}
                                {reg.payer && reg.payer.id !== reg.member?.id && (
                                  <Typography
                                    component="span"
                                    variant="caption"
                                    color="primary.main"
                                    sx={{ ml: 1 }}
                                  >
                                    (comprado por {reg.payer.name ?? reg.payer.githubHandle}
                                    {reg.payer.githubHandle
                                      ? ` @${reg.payer.githubHandle}`
                                      : ""})
                                  </Typography>
                                )}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                {reg.attendeeEmail}
                                {reg.member?.githubHandle
                                  ? ` · @${reg.member.githubHandle}`
                                  : ""}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                {reg.ticketType?.name ?? "Ingresso"}
                                {reg.order &&
                                  ` · ${formatOrderStatus(reg.order.status)}${
                                    reg.order.paidAt
                                      ? ` · ${formatDateTime(reg.order.paidAt)}`
                                      : ""
                                  }`}
                              </Typography>
                            </Box>
                            {reg.checkedInAt ? (
                              <Chip
                                icon={<CheckCircleIcon />}
                                label={`Presente · ${formatDateTime(reg.checkedInAt)}`}
                                color="success"
                                size="small"
                                variant="outlined"
                              />
                            ) : (
                              <Button
                                size="small"
                                variant="contained"
                                disabled={checkinLoading}
                                onClick={() => handleCheckin(reg.checkinToken)}
                              >
                                Confirmar presença
                              </Button>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                )}
              </>
            )}
          </>
        )}
      </AdminPageContainer>
    </Layout>
  );
}

/**
 * Testes do check-in — conversão de
 * `src/pages/admin/__tests__/eventos-checkin.test.tsx` (jest) para vitest.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import CheckinApp from "../CheckinApp";
import { isCameraAvailable, translateCameraError } from "../checkin-utils";
import { renderWithMui } from "../../../../../test/render-mui";
import type { AuthUser } from "../../../../../lib/auth-client";
import {
  __factory__ as qrFactory,
  __state__ as qrState,
  type MockQrScannerInstance,
} from "../../../../../test/mocks/qr-scanner";

vi.mock("qr-scanner", () => import("../../../../../test/mocks/qr-scanner"));

// Estado mutável compartilhado com a fábrica do mock — cada teste ajusta
// os campos que precisa no beforeEach/corpo.
const authState = vi.hoisted(() => ({
  user: null as AuthUser | null,
  ready: false,
  isLoggedIn: false,
  isAdmin: false,
  authFetch: vi.fn(),
}));

vi.mock("../../../../../lib/use-auth", () => ({
  useAuth: () => ({
    user: authState.user,
    ready: authState.ready,
    isLoggedIn: authState.isLoggedIn,
    isAdmin: authState.isAdmin,
    authFetch: authState.authFetch,
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const managedEvent = {
  id: "evt-1",
  title: "Encontro DevParaná",
  startAt: "2026-08-10T18:00:00.000Z",
  status: "scheduled",
  canUseList: true,
};

function makeUser(roles: string[]): AuthUser {
  return {
    sub: roles.join("-") || "u-0",
    githubId: "github-1",
    handle: roles[0] ?? "user",
    name: roles[0] ?? "Usuário",
    avatarUrl: "",
    roles,
  };
}

const organizerUser = makeUser(["event_organizer"]);
const checkerUser = makeUser(["event_checker"]);

const registration = {
  id: "reg-1",
  attendeeName: "Participante Um",
  attendeeEmail: "um@example.com",
  status: "confirmed",
  checkedInAt: null,
  certificateGrantedAt: null,
  certificateInvitedAt: null,
  checkinToken: "token-abc",
  isGuest: false,
  member: null,
  payer: null,
  ticketType: { name: "Ingresso Padrão" },
  order: {
    id: "ord-1",
    status: "paid",
    totalCents: 5000,
    quantity: 1,
    paidAt: "2026-08-01T00:00:00Z",
  },
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

type ExtraHandler = (url: string, init?: RequestInit) => unknown;

function mockAuthFetchWithEvents(extra?: ExtraHandler) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const custom = extra?.(url, init);
    if (custom) return custom as Response;
    if (url === "/events/checkin-scope")
      return jsonResponse({ managed: [managedEvent], external: [] });
    return jsonResponse(null, { status: 404 });
  });
}

/** Handler extra padrão: lista de inscrições vazia. */
const noRegistrations: ExtraHandler = (url) =>
  url.includes("/registrations") ? jsonResponse([]) : null;

function mockMediaDevices() {
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: vi.fn().mockResolvedValue({}) },
    configurable: true,
  });
}

function removeMediaDevices() {
  Object.defineProperty(navigator, "mediaDevices", {
    value: undefined,
    configurable: true,
  });
}

// ---------------------------------------------------------------------------
// Helpers de setup de página (evitam repetição entre os cenários)
// ---------------------------------------------------------------------------

function mockAuthFor(user: AuthUser, authFetch: typeof authState.authFetch) {
  authState.user = user;
  authState.ready = true;
  authState.isLoggedIn = true;
  authState.isAdmin = user.roles.includes("admin");
  authState.authFetch = authFetch;
}

function renderAtCheckin(eventId = "evt-1") {
  window.history.pushState({}, "", `/admin/eventos-checkin?event=${eventId}`);
  renderWithMui(<CheckinApp />);
}

async function waitForRegistrationsList() {
  await waitFor(() =>
    expect(screen.queryByText(/inscritos? nesta página/i)).toBeInTheDocument(),
  );
}

/** Setup padrão: organizador logado, evento pré-selecionado e lista carregada. */
async function setupOrganizerPage(extra?: ExtraHandler) {
  const authFetch = mockAuthFetchWithEvents(extra ?? noRegistrations);
  mockAuthFor(organizerUser, authFetch);
  renderAtCheckin();
  await waitForRegistrationsList();
  return authFetch;
}

/** Clica em "Ativar câmera" e aguarda o scanner ficar ativo. */
async function activateCamera() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Ativar câmera/i }));
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Parar câmera/i })).toBeInTheDocument(),
  );
}

// ---------------------------------------------------------------------------
// Pure-unit: helper exports
// ---------------------------------------------------------------------------

describe("isCameraAvailable()", () => {
  afterEach(() => mockMediaDevices());

  it("retorna false quando navigator.mediaDevices é undefined", () => {
    removeMediaDevices();
    expect(isCameraAvailable()).toBe(false);
  });

  it("retorna true quando getUserMedia está disponível", () => {
    mockMediaDevices();
    expect(isCameraAvailable()).toBe(true);
  });
});

describe("translateCameraError()", () => {
  const domError = (name: string) => Object.assign(new Error("x"), { name });

  it.each<[string, RegExp]>([
    ["NotAllowedError", /permiss/i],
    ["PermissionDeniedError", /permiss/i],
    ["NotFoundError", /nenhuma câmera/i],
    ["NotReadableError", /outro aplicativo/i],
    ["OverconstrainedError", /não pôde ser iniciada/i],
    ["AbortError", /interrompida/i],
    ["CameraTimeoutError", /demorou para responder/i],
  ])("traduz %s", (name, expected) => {
    expect(translateCameraError(domError(name))).toMatch(expected);
  });

  it("retorna mensagem genérica para erro desconhecido", () => {
    expect(translateCameraError(new Error("estranhão"))).toMatch(/não foi possível acessar/i);
  });

  it("retorna mensagem genérica para valor não-Error", () => {
    expect(translateCameraError("string erro")).toMatch(/não foi possível acessar/i);
  });
});

// ---------------------------------------------------------------------------
// Integração: página completa
// ---------------------------------------------------------------------------

describe("/admin/eventos-checkin", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    qrState.instance = null;
    qrState.hasCamera.mockResolvedValue(true);
    mockMediaDevices();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  // ── Acesso / autorização ─────────────────────────────────────────────────

  it("membro autenticado sem escopo não recebe dados de participantes", async () => {
    const authFetch = vi.fn(async (url: string) => {
      if (url === "/events/checkin-scope") {
        return jsonResponse({ managed: [], external: [] });
      }
      if (url.includes("/registrations")) return jsonResponse([registration]);
      return jsonResponse(null, { status: 404 });
    });
    mockAuthFor(makeUser(["membro"]), authFetch);

    renderAtCheckin();

    expect(await screen.findByText("Nenhum evento gerenciável encontrado.")).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith("/events/checkin-scope");
    expect(
      authFetch.mock.calls.some(([url]) => url.includes("/registrations")),
    ).toBe(false);
    expect(screen.queryByText("Participante Um")).not.toBeInTheDocument();
  });

  it.each([
    ["staff host local", ["membro"]],
    ["event_host explícito", ["membro", "event_host"]],
    ["staff checker local", ["membro"]],
  ])("%s acessa o evento retornado pelo escopo sem role global de gestão", async (_label, roles) => {
    const authFetch = mockAuthFetchWithEvents(noRegistrations);
    mockAuthFor(makeUser(roles), authFetch);

    renderAtCheckin();

    await waitForRegistrationsList();
    expect(authFetch).toHaveBeenCalledWith("/events/checkin-scope");
    expect(await screen.findByRole("tab", { name: "Participantes" })).toBeInTheDocument();
  });

  it("event_checker tem acesso (role de check-in)", async () => {
    const authFetch = mockAuthFetchWithEvents(noRegistrations);
    mockAuthFor(checkerUser, authFetch);

    renderAtCheckin();

    // Sincrono após o render: a página já está montada sem redirecionar e o
    // fetch de inscrições ainda não disparou (só /events/checkin-scope).
    expect(screen.getByText("Check-in")).toBeInTheDocument();
    expect(
      authFetch.mock.calls.some(([url]) => url.includes("/registrations")),
    ).toBe(false);

    fireEvent.click(await screen.findByRole("tab", { name: "Participantes" }));
    expect(await screen.findByText(/Nenhuma inscrição encontrada/i)).toBeInTheDocument();
  });

  // ── Token manual ─────────────────────────────────────────────────────────

  it("carrega eventos, seleciona e confirma presença via token manual", async () => {
    const authFetch = await setupOrganizerPage((url, init) => {
      if (url.includes("/events/evt-1/registrations")) return jsonResponse([registration]);
      if (url.includes("/events/evt-1/checkin") && init?.method === "POST") {
        return jsonResponse({
          status: "checked_in",
          registration: {
            attendeeName: "Participante Um",
            attendeeEmail: "um@example.com",
            checkedInAt: "2026-08-10T18:05:00.000Z",
          },
        });
      }
      return null;
    });

    fireEvent.change(screen.getByLabelText("Token do QR Code"), {
      target: { value: "token-abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Confirmar$/i }));

    expect(
      await screen.findByText(/Presença confirmada: Participante Um/i),
    ).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith(
      "/events/evt-1/checkin",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "token-abc" }),
      }),
    );
  });

  it("exibe feedback vermelho para token inválido (404)", async () => {
    await setupOrganizerPage((url, init) => {
      if (url.includes("/events/evt-1/registrations")) return jsonResponse([]);
      if (url.includes("/events/evt-1/checkin") && init?.method === "POST") {
        return jsonResponse({ message: "Not found" }, { status: 404 });
      }
      return null;
    });

    fireEvent.change(await screen.findByLabelText("Token do QR Code"), {
      target: { value: "token-errado" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Confirmar$/i }));

    expect(await screen.findByText(/Token inválido/i)).toBeInTheDocument();
  });

  it("exibe feedback laranja para presença já confirmada", async () => {
    await setupOrganizerPage((url, init) => {
      if (url.includes("/registrations")) return jsonResponse([registration]);
      if (url.includes("/checkin") && init?.method === "POST") {
        return jsonResponse({
          status: "already_checked_in",
          registration: {
            attendeeName: "Participante Um",
            attendeeEmail: "um@example.com",
            checkedInAt: "2026-08-10T18:01:00.000Z",
          },
        });
      }
      return null;
    });

    fireEvent.change(await screen.findByLabelText("Token do QR Code"), {
      target: { value: "token-abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Confirmar$/i }));

    expect(await screen.findByText(/já teve a presença confirmada/i)).toBeInTheDocument();
  });

  it("pré-seleciona evento externo e confirma presença pelo endpoint externo", async () => {
    const extKey = "meetup:devparana:ext-1";
    const activation = {
      id: "act-1",
      eventKey: extKey,
      features: ["checkin"],
      title: "Meetup Externo",
      canUseList: true,
    };
    const encodedKey = encodeURIComponent(extKey);

    const authFetch = mockAuthFetchWithEvents((url, init) => {
      if (url === "/events/checkin-scope")
        return jsonResponse({ managed: [], external: [activation] });
      if (url.startsWith(`/events/external/${encodedKey}/participants?`))
        return jsonResponse([registration]);
      if (url === `/events/external/${encodedKey}/checkin` && init?.method === "POST") {
        return jsonResponse({
          status: "checked_in",
          registration: {
            attendeeName: "Participante Um",
            attendeeEmail: "um@example.com",
            checkedInAt: "2026-08-10T18:05:00.000Z",
          },
        });
      }
      return null;
    });
    mockAuthFor(organizerUser, authFetch);

    renderAtCheckin(`external:${extKey}`);

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith("/events/checkin-scope");
    });

    expect(await screen.findByText(/1 inscrito nesta página/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Token do QR Code"), {
      target: { value: "token-abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Confirmar$/i }));

    expect(
      await screen.findByText(/Presença confirmada: Participante Um/i),
    ).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith(
      `/events/external/${encodedKey}/checkin`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "token-abc" }),
      }),
    );
  });

  // ── Câmera: ativação ─────────────────────────────────────────────────────

  it("exibe botão 'Ativar câmera' quando getUserMedia está disponível", async () => {
    await setupOrganizerPage();

    expect(screen.getByRole("button", { name: /Ativar câmera/i })).toBeInTheDocument();
  });

  it("ativa câmera: instancia QrScanner e exibe botão 'Parar câmera'", async () => {
    await setupOrganizerPage();

    await activateCamera();

    expect(qrState.instance).not.toBeNull();
    expect(qrState.instance!.start).toHaveBeenCalledTimes(1);
  });

  it("para câmera: chama stop() e destroy() no QrScanner", async () => {
    await setupOrganizerPage();

    await activateCamera();
    const scannerBeforeStop = qrState.instance!;

    fireEvent.click(screen.getByRole("button", { name: /Parar câmera/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Ativar câmera/i })).toBeInTheDocument(),
    );

    expect(scannerBeforeStop.stop).toHaveBeenCalledTimes(1);
    expect(scannerBeforeStop.destroy).toHaveBeenCalledTimes(1);
  });

  it("preview: wrapper oculto antes de ativar, visível com câmera ativa, oculto após parar", async () => {
    await setupOrganizerPage();

    const wrapper = () => document.getElementById("checkin-camera-preview-wrapper")!;
    const video = () => document.getElementById("checkin-camera-preview") as HTMLVideoElement;

    // Wrapper controla a visibilidade (inicialmente oculto)
    expect(wrapper()).not.toBeVisible();
    // O vídeo nunca fica display:none: o qr-scanner zeraria o CSS dele
    // (width/height/opacity 0) ao detectar vídeo escondido, deixando a
    // preview invisível mesmo com o stream ativo.
    expect(video().style.display).toBe("block");

    await activateCamera();
    expect(wrapper()).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Parar câmera/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Ativar câmera/i })).toBeInTheDocument(),
    );
    expect(wrapper()).not.toBeVisible();
  });

  it("timeout: exibe erro e libera o botão quando a câmera nunca responde", async () => {
    // Simula ambiente onde enumerateDevices/getUserMedia pendura (reproduzido
    // em Firefox headless sem câmera): sem timeout a UI travava em "Ativando...".
    qrState.hasCamera.mockReturnValue(new Promise(() => {}));
    await setupOrganizerPage();

    vi.useFakeTimers();
    try {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Ativar câmera/i }));
      });
      await act(async () => {
        vi.advanceTimersByTime(16000);
      });

      expect(screen.getByText(/demorou para responder/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Ativar câmera/i })).toBeInTheDocument();
      expect(screen.queryByText(/Ativando/i)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("dispara check-in ao receber token via QrScanner (simulateScan)", async () => {
    const authFetch = await setupOrganizerPage((url, init) => {
      if (url.includes("/registrations")) return jsonResponse([registration]);
      if (url.includes("/checkin") && init?.method === "POST") {
        return jsonResponse({
          status: "checked_in",
          registration: {
            attendeeName: "Participante Um",
            attendeeEmail: "um@example.com",
            checkedInAt: "2026-08-10T18:05:00.000Z",
          },
        });
      }
      return null;
    });

    await activateCamera();
    await waitFor(() => expect(qrState.instance).not.toBeNull());

    await act(async () => {
      qrState.instance!.simulateScan("token-abc");
    });

    expect(
      await screen.findByText(/Presença confirmada: Participante Um/i),
    ).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith(
      "/events/evt-1/checkin",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "token-abc" }),
      }),
    );
  });

  it("cooldown: não dispara check-in duplicado do mesmo token em < 3s", async () => {
    const authFetch = await setupOrganizerPage((url, init) => {
      if (url.includes("/registrations")) return jsonResponse([]);
      if (url.includes("/checkin") && init?.method === "POST") {
        return jsonResponse({
          status: "checked_in",
          registration: {
            attendeeName: "Test",
            attendeeEmail: "t@t.com",
            checkedInAt: "2026-08-10T18:05:00.000Z",
          },
        });
      }
      return null;
    });

    await activateCamera();
    await waitFor(() => expect(qrState.instance).not.toBeNull());

    await act(async () => {
      qrState.instance!.simulateScan("token-cooldown");
      qrState.instance!.simulateScan("token-cooldown");
      qrState.instance!.simulateScan("token-cooldown");
    });

    await waitFor(() => {
      const checkinCalls = authFetch.mock.calls.filter(
        ([url, init]) =>
          (url as string).includes("/checkin") && (init as RequestInit)?.method === "POST",
      );
      expect(checkinCalls).toHaveLength(1);
    });
  });

  // ── Câmera: sem getUserMedia ─────────────────────────────────────────────

  it("exibe aviso quando câmera não disponível no navegador", async () => {
    removeMediaDevices();
    await setupOrganizerPage();

    expect(
      screen.getByText(/a câmera não está disponível neste navegador/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ativar câmera/i })).not.toBeInTheDocument();
  });

  // ── Câmera: QrScanner.hasCamera() = false ───────────────────────────────

  it("exibe erro quando QrScanner.hasCamera() retorna false", async () => {
    qrState.hasCamera.mockResolvedValueOnce(false);
    await setupOrganizerPage();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Ativar câmera/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/nenhuma câmera encontrada/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Ativar câmera/i })).toBeInTheDocument();
  });

  // ── Câmera: start() rejeita com NotAllowedError ──────────────────────────

  it("exibe erro de permissão quando QrScanner.start() lança NotAllowedError", async () => {
    const permError = Object.assign(new Error("denied"), { name: "NotAllowedError" });

    // Substitui a fábrica de instâncias para injetar um start() que rejeita
    const originalFactory = qrFactory.current;
    qrFactory.current = (_video, onDecode) => {
      const inst: MockQrScannerInstance = {
        start: vi.fn<() => Promise<void>>(() => Promise.reject(permError)),
        stop: vi.fn(() => {}),
        destroy: vi.fn(() => {}),
        _onDecode: onDecode,
        simulateScan: (t: string) => onDecode({ data: t }),
      };
      qrState.instance = inst;
      return inst;
    };

    try {
      await setupOrganizerPage();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Ativar câmera/i }));
      });

      await waitFor(() => {
        expect(screen.getByText(/permissão de câmera negada/i)).toBeInTheDocument();
      });
    } finally {
      qrFactory.current = originalFactory;
    }
  });

  // ── Lista de participantes ────────────────────────────────────────────

  it("exibe botão 'Confirmar presença' na lista e realiza check-in", async () => {
    const authFetch = await setupOrganizerPage((url, init) => {
      if (url.includes("/registrations")) return jsonResponse([registration]);
      if (url.includes("/checkin") && init?.method === "POST") {
        return jsonResponse({
          status: "checked_in",
          registration: {
            attendeeName: "Participante Um",
            attendeeEmail: "um@example.com",
            checkedInAt: "2026-08-10T18:10:00.000Z",
          },
        });
      }
      return null;
    });

    fireEvent.click(screen.getByRole("tab", { name: "Participantes" }));
    expect(await screen.findByText("Participante Um")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar presença" }));

    expect(await screen.findByText(/Presença confirmada/i)).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith(
      "/events/evt-1/checkin",
      expect.objectContaining({ body: JSON.stringify({ token: "token-abc" }) }),
    );
  });

  it("exibe badge de convidado na busca manual sem alterar o check-in", async () => {
    await setupOrganizerPage((url) => {
      if (url.includes("/registrations")) {
        return jsonResponse([{ ...registration, isGuest: true }]);
      }
      return null;
    });

    fireEvent.click(screen.getByRole("tab", { name: "Participantes" }));
    expect(await screen.findByText("Convidado")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirmar presença" }),
    ).toBeEnabled();
  });

  it("event_checker não vê lista de participantes (canUseList=false)", async () => {
    const eventSemLista = { ...managedEvent, canUseList: false };
    const authFetch = vi.fn(async (url: string) => {
      if (url === "/events/checkin-scope")
        return jsonResponse({ managed: [eventSemLista], external: [] });
      if (url.includes("/registrations")) return jsonResponse([registration]);
      return jsonResponse(null, { status: 404 });
    });
    mockAuthFor(checkerUser, authFetch);

    renderAtCheckin();
    expect(await screen.findByText("Ler QR Code pela câmera")).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: /Buscar participante/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Participante Um")).not.toBeInTheDocument();
    expect(
      authFetch.mock.calls.some(([url]) => url.includes("/registrations")),
    ).toBe(false);
  });

  it("seleciona todos os filtrados e confirma presença em lote", async () => {
    const second = {
      ...registration,
      id: "reg-2",
      attendeeName: "Participante Dois",
      attendeeEmail: "dois@example.com",
      checkinToken: "token-def",
    };
    const authFetch = await setupOrganizerPage((url, init) => {
      if (url.includes("/registrations")) return jsonResponse([registration, second]);
      if (url === "/events/evt-1/checkin/batch" && init?.method === "POST") {
        return jsonResponse([
          { token: "token-abc", status: "checked_in" },
          { token: "token-def", status: "checked_in" },
        ]);
      }
      return null;
    });

    fireEvent.click(screen.getByRole("tab", { name: "Participantes" }));
    fireEvent.click(
      await screen.findByRole("checkbox", { name: /selecionar todos os filtrados/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar presença (2)" }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        "/events/evt-1/checkin/batch",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ tokens: ["token-abc", "token-def"] }),
        }),
      );
    });
  });

  it("pagina 51 participantes, limpa seleção na navegação/busca e envia somente a página atual", async () => {
    const participants = Array.from({ length: 51 }, (_, index) => {
      const number = String(index + 1).padStart(3, "0");
      return {
        ...registration,
        id: `reg-${number}`,
        attendeeName: `Participante ${number}`,
        attendeeEmail: `participante-${number}@example.com`,
        checkinToken: `token-${number}`,
      };
    });
    const authFetch = await setupOrganizerPage((url, init) => {
      if (url.includes("/registrations")) {
        const params = new URLSearchParams(url.split("?")[1]);
        const page = Number(params.get("page") ?? "1");
        const search = params.get("search") ?? "";
        const filtered = participants.filter((item) =>
          `${item.attendeeName} ${item.attendeeEmail}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
        );
        return jsonResponse({
          data: filtered.slice((page - 1) * 25, page * 25),
          total: filtered.length,
          page,
          totalPages: Math.ceil(filtered.length / 25),
          limit: 25,
        });
      }
      if (url === "/events/evt-1/checkin/batch" && init?.method === "POST") {
        const { tokens } = JSON.parse(String(init.body));
        return jsonResponse(tokens.map((token: string) => ({ token, status: "checked_in" })));
      }
      return null;
    });

    fireEvent.click(screen.getByRole("tab", { name: "Participantes" }));
    expect(await screen.findByRole("navigation", { name: "Paginação de participantes" })).toBeInTheDocument();
    expect(screen.getByText("25 inscritos nesta página")).toBeInTheDocument();
    expect(screen.getByText("0 presentes nesta página")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("checkbox", { name: /selecionar todos os filtrados/i }));
    expect(screen.getByRole("button", { name: "Confirmar presença (25)" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));

    expect(await screen.findByText("Participante 026")).toBeInTheDocument();
    expect(screen.queryByText("Participante 001")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Confirmar presença (0)" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(await screen.findByText("Participante 051")).toBeInTheDocument();
    expect(screen.getByText("Mostrando 51–51 de 51")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ir para a página 2 de 3" }));
    expect(await screen.findByText("Participante 026")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Participante 051")).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /selecionar todos os filtrados/i }));
    expect(screen.getByRole("button", { name: "Confirmar presença (25)" })).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Nome ou e-mail"), {
      target: { value: "Participante 026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar participante" }));

    await waitFor(() => {
      expect(screen.queryByText("Participante 027")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Participante 026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar presença (0)" })).toBeDisabled();
    expect(screen.queryByRole("navigation", { name: "Paginação de participantes" })).not.toBeInTheDocument();
    const registrationUrls = authFetch.mock.calls
      .map(([url]) => url)
      .filter((url) => url.includes("/registrations"));
    expect(registrationUrls.at(-1)).toContain("page=1");
    expect(registrationUrls.at(-1)).toContain("search=Participante+026");

    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Participante 026 para check-in" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar presença (1)" }));
    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        "/events/evt-1/checkin/batch",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ tokens: ["token-026"] }),
        }),
      );
    });
  });

  it("concede certificado sem passar pelo check-in", async () => {
    const authFetch = await setupOrganizerPage((url, init) => {
      if (url.includes("/registrations")) return jsonResponse([registration]);
      if (
        url === "/events/registrations/reg-1/certificate/grant" &&
        init?.method === "POST"
      ) {
        return jsonResponse({
          ...registration,
          certificateGrantedAt: "2026-08-10T18:10:00.000Z",
        });
      }
      return null;
    });

    fireEvent.click(screen.getByRole("tab", { name: "Certificados" }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Conceder certificado para Participante Um",
      }),
    );

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        "/events/registrations/reg-1/certificate/grant",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("enfileira somente a página de 25 e limpa a seleção ao mudar de página", async () => {
    const pending = Array.from({ length: 51 }, (_, index) => ({
      ...registration,
      id: `reg-pending-${index + 1}`,
      status: "pending_match",
      attendeeName: `Pendente ${index + 1}`,
    }));
    const authFetch = await setupOrganizerPage((url, init) => {
      if (url.includes("/registrations")) {
        const page = Number(new URLSearchParams(url.split("?")[1]).get("page") ?? "1");
        return jsonResponse({ data: pending.slice((page - 1) * 25, page * 25), total: 51, page, totalPages: 3, limit: 25 });
      }
      if (url === "/events/certificate-invites/batch" && init?.method === "POST") {
        return jsonResponse({ batchId: "batch-1", total: 25, status: "queued", invalid: [] }, { status: 202 });
      }
      if (url === "/events/certificate-invites/batches/batch-1") {
        return jsonResponse({ batchId: "batch-1", status: "completed", total: 25, completed: 25, queued: 0, processing: 0, retry: 0, failed: 0, skipped: 0, items: [] });
      }
      return null;
    });

    fireEvent.click(screen.getByRole("tab", { name: "Certificados" }));
    expect(await screen.findByRole("navigation", { name: "Paginação de certificados" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("checkbox", { name: /selecionar todos os filtrados/i }));
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(await screen.findByRole("button", { name: "Enfileirar convites (0)" })).toBeDisabled();

    fireEvent.click(await screen.findByRole("checkbox", { name: /selecionar todos os filtrados/i }));
    fireEvent.click(screen.getByRole("button", { name: "Enfileirar convites (25)" }));
    await act(async () => {});
    expect(await screen.findByRole("progressbar")).toBeInTheDocument();

    const createCall = authFetch.mock.calls.find(([url, init]) => url === "/events/certificate-invites/batch" && init?.method === "POST");
    expect(JSON.parse(String(createCall?.[1]?.body)).registrationIds).toHaveLength(25);
  });

  it("não inicia acompanhamento quando nenhum convite novo é enfileirado", async () => {
    const pending = { ...registration, status: "pending_match" };
    const authFetch = await setupOrganizerPage((url, init) => {
      if (url.includes("/registrations")) return jsonResponse({ data: [pending], total: 1, page: 1, totalPages: 1, limit: 25 });
      if (url === "/events/certificate-invites/batch" && init?.method === "POST") {
        return jsonResponse({ batchId: "batch-empty", total: 0, status: "queued", invalid: [pending.id] }, { status: 202 });
      }
      return null;
    });

    fireEvent.click(screen.getByRole("tab", { name: "Certificados" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /selecionar todos os filtrados/i }));
    fireEvent.click(screen.getByRole("button", { name: "Enfileirar convites (1)" }));

    expect(await screen.findByText("Nenhum convite novo foi enfileirado.")).toBeInTheDocument();
    expect(screen.getByText("1 inscrição(ões) não puderam ser enfileiradas.")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enfileirar convites (0)" })).toBeDisabled();
    expect(authFetch.mock.calls.filter(([url]) => url === "/events/certificate-invites/batches/batch-empty")).toHaveLength(0);
  });

  it("pausa o acompanhamento do lote quando a aba fica oculta", async () => {
    const pending = { ...registration, status: "pending_match" };
    const authFetch = await setupOrganizerPage((url, init) => {
      if (url.includes("/registrations")) return jsonResponse({ data: [pending], total: 1, page: 1, totalPages: 1, limit: 25 });
      if (url === "/events/certificate-invites/batch" && init?.method === "POST") {
        return jsonResponse({ batchId: "batch-hidden", total: 1, status: "queued", invalid: [] }, { status: 202 });
      }
      if (url === "/events/certificate-invites/batches/batch-hidden") {
        return jsonResponse({ batchId: "batch-hidden", status: "completed", total: 1, completed: 1, queued: 0, processing: 0, retry: 0, failed: 0, skipped: 0, items: [] });
      }
      return null;
    });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    fireEvent.click(screen.getByRole("tab", { name: "Certificados" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /selecionar todos os filtrados/i }));
    fireEvent.click(screen.getByRole("button", { name: "Enfileirar convites (1)" }));
    vi.useFakeTimers();
    await act(async () => { vi.advanceTimersByTime(10_000); });
    expect(authFetch.mock.calls.filter(([url]) => url === "/events/certificate-invites/batches/batch-hidden")).toHaveLength(0);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => { vi.advanceTimersByTime(5_000); });
    expect(authFetch.mock.calls.filter(([url]) => url === "/events/certificate-invites/batches/batch-hidden")).toHaveLength(1);
    vi.useRealTimers();
  });

  it("retoma o lote pelo deep link, separa o resumo e seleciona falhas explicitamente", async () => {
    const pending = { ...registration, id: "reg-fail", status: "pending_match" };
    const authFetch = mockAuthFetchWithEvents((url, init) => {
      if (url.includes("/registrations")) {
        expect(url).toContain("certificateFilter=registration_pending");
        return jsonResponse({ data: [pending], total: 1, page: 1, totalPages: 1, limit: 25 });
      }
      if (url === "/events/certificate-invites/batches/batch-resume") {
        return jsonResponse({
          batchId: "batch-resume",
          status: "completed",
          total: 4,
          completed: 1,
          queued: 0,
          processing: 0,
          retry: 1,
          failed: 1,
          skipped: 1,
          items: [
            { registrationId: "reg-fail", status: "failed", attempts: 3, lastError: "SMTP timeout" },
          ],
        });
      }
      if (url === "/events/certificate-invites/batch" && init?.method === "POST") {
        return jsonResponse({ batchId: "batch-retry", total: 0, status: "queued", invalid: [] }, { status: 202 });
      }
      return null;
    });
    mockAuthFor(organizerUser, authFetch);
    window.history.pushState(
      {},
      "",
      "/admin/eventos-checkin?event=evt-1&tab=certificates&filter=registration_pending&batch=batch-resume",
    );
    renderWithMui(<CheckinApp />);

    expect(await screen.findByText(/1 enviados/)).toBeInTheDocument();
    expect(screen.getByText(/1 aguardando retry/)).toBeInTheDocument();
    expect(screen.getByText(/1 falhas/)).toBeInTheDocument();
    expect(screen.getByText(/1 ignorados por SMTP ausente/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Certificados" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(await screen.findByRole("button", { name: "Selecionar falhas para um novo lote (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Enfileirar convites (1)" }));

    await waitFor(() => {
      const retryCall = authFetch.mock.calls.find(
        ([url, init]) => url === "/events/certificate-invites/batch" && init?.method === "POST",
      );
      expect(JSON.parse(String(retryCall?.[1]?.body)).registrationIds).toEqual(["reg-fail"]);
    });
  });

  it("distingue estados e executa conceder antes de convidar como ações explícitas", async () => {
    const grantedPending = {
      ...registration,
      id: "reg-granted-pending",
      attendeeName: "Concedido Pendente",
      status: "pending_match",
      certificateGrantedAt: "2026-11-01T12:00:00.000Z",
    };
    const ungrantedPending = {
      ...registration,
      id: "reg-ungranted-pending",
      attendeeName: "Pendente Sem Concessão",
      status: "pending_match",
    };
    const authFetch = await setupOrganizerPage((url, init) => {
      if (url.includes("/registrations")) {
        return jsonResponse({ data: [grantedPending, ungrantedPending], total: 2, page: 1, totalPages: 1, limit: 25 });
      }
      if (url === "/events/registrations/reg-ungranted-pending/certificate/grant" && init?.method === "POST") {
        return jsonResponse({ ...ungrantedPending, certificateGrantedAt: "2026-11-11T12:00:00.000Z" });
      }
      if (url === "/events/certificate-invites/batch" && init?.method === "POST") {
        return jsonResponse({ batchId: "batch-combined", total: 0, status: "queued", invalid: [] }, { status: 202 });
      }
      return null;
    });

    fireEvent.click(screen.getByRole("tab", { name: "Certificados" }));
    expect(await screen.findByText("Concedido aguardando cadastro")).toBeInTheDocument();
    expect(screen.getByText("Cadastro pendente sem concessão")).toBeInTheDocument();
    expect(screen.getByText(/convite vincula a participação, não o certificado/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", {
      name: "Conceder e depois convidar para Pendente Sem Concessão",
    }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        "/events/registrations/reg-ungranted-pending/certificate/grant",
        expect.objectContaining({ method: "POST" }),
      );
      expect(authFetch).toHaveBeenCalledWith(
        "/events/certificate-invites/batch",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ registrationIds: ["reg-ungranted-pending"] }),
        }),
      );
    });
    const grantCall = authFetch.mock.calls.findIndex(([url]) => url.endsWith("/certificate/grant"));
    const inviteCall = authFetch.mock.calls.findIndex(([url]) => url === "/events/certificate-invites/batch");
    expect(grantCall).toBeLessThan(inviteCall);
  });
});

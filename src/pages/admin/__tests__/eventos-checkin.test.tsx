import React from "react";
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import EventosCheckinPage, {
  isCameraAvailable,
  translateCameraError,
} from "../eventos-checkin";
import { buildAuthState, mockUseAuth } from "../../../test-utils/auth";
import { jsonResponse } from "../../../test-utils/http";
import { mockHistory, resetRouterMocks } from "../../../test-utils/router";

// Usa o mock manual em src/__mocks__/qr-scanner.ts
jest.mock("qr-scanner");
jest.mock("../../../hooks/useAuth");

import { __state__ as qrState } from "../../../__mocks__/qr-scanner";

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

const organizerUser = {
  sub: "u-1",
  name: "Organizador",
  handle: "org",
  avatarUrl: "",
  roles: ["event_organizer"],
};

const checkerUser = {
  sub: "u-2",
  name: "Checker",
  handle: "chk",
  avatarUrl: "",
  roles: ["event_checker"],
};

const registration = {
  id: "reg-1",
  attendeeName: "Participante Um",
  attendeeEmail: "um@example.com",
  status: "confirmed",
  checkedInAt: null,
  checkinToken: "token-abc",
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

function mockAuthFetchWithEvents(extra?: (url: string, init?: RequestInit) => unknown) {
  return jest.fn(async (url: string, init?: RequestInit) => {
    const custom = extra?.(url, init);
    if (custom) return custom;
    if (url === "/events/checkin-scope")
      return jsonResponse({ managed: [managedEvent], external: [] });
    return jsonResponse(null, { ok: false, status: 404 });
  });
}

function mockMediaDevices() {
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: jest.fn().mockResolvedValue({}) },
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
  it("traduz NotAllowedError", () => {
    const err = Object.assign(new Error("x"), { name: "NotAllowedError" });
    expect(translateCameraError(err)).toMatch(/permiss/i);
  });

  it("traduz PermissionDeniedError", () => {
    const err = Object.assign(new Error("x"), { name: "PermissionDeniedError" });
    expect(translateCameraError(err)).toMatch(/permiss/i);
  });

  it("traduz NotFoundError", () => {
    const err = Object.assign(new Error("x"), { name: "NotFoundError" });
    expect(translateCameraError(err)).toMatch(/nenhuma câmera/i);
  });

  it("traduz NotReadableError", () => {
    const err = Object.assign(new Error("x"), { name: "NotReadableError" });
    expect(translateCameraError(err)).toMatch(/outro aplicativo/i);
  });

  it("traduz OverconstrainedError", () => {
    const err = Object.assign(new Error("x"), { name: "OverconstrainedError" });
    expect(translateCameraError(err)).toMatch(/não pôde ser iniciada/i);
  });

  it("traduz AbortError", () => {
    const err = Object.assign(new Error("x"), { name: "AbortError" });
    expect(translateCameraError(err)).toMatch(/interrompida/i);
  });

  it("traduz CameraTimeoutError (câmera sem resposta)", () => {
    const err = Object.assign(new Error("x"), { name: "CameraTimeoutError" });
    expect(translateCameraError(err)).toMatch(/demorou para responder/i);
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
    resetRouterMocks();
    window.history.pushState({}, "", "/");
    qrState.instance = null;
    qrState.hasCamera.mockResolvedValue(true);
    mockMediaDevices();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Acesso / autorização ─────────────────────────────────────────────────

  it("redireciona para home quando usuário não tem role de evento", async () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        isAdmin: false,
        authFetch: jest.fn() as any,
        user: { sub: "u-1", roles: ["member"] } as any,
      }),
    );

    render(<EventosCheckinPage />);

    await waitFor(() => {
      expect(mockHistory.replace).toHaveBeenCalledWith("/");
    });
  });

  it("event_checker tem acesso (role de check-in)", async () => {
    const authFetch = mockAuthFetchWithEvents((url) => {
      if (url.includes("/registrations")) return jsonResponse([]);
      return null;
    });
    mockUseAuth.mockReturnValue(
      buildAuthState({
        isAdmin: false,
        authFetch: authFetch as any,
        user: checkerUser as any,
      }),
    );

    window.history.pushState({}, "", "/admin/eventos-checkin?event=evt-1");
    render(<EventosCheckinPage />);

    expect(await screen.findByText(/check-in/i)).toBeInTheDocument();
    expect(mockHistory.replace).not.toHaveBeenCalled();
  });

  // ── Token manual ─────────────────────────────────────────────────────────

  it("carrega eventos, seleciona e confirma presença via token manual", async () => {
    const authFetch = mockAuthFetchWithEvents((url, init) => {
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

    mockUseAuth.mockReturnValue(
      buildAuthState({
        isAdmin: false,
        authFetch: authFetch as any,
        user: organizerUser as any,
      }),
    );

    window.history.pushState({}, "", "/admin/eventos-checkin?event=evt-1");
    render(<EventosCheckinPage />);

    expect(await screen.findByText(/1 inscrito na lista/i)).toBeInTheDocument();

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
    const authFetch = mockAuthFetchWithEvents((url, init) => {
      if (url.includes("/events/evt-1/registrations")) return jsonResponse([]);
      if (url.includes("/events/evt-1/checkin") && init?.method === "POST") {
        return jsonResponse({ message: "Not found" }, { ok: false, status: 404 });
      }
      return null;
    });

    mockUseAuth.mockReturnValue(
      buildAuthState({
        isAdmin: false,
        authFetch: authFetch as any,
        user: organizerUser as any,
      }),
    );

    window.history.pushState({}, "", "/admin/eventos-checkin?event=evt-1");
    render(<EventosCheckinPage />);

    fireEvent.change(await screen.findByLabelText("Token do QR Code"), {
      target: { value: "token-errado" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Confirmar$/i }));

    expect(await screen.findByText(/Token inválido/i)).toBeInTheDocument();
  });

  it("exibe feedback laranja para presença já confirmada", async () => {
    const authFetch = mockAuthFetchWithEvents((url, init) => {
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

    mockUseAuth.mockReturnValue(
      buildAuthState({
        isAdmin: false,
        authFetch: authFetch as any,
        user: organizerUser as any,
      }),
    );

    window.history.pushState({}, "", "/admin/eventos-checkin?event=evt-1");
    render(<EventosCheckinPage />);

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
      if (url === `/events/external/${encodedKey}/participants`)
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

    mockUseAuth.mockReturnValue(
      buildAuthState({
        isAdmin: false,
        authFetch: authFetch as any,
        user: organizerUser as any,
      }),
    );

    window.history.pushState(
      {},
      "",
      `/admin/eventos-checkin?event=external:${extKey}`,
    );
    render(<EventosCheckinPage />);

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith("/events/checkin-scope");
    });

    expect(await screen.findByText(/1 inscrito na lista/i)).toBeInTheDocument();

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
    mockUseAuth.mockReturnValue(
      buildAuthState({
        isAdmin: false,
        authFetch: mockAuthFetchWithEvents((url) => {
          if (url.includes("/registrations")) return jsonResponse([]);
          return null;
        }) as any,
        user: organizerUser as any,
      }),
    );

    window.history.pushState({}, "", "/admin/eventos-checkin?event=evt-1");
    render(<EventosCheckinPage />);

    await waitFor(() =>
      expect(screen.queryByText(/inscritos? na lista/i)).toBeInTheDocument(),
    );

    expect(screen.getByRole("button", { name: /Ativar câmera/i })).toBeInTheDocument();
  });

  it("ativa câmera: instancia QrScanner e exibe botão 'Parar câmera'", async () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        isAdmin: false,
        authFetch: mockAuthFetchWithEvents((url) => {
          if (url.includes("/registrations")) return jsonResponse([]);
          return null;
        }) as any,
        user: organizerUser as any,
      }),
    );

    window.history.pushState({}, "", "/admin/eventos-checkin?event=evt-1");
    render(<EventosCheckinPage />);

    await waitFor(() =>
      expect(screen.queryByText(/inscritos? na lista/i)).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Ativar câmera/i }));
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Parar câmera/i })).toBeInTheDocument(),
    );

    expect(qrState.instance).not.toBeNull();
    expect(qrState.instance!.start).toHaveBeenCalledTimes(1);
  });

  it("para câmera: chama stop() e destroy() no QrScanner", async () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        isAdmin: false,
        authFetch: mockAuthFetchWithEvents((url) => {
          if (url.includes("/registrations")) return jsonResponse([]);
          return null;
        }) as any,
        user: organizerUser as any,
      }),
    );

    window.history.pushState({}, "", "/admin/eventos-checkin?event=evt-1");
    render(<EventosCheckinPage />);

    await waitFor(() =>
      expect(screen.queryByText(/inscritos? na lista/i)).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Ativar câmera/i }));
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Parar câmera/i })).toBeInTheDocument(),
    );

    const scannerBeforeStop = qrState.instance!;

    fireEvent.click(screen.getByRole("button", { name: /Parar câmera/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Ativar câmera/i })).toBeInTheDocument(),
    );

    expect(scannerBeforeStop.stop).toHaveBeenCalledTimes(1);
    expect(scannerBeforeStop.destroy).toHaveBeenCalledTimes(1);
  });

  it("preview: wrapper oculto antes de ativar, visível com câmera ativa, oculto após parar", async () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        isAdmin: false,
        authFetch: mockAuthFetchWithEvents((url) => {
          if (url.includes("/registrations")) return jsonResponse([]);
          return null;
        }) as any,
        user: organizerUser as any,
      }),
    );

    window.history.pushState({}, "", "/admin/eventos-checkin?event=evt-1");
    render(<EventosCheckinPage />);

    await waitFor(() =>
      expect(screen.queryByText(/inscritos? na lista/i)).toBeInTheDocument(),
    );

    const wrapper = () => document.getElementById("checkin-camera-preview-wrapper")!;
    const video = () => document.getElementById("checkin-camera-preview") as HTMLVideoElement;

    // Wrapper controla a visibilidade (inicialmente oculto)
    expect(wrapper()).not.toBeVisible();
    // O vídeo nunca fica display:none: o qr-scanner zeraria o CSS dele
    // (width/height/opacity 0) ao detectar vídeo escondido, deixando a
    // preview invisível mesmo com o stream ativo.
    expect(video().style.display).toBe("block");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Ativar câmera/i }));
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Parar câmera/i })).toBeInTheDocument(),
    );
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

    mockUseAuth.mockReturnValue(
      buildAuthState({
        isAdmin: false,
        authFetch: mockAuthFetchWithEvents((url) => {
          if (url.includes("/registrations")) return jsonResponse([]);
          return null;
        }) as any,
        user: organizerUser as any,
      }),
    );

    window.history.pushState({}, "", "/admin/eventos-checkin?event=evt-1");
    render(<EventosCheckinPage />);

    await waitFor(() =>
      expect(screen.queryByText(/inscritos? na lista/i)).toBeInTheDocument(),
    );

    jest.useFakeTimers();
    try {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Ativar câmera/i }));
      });
      await act(async () => {
        jest.advanceTimersByTime(16000);
      });

      expect(screen.getByText(/demorou para responder/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Ativar câmera/i })).toBeInTheDocument();
      expect(screen.queryByText(/Ativando/i)).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it("dispara check-in ao receber token via QrScanner (simulateScan)", async () => {
    const authFetch = mockAuthFetchWithEvents((url, init) => {
      if (url.includes("/registrations")) return jsonResponse([registration]);
      if (url.includes("/checkin") && init?.method === "POST") {
        return jsonResponse({
          status: "checked_in",
          registration: {
            attendeeName: "Participante Um",
            attendeeEmail: "um@example.com",
            checkedInAt: null,
          },
        });
      }
      return null;
    });

    mockUseAuth.mockReturnValue(
      buildAuthState({
        isAdmin: false,
        authFetch: authFetch as any,
        user: organizerUser as any,
      }),
    );

    window.history.pushState({}, "", "/admin/eventos-checkin?event=evt-1");
    render(<EventosCheckinPage />);

    await waitFor(() =>
      expect(screen.queryByText(/inscritos? na lista/i)).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Ativar câmera/i }));
    });

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
    const authFetch = mockAuthFetchWithEvents((url, init) => {
      if (url.includes("/registrations")) return jsonResponse([]);
      if (url.includes("/checkin") && init?.method === "POST") {
        return jsonResponse({
          status: "checked_in",
          registration: {
            attendeeName: "Test",
            attendeeEmail: "t@t.com",
            checkedInAt: null,
          },
        });
      }
      return null;
    });

    mockUseAuth.mockReturnValue(
      buildAuthState({
        isAdmin: false,
        authFetch: authFetch as any,
        user: organizerUser as any,
      }),
    );

    window.history.pushState({}, "", "/admin/eventos-checkin?event=evt-1");
    render(<EventosCheckinPage />);

    await waitFor(() =>
      expect(screen.queryByText(/inscritos? na lista/i)).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Ativar câmera/i }));
    });

    await waitFor(() => expect(qrState.instance).not.toBeNull());

    await act(async () => {
      qrState.instance!.simulateScan("token-cooldown");
      qrState.instance!.simulateScan("token-cooldown");
      qrState.instance!.simulateScan("token-cooldown");
    });

    await waitFor(() => {
      const checkinCalls = (authFetch as jest.Mock).mock.calls.filter(
        ([url, init]) =>
          (url as string).includes("/checkin") && (init as RequestInit)?.method === "POST",
      );
      expect(checkinCalls).toHaveLength(1);
    });
  });

  // ── Câmera: sem getUserMedia ─────────────────────────────────────────────

  it("exibe aviso quando câmera não disponível no navegador", async () => {
    removeMediaDevices();

    mockUseAuth.mockReturnValue(
      buildAuthState({
        isAdmin: false,
        authFetch: mockAuthFetchWithEvents((url) => {
          if (url.includes("/registrations")) return jsonResponse([]);
          return null;
        }) as any,
        user: organizerUser as any,
      }),
    );

    window.history.pushState({}, "", "/admin/eventos-checkin?event=evt-1");
    render(<EventosCheckinPage />);

    await waitFor(() =>
      expect(screen.queryByText(/inscritos? na lista/i)).toBeInTheDocument(),
    );

    expect(
      screen.getByText(/a câmera não está disponível neste navegador/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ativar câmera/i })).not.toBeInTheDocument();
  });

  // ── Câmera: QrScanner.hasCamera() = false ───────────────────────────────

  it("exibe erro quando QrScanner.hasCamera() retorna false", async () => {
    qrState.hasCamera.mockResolvedValueOnce(false);

    mockUseAuth.mockReturnValue(
      buildAuthState({
        isAdmin: false,
        authFetch: mockAuthFetchWithEvents((url) => {
          if (url.includes("/registrations")) return jsonResponse([]);
          return null;
        }) as any,
        user: organizerUser as any,
      }),
    );

    window.history.pushState({}, "", "/admin/eventos-checkin?event=evt-1");
    render(<EventosCheckinPage />);

    await waitFor(() =>
      expect(screen.queryByText(/inscritos? na lista/i)).toBeInTheDocument(),
    );

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

    // Sobrescreve o start da próxima instância para rejeitar
    const originalMock = jest.requireMock("qr-scanner") as {
      default: jest.Mock & { hasCamera: jest.Mock };
    };
    const originalDefault = originalMock.default;
    const originalHasCamera = originalMock.default.hasCamera;

    originalMock.default = jest.fn(
      (_video: HTMLVideoElement, onDecode: (r: { data: string }) => void) => {
        const inst = {
          start: jest.fn().mockRejectedValueOnce(permError),
          stop: jest.fn(),
          destroy: jest.fn(),
          _onDecode: onDecode,
          simulateScan: (t: string) => onDecode({ data: t }),
        };
        qrState.instance = inst;
        return inst;
      },
    ) as unknown as typeof originalDefault;
    originalMock.default.hasCamera = originalHasCamera;

    mockUseAuth.mockReturnValue(
      buildAuthState({
        isAdmin: false,
        authFetch: mockAuthFetchWithEvents((url) => {
          if (url.includes("/registrations")) return jsonResponse([]);
          return null;
        }) as any,
        user: organizerUser as any,
      }),
    );

    window.history.pushState({}, "", "/admin/eventos-checkin?event=evt-1");
    render(<EventosCheckinPage />);

    await waitFor(() =>
      expect(screen.queryByText(/inscritos? na lista/i)).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Ativar câmera/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/permissão de câmera negada/i)).toBeInTheDocument();
    });

    // Restaura
    originalMock.default = originalDefault;
    originalMock.default.hasCamera = originalHasCamera;
  });

  // ── Lista de participantes ────────────────────────────────────────────────

  it("exibe botão 'Confirmar presença' na lista e realiza check-in", async () => {
    const authFetch = mockAuthFetchWithEvents((url, init) => {
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

    mockUseAuth.mockReturnValue(
      buildAuthState({
        isAdmin: false,
        authFetch: authFetch as any,
        user: organizerUser as any,
      }),
    );

    window.history.pushState({}, "", "/admin/eventos-checkin?event=evt-1");
    render(<EventosCheckinPage />);

    expect(await screen.findByText("Participante Um")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar presença/i }));

    expect(await screen.findByText(/Presença confirmada/i)).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith(
      "/events/evt-1/checkin",
      expect.objectContaining({ body: JSON.stringify({ token: "token-abc" }) }),
    );
  });

  it("event_checker não vê lista de participantes (canUseList=false)", async () => {
    const eventSemLista = { ...managedEvent, canUseList: false };
    const authFetch = jest.fn(async (url: string) => {
      if (url === "/events/checkin-scope")
        return jsonResponse({ managed: [eventSemLista], external: [] });
      if (url.includes("/registrations")) return jsonResponse([registration]);
      return jsonResponse(null, { ok: false, status: 404 });
    });

    mockUseAuth.mockReturnValue(
      buildAuthState({
        isAdmin: false,
        authFetch: authFetch as any,
        user: checkerUser as any,
      }),
    );

    window.history.pushState({}, "", "/admin/eventos-checkin?event=evt-1");
    render(<EventosCheckinPage />);

    await waitFor(() =>
      expect(screen.queryByText(/inscritos? na lista/i)).toBeInTheDocument(),
    );

    expect(
      screen.queryByRole("button", { name: /Buscar participante/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Participante Um")).not.toBeInTheDocument();
  });
});

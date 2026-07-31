import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EventosCheckinPage from "../eventos-checkin";
import { buildAuthState, mockUseAuth } from "../../../test-utils/auth";
import { jsonResponse } from "../../../test-utils/http";
import { mockHistory, resetRouterMocks } from "../../../test-utils/router";

jest.mock("../../../hooks/useAuth");

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

const registration = {
  id: "reg-1",
  attendeeName: "Participante Um",
  attendeeEmail: "um@example.com",
  status: "confirmed",
  checkedInAt: null,
  checkinToken: "token-abc",
};

function mockAuthFetchWithEvents(extra?: (url: string, init?: RequestInit) => unknown) {
  return jest.fn(async (url: string, init?: RequestInit) => {
    const custom = extra?.(url, init);
    if (custom) return custom;
    if (url === "/events/checkin-scope") return jsonResponse({ managed: [managedEvent], external: [] });
    return jsonResponse(null, { ok: false, status: 404 });
  });
}

describe("/admin/eventos-checkin", () => {
  beforeEach(() => {
    resetRouterMocks();
    window.history.pushState({}, "", "/");
  });

  it("redireciona para home quando usuário não tem role de evento", async () => {
    mockUseAuth.mockReturnValue(buildAuthState({
      isAdmin: false,
      authFetch: jest.fn() as any,
      user: { sub: "u-1", roles: ["member"] } as any,
    }));

    render(<EventosCheckinPage />);

    await waitFor(() => {
      expect(mockHistory.replace).toHaveBeenCalledWith("/");
    });
  });

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

    mockUseAuth.mockReturnValue(buildAuthState({
      isAdmin: false,
      authFetch: authFetch as any,
      user: organizerUser as any,
    }));

    // Seleção via query string: /admin/eventos-checkin?event=evt-1
    window.history.pushState({}, "", "/admin/eventos-checkin?event=evt-1");

    render(<EventosCheckinPage />);

    // Contador derivado da lista de inscrições
    expect(await screen.findByText(/1 inscrito na lista/i)).toBeInTheDocument();

    // Token manual
    fireEvent.change(screen.getByLabelText("Token do QR Code"), {
      target: { value: "token-abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Confirmar$/i }));

    expect(await screen.findByText(/Presença confirmada: Participante Um/i)).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith(
      "/events/evt-1/checkin",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ token: "token-abc" }) }),
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

    mockUseAuth.mockReturnValue(buildAuthState({
      isAdmin: false,
      authFetch: authFetch as any,
      user: organizerUser as any,
    }));

    window.history.pushState({}, "", "/admin/eventos-checkin?event=evt-1");

    render(<EventosCheckinPage />);

    fireEvent.change(await screen.findByLabelText("Token do QR Code"), {
      target: { value: "token-errado" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Confirmar$/i }));

    expect(await screen.findByText(/Token inválido/i)).toBeInTheDocument();
  });

  it("pré-seleciona evento externo e confirma presença pelo endpoint externo", async () => {
    const extKey = "meetup:devparana:ext-1";
    const activation = {
      id: "act-1",
      eventKey: extKey,
      features: ["checkin"],
      communityProjectKey: "devparana",
      title: "Meetup Externo",
      enabledByMemberId: "u-1",
    };
    const encodedKey = encodeURIComponent(extKey);

    const authFetch = mockAuthFetchWithEvents((url, init) => {
      if (url === "/events/checkin-scope") return jsonResponse({ managed: [], external: [activation] });
      if (url === `/events/external/${encodedKey}/participants`) {
        return jsonResponse([registration]);
      }
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

    mockUseAuth.mockReturnValue(buildAuthState({
      isAdmin: false,
      authFetch: authFetch as any,
      user: organizerUser as any,
    }));

    // Seleção via query string: /admin/eventos-checkin?event=external:<eventKey>
    window.history.pushState({}, "", `/admin/eventos-checkin?event=external:${extKey}`);

    render(<EventosCheckinPage />);

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith("/events/checkin-scope");
    });

    // Lista de participantes veio do endpoint externo
    expect(await screen.findByText(/1 inscrito na lista/i)).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith(`/events/external/${encodedKey}/participants`);

    // Token manual posta no endpoint externo com eventKey encodado
    fireEvent.change(screen.getByLabelText("Token do QR Code"), {
      target: { value: "token-abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Confirmar$/i }));

    expect(await screen.findByText(/Presença confirmada: Participante Um/i)).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith(
      `/events/external/${encodedKey}/checkin`,
      expect.objectContaining({ method: "POST", body: JSON.stringify({ token: "token-abc" }) }),
    );
  });
});

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EventMyRegistration from "..";
import { buildAuthState, mockUseAuth } from "../../../test-utils/auth";
import { jsonResponse } from "../../../test-utils/http";

jest.mock("../../../hooks/useAuth");

const API_URL = "http://localhost:3001";
const EVENT_ID = "event-1";
const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

function buildRegistration(overrides: Record<string, unknown> = {}) {
  return {
    id: "reg-1",
    status: "confirmed",
    checkedInAt: null,
    checkinToken: "token-abc-123",
    attendeeName: "Maria Silva",
    isPayerOnly: false,
    event: { id: EVENT_ID },
    activation: null,
    ...overrides,
  };
}

function renderComponent(props: Record<string, unknown> = {}) {
  return render(
    <EventMyRegistration
      apiUrl={API_URL}
      eventId={EVENT_ID}
      eventStartAt={FUTURE}
      {...props}
    />,
  );
}

describe("EventMyRegistration", () => {
  it("não renderiza nada quando o usuário não está logado", () => {
    mockUseAuth.mockReturnValue(buildAuthState({ isLoggedIn: false }));

    const { container } = renderComponent();

    expect(container).toBeEmptyDOMElement();
  });

  it("mostra QR Code e caption para inscrição confirmada em evento futuro", async () => {
    const authFetch = jest.fn(async () => jsonResponse([buildRegistration()]));
    const onOwnRegistration = jest.fn();
    mockUseAuth.mockReturnValue(buildAuthState({ authFetch: authFetch as any }));

    const { container } = renderComponent({ onOwnRegistration });

    expect(await screen.findByText("Você está inscrito(a)!")).toBeInTheDocument();
    expect(
      screen.getByText("Apresente este QR Code na entrada do evento"),
    ).toBeInTheDocument();
    expect(screen.getByText("token-abc-123")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
    await waitFor(() => {
      expect(onOwnRegistration).toHaveBeenCalledWith(true);
    });
  });

  it("emite certificado em evento passado com check-in e mostra link de verificação", async () => {
    const registration = buildRegistration({ checkedInAt: PAST });
    const authFetch = jest.fn(async (url: string) => {
      if (url.endsWith("/events/my-registrations")) return jsonResponse([registration]);
      if (url.endsWith(`/events/registrations/${registration.id}/certificate`)) {
        return jsonResponse({ verificationCode: "ABC-123" });
      }
      return jsonResponse(null, { ok: false, status: 404 });
    });
    mockUseAuth.mockReturnValue(buildAuthState({ authFetch: authFetch as any }));

    renderComponent({ eventStartAt: PAST, eventEndAt: PAST });

    expect(await screen.findByText("Este evento já aconteceu.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Emitir meu certificado/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        `${API_URL}/events/registrations/reg-1/certificate`,
      );
    });
    expect(await screen.findByText(/Certificado emitido! Código:/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Verificar autenticidade/i });
    expect(link).toHaveAttribute(
      "href",
      `${window.location.origin}/certificado/verificar?codigo=ABC-123`,
    );
  });

  it("não renderiza nada sem inscrição no evento e avisa onOwnRegistration(false)", async () => {
    const authFetch = jest.fn(async () =>
      jsonResponse([buildRegistration({ event: { id: "outro-evento" } })]),
    );
    const onOwnRegistration = jest.fn();
    mockUseAuth.mockReturnValue(buildAuthState({ authFetch: authFetch as any }));

    const { container } = renderComponent({ onOwnRegistration });

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(`${API_URL}/events/my-registrations`);
    });
    await waitFor(() => {
      expect(onOwnRegistration).toHaveBeenCalledWith(false);
    });
    expect(container).toBeEmptyDOMElement();
  });
});

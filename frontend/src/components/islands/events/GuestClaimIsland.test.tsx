import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GuestClaimIsland from "./GuestClaimIsland";
import { renderWithMui } from "../../../test/render-mui";
import { jsonResponse } from "../../../test/http-mock";

vi.mock("../ui/TurnstileField", () => ({
  default: ({ onTokenChange }: { onTokenChange: (token: string) => void }) => {
    queueMicrotask(() => onTokenChange("turnstile-token"));
    return <div>Verificação de segurança</div>;
  },
}));

describe("GuestClaimIsland", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("submits consent and Turnstile, then renders the check-in QR", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/events/public/guest-claim")) {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          token: "guest-token",
          name: "Convidado",
          email: "guest@example.test",
          consent: true,
          turnstileToken: "turnstile-token",
        });
        return jsonResponse({
          status: "confirmed", attendeeName: "Convidado",
          attendeeEmail: "gu***@example.test", checkinToken: "guest-token",
        });
      }
      return jsonResponse({
        status: "pending_guest", eventTitle: "Evento X", eventStartAt: "2026-12-01T19:00:00Z",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithMui(<GuestClaimIsland token="guest-token" />);

    await user.type(await screen.findByLabelText(/nome completo/i), "Convidado");
    await user.type(screen.getByLabelText(/e-mail/i), "guest@example.test");
    await user.click(screen.getByRole("checkbox", { name: /concordo/i }));
    await user.click(screen.getByRole("button", { name: /confirmar inscrição/i }));

    expect(await screen.findByRole("img", { name: /qr code de check-in/i })).toBeInTheDocument();
    expect(screen.getByText("Convidado")).toBeInTheDocument();
    expect(screen.getByText("gu***@example.test")).toBeInTheDocument();
  });
});

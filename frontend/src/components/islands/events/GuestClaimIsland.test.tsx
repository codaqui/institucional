import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GuestClaimIsland from "./GuestClaimIsland";
import { renderWithMui } from "../../../test/render-mui";
import { jsonResponse } from "../../../test/http-mock";

const authState = vi.hoisted(() => ({
  user: null as null | { sub: string; handle: string; name: string },
  login: vi.fn(),
  authFetch: vi.fn(),
}));

vi.mock("../../../lib/use-auth", () => ({
  useAuth: () => ({
    user: authState.user,
    ready: true,
    isLoggedIn: authState.user !== null,
    login: authState.login,
    authFetch: authState.authFetch,
  }),
}));

vi.mock("../ui/TurnstileField", () => ({
  default: ({ onTokenChange, resetKey }: { onTokenChange: (token: string) => void; resetKey: number }) => {
    queueMicrotask(() => onTokenChange("turnstile-token"));
    return <div data-testid="turnstile" data-reset-key={resetKey}>Verificação de segurança</div>;
  },
}));

describe("GuestClaimIsland", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    authState.user = null;
    authState.login = vi.fn();
    authState.authFetch = vi.fn();
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

  it("resets the Turnstile widget after a rejected claim", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/events/public/guest-claim")) {
        return jsonResponse({ message: "Verificação Turnstile recusada." }, { status: 403 });
      }
      return jsonResponse({ status: "pending_guest", eventTitle: "Evento X" });
    }));
    renderWithMui(<GuestClaimIsland token="guest-token" />);

    await user.type(await screen.findByLabelText(/nome completo/i), "Convidado");
    await user.type(screen.getByLabelText(/e-mail/i), "guest@example.test");
    await user.click(screen.getByRole("checkbox", { name: /concordo/i }));
    await user.click(screen.getByRole("button", { name: /confirmar inscrição/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Verificação Turnstile recusada.");
    expect(screen.getByTestId("turnstile")).toHaveAttribute("data-reset-key", "1");
  });

  function mockCertificateInvite() {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      status: "pending_guest",
      eventTitle: "DevPR Conf 26",
      requiresAccount: true,
    })));
  }

  function mockGitHubAccount() {
    authState.user = { sub: "member-1", handle: "ana", name: "Ana GitHub" };
  }

  it("starts GitHub login preserving the certificate invitation", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/eventos/convite?token=guest-token");
    mockCertificateInvite();
    renderWithMui(<GuestClaimIsland token="guest-token" />);

    await user.click(await screen.findByRole("button", { name: /entrar com github e associar certificado/i }));

    expect(authState.login).toHaveBeenCalledWith({
      returnTo: "/eventos/convite?token=guest-token",
    });
    expect(screen.queryByLabelText(/nome completo/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("turnstile")).not.toBeInTheDocument();
  });

  it("claims a certificate with the authenticated GitHub account", async () => {
    const user = userEvent.setup();
    mockGitHubAccount();
    mockCertificateInvite();
    authState.authFetch.mockResolvedValue(jsonResponse({
      status: "confirmed",
      attendeeName: "Ana GitHub",
      attendeeEmail: "an***@example.test",
      requiresAccount: true,
    }));
    renderWithMui(<GuestClaimIsland token="guest-token" />);

    await user.click(await screen.findByRole("button", { name: /associar certificado à minha conta/i }));

    expect(authState.authFetch).toHaveBeenCalledWith(
      "/events/public/guest-claim/github",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "guest-token", consent: true }),
      }),
    );
    expect(await screen.findByText(/participação vinculada à sua conta/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ver meus certificados/i })).toHaveAttribute("href", "/membro");
  });

  it("explains an email mismatch and offers account switching", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/eventos/convite?token=guest-token");
    mockGitHubAccount();
    mockCertificateInvite();
    authState.authFetch.mockResolvedValue(jsonResponse({
      message: "O e-mail do convite precisa estar verificado no GitHub da conta autenticada.",
    }, { status: 403 }));
    renderWithMui(<GuestClaimIsland token="guest-token" />);

    await user.click(await screen.findByRole("button", { name: /associar certificado à minha conta/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/precisa estar verificado no github/i);

    await user.click(screen.getByRole("button", { name: /trocar conta github/i }));
    expect(authState.login).toHaveBeenCalledWith({
      returnTo: "/eventos/convite?token=guest-token",
      switchAccount: true,
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import MyDataTab from "./MyDataTab";
import { renderWithMui } from "../../../../test/render-mui";
import { jsonResponse } from "../../../../test/http-mock";
import type { AuthUser } from "../../../../lib/auth-client";

const authState = vi.hoisted(() => ({
  user: null as AuthUser | null,
  ready: true,
  isLoggedIn: true,
  authFetch: vi.fn(),
}));

vi.mock("../../../../lib/use-auth", () => ({
  useAuth: () => ({
    user: authState.user,
    ready: authState.ready,
    isLoggedIn: authState.isLoggedIn,
    authFetch: authState.authFetch,
  }),
}));

const fields = [
  { key: "bio", label: "Bio", source: "Perfil do membro", purpose: "Apresentação pública" },
  { key: "linkedin", label: "LinkedIn", source: "Perfil do membro", purpose: "Link profissional" },
  { key: "sortcoins", label: "SortCoins", source: "Clube Codaqui", purpose: "Saldo opt-in" },
];
const visibility = { bio: true, linkedin: false, sortcoins: false };

function makeUser(): AuthUser {
  return {
    sub: "member-1",
    githubId: "gh-1",
    handle: "octocat",
    name: "Monalisa Octocat",
    email: "private@example.test",
    avatarUrl: "",
    roles: ["membro"],
  };
}

function mockVisibilityResponse() {
  return jsonResponse({ fields, visibility });
}

describe("MyDataTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = makeUser();
    authState.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/members/me/visibility" && init?.method === "PATCH") {
        return jsonResponse({ fields, visibility: { ...visibility, bio: false } });
      }
      if (path === "/members/me/visibility") return mockVisibilityResponse();
      return jsonResponse(null, { status: 404 });
    });
  });

  it("shows account data and saves a visibility toggle without logout", async () => {
    renderWithMui(<MyDataTab />);

    expect(
      await screen.findByText(
        (_, element) =>
          element?.tagName === "P" &&
          (element.textContent?.includes("private@example.test") ?? false),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/nunca é público/i)).toBeInTheDocument();
    const bioSwitch = screen.getByRole("switch", { name: /bio/i });
    expect(bioSwitch).toBeChecked();
    fireEvent.click(bioSwitch);
    fireEvent.click(screen.getByRole("button", { name: /salvar visibilidade/i }));

    expect(await screen.findByText(/visibilidade atualizada/i)).toBeInTheDocument();
    expect(authState.authFetch).toHaveBeenCalledWith("/members/me/visibility", {
      method: "PATCH",
      body: JSON.stringify({ bio: false, linkedin: false, sortcoins: false }),
    });
  });

  it("shows API errors without losing unsaved changes", async () => {
    authState.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/members/me/visibility" && init?.method === "PATCH") {
        return jsonResponse({ message: "Não foi possível salvar." }, { status: 400 });
      }
      if (path === "/members/me/visibility") return mockVisibilityResponse();
      return jsonResponse(null, { status: 404 });
    });
    renderWithMui(<MyDataTab />);

    const bioSwitch = await screen.findByRole("switch", { name: /bio/i });
    fireEvent.click(bioSwitch);
    fireEvent.click(screen.getByRole("button", { name: /salvar visibilidade/i }));

    expect(await screen.findByText("Não foi possível salvar.")).toBeInTheDocument();
    expect(bioSwitch).not.toBeChecked();
  });

  it("permite atualizar consentimento promocional independente e reativar após descadastro", async () => {
    authState.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/members/me/visibility") {
        return jsonResponse({
          fields,
          visibility,
          marketingEmailOptIn: false,
          marketingSuppressed: true,
        });
      }
      if (path === "/members/me/marketing-consent" && init?.method === "PATCH") {
        return jsonResponse({
          marketingEmailOptIn: true,
          marketingSuppressed: false,
        });
      }
      return jsonResponse(null, { status: 404 });
    });

    renderWithMui(<MyDataTab />);

    expect(
      await screen.findByText(/descadastro promocional ativo/i),
    ).toBeInTheDocument();
    const marketingSwitch = screen.getByRole("switch", {
      name: /receber comunicações promocionais/i,
    });
    expect(marketingSwitch).not.toBeChecked();

    fireEvent.click(marketingSwitch);
    fireEvent.click(
      screen.getByRole("button", { name: /confirmar reativação promocional/i }),
    );

    expect(
      await screen.findByText(/preferência de comunicações promocionais atualizada/i),
    ).toBeInTheDocument();
    expect(authState.authFetch).toHaveBeenCalledWith(
      "/members/me/marketing-consent",
      {
        method: "PATCH",
        body: JSON.stringify({ marketingEmailOptIn: true }),
      },
    );
  });
});

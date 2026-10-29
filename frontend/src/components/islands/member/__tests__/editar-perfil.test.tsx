/**
 * Testes da página de edição de perfil (`/membro/editar`) — form bio
 * (280 chars) + LinkedIn via GET/PUT `/members/me`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EditarPerfilApp from "../EditarPerfilApp";
import { renderWithMui } from "../../../../test/render-mui";
import type { AuthUser } from "../../../../lib/auth-client";

const authState = vi.hoisted(() => ({
  user: null as AuthUser | null,
  ready: false,
  isLoggedIn: false,
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

function jsonResponse(body: unknown, options: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

function makeUser(): AuthUser {
  return {
    sub: "user-1",
    githubId: "gh-1",
    name: "Mentoria Codaqui",
    handle: "mentoriacodaqui",
    avatarUrl: "https://example.com/avatar.png",
    roles: ["member"],
  };
}

function mockLoggedIn(authFetch: ReturnType<typeof vi.fn>) {
  authState.user = makeUser();
  authState.ready = true;
  authState.isLoggedIn = true;
  authState.authFetch = authFetch;
}

describe("/membro/editar", () => {
  beforeEach(() => {
    authState.user = null;
    authState.ready = false;
    authState.isLoggedIn = false;
    authState.authFetch = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redireciona para / quando não está logado", async () => {
    authState.ready = true;
    authState.isLoggedIn = false;
    const replace = vi.fn();
    vi.stubGlobal("location", { replace });

    renderWithMui(<EditarPerfilApp />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
  });

  it("carrega bio e LinkedIn de GET /members/me ao montar", async () => {
    const authFetch = vi.fn(async (url: string) => {
      if (url.includes("/members/me")) {
        return jsonResponse({
          bio: "Mentora de programação",
          linkedinUrl: "https://linkedin.com/in/mentoriacodaqui",
        });
      }
      return jsonResponse(null, { status: 404 });
    });
    mockLoggedIn(authFetch);

    renderWithMui(<EditarPerfilApp />);

    expect(await screen.findByDisplayValue("Mentora de programação")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("https://linkedin.com/in/mentoriacodaqui"),
    ).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith(
      expect.stringContaining("/members/me"),
    );
  });

  it(
    "bio tem limite de 280 caracteres e contador",
    async () => {
      const authFetch = vi.fn(async () => jsonResponse({ bio: "", linkedinUrl: "" }));
      mockLoggedIn(authFetch);

      renderWithMui(<EditarPerfilApp />);

      const bio = (await screen.findByLabelText(/bio/i)) as HTMLTextAreaElement;
      expect(bio).toHaveAttribute("maxLength", "280");
      expect(screen.getByText("0/280")).toBeInTheDocument();

      // Cola os 300 caracteres de uma vez em vez de digitar tecla a tecla:
      // o userEvent.paste aplica o maxLength como um navegador (mesma
      // asserção de truncamento), mas em 1 evento — o teste precisa ser
      // estruturalmente rápido no runner lento do CI.
      await userEvent.click(bio);
      await userEvent.paste("a".repeat(300));

      expect(bio.value).toHaveLength(280);
      expect(screen.getByText("280/280")).toBeInTheDocument();
    },
    15000,
  );

  it(
    "salva com PUT /members/me e exibe sucesso",
    async () => {
      const authFetch = vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("/members/me") && init?.method === "PUT") {
          return jsonResponse({ ok: true });
        }
        if (url.includes("/members/me")) {
          return jsonResponse({ bio: "", linkedinUrl: "" });
        }
        return jsonResponse(null, { status: 404 });
      });
      mockLoggedIn(authFetch);

      renderWithMui(<EditarPerfilApp />);

      const bio = await screen.findByLabelText(/bio/i);
      await userEvent.click(bio);
      await userEvent.paste("Nova bio");
      await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

      expect(
        await screen.findByText("Perfil atualizado com sucesso!"),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(authFetch).toHaveBeenCalledWith(
          expect.stringContaining("/members/me"),
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ bio: "Nova bio", linkedinUrl: "" }),
          }),
        );
      });
    },
    15000,
  );

  it("exibe erro quando o PUT falha", async () => {
    const authFetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/members/me") && init?.method === "PUT") {
        return jsonResponse({ message: "Erro ao salvar." }, { status: 500 });
      }
      if (url.includes("/members/me")) {
        return jsonResponse({ bio: "", linkedinUrl: "" });
      }
      return jsonResponse(null, { status: 404 });
    });
    mockLoggedIn(authFetch);

    renderWithMui(<EditarPerfilApp />);

    await screen.findByLabelText(/bio/i);
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(
      await screen.findByText("Não foi possível salvar as alterações. Tente novamente."),
    ).toBeInTheDocument();
  });
});

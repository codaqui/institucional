import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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
      if (path === "/members/me/deletion-request") return jsonResponse(null);
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
      if (path === "/members/me/deletion-request") return jsonResponse(null);
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
        body: JSON.stringify({
          marketingEmailOptIn: true,
          confirmReactivation: true,
        }),
      },
    );
  });

  it("atualiza a prévia com a visibilidade ainda não salva", async () => {
    renderWithMui(<MyDataTab />);

    const preview = await screen.findByRole("region", { name: "Prévia do perfil público" });
    expect(within(preview).getByText("Bio")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: /bio/i }));
    expect(within(preview).queryByText("Bio")).not.toBeInTheDocument();
  });

  it("baixa o JSON e revoga a URL temporária", async () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:export");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(globalThis.URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(globalThis.URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    authState.authFetch.mockImplementation(async (path: string) => {
      if (path === "/members/me/visibility") return mockVisibilityResponse();
      if (path === "/members/me/deletion-request") return jsonResponse(null);
      if (path === "/members/me/export") {
        return new Response('{"schemaVersion":1}', {
          headers: { "Content-Disposition": 'attachment; filename="codaqui-dados-octocat-2026-11-16.json"' },
        });
      }
      return jsonResponse(null, { status: 404 });
    });

    try {
      renderWithMui(<MyDataTab />);
      fireEvent.click(await screen.findByRole("button", { name: "Exportar meus dados" }));

      await screen.findByText(/exportação preparada/i);
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(click).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:export");
    } finally {
      click.mockRestore();
      delete (globalThis.URL as any).createObjectURL;
      delete (globalThis.URL as any).revokeObjectURL;
    }
  });

  it("não cria arquivo quando a exportação falha", async () => {
    const createObjectURL = vi.fn();
    Object.defineProperty(globalThis.URL, "createObjectURL", { value: createObjectURL, configurable: true });
    authState.authFetch.mockImplementation(async (path: string) => {
      if (path === "/members/me/visibility") return mockVisibilityResponse();
      if (path === "/members/me/deletion-request") return jsonResponse(null);
      if (path === "/members/me/export") return jsonResponse({ message: "Exportação indisponível" }, { status: 500 });
      return jsonResponse(null, { status: 404 });
    });

    try {
      renderWithMui(<MyDataTab />);
      fireEvent.click(await screen.findByRole("button", { name: "Exportar meus dados" }));
      expect(await screen.findByText("Exportação indisponível")).toBeInTheDocument();
      expect(createObjectURL).not.toHaveBeenCalled();
    } finally {
      delete (globalThis.URL as any).createObjectURL;
    }
  });

  it("aceita ausência de solicitação com resposta 200 e corpo vazio", async () => {
    authState.authFetch.mockImplementation(async (path: string) => {
      if (path === "/members/me/visibility") return mockVisibilityResponse();
      if (path === "/members/me/deletion-request") return new Response(null, { status: 200 });
      return jsonResponse(null, { status: 404 });
    });
    renderWithMui(<MyDataTab />);

    expect(await screen.findByRole("button", { name: "Solicitar exclusão" })).toBeInTheDocument();
    expect(screen.queryByText(/Unexpected end of JSON input/i)).not.toBeInTheDocument();
  });

  it("solicita e cancela exclusão com revisão explícita e sem remoção imediata", async () => {
    let latest: unknown = null;
    authState.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/members/me/visibility") return mockVisibilityResponse();
      if (path === "/members/me/deletion-request" && init?.method === "POST") {
        latest = { id: "request-1", status: "pending", requestedAt: "2026-11-16T12:00:00.000Z" };
        return jsonResponse(latest);
      }
      if (path === "/members/me/deletion-request/cancel") {
        latest = { ...(latest as object), status: "canceled" };
        return jsonResponse(latest);
      }
      if (path === "/members/me/deletion-request") return jsonResponse(latest);
      return jsonResponse(null, { status: 404 });
    });

    renderWithMui(<MyDataTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Solicitar exclusão" }));
    expect(await screen.findByText(/diretoria revisará o pedido/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));

    expect(await screen.findByText(/solicitação pendente de revisão/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Cancelar solicitação" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar cancelamento" }));
    await screen.findByText(/solicitação cancelada/i);
  });
});

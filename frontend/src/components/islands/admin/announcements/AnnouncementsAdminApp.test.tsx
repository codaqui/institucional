import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AnnouncementsAdminApp from "./AnnouncementsAdminApp";
import { renderWithMui } from "../../../../test/render-mui";
import { jsonResponse } from "../../../../test/http-mock";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock("../../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    isLoggedIn: true,
    isAdmin: true,
    user: { sub: "admin-1", handle: "admin", roles: ["admin"] },
    authFetch: mocks.authFetch,
  }),
}));

const announcement = {
  id: "announcement-1",
  text: "Estamos corrigindo funções do portal.",
  severity: "warning",
  linkUrl: "https://github.com/codaqui/institucional/issues",
  linkLabel: "Reportar bug",
  startsAt: "2026-11-11T10:00:00.000Z",
  endsAt: "2026-11-12T10:00:00.000Z",
  active: true,
  createdById: "admin-1",
  updatedById: "admin-1",
  createdAt: "2026-11-11T10:00:00.000Z",
  updatedAt: "2026-11-11T10:00:00.000Z",
};

function adminResponse(overrides: Record<string, unknown> = {}) {
  return jsonResponse({
    data: [announcement],
    total: 1,
    page: 1,
    totalPages: 1,
    limit: 50,
    ...overrides,
  });
}

describe("AnnouncementsAdminApp", () => {
  beforeEach(() => {
    mocks.authFetch.mockReset();
    mocks.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/announcements/admin?") && !init?.method) return adminResponse();
      if (path === "/announcements/admin" && init?.method === "POST") {
        return jsonResponse(announcement, { status: 201 });
      }
      return jsonResponse({ ...announcement, active: false });
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("blocks invalid text without making a create request", async () => {
    const user = userEvent.setup();
    renderWithMui(<AnnouncementsAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Novo anúncio" }));
    await user.type(screen.getByRole("textbox", { name: "Texto do anúncio" }), "<b>Manutenção</b>");
    await user.click(screen.getByRole("button", { name: "Criar anúncio" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/sem HTML ou Markdown/);
    expect(mocks.authFetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("edits with preview and sends only the public input fields", async () => {
    const user = userEvent.setup();
    renderWithMui(<AnnouncementsAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Editar" }));
    const input = screen.getByRole("textbox", { name: "Texto do anúncio" });
    await user.clear(input);
    await user.type(input, "Aviso atualizado");
    expect(screen.getByText("Prévia do anúncio")).toBeInTheDocument();
    expect(screen.getAllByText("Aviso atualizado").length).toBeGreaterThan(1);
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      const call = mocks.authFetch.mock.calls.find(
        ([path, init]) => path === "/announcements/admin/announcement-1" && init?.method === "PATCH",
      );
      expect(call).toBeDefined();
      expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ text: "Aviso atualizado" });
      expect(JSON.parse(String(call?.[1]?.body))).not.toHaveProperty("createdById");
    });
  });

  it("preserves the instant and offset when editing a display window", async () => {
    const user = userEvent.setup();
    renderWithMui(<AnnouncementsAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      const call = mocks.authFetch.mock.calls.find(
        ([path, init]) => path === "/announcements/admin/announcement-1" && init?.method === "PATCH",
      );
      const body = JSON.parse(String(call?.[1]?.body));
      expect(body.startsAt).toBe(announcement.startsAt);
      expect(body.endsAt).toBe(announcement.endsAt);
    });
  });

  it("rejects a link label without a link without making a request", async () => {
    const user = userEvent.setup();
    renderWithMui(<AnnouncementsAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Novo anúncio" }));
    await user.type(screen.getByRole("textbox", { name: "Texto do anúncio" }), "Aviso institucional");
    await user.type(screen.getByRole("textbox", { name: "Rótulo do link" }), "Saiba mais");
    await user.click(screen.getByRole("button", { name: "Criar anúncio" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Remova o rótulo ou informe um link.");
    expect(mocks.authFetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("requires confirmation before logical deactivation", async () => {
    const user = userEvent.setup();
    renderWithMui(<AnnouncementsAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Desativar" }));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/Desativar/));
    await waitFor(() => {
      expect(mocks.authFetch).toHaveBeenCalledWith(
        "/announcements/admin/announcement-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(await screen.findByText(/Anúncio desativado/)).toBeInTheDocument();
  });

  it("loads the next page through the shared pagination controls", async () => {
    const user = userEvent.setup();
    mocks.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/announcements/admin?") && !init?.method) {
        return adminResponse({ total: 51, totalPages: 2 });
      }
      return jsonResponse(announcement);
    });
    renderWithMui(<AnnouncementsAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Próxima página" }));

    await waitFor(() => {
      expect(
        mocks.authFetch.mock.calls.some(([url]) => url.includes("page=2")),
      ).toBe(true);
    });
  });
});

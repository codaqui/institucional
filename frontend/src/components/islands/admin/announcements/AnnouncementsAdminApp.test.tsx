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
  text: "Aviso de teste",
  severity: "warning",
  linkUrl: null,
  linkLabel: null,
  startsAt: null,
  endsAt: null,
  active: true,
  createdById: "admin-1",
  updatedById: "admin-1",
  createdAt: "2026-11-11T10:00:00.000Z",
  updatedAt: "2026-11-11T10:00:00.000Z",
};

describe("AnnouncementsAdminApp — desativação com confirmação MUI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("desativar anúncio abre diálogo e só deleta ao confirmar", async () => {
    mocks.authFetch
      .mockResolvedValueOnce(jsonResponse({ data: [announcement], total: 1, page: 1, totalPages: 1, limit: 50 }))
      .mockResolvedValueOnce(jsonResponse(announcement))
      .mockResolvedValueOnce(jsonResponse({ data: [], total: 0, page: 1, totalPages: 0, limit: 50 }))
      .mockResolvedValueOnce(jsonResponse({ data: [], total: 0, page: 1, totalPages: 0, limit: 50 }));

    renderWithMui(<AnnouncementsAdminApp />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /desativar/i }));

    expect(
      mocks.authFetch.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "DELETE"),
    ).toBe(false);

    await user.click(await screen.findByRole("button", { name: /confirmar/i }));
    await waitFor(() =>
      expect(
        mocks.authFetch.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "DELETE"),
      ).toBe(true),
    );
  });
});

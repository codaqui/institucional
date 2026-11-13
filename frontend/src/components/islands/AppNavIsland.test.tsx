import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import AppNavIsland from "./AppNavIsland";
import { renderWithMui } from "../../test/render-mui";

const mocks = vi.hoisted(() => ({
  state: { roles: ["admin"] as string[] },
}));

vi.mock("../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    isLoggedIn: true,
    isAdmin: mocks.state.roles.includes("admin"),
    user: {
      sub: "user-1",
      handle: "user",
      name: "User",
      roles: mocks.state.roles,
      avatarUrl: null,
    },
    login: vi.fn(),
    logout: vi.fn(),
    authFetch: vi.fn(),
  }),
}));

vi.mock("../../lib/use-designations", () => ({
  useMyDesignations: () => ({ data: [], loading: false, error: "", refresh: vi.fn() }),
  formatDesignationLabel: (d: { designation: string }) => d.designation,
}));

describe("AppNavIsland — item C4P", () => {
  beforeEach(() => {
    mocks.state.roles = ["admin"];
  });

  it.each([["admin"], ["event_organizer"], ["diretor"]])(
    "exibe o item C4P para %s",
    async (role) => {
      mocks.state.roles = [role];
      renderWithMui(<AppNavIsland currentPath="/admin/c4p" />);
      const link = await screen.findByRole("link", { name: /c4p/i });
      expect(link.getAttribute("href")).toBe("/admin/c4p");
    },
  );

  it("oculta o item C4P para membro sem papel", () => {
    mocks.state.roles = ["membro"];
    renderWithMui(<AppNavIsland currentPath="/membro" />);
    expect(screen.queryByRole("link", { name: /^c4p$/i })).toBeNull();
  });
});

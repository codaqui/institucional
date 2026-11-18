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

describe("AppNavIsland — C4P integrado às atividades", () => {
  beforeEach(() => {
    mocks.state.roles = ["admin"];
  });

  it.each([["admin"], ["event_organizer"], ["diretor"]])(
    "não apresenta item dedicado para %s",
    (role) => {
      mocks.state.roles = [role];
      renderWithMui(<AppNavIsland currentPath="/admin/c4p" />);
      expect(screen.queryByRole("link", { name: /^c4p$/i })).not.toBeInTheDocument();
    },
  );

  it("mantém Eventos como entrada da gestão", () => {
    mocks.state.roles = ["event_organizer"];
    renderWithMui(<AppNavIsland currentPath="/admin/eventos" />);
    expect(screen.getByRole("link", { name: "Eventos" })).toHaveAttribute("href", "/admin/eventos");
  });
});

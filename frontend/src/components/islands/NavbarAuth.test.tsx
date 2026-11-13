import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import NavbarAuth from "./NavbarAuth";
import { renderWithMui } from "../../test/render-mui";

const mocks = vi.hoisted(() => ({
  designations: [] as Array<{ id: string; targetType: string; targetId: string | null; targetKey: string | null; designation: string }>,
}));

vi.mock("../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    isLoggedIn: true,
    isAdmin: false,
    user: { sub: "user-1", handle: "user", name: "User", roles: ["membro"], avatarUrl: null },
    login: vi.fn(),
    logout: vi.fn(),
    authFetch: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../../lib/use-designations", () => ({
  useMyDesignations: () => ({ data: mocks.designations, loading: false, error: "", refresh: vi.fn() }),
  formatDesignationLabel: (d: { designation: string }) => d.designation,
}));

describe("NavbarAuth — avaliador C4P", () => {
  beforeEach(() => {
    mocks.designations = [];
  });

  it("mostra 'Avaliar propostas (C4P)' quando há designation evaluator", async () => {
    mocks.designations = [
      { id: "d1", targetType: "c4p_campaign", targetId: "call-1", targetKey: null, designation: "evaluator" },
    ];
    renderWithMui(<NavbarAuth variant="inline" />);
    const link = await screen.findByRole("link", { name: /avaliar propostas \(c4p\)/i });
    expect(link.getAttribute("href")).toBe("/c4p/avaliar");
  });

  it("oculta o item sem a designation", () => {
    renderWithMui(<NavbarAuth variant="inline" />);
    expect(screen.queryByRole("link", { name: /avaliar propostas/i })).toBeNull();
  });
});

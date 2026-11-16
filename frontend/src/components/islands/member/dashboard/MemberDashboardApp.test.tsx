import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MemberDashboardApp from "./MemberDashboardApp";
import { renderWithMui } from "../../../../test/render-mui";
import { jsonResponse } from "../../../../test/http-mock";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock("../../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    isLoggedIn: true,
    isAdmin: false,
    isFinanceAnalyzer: false,
    isEventOrganizer: false,
    isEventFinance: false,
    isEventHost: false,
    isEventChecker: false,
    user: { sub: "member-1", handle: "maria", name: "Maria", roles: ["membro"], avatarUrl: null },
    login: vi.fn(),
    logout: vi.fn(),
    authFetch: mocks.authFetch,
  }),
}));

describe("MemberDashboardApp — aba Financeiro", () => {
  it("a sub-aba se chama 'Reembolsos' (não 'SortCoins e reembolsos')", async () => {
    mocks.authFetch.mockImplementation((url: string) => {
      if (url.includes("transactions") || url.includes("registrations")) {
        return Promise.resolve(jsonResponse({ data: [], total: 0 }));
      }
      return Promise.resolve(jsonResponse([]));
    });
    renderWithMui(<MemberDashboardApp />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Financeiro" }));

    expect(await screen.findByRole("tab", { name: "Reembolsos" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /sortcoins e reembolsos/i })).toBeNull();
  });
});

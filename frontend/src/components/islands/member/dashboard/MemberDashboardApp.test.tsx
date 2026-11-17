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

function mockEmptyHistory() {
  mocks.authFetch.mockImplementation((url: string) => {
    if (url.includes("transactions") || url.includes("registrations")) {
      return Promise.resolve(jsonResponse({ data: [], total: 0 }));
    }
    return Promise.resolve(jsonResponse([]));
  });
}

describe("MemberDashboardApp — apoio e financeiro", () => {
  it("o filtro se chama Reembolsos, sem misturar SortCoins", async () => {
    mockEmptyHistory();
    renderWithMui(<MemberDashboardApp />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Apoio e financeiro" }));

    expect(await screen.findByRole("button", { name: "Reembolsos" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.queryByRole("button", { name: /sortcoins e reembolsos/i })).toBeNull();
  });

  it("Tudo reúne os três blocos e cada chip isola seu histórico", async () => {
    mockEmptyHistory();
    renderWithMui(<MemberDashboardApp />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Apoio e financeiro" }));

    expect(await screen.findByRole("button", { name: "Tudo" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await screen.findByText("Doações avulsas")).toBeInTheDocument();
    expect(await screen.findByText("Assinaturas Recorrentes")).toBeInTheDocument();
    expect(await screen.findByText("Minhas Solicitações de Reembolso")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Doações" }));
    expect(screen.queryByText("Assinaturas Recorrentes")).not.toBeInTheDocument();
    expect(screen.queryByText("Minhas Solicitações de Reembolso")).not.toBeInTheDocument();
    expect(screen.getByText("Doações avulsas")).toBeInTheDocument();
  });
});

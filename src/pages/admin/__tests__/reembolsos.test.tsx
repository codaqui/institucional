import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import ReembolsosPage from "../reembolsos";
import { buildAuthState, mockUseAuth } from "../../../test-utils/auth";
import { jsonResponse } from "../../../test-utils/http";
import { mockHistory, resetRouterMocks } from "../../../test-utils/router";

jest.mock("../../../hooks/useAuth");
jest.mock(
  "../../../components/AdminNavbar",
  () => require("../../../test-utils/admin-component-mocks").mockAdminNavbarModule,
);

describe("/admin/reembolsos", () => {
  beforeEach(() => {
    resetRouterMocks();
    globalThis.window.history.pushState({}, "", "/admin/reembolsos");
  });

  it.each([
    { role: "event_organizer", label: "organizador de eventos" },
    { role: "event_host", label: "anfitrião de evento" },
    { role: "event_checker", label: "credenciador" },
    { role: "event_finance", label: "financeiro de eventos" },
    { role: "member", label: "membro comum" },
  ])("redireciona $label para a home", async ({ role }) => {
    mockUseAuth.mockReturnValue(buildAuthState({
      authFetch: jest.fn() as any,
      user: { sub: "u1", roles: ["membro", role] } as any,
      isEventOrganizer: role === "event_organizer",
      isEventHost: role === "event_host",
      isEventChecker: role === "event_checker",
    }));

    render(<ReembolsosPage />);

    await waitFor(() => {
      expect(mockHistory.replace).toHaveBeenCalledWith("/");
    });
  });

  it.each([
    { role: "admin", label: "admin" },
    { role: "finance-analyzer", label: "finance analyzer" },
  ])("permite acesso a $label", async ({ role }) => {
    const authFetch = jest.fn(async (url: string) => {
      if (url.includes("/reimbursements")) {
        return jsonResponse({ data: [] });
      }
      if (url.includes("/ledger/community-balances")) {
        return jsonResponse([]);
      }
      return jsonResponse(null, { ok: false, status: 404 });
    });

    mockUseAuth.mockReturnValue(buildAuthState({
      authFetch: authFetch as any,
      user: { sub: "u1", roles: ["membro", role] } as any,
      isAdmin: role === "admin",
      isFinanceAnalyzer: role === "finance-analyzer",
      isEventFinance: role === "event_finance",
    }));

    render(<ReembolsosPage />);

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(expect.stringContaining("/reimbursements"));
    });

    expect(screen.getByRole("tab", { name: /Pendentes/i })).toBeInTheDocument();
  });
});

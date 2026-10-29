import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import {
  authState,
  jsonResponse,
  mockLoggedIn,
  resetAuthState,
  stubLocation,
} from "../../../../../test/admin-auth-fixtures";
import ReembolsosApp from "../ReembolsosApp";
import { renderWithMui } from "../../../../../test/render-mui";

/** O saldo das contas vem de um fetch público (sem auth). */
function stubBalancesFetch() {
  const fetchMock = vi.fn(async () => jsonResponse([]));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("/admin/reembolsos", () => {
  beforeEach(() => {
    resetAuthState();
    authState.authFetch = vi.fn(async (url: string) => {
      if (url.includes("/reimbursements")) {
        return jsonResponse({ data: [] });
      }
      return jsonResponse(null, { status: 404 });
    });
    stubBalancesFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    { role: "event_organizer", label: "organizador de eventos" },
    { role: "event_host", label: "anfitrião de evento" },
    { role: "event_checker", label: "credenciador" },
    { role: "event_finance", label: "financeiro de eventos" },
    { role: "membro", label: "membro comum" },
  ])("redireciona $label para a home", async ({ role }) => {
    const replace = stubLocation();
    try {
      mockLoggedIn(["membro", role]);

      renderWithMui(<ReembolsosApp />);

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/");
      });
      expect(authState.authFetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each([
    { role: "admin", label: "admin" },
    { role: "finance-analyzer", label: "finance analyzer" },
  ])("permite acesso a $label", async ({ role }) => {
    const balancesFetch = stubBalancesFetch();
    try {
      mockLoggedIn(["membro", role]);

      renderWithMui(<ReembolsosApp />);

      await waitFor(() => {
        expect(authState.authFetch).toHaveBeenCalledWith(
          expect.stringContaining("/reimbursements"),
        );
      });

      // saldos via endpoint público (fetch global, sem auth)
      expect(balancesFetch).toHaveBeenCalledWith(
        expect.stringContaining("/ledger/community-balances"),
      );
      expect(screen.getByRole("tab", { name: /Pendentes/i })).toBeInTheDocument();
      expect(
        screen.getByText(/Nenhuma solicitação pendente/i),
      ).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

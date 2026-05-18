import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LancamentoPage from "../lancamento";
import { buildAuthState, mockUseAuth } from "../../../test-utils/auth";
import { jsonResponse } from "../../../test-utils/http";
import { mockHistory, resetRouterMocks } from "../../../test-utils/router";

jest.mock("../../../hooks/useAuth");
jest.mock(
  "../../../components/AdminNavbar",
  () => require("../../../test-utils/admin-component-mocks").mockAdminNavbarModule,
);
jest.mock(
  "../../../components/AdminPageContainer",
  () => require("../../../test-utils/admin-component-mocks").mockAdminPageContainerModule,
);

describe("/admin/lancamento", () => {
  beforeEach(() => {
    resetRouterMocks();
    globalThis.window.history.pushState({}, "", "/admin/lancamento");
  });

  it("redireciona quando usuário não é admin", async () => {
    mockUseAuth.mockReturnValue(buildAuthState({
      authFetch: jest.fn() as any,
      user: { sub: "u1" } as any,
    }));

    render(<LancamentoPage />);

    await waitFor(() => {
      expect(mockHistory.replace).toHaveBeenCalledWith("/");
    });
  });

  it("valida campos obrigatórios no lançamento direto", async () => {
    const authFetch = jest.fn(async (url: string) => {
      if (url.endsWith("/ledger/accounts")) return jsonResponse([]);
      if (url.endsWith("/account-transfers")) return jsonResponse({ data: [] });
      return jsonResponse(null, { ok: false, status: 404 });
    });

    mockUseAuth.mockReturnValue(buildAuthState({
      isAdmin: true,
      authFetch: authFetch as any,
      user: { sub: "admin-1" } as any,
    }));

    render(<LancamentoPage />);

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(expect.stringContaining("/ledger/accounts"));
      expect(authFetch).toHaveBeenCalledWith(expect.stringContaining("/account-transfers"));
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Revisar lançamento/i }));

    expect(await screen.findByText(/Preencha os campos obrigatórios/i)).toBeInTheDocument();
  });

  it("cria conta externa e aprova solicitação de transferência pendente", async () => {
    const authFetch = jest.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith("/ledger/accounts") && !options) {
        return jsonResponse([
          { id: "a-1", name: "Conta A", type: "INTERNAL", projectKey: "tesouro" },
          { id: "a-2", name: "Conta B", type: "INTERNAL", projectKey: "devparana" },
        ]);
      }
      if (url.endsWith("/account-transfers") && !options) {
        return jsonResponse({
          data: [
            {
              id: "t-1",
              amount: 150,
              reason: "Ajuste de caixa",
              status: "pending",
              requestedBy: { name: "Pessoa", githubHandle: "pessoa" },
              reviewedBy: null,
              reviewNote: null,
              reviewedAt: null,
              createdAt: "2026-05-18T10:00:00.000Z",
              sourceAccount: { name: "Conta A" },
              destinationAccount: { name: "Conta B" },
            },
          ],
        });
      }
      if (url.endsWith("/ledger/accounts") && options?.method === "POST") {
        return jsonResponse({ id: "ext-1" });
      }
      if (url.endsWith("/account-transfers/t-1/approve") && options?.method === "PATCH") {
        return jsonResponse({ ok: true });
      }
        return jsonResponse(null, { ok: false, status: 404 });
    });

    mockUseAuth.mockReturnValue(buildAuthState({
      isAdmin: true,
      authFetch: authFetch as any,
      user: { sub: "admin-1" } as any,
    }));

    render(<LancamentoPage />);

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(expect.stringContaining("/ledger/accounts"));
      expect(authFetch).toHaveBeenCalledWith(expect.stringContaining("/account-transfers"));
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Criar conta externa/i }));
    fireEvent.change(screen.getByLabelText(/Nome da conta/i), {
      target: { value: "Gateway PIX Manual" },
    });
    fireEvent.change(screen.getByLabelText(/Project key/i), {
      target: { value: "pix-manual-codaqui" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Criar conta/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/ledger/accounts"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    const createCall = authFetch.mock.calls.find(
      ([url, opts]) => String(url).endsWith("/ledger/accounts") && (opts as RequestInit)?.method === "POST",
    );
    const createBody = JSON.parse((createCall?.[1] as RequestInit).body as string) as {
      name: string;
      type: string;
      projectKey: string;
    };
    expect(createBody).toEqual({
      name: "Gateway PIX Manual",
      type: "EXTERNAL",
      projectKey: "pix-manual-codaqui",
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /Criar conta externa/i }),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: /Transferências \(1 pendente\)/i }));
    fireEvent.click(screen.getByRole("button", { name: /Aprovar/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Aprovar$/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/account-transfers/t-1/approve"),
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });
});

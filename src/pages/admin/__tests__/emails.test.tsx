import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EmailsAdminPage from "../emails";
import { buildAuthState, mockUseAuth } from "../../../test-utils/auth";
import { jsonResponse } from "../../../test-utils/http";
import { mockHistory, resetRouterMocks } from "../../../test-utils/router";

jest.mock("../../../hooks/useAuth");
jest.mock(
  "../../../components/AdminNavbar",
  () => require("../../../test-utils/admin-component-mocks").mockAdminNavbarModule,
);

const failedLog = {
  id: "log-1",
  to: "participante@example.com",
  template: "event-confirmation",
  eventId: "evt-1",
  status: "failed",
  error: "SMTP timeout",
  createdAt: "2026-07-20T10:00:00.000Z",
};

const sentLog = {
  id: "log-2",
  to: "outro@example.com",
  template: "event-reminder",
  eventId: "evt-1",
  status: "sent",
  error: null,
  createdAt: "2026-07-19T10:00:00.000Z",
};

const listResponse = {
  items: [failedLog, sentLog],
  total: 2,
  summary: {
    sent: 9,
    failed: 1,
    byTemplate: {
      "event-confirmation": { sent: 7, failed: 1 },
      "event-reminder": { sent: 2, failed: 0 },
    },
  },
};

describe("/admin/emails", () => {
  beforeEach(() => {
    resetRouterMocks();
  });

  it("redireciona para home quando não é admin", async () => {
    mockUseAuth.mockReturnValue(buildAuthState({
      isAdmin: false,
      authFetch: jest.fn() as any,
      user: { sub: "u-1" } as any,
    }));

    render(<EmailsAdminPage />);

    await waitFor(() => {
      expect(mockHistory.replace).toHaveBeenCalledWith("/");
    });
  });

  it("carrega resumo e tabela paginada de e-mails", async () => {
    const authFetch = jest.fn(async (url: string) => {
      if (url.includes("/notifications/emails?")) return jsonResponse(listResponse);
      return jsonResponse(null, { ok: false, status: 404 });
    });

    mockUseAuth.mockReturnValue(buildAuthState({
      isAdmin: true,
      authFetch: authFetch as any,
      user: { sub: "admin-1" } as any,
    }));

    render(<EmailsAdminPage />);

    expect(await screen.findByText("participante@example.com")).toBeInTheDocument();
    expect(screen.getByText("outro@example.com")).toBeInTheDocument();
    expect(screen.getByText("Enviados")).toBeInTheDocument();
    expect(screen.getByText("Falhas")).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith(
      expect.stringContaining("page=1&pageSize=20"),
    );
  });

  it("reenvia e-mail com falha e exibe feedback de sucesso", async () => {
    const authFetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/notifications/emails/log-1/resend") && init?.method === "POST") {
        return jsonResponse({ ...failedLog, status: "sent", error: null });
      }
      if (url.includes("/notifications/emails?")) return jsonResponse(listResponse);
      return jsonResponse(null, { ok: false, status: 404 });
    });

    mockUseAuth.mockReturnValue(buildAuthState({
      isAdmin: true,
      authFetch: authFetch as any,
      user: { sub: "admin-1" } as any,
    }));

    render(<EmailsAdminPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Reenviar/i }));

    expect(
      await screen.findByText(/E-mail reenviado com sucesso para participante@example.com/i),
    ).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith(
      expect.stringContaining("/notifications/emails/log-1/resend"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

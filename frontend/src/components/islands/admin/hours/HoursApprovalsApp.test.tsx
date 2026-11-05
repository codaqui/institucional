import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../../test/render-mui";
import { jsonResponse } from "../../../../test/http-mock";
import HoursApprovalsApp from "./HoursApprovalsApp";

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  isAdmin: true,
  isFinanceAnalyzer: false,
  isLoggedIn: true,
}));

vi.mock("../../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    isLoggedIn: mocks.isLoggedIn,
    isAdmin: mocks.isAdmin,
    isFinanceAnalyzer: mocks.isFinanceAnalyzer,
    authFetch: mocks.authFetch,
  }),
}));

const pendingEntry = {
  id: "hour-1",
  memberId: "member-1",
  sourceType: "directorate_activity",
  sourceId: "11111111-1111-1111-1111-111111111111",
  sourceLabel: "Diretoria sintética",
  hours: 2.5,
  description: "Revisão de conteúdo",
  occurredAt: "2026-10-01T12:00:00.000Z",
  status: "pending",
  reportedById: "member-1",
  approvedById: null,
  approvedAt: null,
  rejectReason: null,
  idempotencyKey: "synthetic-review-1",
  createdAt: "2026-10-01T12:00:00.000Z",
  updatedAt: "2026-10-01T12:00:00.000Z",
};

function pendingResponse(overrides: Record<string, unknown> = {}) {
  return jsonResponse({
    data: [pendingEntry],
    total: 1,
    page: 1,
    totalPages: 1,
    limit: 50,
    ...overrides,
  });
}

function lastCall(path: string, method = "GET") {
  return mocks.authFetch.mock.calls.findLast(
    ([url, init]) => url === path && (init?.method ?? "GET") === method,
  );
}

describe("HoursApprovalsApp", () => {
  beforeEach(() => {
    mocks.isAdmin = true;
    mocks.isFinanceAnalyzer = false;
    mocks.isLoggedIn = true;
    mocks.authFetch.mockReset();
    mocks.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/hours/pending") && !init?.method) return pendingResponse();
      if (init?.method === "POST") return jsonResponse({ ...pendingEntry, status: "approved" });
      return jsonResponse({ message: `Rota inesperada: ${path}` }, { status: 500 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the standard paginated queue and requests another page", async () => {
    const user = userEvent.setup();
    mocks.authFetch.mockImplementation(async (path: string) => {
      if (path === "/hours/pending?page=1&limit=50") {
        return pendingResponse({ total: 51, totalPages: 2 });
      }
      if (path === "/hours/pending?page=2&limit=50") {
        return pendingResponse({
          data: [{ ...pendingEntry, id: "hour-2", description: "Segunda atividade" }],
          total: 51,
          page: 2,
          totalPages: 2,
        });
      }
      return jsonResponse({ message: "Rota inesperada" }, { status: 500 });
    });
    renderWithMui(<HoursApprovalsApp />);

    expect(await screen.findByText("Revisão de conteúdo")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Fila de aprovação de horas" })).toBeInTheDocument();
    expect(screen.getByText("Mostrando 1–50 de 51")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ir para a página 2 de 2" }));

    expect(await screen.findByText("Segunda atividade")).toBeInTheDocument();
    expect(lastCall("/hours/pending?page=2&limit=50")).toBeDefined();
  });

  it("approves a pending entry and refreshes the queue", async () => {
    const user = userEvent.setup();
    renderWithMui(<HoursApprovalsApp />);

    await user.click(
      await screen.findByRole("button", { name: "Aprovar Revisão de conteúdo" }),
    );

    await waitFor(() => expect(lastCall("/hours/hour-1/approve", "POST")).toBeDefined());
    expect(await screen.findByRole("status")).toHaveTextContent("Horas aprovadas com sucesso.");
    expect(lastCall("/hours/pending?page=1&limit=50")).toBeDefined();
  });

  it("moves from the emptied last page back to page 1 after approval", async () => {
    const user = userEvent.setup();
    let reviewed = false;
    let pageOneLoads = 0;
    mocks.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/hours/pending?page=1&limit=50") {
        pageOneLoads += 1;
        return pendingResponse({
          total: reviewed ? 1 : 51,
          totalPages: reviewed ? 1 : 2,
        });
      }
      if (path === "/hours/pending?page=2&limit=50") {
        return pendingResponse({
          data: reviewed ? [] : [{ ...pendingEntry, id: "hour-2", description: "Segunda atividade" }],
          total: reviewed ? 1 : 51,
          page: 2,
          totalPages: reviewed ? 1 : 2,
        });
      }
      if (path === "/hours/hour-2/approve" && init?.method === "POST") {
        reviewed = true;
        return jsonResponse({ ...pendingEntry, id: "hour-2", status: "approved" });
      }
      return jsonResponse({ message: `Rota inesperada: ${path}` }, { status: 500 });
    });
    renderWithMui(<HoursApprovalsApp />);

    await user.click(await screen.findByRole("button", { name: "Ir para a página 2 de 2" }));
    await user.click(
      await screen.findByRole("button", { name: "Aprovar Segunda atividade" }),
    );

    await waitFor(() => expect(pageOneLoads).toBe(2));
    expect(await screen.findByText("Revisão de conteúdo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ir para a página 2 de 2" })).not.toBeInTheDocument();
    expect(mocks.authFetch.mock.calls.filter(([path]) => path === "/hours/pending?page=2&limit=50")).toHaveLength(2);
  });

  it("requires a rejection reason, announces validation and submits the trimmed reason", async () => {
    const user = userEvent.setup();
    renderWithMui(<HoursApprovalsApp />);

    await user.click(
      await screen.findByRole("button", { name: "Rejeitar Revisão de conteúdo" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Rejeitar lançamento de horas" });
    await user.click(within(dialog).getByRole("button", { name: "Confirmar rejeição" }));

    expect(within(dialog).getByRole("alert")).toHaveTextContent("Informe o motivo da rejeição.");
    expect(within(dialog).getByLabelText(/^Motivo da rejeição/)).toHaveFocus();
    expect(lastCall("/hours/hour-1/reject", "POST")).toBeUndefined();

    await user.type(within(dialog).getByLabelText(/^Motivo da rejeição/), "  Comprovação insuficiente  ");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar rejeição" }));

    await waitFor(() => expect(lastCall("/hours/hour-1/reject", "POST")).toBeDefined());
    const call = lastCall("/hours/hour-1/reject", "POST");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ reason: "Comprovação insuficiente" });
    expect(await screen.findByRole("status")).toHaveTextContent("Horas rejeitadas com sucesso.");
  });

  it("surfaces review API errors in a live region", async () => {
    const user = userEvent.setup();
    mocks.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/hours/pending") && !init?.method) return pendingResponse();
      return jsonResponse({ message: "O lançamento já foi revisado." }, { status: 409 });
    });
    renderWithMui(<HoursApprovalsApp />);

    await user.click(
      await screen.findByRole("button", { name: "Aprovar Revisão de conteúdo" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("O lançamento já foi revisado.");
  });

  it("allows finance analyzers and redirects members without review permission", async () => {
    const replace = vi.fn();
    vi.stubGlobal("location", { replace });
    mocks.isAdmin = false;
    mocks.isFinanceAnalyzer = false;
    renderWithMui(<HoursApprovalsApp />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(mocks.authFetch).not.toHaveBeenCalled();
  });
});

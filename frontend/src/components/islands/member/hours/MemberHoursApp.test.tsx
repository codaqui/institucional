import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../../test/render-mui";
import { jsonResponse } from "../../../../test/http-mock";
import type { AuthUser } from "../../../../lib/auth-client";
import MemberHoursApp from "./MemberHoursApp";

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  user: null as AuthUser | null,
}));

vi.mock("../../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    isLoggedIn: mocks.user !== null,
    user: mocks.user,
    authFetch: mocks.authFetch,
  }),
}));

const member: AuthUser = {
  sub: "member-1",
  githubId: "gh-1",
  handle: "membro-teste",
  name: "Membro Sintético",
  avatarUrl: "",
  roles: ["membro"],
};

const entries = [
  {
    id: "hour-approved-1",
    memberId: "member-1",
    sourceType: "event_checkin",
    sourceId: "11111111-1111-1111-1111-111111111111",
    sourceLabel: "Encontro sintético",
    hours: 10,
    description: "Presença aprovada",
    occurredAt: "2026-06-10T12:00:00.000Z",
    status: "approved",
    reportedById: null,
    approvedById: "admin-1",
    approvedAt: "2026-06-11T12:00:00.000Z",
    rejectReason: null,
    idempotencyKey: null,
    createdAt: "2026-06-10T12:00:00.000Z",
    updatedAt: "2026-06-11T12:00:00.000Z",
  },
  {
    id: "hour-approved-2",
    memberId: "member-1",
    sourceType: "directorate_activity",
    sourceId: "22222222-2222-2222-2222-222222222222",
    sourceLabel: "Diretoria sintética",
    hours: "2.50",
    description: "Atividade aprovada",
    occurredAt: "2026-06-12T12:00:00.000Z",
    status: "approved",
    reportedById: "member-1",
    approvedById: "admin-1",
    approvedAt: "2026-06-13T12:00:00.000Z",
    rejectReason: null,
    idempotencyKey: "synthetic-2",
    createdAt: "2026-06-12T12:00:00.000Z",
    updatedAt: "2026-06-13T12:00:00.000Z",
  },
  {
    id: "hour-pending",
    memberId: "member-1",
    sourceType: "directorate_activity",
    sourceId: "33333333-3333-3333-3333-333333333333",
    sourceLabel: "Diretoria sintética",
    hours: 4,
    description: "Atividade pendente",
    occurredAt: "2026-06-14T12:00:00.000Z",
    status: "pending",
    reportedById: "member-1",
    approvedById: null,
    approvedAt: null,
    rejectReason: null,
    idempotencyKey: "synthetic-3",
    createdAt: "2026-06-14T12:00:00.000Z",
    updatedAt: "2026-06-14T12:00:00.000Z",
  },
  {
    id: "hour-rejected",
    memberId: "member-1",
    sourceType: "directorate_activity",
    sourceId: "44444444-4444-4444-4444-444444444444",
    sourceLabel: "Diretoria sintética",
    hours: 8,
    description: "Atividade rejeitada",
    occurredAt: "2026-06-15T12:00:00.000Z",
    status: "rejected",
    reportedById: "member-1",
    approvedById: "admin-1",
    approvedAt: "2026-06-16T12:00:00.000Z",
    rejectReason: "Fora do período",
    idempotencyKey: "synthetic-4",
    createdAt: "2026-06-15T12:00:00.000Z",
    updatedAt: "2026-06-16T12:00:00.000Z",
  },
];

const statement = {
  memberId: "member-1",
  from: "2026-01-01T00:00:00.000Z",
  to: "2026-12-31T00:00:00.000Z",
  totalHours: 12.5,
  entries: entries.slice(0, 2).map(({ id, sourceType, sourceLabel, hours, description, occurredAt }) => ({
    id,
    sourceType,
    sourceLabel,
    hours,
    description,
    occurredAt,
  })),
  verificationCode: "HRS-11111111-1111-1111-1111-111111111111",
};

describe("MemberHoursApp", () => {
  beforeEach(() => {
    mocks.user = member;
    mocks.authFetch.mockReset();
    mocks.authFetch.mockImplementation(async (path: string) => {
      if (path === "/hours/me") return jsonResponse(entries);
      if (path === "/hours/me/summary") return jsonResponse({ totalHours: 12.5 });
      if (path.startsWith("/hours/members/member-1/statement")) {
        return jsonResponse(statement);
      }
      return jsonResponse({ message: `Rota inesperada: ${path}` }, { status: 500 });
    });
    vi.spyOn(window, "print").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sums only approved hours and renders the member statement history", async () => {
    renderWithMui(<MemberHoursApp />);

    expect(await screen.findByText("12,50 horas")).toBeInTheDocument();
    expect(screen.getByText("Saldo aprovado")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Extrato de horas" })).toBeInTheDocument();
    expect(screen.getByText("Atividade pendente")).toBeInTheDocument();
    expect(screen.getByText("Atividade rejeitada")).toBeInTheDocument();
    expect(screen.getByText("Fora do período")).toBeInTheDocument();
    expect(mocks.authFetch).toHaveBeenCalledWith("/hours/me");
  });

  it("uses the aggregate approved balance instead of summing the limited statement", async () => {
    mocks.authFetch.mockImplementation(async (path: string) => {
      if (path === "/hours/me") return jsonResponse(entries);
      if (path === "/hours/me/summary") return jsonResponse({ totalHours: 1001.25 });
      return jsonResponse({ message: `Rota inesperada: ${path}` }, { status: 500 });
    });
    renderWithMui(<MemberHoursApp />);

    expect(await screen.findByText("1.001,25 horas")).toBeInTheDocument();
    expect(screen.queryByText("12,50 horas")).not.toBeInTheDocument();
    expect(mocks.authFetch).toHaveBeenCalledWith("/hours/me/summary");
  });

  it("prints only approved hours in the selected period", async () => {
    const user = userEvent.setup();
    renderWithMui(<MemberHoursApp />);
    await screen.findByText("12,50 horas");

    await user.type(screen.getByLabelText("Data inicial"), "2026-01-01");
    await user.type(screen.getByLabelText("Data final"), "2026-12-31");
    await user.click(screen.getByRole("button", { name: /emitir declaração/i }));

    const dialog = await screen.findByRole("dialog", { name: "Declaração de horas" });
    expect(within(dialog).getByText("12,50 horas")).toBeInTheDocument();
    expect(within(dialog).getByText("Membro Sintético")).toBeInTheDocument();
    expect(
      within(dialog).getByText("HRS-11111111-1111-1111-1111-111111111111"),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("Atividade pendente")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Atividade rejeitada")).not.toBeInTheDocument();
    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
    expect(mocks.authFetch).toHaveBeenCalledWith(
      "/hours/members/member-1/statement?from=2026-01-01&to=2026-12-31",
    );
  });

  it("announces statement errors without opening the print dialog", async () => {
    const user = userEvent.setup();
    mocks.authFetch.mockImplementation(async (path: string) => {
      if (path === "/hours/me") return jsonResponse(entries);
      if (path === "/hours/me/summary") return jsonResponse({ totalHours: 12.5 });
      return jsonResponse({ message: "Período inválido para a declaração de horas." }, { status: 409 });
    });
    renderWithMui(<MemberHoursApp />);
    await screen.findByText("12,50 horas");

    await user.click(screen.getByRole("button", { name: /emitir declaração/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Período inválido para a declaração de horas.",
    );
    expect(screen.queryByRole("dialog", { name: "Declaração de horas" })).not.toBeInTheDocument();
    expect(window.print).not.toHaveBeenCalled();
  });
});

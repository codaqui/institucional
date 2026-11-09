import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../test/render-mui";
import { jsonResponse } from "../../../test/http-mock";
import MentorProjectsIsland from "./MentorProjectsIsland";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock("../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    isLoggedIn: true,
    user: {
      sub: "mentor-1", githubId: "gh-1", handle: "mentor", name: "Mentor Sintético",
      avatarUrl: "", roles: ["mentor"],
    },
    authFetch: mocks.authFetch,
  }),
}));

const membership = {
  projectId: "b2d1507b-8b32-4f57-b8d0-fcf8d7a61f80",
  projectSlug: "projeto-sintetico",
  projectName: "Projeto sintético",
  role: "mentor",
  status: "active",
  reportDiscussionUrl: null,
  joinedAt: "2026-11-01T12:00:00.000Z",
};

const participant = {
  id: "participant-row-1",
  memberId: "70c0d1d0-8fd6-477d-b59c-eb48f37a1f18",
  role: "participant",
  member: { name: "Participante Sintético", handle: "participante" },
};

const pendingHour = {
  id: "86a2f2cf-b70b-4b6a-b489-e7e65a18b2a4",
  memberId: participant.memberId,
  sourceType: "extension_project",
  sourceId: membership.projectId,
  sourceLabel: membership.projectName,
  hours: 2,
  description: "Encontro inicial",
  occurredAt: "2026-11-02T12:00:00.000Z",
  status: "pending",
  reportedById: "mentor-1",
  approvedById: null,
  approvedAt: null,
  rejectReason: null,
  createdAt: "2026-11-02T12:00:00.000Z",
  updatedAt: "2026-11-02T12:00:00.000Z",
};

function call(path: string, method = "GET") {
  return mocks.authFetch.mock.calls.findLast(
    ([url, init]) => url === path && (init?.method ?? "GET") === method,
  );
}

describe("MentorProjectsIsland", () => {
  beforeEach(() => {
    mocks.authFetch.mockReset().mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/projects/my") return jsonResponse([membership]);
      if (path === `/projects/${membership.projectId}/participants`) return jsonResponse([participant]);
      if (path === `/projects/${membership.projectId}/hours` && !init?.method) return jsonResponse([pendingHour]);
      if (path === `/projects/${membership.projectId}/hours` && init?.method === "POST") return jsonResponse(pendingHour, { status: 201 });
      if (path === `/projects/${membership.projectId}/hours/${pendingHour.id}`) return jsonResponse({ ...pendingHour, hours: 3 });
      if (path === `/projects/${membership.projectId}`) return jsonResponse({ ...membership, status: "finished" });
      throw new Error(`Unexpected ${init?.method ?? "GET"} ${path}`);
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.stubGlobal("crypto", { randomUUID: () => "hour-idempotency-1" });
  });

  it("lists participants and records hours with an idempotency key", async () => {
    const user = userEvent.setup();
    renderWithMui(<MentorProjectsIsland />);

    await user.click(await screen.findByRole("button", { name: /^Gerenciar projeto/ }));
    expect((await screen.findAllByText(/Participante Sintético/)).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Lançar horas" }));
    await user.click(screen.getByRole("combobox", { name: /Participante/ }));
    await user.click(await screen.findByRole("option", { name: "Participante Sintético" }));
    await user.type(screen.getByLabelText(/Horas/), "2.5");
    await user.type(screen.getByLabelText(/Data da atividade/), "2026-11-02");
    await user.type(screen.getByLabelText(/Descrição/), "Mentoria do encontro");
    await user.click(screen.getByRole("button", { name: "Salvar horas" }));

    await waitFor(() => expect(call(`/projects/${membership.projectId}/hours`, "POST")).toBeDefined());
    expect(JSON.parse(String(call(`/projects/${membership.projectId}/hours`, "POST")?.[1]?.body))).toEqual({
      memberId: participant.memberId,
      hours: 2.5,
      occurredAt: "2026-11-02",
      description: "Mentoria do encontro",
      idempotencyKey: "hour-idempotency-1",
    });
  });

  it("edits only a pending entry without replacing its idempotency key", async () => {
    const user = userEvent.setup();
    renderWithMui(<MentorProjectsIsland />);

    await user.click(await screen.findByRole("button", { name: /^Gerenciar projeto/ }));
    await user.click(await screen.findByRole("button", { name: "Editar lançamento" }));
    await user.clear(screen.getByLabelText(/Horas/));
    await user.type(screen.getByLabelText(/Horas/), "3");
    await user.click(screen.getByRole("button", { name: "Salvar horas" }));

    await waitFor(() => expect(call(`/projects/${membership.projectId}/hours/${pendingHour.id}`, "PATCH")).toBeDefined());
    expect(JSON.parse(String(call(`/projects/${membership.projectId}/hours/${pendingHour.id}`, "PATCH")?.[1]?.body))).toEqual({
      memberId: participant.memberId,
      hours: 3,
      occurredAt: "2026-11-02",
      description: "Encontro inicial",
    });
  });

  it("finalizes an active project with its report Discussion", async () => {
    const user = userEvent.setup();
    renderWithMui(<MentorProjectsIsland />);

    await user.click(await screen.findByRole("button", { name: /^Gerenciar projeto/ }));
    await user.click(await screen.findByRole("button", { name: "Finalizar projeto" }));
    await user.type(screen.getByLabelText(/URL do relatório/), "https://github.com/codaqui/institucional/discussions/42");
    await user.click(screen.getByRole("button", { name: "Confirmar finalização" }));

    await waitFor(() => expect(call(`/projects/${membership.projectId}`, "PATCH")).toBeDefined());
    expect(JSON.parse(String(call(`/projects/${membership.projectId}`, "PATCH")?.[1]?.body))).toEqual({
      status: "finished",
      reportDiscussionUrl: "https://github.com/codaqui/institucional/discussions/42",
    });
  });
});

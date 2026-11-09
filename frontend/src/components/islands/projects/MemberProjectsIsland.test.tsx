import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../test/render-mui";
import { jsonResponse } from "../../../test/http-mock";
import MemberProjectsIsland from "./MemberProjectsIsland";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock("../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    isLoggedIn: true,
    user: {
      sub: "member-1", githubId: "gh-1", handle: "member", name: "Membro Sintético",
      avatarUrl: "", roles: ["membro"],
    },
    authFetch: mocks.authFetch,
  }),
}));

const membership = {
  projectId: "b2d1507b-8b32-4f57-b8d0-fcf8d7a61f80",
  projectSlug: "projeto-sintetico",
  projectName: "Projeto sintético",
  role: "participant",
  status: "finished",
  reportDiscussionUrl: "https://github.com/codaqui/institucional/discussions/42",
  joinedAt: "2026-11-01T12:00:00.000Z",
};

const hour = {
  id: "86a2f2cf-b70b-4b6a-b489-e7e65a18b2a4",
  memberId: "member-1",
  sourceType: "extension_project",
  sourceId: membership.projectId,
  sourceLabel: membership.projectName,
  hours: 4,
  description: "Encontro inicial",
  occurredAt: "2026-11-02T12:00:00.000Z",
  status: "approved",
  reportedById: "mentor-1",
  approvedById: "finance-1",
  approvedAt: "2026-11-03T12:00:00.000Z",
  rejectReason: null,
  idempotencyKey: "private-key",
  createdAt: "2026-11-02T12:00:00.000Z",
  updatedAt: "2026-11-03T12:00:00.000Z",
};

describe("MemberProjectsIsland", () => {
  beforeEach(() => {
    mocks.authFetch.mockReset().mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/projects/my") return jsonResponse([membership]);
      if (path === "/hours/me") return jsonResponse([hour]);
      if (path === `/project-certificates/projects/${membership.projectId}`) {
        return jsonResponse({
          id: "cert-1", projectId: membership.projectId, memberId: "member-1", kind: "participant",
          code: "PRJ-SINTETICO-1", hoursAtIssue: 4, issuedAt: "2026-11-04T12:00:00.000Z", createdById: "member-1",
        }, { status: 201 });
      }
      if (path === "/project-certificates/PRJ-SINTETICO-1") {
        return jsonResponse({
          valid: true, kind: "participant", memberName: "Membro Sintético",
          projectName: membership.projectName, hoursAtIssue: 4, issuedAt: "2026-11-04T12:00:00.000Z",
        });
      }
      throw new Error(`Unexpected ${init?.method ?? "GET"} ${path}`);
    });
  });

  it("shows own project hours and emits a printable declaration", async () => {
    const user = userEvent.setup();
    renderWithMui(<MemberProjectsIsland />);

    expect(await screen.findByText("Projeto sintético")).toBeInTheDocument();
    expect(screen.getByText("4 horas aprovadas")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Emitir declaração" }));

    expect(await screen.findByText("Declaração de participação")).toBeInTheDocument();
    expect(screen.getByText(/PRJ-SINTETICO-1/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Imprimir / salvar PDF" })).toBeInTheDocument();
    const issue = mocks.authFetch.mock.calls.find(([path]) => path === `/project-certificates/projects/${membership.projectId}`);
    expect(JSON.parse(String(issue?.[1]?.body))).toEqual({ kind: "participant" });
    await waitFor(() => expect(mocks.authFetch).toHaveBeenCalledWith("/project-certificates/PRJ-SINTETICO-1"));
  });

  it("keeps certificate authorization and validation errors visible", async () => {
    mocks.authFetch.mockImplementation(async (path: string) => {
      if (path === "/projects/my") return jsonResponse([membership]);
      if (path === "/hours/me") return jsonResponse([hour]);
      return jsonResponse({ message: "A declaração exige horas aprovadas no projeto." }, { status: 409 });
    });
    const user = userEvent.setup();
    renderWithMui(<MemberProjectsIsland />);

    await user.click(await screen.findByRole("button", { name: "Emitir declaração" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A declaração exige horas aprovadas no projeto.");
  });
});

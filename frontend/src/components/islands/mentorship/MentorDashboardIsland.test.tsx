import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../test/render-mui";
import { jsonResponse } from "../../../test/http-mock";
import { completeMenteeLinkFlow } from "../../../test/mentorship-session-fixtures";
import MentorDashboardIsland from "./MentorDashboardIsland";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn(), isAdmin: false, replace: vi.fn() }));
vi.mock("../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true, isLoggedIn: true, isAdmin: mocks.isAdmin,
    user: { sub: "member-1", handle: "ana", name: "Ana", roles: mocks.isAdmin ? ["admin"] : ["membro"] },
    authFetch: mocks.authFetch,
  }),
}));

const session = {
  id: "session-1", mentorId: "mentor-1", menteeName: "Bia", menteeEmail: "bia@x.dev",
  topicTags: ["DevOps"], scheduledAt: "2026-11-16T22:00:00.000Z", durationMin: 60,
  timeZone: "America/Sao_Paulo", status: "requested", meetLink: null,
};

describe("MentorDashboardIsland", () => {
  beforeEach(() => {
    mocks.isAdmin = false;
    mocks.replace.mockReset();
    vi.stubGlobal("location", { replace: mocks.replace });
    mocks.authFetch.mockReset().mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/mentorship/profile") return jsonResponse({ id: "mentor-1", areas: ["DevOps"], focus: "Carreira" });
      if (path === "/mentorship/sessions") return jsonResponse([session]);
      if (path.startsWith("/mentorship/member-options") || path === "/mentorship/sessions/session-1/mentee") {
        return jsonResponse(init?.method === "POST"
          ? { ...session, menteeMember: { id: "member-1", name: "Ana", githubHandle: "ana", avatarUrl: "avatar" } }
          : [{ id: "member-1", name: "Ana", githubHandle: "ana", avatarUrl: "avatar" }]);
      }
      return jsonResponse({ ...session, status: "confirmed", meetLink: "https://meet.example.test/session" }, { status: init?.method === "POST" ? 201 : 200 });
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("guides the mentor to publish weekly availability", async () => {
    renderWithMui(<MentorDashboardIsland />);

    expect(await screen.findByText("Cadastre ao menos um horário semanal para oferecer sessões na página pública.")).toBeInTheDocument();
  });

  it("confirms a request with an HTTPS meet link", async () => {
    const user = userEvent.setup();
    renderWithMui(<MentorDashboardIsland />);

    await user.type(await screen.findByLabelText(/^Link da sessão/), "https://meet.example.test/session");
    await user.click(screen.getByRole("button", { name: "Confirmar sessão" }));

    await waitFor(() => expect(mocks.authFetch).toHaveBeenCalledWith("/mentorship/sessions/session-1/confirm", expect.objectContaining({ method: "POST" })));
    const confirmCall = mocks.authFetch.mock.calls.find(([path]) => path === "/mentorship/sessions/session-1/confirm");
    expect(JSON.parse(String(confirmCall?.[1]?.body))).toEqual({ meetLink: "https://meet.example.test/session" });
    expect(await screen.findByText(/sessão confirmada/i)).toBeInTheDocument();
  });

  it("shows friendly session data, links a participant and reloads sessions", async () => {
    const user = userEvent.setup();
    renderWithMui(<MentorDashboardIsland />);

    expect(await screen.findByText("Solicitada")).toBeInTheDocument();
    expect(screen.getByText(/16\/11\/2026/)).toBeInTheDocument();
    expect(screen.getByText("Não vinculado à plataforma")).toBeInTheDocument();

    await completeMenteeLinkFlow(user);

    await waitFor(() => {
      expect(mocks.authFetch).toHaveBeenCalledWith(
        "/mentorship/sessions/session-1/mentee",
        expect.objectContaining({ method: "POST" }),
      );
      expect(mocks.authFetch.mock.calls.filter(([path]) => path === "/mentorship/sessions").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("redirects admins to mentorship administration before loading mentor data", async () => {
    mocks.isAdmin = true;
    renderWithMui(<MentorDashboardIsland />);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/admin/mentoria"));
    expect(mocks.authFetch).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../test/render-mui";
import { jsonResponse } from "../../../test/http-mock";
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
      return jsonResponse({ ...session, status: "confirmed", meetLink: "https://meet.example.test/session" }, { status: init?.method === "POST" ? 201 : 200 });
    });
  });

  afterEach(() => vi.unstubAllGlobals());

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

  it("redirects admins to mentorship administration before loading mentor data", async () => {
    mocks.isAdmin = true;
    renderWithMui(<MentorDashboardIsland />);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/admin/mentoria"));
    expect(mocks.authFetch).not.toHaveBeenCalled();
  });
});

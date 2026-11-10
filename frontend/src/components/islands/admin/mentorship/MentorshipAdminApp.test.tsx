import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../../test/render-mui";
import { jsonResponse } from "../../../../test/http-mock";
import MentorshipAdminApp from "./MentorshipAdminApp";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));
vi.mock("../../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true, isLoggedIn: true, isAdmin: true,
    user: { sub: "admin-1", handle: "admin", name: "Admin", roles: ["admin"] },
    authFetch: mocks.authFetch,
  }),
}));

describe("MentorshipAdminApp", () => {
  beforeEach(() => {
    mocks.authFetch.mockReset().mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/mentorship/applications") {
        return jsonResponse(init?.method === "POST" ? [] : [{ id: "application-1", memberId: "member-1", status: "pending", designation: "mentor" }]);
      }
      if (path.startsWith("/mentorship/sessions/admin")) {
        return jsonResponse({ data: [], total: 51, page: 1, totalPages: 2, limit: 50 });
      }
      if (path === "/mentorship/insights") {
        return jsonResponse({ completed: 2, activeMentors: 1, areas: [], noShowRate: 0, requested: 1, confirmed: 0, canceled: 0, noShow: 0 });
      }
      return jsonResponse({ id: "application-1", status: "active" }, { status: 201 });
    });
  });

  it("approves a mentor and uses server-side pagination", async () => {
    const user = userEvent.setup();
    renderWithMui(<MentorshipAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Aprovar mentor" }));
    await waitFor(() => expect(mocks.authFetch).toHaveBeenCalledWith("/mentorship/applications/application-1/confirm", expect.objectContaining({ method: "POST" })));
    expect(await screen.findByText(/mentor aprovado/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(mocks.authFetch).toHaveBeenCalledWith(
      expect.stringContaining("/mentorship/sessions/admin?page=2&limit=50"),
    ));
  });
});

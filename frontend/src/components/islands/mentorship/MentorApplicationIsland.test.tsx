import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../test/render-mui";
import { jsonResponse } from "../../../test/http-mock";
import MentorApplicationIsland from "./MentorApplicationIsland";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));
vi.mock("../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true, isLoggedIn: true, isAdmin: false,
    user: { sub: "member-1", handle: "ana", name: "Ana", roles: ["membro"] },
    authFetch: mocks.authFetch,
  }),
}));

describe("MentorApplicationIsland", () => {
  beforeEach(() => {
    mocks.authFetch.mockReset().mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/mentorship/applications/my") return jsonResponse([]);
      return jsonResponse({ id: "application-1", status: "pending" }, { status: init?.method === "POST" ? 201 : 200 });
    });
  });

  it("submits areas and focus for admin approval", async () => {
    const user = userEvent.setup();
    renderWithMui(<MentorApplicationIsland />);

    await user.type(screen.getByLabelText(/^Áreas/), "DevOps, Backend");
    await user.type(screen.getByLabelText("Foco"), "Carreira");
    await user.click(screen.getByRole("button", { name: "Enviar candidatura" }));

    await waitFor(() => expect(mocks.authFetch).toHaveBeenCalledWith("/mentorship/applications", expect.objectContaining({ method: "POST" })));
    expect(JSON.parse(String(mocks.authFetch.mock.calls[1][1]?.body))).toEqual({ areas: ["DevOps", "Backend"], focus: "Carreira" });
    expect(await screen.findByText(/candidatura enviada/i)).toBeInTheDocument();
  });
});

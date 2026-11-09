import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithMui } from "../../../test/render-mui";
import ProjectRegistrationIsland from "./ProjectRegistrationIsland";

const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));
vi.mock("../../../lib/use-auth", () => ({
  useAuth: () => ({
    user: { id: "member-1", githubHandle: "member", roles: ["membro"] },
    ready: true,
    isLoggedIn: true,
    isAdmin: false,
    authFetch: authFetchMock,
  }),
}));

describe("ProjectRegistrationIsland", () => {
  it("joins a project and confirms participation", async () => {
    authFetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "participation-1" }), { status: 201 }));
    renderWithMui(<ProjectRegistrationIsland projectId="project-1" />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /inscrever-se/i }));

    expect(authFetchMock).toHaveBeenCalledWith("/projects/project-1/join", { method: "POST" });
    expect(await screen.findByText(/inscrição confirmada/i)).toBeInTheDocument();
  });

  it("shows API errors without closing the form", async () => {
    authFetchMock.mockResolvedValue(new Response(JSON.stringify({ message: "Vagas esgotadas." }), { status: 409 }));
    renderWithMui(<ProjectRegistrationIsland projectId="project-1" />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /inscrever-se/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Vagas esgotadas.");
    expect(screen.getByRole("button", { name: /inscrever-se/i })).toBeInTheDocument();
  });
});

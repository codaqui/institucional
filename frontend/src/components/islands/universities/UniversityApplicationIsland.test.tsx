import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithMui } from "../../../test/render-mui";
import UniversityApplicationIsland from "./UniversityApplicationIsland";

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

const institutions = [{
  id: "ies-1",
  slug: "ies-exemplo",
  name: "IES Exemplo",
  website: null,
  city: { id: "city-1", name: "Maringá", uf: "PR" },
  ambassador: null,
}];

describe("UniversityApplicationIsland", () => {
  it("submits an ambassador application", async () => {
    authFetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "application-1" }), { status: 201 }));
    renderWithMui(<UniversityApplicationIsland institutions={institutions} />);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Instituição"), "ies-1");
    await user.type(screen.getByLabelText("Motivação"), "Quero apoiar o programa.");
    await user.click(screen.getByRole("button", { name: "Enviar candidatura" }));

    expect(authFetchMock).toHaveBeenCalledWith(
      "/universities/institutions/ies-1/ambassador-applications",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ applicationNotes: "Quero apoiar o programa." }),
      }),
    );
    expect(await screen.findByText(/candidatura registrada/i)).toBeInTheDocument();
  });

  it("shows API errors without closing the form", async () => {
    authFetchMock.mockResolvedValue(new Response(JSON.stringify({ message: "Candidatura duplicada." }), { status: 409 }));
    renderWithMui(<UniversityApplicationIsland institutions={institutions} />);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Instituição"), "ies-1");
    await user.type(screen.getByLabelText("Motivação"), "Quero apoiar o programa.");
    await user.click(screen.getByRole("button", { name: "Enviar candidatura" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Candidatura duplicada.");
    expect(screen.getByRole("button", { name: "Enviar candidatura" })).toBeInTheDocument();
  });
});

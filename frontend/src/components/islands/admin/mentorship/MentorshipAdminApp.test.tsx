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

let mentor = {
  id: "profile-1", memberId: "placeholder-1", name: "Matheus", githubHandle: "seed-matheus",
  avatarUrl: "", areas: ["Backend"], focus: "Carreira", active: false, isPlaceholder: true,
};

describe("MentorshipAdminApp", () => {
  beforeEach(() => {
    mentor = {
      id: "profile-1", memberId: "placeholder-1", name: "Matheus", githubHandle: "seed-matheus",
      avatarUrl: "", areas: ["Backend"], focus: "Carreira", active: false, isPlaceholder: true,
    };
    mocks.authFetch.mockReset().mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/mentorship/applications") {
        return jsonResponse(init?.method === "POST" ? [] : [{ id: "application-1", memberId: "member-1", status: "pending", designation: "mentor" }]);
      }
      if (path.startsWith("/mentorship/sessions/admin")) {
        return jsonResponse({ data: [], total: 51, page: 1, totalPages: 2, limit: 50 });
      }
      if (path.startsWith("/mentorship/admin/mentors")) {
        return jsonResponse(init?.method === "PATCH" ? mentor : { data: [mentor], total: 1, page: 1, totalPages: 1, limit: 50 });
      }
      if (path === "/admin/members") {
        return jsonResponse([{ id: "member-1", name: "Enderson", githubHandle: "enderson", avatarUrl: "", roles: ["admin"], isActive: true, joinedAt: "2026-01-01" }]);
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

  it("reassigns a placeholder with explicit confirmation and activates the mentor", async () => {
    const user = userEvent.setup();
    renderWithMui(<MentorshipAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Editar mentor Matheus" }));
    await user.click(screen.getByRole("combobox", { name: "Membro vinculado" }));
    await user.click(await screen.findByRole("option", { name: /Enderson/ }));
    await user.clear(screen.getByRole("textbox", { name: "Áreas" }));
    await user.type(screen.getByRole("textbox", { name: "Áreas" }), "Backend, .NET");
    await user.click(screen.getByRole("switch", { name: "Mentor ativo" }));
    await user.click(screen.getByRole("button", { name: "Salvar mentor" }));
    await user.click(await screen.findByRole("button", { name: "Confirmar reatribuição" }));

    await waitFor(() => expect(mocks.authFetch).toHaveBeenCalledWith("/mentorship/admin/mentors/profile-1", expect.objectContaining({ method: "PATCH" })));
    const patch = mocks.authFetch.mock.calls.find(([path, init]) => path === "/mentorship/admin/mentors/profile-1" && (init as RequestInit | undefined)?.method === "PATCH");
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ memberId: "member-1", areas: ["Backend", ".NET"], focus: "Carreira", active: true });
    expect(await screen.findByText(/mentor atualizado/i)).toBeInTheDocument();
    expect(mocks.authFetch.mock.calls.filter(([path]) => path === "/admin/members")).toHaveLength(1);
  });

  it("deactivates a mentor without reassigning the member", async () => {
    mentor = { ...mentor, memberId: "member-1", name: "Enderson", githubHandle: "enderson", active: true, isPlaceholder: false };
    const user = userEvent.setup();
    renderWithMui(<MentorshipAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Editar mentor Enderson" }));
    await user.click(screen.getByRole("switch", { name: "Mentor ativo" }));
    await user.click(screen.getByRole("button", { name: "Salvar mentor" }));

    await waitFor(() => expect(mocks.authFetch).toHaveBeenCalledWith("/mentorship/admin/mentors/profile-1", expect.objectContaining({ method: "PATCH" })));
    const patch = mocks.authFetch.mock.calls.find(([path, init]) => path === "/mentorship/admin/mentors/profile-1" && (init as RequestInit | undefined)?.method === "PATCH");
    expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({ memberId: "member-1", active: false });
  });
});

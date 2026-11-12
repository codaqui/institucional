import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import C4pAdminApp from "./C4pAdminApp";
import { renderWithMui } from "../../../../test/render-mui";
import { jsonResponse } from "../../../../test/http-mock";

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
}));

vi.mock("../../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    isLoggedIn: true,
    isAdmin: true,
    user: { sub: "admin-1", handle: "admin", roles: ["admin"] },
    authFetch: mocks.authFetch,
  }),
}));

const call = {
  id: "call-1",
  slug: "devpr-conf-2026",
  name: "C4P DevPR",
  status: "open",
  talksCount: 3,
  evaluatorsActiveCount: 2,
  votesCount: 4,
  createdAt: "2026-11-01T00:00:00.000Z",
};

describe("C4pAdminApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lista campanhas paginadas", async () => {
    mocks.authFetch.mockResolvedValue(
      jsonResponse({
        data: [call],
        total: 1,
        page: 1,
        totalPages: 1,
        limit: 50,
      }),
    );
    renderWithMui(<C4pAdminApp />);
    expect(await screen.findByText("C4P DevPR")).toBeTruthy();
    expect(screen.getByText(/3 propostas/i)).toBeTruthy();
  });

  it("cria campanha pelo dialog", async () => {
    mocks.authFetch
      .mockResolvedValueOnce(jsonResponse({ data: [], total: 0, page: 1, totalPages: 0, limit: 50 }))
      .mockResolvedValueOnce(jsonResponse({ id: "call-2", slug: "nova", status: "draft" }))
      .mockResolvedValueOnce(jsonResponse({ data: [call], total: 1, page: 1, totalPages: 1, limit: 50 }));
    renderWithMui(<C4pAdminApp />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /nova campanha/i }));
    await user.type(await screen.findByLabelText(/slug/i), "nova-campanha");
    await user.type(screen.getByLabelText(/nome/i), "Nova Campanha");
    await user.click(screen.getByRole("button", { name: /^criar$/i }));
    await waitFor(() =>
      expect(mocks.authFetch).toHaveBeenCalledWith(
        "/c4p/manage/calls",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const body = JSON.parse(
      (mocks.authFetch.mock.calls.find(([url]) => url === "/c4p/manage/calls")![1] as RequestInit)
        .body as string,
    );
    expect(body.slug).toBe("nova-campanha");
  });

  it("erro da API (slug reservado) exibe mensagem", async () => {
    mocks.authFetch
      .mockResolvedValueOnce(jsonResponse({ data: [], total: 0, page: 1, totalPages: 0, limit: 50 }))
      .mockResolvedValueOnce(
        jsonResponse({ message: "Este slug é reservado pelo sistema." }, { status: 400 }),
      );
    renderWithMui(<C4pAdminApp />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /nova campanha/i }));
    await user.type(await screen.findByLabelText(/slug/i), "public");
    await user.type(screen.getByLabelText(/nome/i), "Tentativa");
    await user.click(screen.getByRole("button", { name: /^criar$/i }));
    expect(await screen.findByText(/slug é reservado/i)).toBeTruthy();
  });
});

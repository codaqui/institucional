import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../test/render-mui";
import { jsonResponse } from "../../../test/http-mock";
import MentorDirectoryIsland from "./MentorDirectoryIsland";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));
vi.mock("../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true, isLoggedIn: false, isAdmin: false, user: null,
    login: vi.fn(), authFetch: mocks.authFetch,
  }),
}));

const mentor = {
  id: "mentor-1", handle: "ana", name: "Ana", avatarUrl: "avatar",
  areas: ["DevOps"], focus: "Carreira", availability: [],
};

describe("MentorDirectoryIsland", () => {
  beforeEach(() => {
    mocks.authFetch.mockReset().mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/mentorship/availability")) {
        return jsonResponse([{ scheduledAt: "2026-11-16T19:00", durationMin: 60, timeZone: "America/Sao_Paulo" }]);
      }
      if (path === "/mentorship/sessions" && init?.method === "POST") {
        return jsonResponse({ token: "token-1", status: "requested" }, { status: 201 });
      }
      return jsonResponse({ message: "not found" }, { status: 404 });
    });
  });

  it("books an available slot with accessible fields and guest consent", async () => {
    const user = userEvent.setup();
    renderWithMui(<MentorDirectoryIsland mentors={[mentor]} />);

    await user.click(screen.getByRole("button", { name: "Ver horários de Ana" }));
    await user.click(await screen.findByRole("button", { name: "Agendar 19:00" }));
    await user.type(screen.getByLabelText(/^Nome/), "Ana");
    await user.type(screen.getByLabelText(/^E-mail/), "ana@x.dev");
    await user.type(screen.getByLabelText(/^Temas/), "DevOps");
    await user.click(screen.getByRole("checkbox", { name: /consentimento/i }));
    await user.click(screen.getByRole("button", { name: "Solicitar sessão" }));

    await waitFor(() => expect(mocks.authFetch).toHaveBeenCalledWith("/mentorship/sessions", expect.objectContaining({ method: "POST" })));
    const body = JSON.parse(String(mocks.authFetch.mock.calls.find(([path]) => path === "/mentorship/sessions")?.[1]?.body));
    expect(body).toMatchObject({ mentorId: "mentor-1", menteeName: "Ana", menteeEmail: "ana@x.dev", topicTags: ["DevOps"] });
    expect(await screen.findByText(/sessão solicitada/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Acompanhar sessão" })).toHaveAttribute("href", "/mentoria/sessao/token-1");
  });
});

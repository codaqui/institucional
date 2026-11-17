import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../../test/render-mui";
import { jsonResponse } from "../../../../test/http-mock";
import ProjectMentorFields from "./ProjectMentorFields";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock("../../../../lib/use-auth", () => ({
  useAuth: () => ({ authFetch: mocks.authFetch }),
}));

const ana = {
  id: "ana-1",
  name: "Ana",
  githubHandle: "ana",
  avatarUrl: "ana.png",
};
const bruno = {
  id: "bruno-1",
  name: "Bruno",
  githubHandle: "bruno",
  avatarUrl: null,
};
const historic = {
  id: "old-1",
  name: "Histórico",
  githubHandle: "historico",
  avatarUrl: null,
};

describe("ProjectMentorFields", () => {
  beforeEach(() => {
    mocks.authFetch.mockReset();
    mocks.authFetch.mockResolvedValue(jsonResponse([ana]));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces member search by 300 ms", async () => {
    const user = userEvent.setup();
    renderWithMui(
      <ProjectMentorFields mentor={null} coMentors={[]} onChange={vi.fn()} />,
    );

    await user.type(screen.getByLabelText("Mentor principal"), "ana");
    expect(mocks.authFetch).not.toHaveBeenCalled();
    await waitFor(
      () => {
        expect(mocks.authFetch).toHaveBeenCalledWith(
          "/mentorship/member-options?search=ana",
        );
      },
      { timeout: 700 },
    );
  });

  it("removes a new principal from co-mentors", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithMui(
      <ProjectMentorFields
        mentor={null}
        coMentors={[ana, bruno]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByLabelText("Mentor principal"));
    await user.click(await screen.findByRole("option", { name: "Ana (@ana)" }));

    expect(onChange).toHaveBeenCalledWith(ana, [bruno]);
  });

  it("keeps selected historic members available when search returns other people", async () => {
    const user = userEvent.setup();
    renderWithMui(
      <ProjectMentorFields
        mentor={historic}
        coMentors={[]}
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Mentor principal");
    expect(input).toHaveValue("Histórico (@historico)");
    await user.type(input, "nova");

    expect(
      await screen.findByRole("option", { name: "Ana (@ana)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Histórico (@historico)" }),
    ).toBeInTheDocument();
  });
});

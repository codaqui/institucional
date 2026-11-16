import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MenteeLinkDialog from "./MenteeLinkDialog";
import { renderWithMui } from "../../../test/render-mui";
import { jsonResponse } from "../../../test/http-mock";

const member = { id: "member-1", name: "Ana", githubHandle: "ana", avatarUrl: "avatar" };

describe("MenteeLinkDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("searches members and assigns the selected one", async () => {
    const authFetch = vi.fn().mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/mentorship/member-options" || path === "/mentorship/member-options?search=ana") {
        return jsonResponse([member]);
      }
      if (path === "/mentorship/sessions/session-1/mentee" && init?.method === "POST") {
        return jsonResponse({ id: "session-1", menteeMember: member });
      }
      return jsonResponse({ message: "not found" }, { status: 404 });
    });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    renderWithMui(<MenteeLinkDialog sessionId="session-1" authFetch={authFetch} onClose={vi.fn()} onSaved={onSaved} />);

    const input = await screen.findByRole("combobox", { name: /membro da plataforma/i });
    await user.type(input, "ana");
    await user.click(await screen.findByRole("option", { name: /Ana \(@ana\)/i }));
    await user.click(screen.getByRole("button", { name: /vincular participante/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(authFetch).toHaveBeenCalledWith(
      "/mentorship/sessions/session-1/mentee",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ memberId: "member-1" }) }),
    );
  });

  it("does not submit without a selected member and shows API errors", async () => {
    const authFetch = vi.fn().mockImplementation(async (path: string) => {
      if (path === "/mentorship/member-options") return jsonResponse([]);
      return jsonResponse({ message: "Membro inválido" }, { status: 400 });
    });
    const user = userEvent.setup();
    renderWithMui(<MenteeLinkDialog sessionId="session-1" authFetch={authFetch} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole("button", { name: /vincular participante/i })).toBeDisabled();
    expect(authFetch).not.toHaveBeenCalledWith(
      "/mentorship/sessions/session-1/mentee",
      expect.anything(),
    );
  });
});

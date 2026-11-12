import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import C4pAdminDetailApp from "./C4pAdminDetailApp";
import { renderWithMui } from "../../../../test/render-mui";
import { jsonResponse } from "../../../../test/http-mock";

const mocks = vi.hoisted(() => {
  const state = { roles: ["admin"] as string[] };
  return {
    state,
    authFetch: vi.fn(),
  };
});

vi.mock("../../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    isLoggedIn: true,
    isAdmin: mocks.state.roles.includes("admin"),
    user: { sub: "user-1", handle: "user", roles: mocks.state.roles },
    authFetch: mocks.authFetch,
  }),
}));

const callDetail = {
  id: "call-1",
  slug: "devpr-conf-2026",
  name: "C4P DevPR",
  status: "open",
  criteria: [{ key: "relevancia", label: "Relevância", weight: 1 }],
  publicResults: false,
};

function seedDetail() {
  mocks.authFetch.mockResolvedValueOnce(jsonResponse(callDetail));
}

const talksPage = {
  data: [
    { id: "talk-1", title: "Palestra A", speakerName: "Maria", speakerEmail: "maria@example.com", track: null, level: null, origin: "public_form" as const, consentAt: "2026-11-01T00:00:00.000Z", createdAt: "2026-11-01T00:00:00.000Z" },
  ],
  total: 1,
  page: 1,
  totalPages: 1,
  limit: 50,
};

describe("C4pAdminDetailApp", () => {
  beforeEach(() => {
    mocks.authFetch.mockReset();
    mocks.state.roles = ["admin"];
  });

  it("finalizar envia os talkIds selecionados", async () => {
    seedDetail();
    mocks.authFetch
      .mockResolvedValueOnce(jsonResponse(talksPage))
      .mockResolvedValueOnce(jsonResponse(talksPage))
      .mockResolvedValueOnce(jsonResponse({ ...callDetail, status: "closed", selectedTalkIds: ["talk-1"], finalizedAt: "2026-11-12T00:00:00.000Z" }))
      .mockResolvedValueOnce(jsonResponse({ ...callDetail, status: "closed", selectedTalkIds: ["talk-1"], finalizedAt: "2026-11-12T00:00:00.000Z" }))
      .mockResolvedValueOnce(jsonResponse(talksPage));
    renderWithMui(<C4pAdminDetailApp callId="call-1" />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: /finalização/i }));
    await user.click(await screen.findByRole("checkbox", { name: /selecionar palestra a/i }));
    await user.click(screen.getByRole("button", { name: /finalizar campanha/i }));
    await user.click(await screen.findByRole("button", { name: /confirmar finalização/i }));
    await waitFor(() =>
      expect(mocks.authFetch).toHaveBeenCalledWith(
        "/c4p/manage/calls/call-1/finalize",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const body = JSON.parse(
      (mocks.authFetch.mock.calls.find(([url]) =>
        String(url).includes("/finalize"),
      )![1] as RequestInit).body as string,
    );
    expect(body.talkIds).toEqual(["talk-1"]);
  });

  it("organizer não-admin vê finalizar desabilitado", async () => {
    mocks.state.roles = ["event_organizer"];
    seedDetail();
    mocks.authFetch
      .mockResolvedValueOnce(jsonResponse(talksPage))
      .mockResolvedValueOnce(jsonResponse(talksPage));
    renderWithMui(<C4pAdminDetailApp callId="call-1" />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: /finalização/i }));
    const finalize = await screen.findByRole("button", { name: /finalizar campanha/i });
    expect((finalize as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/somente admin/i)).toBeTruthy();
  });

  it("importa CSV como text/csv", async () => {
    seedDetail();
    mocks.authFetch
      .mockResolvedValueOnce(jsonResponse(talksPage))
      .mockResolvedValueOnce(jsonResponse({ imported: 1, skipped: [] }))
      .mockResolvedValueOnce(jsonResponse(callDetail))
      .mockResolvedValueOnce(jsonResponse(talksPage));
    renderWithMui(<C4pAdminDetailApp callId="call-1" />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: /propostas/i }));
    const fileInput = await screen.findByLabelText(/arquivo csv/i);
    const file = new File(["Nome,Título\nJoão,Palestra X"], "propostas.csv", { type: "text/csv" });
    await user.upload(fileInput, file);
    await user.click(screen.getByRole("button", { name: /importar/i }));
    await waitFor(() =>
      expect(mocks.authFetch).toHaveBeenCalledWith(
        "/c4p/manage/calls/call-1/talks/import",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "text/csv" },
        }),
      ),
    );
    const init = mocks.authFetch.mock.calls.find(([url]) =>
      String(url).includes("/import"),
    )![1] as RequestInit;
    expect(init.body).toContain("João");
  });
});

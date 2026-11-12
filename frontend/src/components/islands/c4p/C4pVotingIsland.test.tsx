import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import C4pVotingIsland from "./C4pVotingIsland";
import { renderWithMui } from "../../../test/render-mui";
import { jsonResponse } from "../../../test/http-mock";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock("../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    isLoggedIn: true,
    user: { sub: "eval-1", handle: "evaluator", roles: ["membro"] },
    authFetch: mocks.authFetch,
  }),
}));

const criteria = [
  { key: "relevancia", label: "Relevância Prática", weight: 1 },
  { key: "clareza", label: "Clareza do Resumo", weight: 1 },
];

const talk = {
  id: "talk-1",
  title: "Palestra A",
  summary: "Resumo.",
  level: "Iniciante",
  track: "Frontend",
  speakerName: "Maria",
  speakerRole: null,
  linkedin: null,
  bio: null,
  photoUrl: null,
  spokeBefore: null,
  myVote: null,
};

describe("C4pVotingIsland", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza um slider por critério e salva o voto", async () => {
    mocks.authFetch
      .mockResolvedValueOnce(jsonResponse({ call: { id: "call-1", name: "C4P", criteria }, progress: { voted: 0, total: 1 } }))
      .mockResolvedValueOnce(
        jsonResponse([{ ...talk, myVote: null }]),
      )
      .mockResolvedValueOnce(jsonResponse({ id: "vote-1" }))
      .mockResolvedValueOnce(jsonResponse({ call: { id: "call-1", name: "C4P", criteria }, progress: { voted: 1, total: 1 } }))
      .mockResolvedValueOnce(
        jsonResponse([
          { ...talk, myVote: { scores: { relevancia: 5, clareza: 5 }, comment: null, updatedAt: "2026-11-12T00:00:00.000Z" } },
        ]),
      );

    renderWithMui(<C4pVotingIsland callId="call-1" />);
    expect(await screen.findByText("Relevância Prática")).toBeTruthy();
    expect(screen.getByText("Clareza do Resumo")).toBeTruthy();
    expect(screen.getByText(/0 de 1 avaliadas/i)).toBeTruthy();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /salvar avaliação/i }));
    await waitFor(() =>
      expect(mocks.authFetch).toHaveBeenCalledWith(
        "/c4p/evaluator/calls/call-1/talks/talk-1/vote",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
    const body = JSON.parse(
      (mocks.authFetch.mock.calls.find(([url]) =>
        String(url).includes("/vote"),
      )![1] as RequestInit).body as string,
    );
    expect(Object.keys(body.scores).sort()).toEqual(["clareza", "relevancia"]);
    expect(body.scores.relevancia).toBeGreaterThanOrEqual(0);
    expect(body.scores.relevancia).toBeLessThanOrEqual(10);
    await waitFor(() => expect(screen.getByText(/1 de 1 avaliadas/i)).toBeTruthy());
  });

  it("erro 409 exibe alerta de votação encerrada", async () => {
    mocks.authFetch
      .mockResolvedValueOnce(jsonResponse({ call: { id: "call-1", name: "C4P", criteria }, progress: { voted: 0, total: 1 } }))
      .mockResolvedValueOnce(jsonResponse([{ ...talk, myVote: null }]))
      .mockResolvedValueOnce(
        jsonResponse(
          { message: "A votação está encerrada nesta chamada." },
          { status: 409 },
        ),
      );
    renderWithMui(<C4pVotingIsland callId="call-1" />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /salvar avaliação/i }));
    expect(await screen.findByText(/votação está encerrada/i)).toBeTruthy();
  });
});

import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../test/render-mui";
import { jsonResponse, useFetchMock } from "../../../test/http-mock";
import MenteeSessionIsland from "./MenteeSessionIsland";

const fetchMock = useFetchMock();
const session = {
  scheduledAt: "2026-11-16T22:00:00.000Z", durationMin: 60, timeZone: "America/Sao_Paulo",
  status: "confirmed", meetLink: "https://meet.example.test/session", menteeName: "Bia",
  menteeEmail: "bia@x.dev", topicTags: ["DevOps"], rating: null, feedback: null, cancelReason: null,
};

describe("MenteeSessionIsland", () => {
  it("cancels by token with a reason", async () => {
    fetchMock.current.mockImplementation(async (_url, init?: RequestInit) => jsonResponse(
      init?.method === "POST" ? { ...session, status: "canceled", cancelReason: "Conflito" } : session,
    ));
    const user = userEvent.setup();
    renderWithMui(<MenteeSessionIsland token="token-1" />);

    await user.type(await screen.findByLabelText(/^Motivo do cancelamento/), "Conflito");
    await user.click(screen.getByRole("button", { name: "Cancelar sessão" }));

    await waitFor(() => expect(fetchMock.current).toHaveBeenCalledWith(
      expect.stringContaining("/mentorship/sessions/token-1/cancel"),
      expect.objectContaining({ method: "POST" }),
    ));
    expect(await screen.findByText(/sessão cancelada/i)).toBeInTheDocument();
  });

  it("rates a completed session", async () => {
    fetchMock.current.mockImplementation(async (_url, init?: RequestInit) => jsonResponse(
      init?.method === "POST" ? { ...session, status: "completed", rating: 5 } : { ...session, status: "completed" },
    ));
    const user = userEvent.setup();
    renderWithMui(<MenteeSessionIsland token="token-1" />);

    await user.selectOptions(await screen.findByLabelText("Avaliação"), "5");
    await user.type(screen.getByLabelText("Feedback"), "Ótima sessão");
    await user.click(screen.getByRole("button", { name: "Enviar avaliação" }));

    await waitFor(() => expect(fetchMock.current).toHaveBeenCalledWith(
      expect.stringContaining("/mentorship/sessions/token-1/rating"),
      expect.objectContaining({ method: "POST" }),
    ));
    expect(await screen.findByText(/avaliação registrada/i)).toBeInTheDocument();
  });
});

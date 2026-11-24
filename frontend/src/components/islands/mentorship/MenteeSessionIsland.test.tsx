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
  it("shows the session date in its time zone and a localized status", async () => {
    fetchMock.current.mockResolvedValue(jsonResponse(session));
    renderWithMui(<MenteeSessionIsland token="token-1" />);

    expect(await screen.findByText("16/11/2026, 19:00 · 60 min · America/Sao_Paulo")).toBeInTheDocument();
    expect(screen.getByText("Status: Confirmada")).toBeInTheDocument();
    expect(screen.queryByText(/2026-11-16T22:00:00.000Z/)).not.toBeInTheDocument();
  });

  it("offers a Google Calendar link with UTC dates when the session is confirmed", async () => {
    fetchMock.current.mockResolvedValue(jsonResponse(session));
    renderWithMui(<MenteeSessionIsland token="token-1" />);

    const link = await screen.findByRole("link", { name: "Adicionar ao Google Calendar" });
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("https://calendar.google.com/calendar/render?action=TEMPLATE")).toBe(
      true,
    );
    expect(href).toContain("dates=20261116T220000Z%2F20261116T230000Z");
    expect(href).toContain(
      encodeURIComponent("http://localhost/mentoria/sessao/token-1"),
    );
    expect(href).toContain(
      `location=${encodeURIComponent("https://meet.example.test/session")}`,
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it.each(["requested", "completed", "canceled"] as const)(
    "omits the Google Calendar link when the session is %s",
    async (status) => {
      fetchMock.current.mockResolvedValue(jsonResponse({ ...session, status }));
      renderWithMui(<MenteeSessionIsland token="token-1" />);

      await screen.findByText("Sessão de mentoria");
      expect(
        screen.queryByRole("link", { name: "Adicionar ao Google Calendar" }),
      ).not.toBeInTheDocument();
    },
  );

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

import React from "react";
import { render, screen } from "@testing-library/react";
import EventOverrideHistory from "../../EventOverrideHistory";
import { jsonResponse } from "../../../test-utils/http";

const entry = {
  sha: "abc123def4567890",
  message: "chore: override meetup:devparana:ext-1",
  authorHandle: "end",
  authorAvatarUrl: "https://avatars.githubusercontent.com/end?v=4",
  date: "2026-07-20T12:00:00.000Z",
  url: "https://github.com/codaqui/institucional/commit/abc123def4567890",
};

function renderHistory(authFetch: jest.Mock) {
  return render(
    <EventOverrideHistory
      apiUrl="http://localhost:3001"
      authFetch={authFetch as any}
      sourceKey="meetup:devparana"
      eventId="ext-1"
    />,
  );
}

describe("EventOverrideHistory", () => {
  it("renderiza a lista de edições com autor, mensagem e link do commit", async () => {
    const authFetch = jest.fn(async () => jsonResponse([entry]));

    renderHistory(authFetch);

    expect(await screen.findByText("@end")).toBeInTheDocument();
    expect(screen.getByText(/override meetup:devparana:ext-1/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir commit abc123d/i })).toHaveAttribute(
      "href",
      entry.url,
    );
    expect(screen.getByRole("link", { name: /Abrir commit abc123d/i })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(authFetch).toHaveBeenCalledWith(
      "http://localhost:3001/events/override/meetup%3Adevparana/ext-1/history",
    );
  });

  it("exibe estado vazio quando não há edições registradas", async () => {
    const authFetch = jest.fn(async () => jsonResponse([]));

    renderHistory(authFetch);

    expect(await screen.findByText("Nenhuma edição registrada.")).toBeInTheDocument();
  });

  it("exibe mensagem de erro quando a API falha", async () => {
    const authFetch = jest.fn(async () =>
      jsonResponse({ message: "erro" }, { ok: false, status: 500 }),
    );

    renderHistory(authFetch);

    expect(
      await screen.findByText("Não foi possível carregar o histórico."),
    ).toBeInTheDocument();
  });
});

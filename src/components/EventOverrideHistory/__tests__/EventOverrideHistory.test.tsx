import React from "react";
import { render, screen } from "@testing-library/react";
import EventOverrideHistory from "../../EventOverrideHistory";

function jsonResponse(data: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => data };
}

function renderHistory() {
  return render(
    <EventOverrideHistory
      apiUrl="http://localhost:3001"
      sourceKey="meetup:devparana"
      eventId="ext-1"
    />,
  );
}

describe("EventOverrideHistory", () => {
  beforeEach(() => {
    (globalThis.fetch as unknown as jest.Mock) = jest.fn();
  });

  it("renderiza o override atual com autor e data", async () => {
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue(
      jsonResponse({
        ownerHandle: "endersonmenezes",
        updatedAt: "2026-07-20T12:00:00.000Z",
        reason: "Corrigindo titulo",
      }),
    );

    renderHistory();

    expect(await screen.findByText("@endersonmenezes")).toBeInTheDocument();
    expect(screen.getByText(/Editado em/)).toBeInTheDocument();
    expect(screen.getByText(/Motivo: Corrigindo titulo/)).toBeInTheDocument();
    expect(globalThis.fetch as unknown as jest.Mock).toHaveBeenCalledWith(
      "http://localhost:3001/events/overrides/meetup%3Adevparana/ext-1",
    );
  });

  it("exibe estado vazio quando nao ha override (404)", async () => {
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue(
      jsonResponse(null, false, 404),
    );

    renderHistory();

    expect(
      await screen.findByText("Nenhum override ativo para este evento."),
    ).toBeInTheDocument();
  });

  it("exibe mensagem de erro quando a API falha", async () => {
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue(
      jsonResponse({ message: "erro" }, false, 500),
    );

    renderHistory();

    expect(
      await screen.findByText("Não foi possível carregar o override atual."),
    ).toBeInTheDocument();
  });
});

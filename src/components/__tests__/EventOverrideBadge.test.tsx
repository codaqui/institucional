import React from "react";
import { render, screen } from "@testing-library/react";
import EventOverrideBadge from "../EventOverrideBadge";
import type { EventOverride } from "../../utils/event-override";

const baseOverride: EventOverride = {
  eventId: "123",
  sourceKey: "meetup:devparana",
  extendData: { featured: true },
  ownerHandle: "organizador",
  updatedAt: "2026-04-29T23:00:00-03:00",
};

describe("EventOverrideBadge", () => {
  it("exibe o handle de quem verificou o evento", () => {
    render(<EventOverrideBadge override={baseOverride} />);
    expect(screen.getByText("Verificado por @organizador")).toBeInTheDocument();
  });

  it("usa o motivo do override como tooltip quando presente", () => {
    render(
      <EventOverrideBadge
        override={{ ...baseOverride, reason: "Corrigindo título do evento" }}
      />
    );
    expect(screen.getByTitle("Corrigindo título do evento")).toBeInTheDocument();
  });

  it("usa tooltip padrão quando não há motivo", () => {
    render(<EventOverrideBadge override={baseOverride} />);
    expect(
      screen.getByTitle("Metadados corrigidos pelo organizador")
    ).toBeInTheDocument();
  });
});

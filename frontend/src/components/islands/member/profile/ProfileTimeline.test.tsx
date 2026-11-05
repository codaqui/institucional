import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithMui } from "../../../../test/render-mui";
import ProfileTimeline from "./ProfileTimeline";

describe("ProfileTimeline", () => {
  it("renders approved entries as an accessible chronological list", () => {
    renderWithMui(
      <ProfileTimeline
        entries={[
          {
            id: "hour-1",
            sourceType: "event_checkin",
            sourceLabel: "Encontro sintético",
            hours: 2.5,
            description: "Presença aprovada",
            occurredAt: "2026-06-10T12:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Linha do tempo" })).toBeInTheDocument();
    const timeline = screen.getByRole("list", { name: "Linha do tempo de horas" });
    expect(within(timeline).getByText("Encontro sintético")).toBeInTheDocument();
    expect(within(timeline).getByText("Presença aprovada")).toBeInTheDocument();
    expect(within(timeline).getByText("2,50 horas")).toBeInTheDocument();
    expect(within(timeline).getByText("10/06/2026")).toBeInTheDocument();
  });

  it("renders nothing when there are no public entries", () => {
    const { container } = renderWithMui(<ProfileTimeline entries={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

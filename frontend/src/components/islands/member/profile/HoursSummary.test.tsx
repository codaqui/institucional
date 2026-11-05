import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithMui } from "../../../../test/render-mui";
import HoursSummary from "./HoursSummary";

describe("HoursSummary", () => {
  it("shows the approved total and textual states for the 10, 50 and 100 hour milestones", () => {
    renderWithMui(<HoursSummary totalHours={12.5} />);

    expect(screen.getByRole("heading", { name: "Horas aprovadas" })).toBeInTheDocument();
    expect(screen.getByText("12,50 horas")).toBeInTheDocument();
    const milestones = screen.getByRole("list", { name: "Marcos de horas" });
    expect(within(milestones).getByText("10 horas — alcançado")).toBeInTheDocument();
    expect(within(milestones).getByText("50 horas — ainda não alcançado")).toBeInTheDocument();
    expect(within(milestones).getByText("100 horas — ainda não alcançado")).toBeInTheDocument();
  });
});

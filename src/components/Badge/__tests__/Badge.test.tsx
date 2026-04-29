import React from "react";
import { render, screen } from "@testing-library/react";
import Badge from "../index";
import type { BadgeVariant } from "../index";

describe("Badge", () => {
  it("renders the label", () => {
    render(<Badge label="Iniciante" />);
    expect(screen.getByText("Iniciante")).toBeInTheDocument();
  });

  it("renders as a span element", () => {
    const { container } = render(<Badge label="Info" />);
    expect(container.querySelector("span")).toBeInTheDocument();
  });

  it("renders without errors when no variant is provided (uses default)", () => {
    expect(() => render(<Badge label="Padrão" />)).not.toThrow();
  });

  it.each<BadgeVariant>([
    "iniciante",
    "intermediario",
    "avancado",
    "info",
    "destaque",
    "novo",
  ])("renders without errors for variant '%s'", (variant) => {
    expect(() => render(<Badge label={variant} variant={variant} />)).not.toThrow();
    screen.getByText(variant);
  });

  it("renders the correct label for each variant", () => {
    const { rerender } = render(<Badge label="first" />);
    expect(screen.getByText("first")).toBeInTheDocument();

    rerender(<Badge label="second" variant="destaque" />);
    expect(screen.getByText("second")).toBeInTheDocument();
  });
});

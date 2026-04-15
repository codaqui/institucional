import React from "react";
import { render, screen } from "@testing-library/react";
import StatCard from "../index";

describe("StatCard", () => {
  const icon = <span data-testid="icon">📊</span>;

  it("renders label and value", () => {
    render(<StatCard icon={icon} value="42" label="Total" />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("renders icon", () => {
    render(<StatCard icon={icon} value="10" label="Count" />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it('renders with "outlined" variant by default', () => {
    const { container } = render(<StatCard icon={icon} value="5" label="Items" />);
    // Default variant renders a Card, not a Paper
    expect(container.querySelector(".MuiCard-root")).toBeInTheDocument();
  });

  it('renders with "filled" variant using Paper', () => {
    const { container } = render(<StatCard icon={icon} value="5" label="Items" variant="filled" />);
    expect(container.querySelector(".MuiPaper-root")).toBeInTheDocument();
  });

  it("accepts ReactNode as value", () => {
    render(<StatCard icon={icon} value={<span data-testid="skeleton">Loading...</span>} label="Stat" />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });
});

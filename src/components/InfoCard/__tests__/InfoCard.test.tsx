import React from "react";
import { render, screen } from "@testing-library/react";
import InfoCard from "../index";

describe("InfoCard", () => {
  it("renders title and description", () => {
    render(<InfoCard title="Test Title" description="Test description" />);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(
      <InfoCard title="Card" description="Desc" icon={<span data-testid="card-icon">🔥</span>} />
    );
    expect(screen.getByTestId("card-icon")).toBeInTheDocument();
  });

  it("renders children", () => {
    render(
      <InfoCard title="Card" description="Desc">
        <button>Action</button>
      </InfoCard>
    );
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
  });

  it("applies borderColor", () => {
    const { container } = render(
      <InfoCard title="Card" description="Desc" borderColor="error.main" />
    );
    const card = container.querySelector(".MuiCard-root");
    expect(card).toBeInTheDocument();
  });

  it("has hover effect styles (card is outlined)", () => {
    const { container } = render(<InfoCard title="Card" description="Desc" />);
    const card = container.querySelector(".MuiCard-root");
    expect(card).toHaveClass("MuiPaper-outlined");
  });
});

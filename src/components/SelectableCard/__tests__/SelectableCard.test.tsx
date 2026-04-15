import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SelectableCard from "../index";

describe("SelectableCard", () => {
  const defaultProps = {
    selected: false,
    onClick: jest.fn(),
    primary: "Community A",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders primary text", () => {
    render(<SelectableCard {...defaultProps} />);
    expect(screen.getByText("Community A")).toBeInTheDocument();
  });

  it("renders secondary text", () => {
    render(<SelectableCard {...defaultProps} secondary="Description" />);
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  it("shows CheckCircleIcon when selected", () => {
    const { container } = render(<SelectableCard {...defaultProps} selected />);
    expect(container.querySelector("[data-testid='CheckCircleIcon']")).toBeInTheDocument();
  });

  it("hides CheckCircleIcon when not selected", () => {
    const { container } = render(<SelectableCard {...defaultProps} selected={false} />);
    expect(container.querySelector("[data-testid='CheckCircleIcon']")).not.toBeInTheDocument();
  });

  it("renders avatar with src", () => {
    render(<SelectableCard {...defaultProps} avatar="https://example.com/avatar.png" />);
    const img = screen.getByRole("img", { name: "Community A" });
    expect(img).toHaveAttribute("src", "https://example.com/avatar.png");
  });

  it("renders avatarFallback", () => {
    render(<SelectableCard {...defaultProps} avatarFallback="CA" />);
    expect(screen.getByText("CA")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = jest.fn();
    render(<SelectableCard {...defaultProps} onClick={onClick} />);
    fireEvent.click(screen.getByText("Community A"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders in compact mode", () => {
    const { container } = render(<SelectableCard {...defaultProps} compact />);
    // Compact still renders a card
    expect(container.querySelector(".MuiCard-root")).toBeInTheDocument();
  });
});

import React from "react";
import { render, screen } from "@testing-library/react";
import LessonCard from "../index";

describe("LessonCard", () => {
  const defaultProps = {
    title: "Introdução ao Python",
    description: "Aprenda os fundamentos da linguagem.",
    to: "/trilhas/python/page-1",
  };

  it("renders the title", () => {
    render(<LessonCard {...defaultProps} />);
    expect(screen.getByText("Introdução ao Python")).toBeInTheDocument();
  });

  it("renders the description", () => {
    render(<LessonCard {...defaultProps} />);
    expect(screen.getByText("Aprenda os fundamentos da linguagem.")).toBeInTheDocument();
  });

  it("renders a link pointing to the 'to' prop", () => {
    render(<LessonCard {...defaultProps} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/trilhas/python/page-1");
  });

  it("renders the default emoji (📄) when none is provided", () => {
    render(<LessonCard {...defaultProps} />);
    expect(screen.getByText("📄")).toBeInTheDocument();
  });

  it("renders a custom emoji when provided", () => {
    render(<LessonCard {...defaultProps} emoji="🐍" />);
    expect(screen.getByText("🐍")).toBeInTheDocument();
  });

  it("renders the badge when provided", () => {
    render(<LessonCard {...defaultProps} badge="Novo" />);
    expect(screen.getByText("Novo")).toBeInTheDocument();
  });

  it("does not render a badge when omitted", () => {
    render(<LessonCard {...defaultProps} />);
    expect(screen.queryByText("Novo")).not.toBeInTheDocument();
  });

  it("renders the arrow indicator", () => {
    render(<LessonCard {...defaultProps} />);
    expect(screen.getByText("→")).toBeInTheDocument();
  });
});

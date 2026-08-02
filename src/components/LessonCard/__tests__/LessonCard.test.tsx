import React from "react";
import { render, screen } from "@testing-library/react";
import LessonCard from "../index";

describe("LessonCard", () => {
  const defaultProps = {
    title: "Introdução ao Python",
    description: "Aprenda os fundamentos da linguagem.",
    to: "/trilhas/python/page-1",
  };

  it.each([
    ["title", "Introdução ao Python"],
    ["description", "Aprenda os fundamentos da linguagem."],
    ["default emoji", "📄"],
    ["arrow indicator", "→"],
  ])("renders the %s", (_, text) => {
    render(<LessonCard {...defaultProps} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("renders a link pointing to the 'to' prop", () => {
    render(<LessonCard {...defaultProps} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/trilhas/python/page-1");
  });

  it("renders a custom emoji when provided", () => {
    render(<LessonCard {...defaultProps} emoji="🐍" />);
    expect(screen.getByText("🐍")).toBeInTheDocument();
  });

  it.each([
    ["renders the badge when provided", "Novo", true],
    ["does not render a badge when omitted", "Novo", false],
  ])("%s", (_, text, withBadge) => {
    render(<LessonCard {...defaultProps} badge={withBadge ? text : undefined} />);
    const matcher = screen.queryByText(text);
    if (withBadge) {
      expect(matcher).toBeInTheDocument();
    } else {
      expect(matcher).not.toBeInTheDocument();
    }
  });
});

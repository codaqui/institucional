import React from "react";
import { render, screen } from "@testing-library/react";
import PageHero from "../PageHero";

describe("PageHero", () => {
  it("renders the title", () => {
    render(<PageHero title="Aprenda Tecnologia" />);
    expect(screen.getByText("Aprenda Tecnologia")).toBeInTheDocument();
  });

  it("renders eyebrow when provided", () => {
    render(<PageHero title="Título" eyebrow="Quero Estudar" />);
    expect(screen.getByText("Quero Estudar")).toBeInTheDocument();
  });

  it("does not render eyebrow element when omitted", () => {
    render(<PageHero title="Título" />);
    // No "Quero Estudar" text should be present
    expect(screen.queryByText("Quero Estudar")).not.toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(<PageHero title="Título" subtitle="Subtítulo explicativo" />);
    expect(screen.getByText("Subtítulo explicativo")).toBeInTheDocument();
  });

  it("does not render subtitle when omitted", () => {
    render(<PageHero title="Apenas Título" />);
    expect(screen.queryByText("Subtítulo explicativo")).not.toBeInTheDocument();
  });

  it("renders children", () => {
    render(
      <PageHero title="Título">
        <button>Inscrever-se</button>
      </PageHero>
    );
    expect(screen.getByRole("button", { name: "Inscrever-se" })).toBeInTheDocument();
  });

  it("does not render children slot when no children are passed", () => {
    const { container } = render(<PageHero title="Título" />);
    // Children Box should not exist when children is undefined
    expect(container.querySelector("button")).not.toBeInTheDocument();
  });
});

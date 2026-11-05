import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithMui } from "../../../../test/render-mui";
import ProfileBadges from "./ProfileBadges";

describe("ProfileBadges", () => {
  it("links the public SVG with an informative alternative text", () => {
    renderWithMui(<ProfileBadges name="Membro Sintético" githubHandle="membro-teste" />);

    expect(screen.getByRole("heading", { name: "Selo público" })).toBeInTheDocument();
    const badge = screen.getByRole("img", { name: "Selo Codaqui de Membro Sintético" });
    expect(badge).toHaveAttribute("src", "/badges/membro-teste.svg");
    expect(badge).toHaveAttribute("width", "640");
    expect(badge).toHaveAttribute("height", "120");
  });

  it("hides only the badge when its SVG fails to load", () => {
    renderWithMui(
      <>
        <ProfileBadges name="Membro Sintético" githubHandle="membro-teste" />
        <p>Horas, eventos e doações</p>
      </>,
    );

    fireEvent.error(screen.getByRole("img", { name: "Selo Codaqui de Membro Sintético" }));

    expect(screen.queryByRole("heading", { name: "Selo público" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Selo Codaqui/ })).not.toBeInTheDocument();
    expect(screen.getByText("Horas, eventos e doações")).toBeInTheDocument();
  });

  it("retries with the new src when the handle changes after an error", () => {
    const { rerender } = renderWithMui(
      <ProfileBadges name="Membro Sintético" githubHandle="membro-teste" />,
    );
    fireEvent.error(screen.getByRole("img", { name: "Selo Codaqui de Membro Sintético" }));
    expect(screen.queryByRole("img", { name: /Selo Codaqui/ })).not.toBeInTheDocument();

    rerender(<ProfileBadges name="Membro Sintético" githubHandle="novo-handle" />);

    const retry = screen.getByRole("img", { name: "Selo Codaqui de Membro Sintético" });
    expect(retry).toHaveAttribute("src", "/badges/novo-handle.svg");
    fireEvent.load(retry);
    expect(screen.getByRole("heading", { name: "Selo público" })).toBeInTheDocument();
  });
});

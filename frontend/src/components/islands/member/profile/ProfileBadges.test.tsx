import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
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
});

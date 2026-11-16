import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import SessionParticipant from "./SessionParticipant";
import { renderWithMui } from "../../../test/render-mui";

describe("SessionParticipant", () => {
  it("links a linked member to their public profile", () => {
    renderWithMui(
      <SessionParticipant
        name="Ana"
        email="ana@example.test"
        member={{ id: "member-1", name: "Ana", githubHandle: "ana", avatarUrl: "avatar" }}
      />,
    );

    expect(screen.getByRole("link", { name: /Ana/i })).toHaveAttribute("href", "/@ana");
    expect(screen.getByText("@ana")).toBeInTheDocument();
  });

  it("marks a participant without a linked account", () => {
    renderWithMui(<SessionParticipant name="Bia" email="bia@example.test" member={null} />);

    expect(screen.getByText("Não vinculado à plataforma")).toBeInTheDocument();
    expect(screen.getByText("bia@example.test")).toBeInTheDocument();
  });
});

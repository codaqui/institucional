import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import ProfileVisibilityPreview from "./ProfileVisibilityPreview";
import { renderWithMui } from "../../../../test/render-mui";
import type { AuthUser } from "../../../../lib/auth-client";

const user: AuthUser = {
  sub: "member-1",
  githubId: "gh-1",
  handle: "maria",
  name: "Maria Souza",
  email: "private@example.test",
  avatarUrl: "",
  roles: ["membro"],
};

describe("ProfileVisibilityPreview", () => {
  it("mostra somente os campos habilitados sem expor e-mail", () => {
    renderWithMui(
      <ProfileVisibilityPreview
        user={user}
        visibility={{ bio: true, linkedin: false }}
        fields={[
          { key: "bio", label: "Bio", source: "Perfil", purpose: "Apresentação" },
          { key: "linkedin", label: "LinkedIn", source: "Perfil", purpose: "Contato" },
        ]}
      />,
    );

    expect(screen.getByRole("region", { name: "Prévia do perfil público" })).toBeInTheDocument();
    expect(screen.getByText("Maria Souza")).toBeInTheDocument();
    expect(screen.getByText("@maria")).toBeInTheDocument();
    expect(screen.getByText("Bio")).toBeInTheDocument();
    expect(screen.queryByText("LinkedIn")).not.toBeInTheDocument();
    expect(screen.queryByText(/private@example.test/)).not.toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../../test/render-mui";
import OpenSourceProjectPicker from "./OpenSourceProjectPicker";

describe("OpenSourceProjectPicker", () => {
  it("filters the local showcase and selects a project without side effects", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderWithMui(
      <OpenSourceProjectPicker open onClose={vi.fn()} onSelect={onSelect} />,
    );

    expect(screen.getByText("Boletim Diário de Segurança")).toBeInTheDocument();
    const sourceLink = screen.getByRole("link", {
      name: "Abrir repositório de Backstage Lab",
    });
    expect(sourceLink).toHaveAttribute(
      "href",
      "https://github.com/codaqui/backstage",
    );
    expect(sourceLink).toHaveAttribute("target", "_blank");
    expect(sourceLink).toHaveAttribute("rel", "noopener noreferrer");

    await user.type(
      screen.getByLabelText("Buscar projeto da vitrine"),
      "terraform",
    );
    expect(screen.queryByText("Backstage Lab")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Usar Laboratório de Terraform" }),
    );

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Laboratório de Terraform",
        href: "https://github.com/codaqui/terraform-organization",
      }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

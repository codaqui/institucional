import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../test/render-mui";
import FilterChipGroup from "./FilterChipGroup";

describe("FilterChipGroup", () => {
  it("marca somente o filtro atual e informa a seleção", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithMui(
      <FilterChipGroup
        label="Filtrar participação"
        value="all"
        options={[
          { value: "all", label: "Tudo" },
          { value: "events", label: "Eventos" },
        ]}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("group", { name: "Filtrar participação" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tudo" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Eventos" })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "Eventos" }));
    expect(onChange).toHaveBeenCalledWith("events");
  });
});

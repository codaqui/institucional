import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DataTable from "./DataTable";
import { renderWithMui } from "../../../../test/render-mui";

describe("DataTable pagination", () => {
  it("uses the shared accessible controls and preserves the table", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    renderWithMui(
      <DataTable
        table={<table><tbody><tr><td>Linha real</td></tr></tbody></table>}
        page={2}
        totalPages={4}
        onPageChange={onPageChange}
        itemLabel="empresas"
      />,
    );

    expect(screen.getByText("Linha real")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Paginação de empresas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir para a página 2 de 4" })).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});

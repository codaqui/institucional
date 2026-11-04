import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMui } from "../../../test/render-mui";
import DateRangeControls from "./DateRangeControls";

describe("DateRangeControls", () => {
  it("controls both dates and clears the range", () => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    renderWithMui(
      <DateRangeControls from="2026-10-01" to="2026-10-31" onChange={onChange} onClear={onClear} />,
    );

    fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-10-02" } });
    expect(onChange).toHaveBeenCalledWith({ from: "2026-10-02", to: "2026-10-31" });

    fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-10-30" } });
    expect(onChange).toHaveBeenCalledWith({ from: "2026-10-01", to: "2026-10-30" });

    fireEvent.click(screen.getByRole("button", { name: "Limpar datas" }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("shows a textual error when from is after to", () => {
    renderWithMui(
      <DateRangeControls from="2026-10-30" to="2026-10-29" onChange={vi.fn()} onClear={vi.fn()} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "A data inicial deve ser anterior ou igual à data final.",
    );
  });
});

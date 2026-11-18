import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminLoadFeedback from "./AdminLoadFeedback";
import { renderWithMui } from "../../../../test/render-mui";

describe("AdminLoadFeedback", () => {
  it("announces loading with a non-animated-layout skeleton", () => {
    renderWithMui(<AdminLoadFeedback loading itemLabel="empresas" />);
    expect(screen.getByRole("status", { name: "Carregando empresas" })).toBeInTheDocument();
  });

  it("offers retry with the current context preserved by the caller", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    renderWithMui(<AdminLoadFeedback error="Falha temporária" onRetry={onRetry} />);
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders nothing without loading or error", () => {
    const { container } = renderWithMui(<AdminLoadFeedback />);
    expect(container).toBeEmptyDOMElement();
  });
});

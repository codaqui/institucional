import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import DescriptionMarkdownEditor from "./DescriptionMarkdownEditor";
import { renderWithMui } from "../../../../test/render-mui";

describe("DescriptionMarkdownEditor — acessibilidade", () => {
  it("todo IconButton da barra de ferramentas tem aria-label", () => {
    renderWithMui(
      <DescriptionMarkdownEditor
        value="Texto de exemplo"
        onChange={() => {}}
      />,
    );
    const buttons = Array.from(
      document.querySelectorAll(".MuiIconButton-root"),
    );
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.getAttribute("aria-label")).toBeTruthy();
    }
  });
});

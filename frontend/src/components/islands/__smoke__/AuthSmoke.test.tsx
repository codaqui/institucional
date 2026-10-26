import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ThemeToggle from "../ThemeToggle"; // componente sem fetch/MUI — ideal p/ canário

vi.mock("../../../lib/config", () => ({ API_URL: "http://localhost:3001" }));

describe("infra de testes de ilhas (canário)", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("renderiza e interage em jsdom", async () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button");
    await userEvent.click(btn);
    expect(document.documentElement.dataset.theme).toBeDefined();
  });
});

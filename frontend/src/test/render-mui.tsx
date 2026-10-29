import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import MuiIslandProvider from "../components/islands/MuiIslandProvider";

export function renderWithMui(ui: ReactElement, options?: RenderOptions) {
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MuiIslandProvider>{children}</MuiIslandProvider>
    ),
    ...options,
  });
}

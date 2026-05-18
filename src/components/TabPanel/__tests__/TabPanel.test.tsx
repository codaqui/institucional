import React from "react";
import { render, screen } from "@testing-library/react";
import TabPanel from "../index";

describe("TabPanel", () => {
  it("renders the active panel content", () => {
    render(
      <TabPanel value={1} index={1}>
        <span>Conteudo ativo</span>
      </TabPanel>
    );

    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
    expect(screen.getByText("Conteudo ativo")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "tab-panel-1");
  });

  it("hides inactive panel content", () => {
    const { container } = render(
      <TabPanel value={0} index={1}>
        <span>Conteudo oculto</span>
      </TabPanel>
    );

    expect(screen.getByRole("tabpanel", { hidden: true })).toHaveAttribute("hidden");
    expect(screen.queryByText("Conteudo oculto")).not.toBeInTheDocument();
    expect(container.querySelector('[hidden=""]')).toBeInTheDocument();
  });
});

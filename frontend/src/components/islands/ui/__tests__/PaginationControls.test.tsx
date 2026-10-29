/**
 * Testes de contrato do PaginationControls — componente reutilizável do SET de
 * paginação. Cobre: renderização nula com uma página só, janela de páginas,
 * estados disabled de primeira/anterior/próxima/última e aria-current.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import PaginationControls from "../PaginationControls";
import { renderWithMui } from "../../../../test/render-mui";

describe("PaginationControls", () => {
  it("não renderiza nada quando há uma única página", () => {
    const { container } = renderWithMui(
      <PaginationControls page={1} totalPages={1} onChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza a janela de páginas com aria-current na corrente", () => {
    renderWithMui(
      <PaginationControls page={5} totalPages={10} onChange={() => {}} />,
    );

    const nav = screen.getByRole("navigation", {
      name: /Paginação de resultados/i,
    });
    expect(nav).toBeInTheDocument();
    // Janela centrada em 5: 3..7
    for (const p of [3, 4, 5, 6, 7]) {
      expect(
        screen.getByRole("button", { name: `Ir para a página ${p} de 10` }),
      ).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Ir para a página 5 de 10" }))
      .toHaveAttribute("aria-current", "page");
  });

  it("desabilita anterior/primeira na primeira página e chama onChange nas demais", () => {
    const onChange = vi.fn();
    renderWithMui(
      <PaginationControls page={1} totalPages={10} onChange={onChange} />,
    );

    expect(screen.getByRole("button", { name: "Primeira página" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Última página" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(onChange).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByRole("button", { name: "Última página" }));
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it("desabilita próxima/última na última página", () => {
    const onChange = vi.fn();
    renderWithMui(
      <PaginationControls page={10} totalPages={10} onChange={onChange} />,
    );

    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Última página" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Primeira página" }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("usa itemLabel contextual no aria-label da navegação", () => {
    renderWithMui(
      <PaginationControls
        page={2}
        totalPages={5}
        onChange={() => {}}
        itemLabel="membros"
      />,
    );
    expect(
      screen.getByRole("navigation", { name: "Paginação de membros" }),
    ).toBeInTheDocument();
  });
});

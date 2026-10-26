import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../../../test/render-mui";
import ModalConfirm from "../ModalConfirm";
import TabPanel from "../TabPanel";
import PageContainer from "../PageContainer";
import DataTable from "../DataTable";
import StatCard from "../StatCard";

describe("ModalConfirm", () => {
  it("confirma via onConfirm (sem tocar no onClose)", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    renderWithMui(
      <ModalConfirm
        open
        onClose={onClose}
        onConfirm={onConfirm}
        title="Excluir?"
        confirmLabel="Excluir"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancela via onClose (recebe o evento do clique, como no original)", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    renderWithMui(
      <ModalConfirm open onClose={onClose} onConfirm={onConfirm} title="Excluir?" />,
    );
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("usa os labels padrão 'Confirmar' e 'Cancelar'", () => {
    renderWithMui(
      <ModalConfirm open onClose={vi.fn()} onConfirm={vi.fn()} title="Título" />,
    );
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("renderiza descrição e mensagem de erro", () => {
    renderWithMui(
      <ModalConfirm
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Título"
        description="Texto descritivo"
        error="Falhou"
      />,
    );
    expect(screen.getByText("Texto descritivo")).toBeInTheDocument();
    expect(screen.getByText("Falhou")).toBeInTheDocument();
  });

  it("desabilita o botão de confirmar durante loading", () => {
    renderWithMui(
      <ModalConfirm open onClose={vi.fn()} onConfirm={vi.fn()} title="Título" loading />,
    );
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
});

describe("TabPanel", () => {
  it("só renderiza children do painel ativo", () => {
    renderWithMui(
      <div>
        <TabPanel index={0} value={1}>painel-0</TabPanel>
        <TabPanel index={1} value={1}>painel-1</TabPanel>
      </div>,
    );
    expect(screen.queryByText("painel-0")).not.toBeInTheDocument();
    expect(screen.getByText("painel-1")).toBeInTheDocument();
  });

  it("expõe role tabpanel vinculado à aba correspondente", () => {
    renderWithMui(<TabPanel index={2} value={2}>conteúdo</TabPanel>);
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("id", "tab-panel-2");
    expect(panel).toHaveAttribute("aria-labelledby", "tab-2");
  });
});

describe("PageContainer", () => {
  it("renderiza children em Container maxWidth lg", () => {
    renderWithMui(<PageContainer>conteúdo da página</PageContainer>);
    const child = screen.getByText("conteúdo da página");
    expect(child.closest(".MuiContainer-maxWidthLg")).not.toBeNull();
  });
});

describe("DataTable", () => {
  it("renderiza a tabela e esconde paginação com totalPages <= 1", () => {
    renderWithMui(
      <DataTable
        table={<table><tbody><tr><td>linha-1</td></tr></tbody></table>}
        page={1}
        totalPages={1}
        onPageChange={vi.fn()}
      />,
    );
    expect(screen.getByText("linha-1")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("mostra paginação e repassa a página selecionada", async () => {
    const onPageChange = vi.fn();
    renderWithMui(
      <DataTable
        table={<table><tbody><tr><td>linha-1</td></tr></tbody></table>}
        page={1}
        totalPages={3}
        onPageChange={onPageChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /go to page 2/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});

describe("StatCard", () => {
  it("renderiza valor e label (variant outlined por padrão)", () => {
    renderWithMui(<StatCard icon={<span>icone</span>} value={42} label="Membros" />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Membros")).toBeInTheDocument();
    expect(screen.getByText("icone")).toBeInTheDocument();
  });

  it("renderiza variant filled", () => {
    renderWithMui(
      <StatCard icon={<span>icone</span>} value="R$ 10" label="Doações" variant="filled" />,
    );
    expect(screen.getByText("R$ 10")).toBeInTheDocument();
    expect(screen.getByText("Doações")).toBeInTheDocument();
  });
});

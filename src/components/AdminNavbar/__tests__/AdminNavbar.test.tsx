/**
 * Testes de permissões do menu administrativo.
 *
 * Garante que cada role só veja os itens do painel aos quais tem acesso,
 * evitando que organizadores de eventos vejam botões financeiros.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminNavbar from "../index";
import { useAuth } from "../../../hooks/useAuth";
import { buildAuthState, mockUseAuth } from "../../../test-utils/auth";

jest.mock("../../../hooks/useAuth");

const ROLES = ["admin", "finance-analyzer", "event_organizer", "event_finance", "event_host", "event_checker"] as const;

type RoleTestCase = {
  role: (typeof ROLES)[number];
  label: string;
  visible: string[];
  hidden: string[];
};

const TEST_CASES: RoleTestCase[] = [
  {
    role: "admin",
    label: "administrador",
    visible: ["Membros", "Reembolsos", "Fornecedores", "Pagamentos", "Recebimentos", "Empresas", "Sorteios", "VirtualCoins", "Carteira", "Eventos", "E-mails"],
    hidden: [],
  },
  {
    role: "finance-analyzer",
    label: "finance-analyzer",
    visible: ["Reembolsos", "Fornecedores", "Pagamentos", "Recebimentos", "Carteira"],
    hidden: ["Membros", "Empresas", "Sorteios", "VirtualCoins", "Eventos", "E-mails"],
  },
  {
    role: "event_organizer",
    label: "organizador de eventos",
    visible: ["Eventos"],
    hidden: ["Membros", "Reembolsos", "Fornecedores", "Pagamentos", "Recebimentos", "Empresas", "Sorteios", "VirtualCoins", "Carteira", "E-mails"],
  },
  {
    role: "event_finance",
    label: "financeiro de eventos",
    visible: [],
    hidden: ["Membros", "Reembolsos", "Fornecedores", "Pagamentos", "Recebimentos", "Empresas", "Sorteios", "VirtualCoins", "Carteira", "Eventos", "E-mails"],
  },
  {
    role: "event_checker",
    label: "credenciador",
    visible: ["Eventos"],
    hidden: ["Membros", "Reembolsos", "Fornecedores", "Pagamentos", "Recebimentos", "Empresas", "Sorteios", "VirtualCoins", "Carteira", "E-mails"],
  },
  {
    role: "event_host",
    label: "anfitrião de evento",
    visible: ["Eventos"],
    hidden: ["Membros", "Reembolsos", "Fornecedores", "Pagamentos", "Recebimentos", "Empresas", "Sorteios", "VirtualCoins", "Carteira", "E-mails"],
  },
];

function buildRoleState(role: (typeof ROLES)[number]) {
  return buildAuthState({
    isAdmin: role === "admin",
    isFinanceAnalyzer: role === "finance-analyzer",
    isEventOrganizer: role === "event_organizer",
    isEventFinance: role === "event_finance",
    isEventHost: role === "event_host",
    isEventChecker: role === "event_checker",
    user: { sub: `u-${role}`, handle: role, roles: ["membro", role] } as any,
  });
}

describe("AdminNavbar", () => {
  it("mostra todos os itens para admin", () => {
    mockUseAuth.mockReturnValue(buildRoleState("admin"));
    render(<AdminNavbar />);
    for (const label of TEST_CASES[0].visible) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  for (const { role, label, visible, hidden } of TEST_CASES.slice(1)) {
    it(`mostra apenas itens permitidos para ${label}`, () => {
      mockUseAuth.mockReturnValue(buildRoleState(role));
      render(<AdminNavbar />);
      for (const item of visible) {
        expect(screen.getByText(item)).toBeInTheDocument();
      }
      for (const item of hidden) {
        expect(screen.queryByText(item)).not.toBeInTheDocument();
      }
    });
  }

  it("exibe submenu de Eventos apenas com itens permitidos para organizador", async () => {
    mockUseAuth.mockReturnValue(buildRoleState("event_organizer"));
    render(<AdminNavbar />);
    await userEvent.click(screen.getByRole("button", { name: /Eventos/i }));
    expect(screen.getByRole("menuitem", { name: /Visão geral/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Overrides & externos/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Check-in/i })).toBeInTheDocument();
  });

  it("exibe submenu de Eventos apenas com Check-in para credenciador", async () => {
    mockUseAuth.mockReturnValue(buildRoleState("event_checker"));
    render(<AdminNavbar />);
    await userEvent.click(screen.getByRole("button", { name: /Eventos/i }));
    expect(screen.queryByRole("menuitem", { name: /Visão geral/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Overrides & externos/i })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Check-in/i })).toBeInTheDocument();
  });
});

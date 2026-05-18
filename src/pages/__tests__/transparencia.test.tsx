import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TransparenciaPage from "../transparencia";

jest.mock("@docusaurus/router", () => ({
  useLocation: () => ({ pathname: "/transparencia", search: "?tx=tx-open" }),
}));
jest.mock("../../components/PageHero", () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <div data-testid="page-hero">{title}</div>,
}));
jest.mock("../../components/StatCard", () => ({
  __esModule: true,
  default: ({
    label,
    value,
  }: {
    label: string;
    value: React.ReactNode;
  }) => (
    <div data-testid="stat-card">
      {label}:{typeof value === "string" || typeof value === "number" ? value : "node"}
    </div>
  ),
}));
jest.mock("../../components/TransactionTable", () => ({
  __esModule: true,
  default: ({
    accountId,
    initialTxId,
  }: {
    accountId: string;
    initialTxId?: string;
  }) => <div data-testid="transaction-table">{`table:${accountId}:${initialTxId ?? "none"}`}</div>,
}));

type MockResponse = Pick<Response, "ok" | "status" | "json">;

function jsonResponse(data: unknown, ok = true, status = 200): MockResponse {
  return {
    ok,
    status,
    json: async () => data,
  };
}

describe("/transparencia", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock | undefined)?.mockReset?.();
  });

  it("carrega saldos/estatísticas e troca aba de comunidade mantendo tx inicial", async () => {
    (global.fetch as any) = jest.fn((url: string) => {
      if (url.includes("/ledger/community-balances")) {
        return Promise.resolve(
          jsonResponse([
            { id: "acc-1", projectKey: "devparana", name: "Carteira DevParaná", balance: 500 },
            { id: "acc-2", projectKey: "com-x", name: "Comunidade X", balance: 200 },
          ]),
        );
      }
      if (url.includes("/ledger/transparency-stats")) {
        return Promise.resolve(
          jsonResponse({
            totalReceived: 1000,
            totalExpenses: 300,
            totalTransactions: 10,
            uniqueDonors: 4,
            recentDonors: [],
            communityStats: [
              { projectKey: "devparana", name: "DevParaná", totalIn: 800, totalOut: 200, txCount: 5 },
              { projectKey: "com-x", name: "Comunidade X", totalIn: 200, totalOut: 100, txCount: 5 },
            ],
          }),
        );
      }
      return Promise.resolve(jsonResponse(null, false, 404));
    });

    render(<TransparenciaPage />);

    expect(await screen.findByTestId("page-hero")).toHaveTextContent("Finanças Abertas");
    expect(await screen.findByText(/Resumo por Comunidade/i)).toBeInTheDocument();
    expect(screen.getByTestId("transaction-table")).toHaveTextContent("table:acc-1:tx-open");

    fireEvent.click(screen.getByRole("tab", { name: /Comunidade X/i }));

    await waitFor(() => {
      expect(screen.getByTestId("transaction-table")).toHaveTextContent("table:acc-2:tx-open");
    });
  });

  it("mostra alerta quando backend de saldos falha", async () => {
    (global.fetch as any) = jest.fn((url: string) => {
      if (url.includes("/ledger/community-balances")) {
        return Promise.resolve(jsonResponse({}, false, 500));
      }
      if (url.includes("/ledger/transparency-stats")) {
        return Promise.resolve(jsonResponse(null, false, 500));
      }
      return Promise.resolve(jsonResponse(null, false, 404));
    });

    render(<TransparenciaPage />);

    expect(
      await screen.findByText(/Não foi possível conectar ao backend/i),
    ).toBeInTheDocument();
  });
});


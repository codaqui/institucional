import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TransactionTable from "../index";

jest.mock("../../TransactionDetailDialog", () => ({
  __esModule: true,
  default: ({
    tx,
  }: {
    tx: { id: string } | null;
  }) => (tx ? <div data-testid="tx-dialog">tx:{tx.id}</div> : null),
}));

function makeTx(id: string, amount: number, description: string) {
  return {
    id,
    amount,
    description,
    createdAt: "2026-05-18T10:00:00.000Z",
    referenceId: "transfer:1",
    sourceAccount: { id: "src-1", name: "Conta Origem" },
    destinationAccount: { id: "acc-1", name: "Conta Destino" },
  };
}

describe("TransactionTable", () => {
  beforeEach(() => {
    (globalThis.fetch as jest.Mock | undefined)?.mockReset?.();
  });

  it("carrega transações e abre modal inicial por txId", async () => {
    (globalThis.fetch as any) = jest.fn((url: string) => {
      if (url.includes("/ledger/transactions/tx-open")) {
        return Promise.resolve({ ok: true, json: async () => makeTx("tx-open", 120, "Detalhe inicial") });
      }
      if (url.includes("/ledger/accounts/acc-1/transactions?page=1&limit=10")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [makeTx("tx-1", 100, "Transferência interna aprovada: ajuste")],
            total: 1,
            page: 1,
            limit: 10,
            totalPages: 1,
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(
      <TransactionTable
        accountId="acc-1"
        accountName="Tesouro"
        apiUrl="http://localhost:3001"
        initialTxId="tx-open"
      />,
    );

    expect(
      await screen.findByRole("table", { name: /Transações de Tesouro/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Transferência interna aprovada/i)).toBeInTheDocument();
    expect(await screen.findByTestId("tx-dialog")).toHaveTextContent("tx:tx-open");
  });

  it("aplica busca e troca de página na consulta paginada", async () => {
    (globalThis.fetch as any) = jest.fn((url: string) => {
      if (url.includes("search=fornecedor") && url.includes("page=1")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [], total: 20, page: 1, limit: 10, totalPages: 2 }),
        });
      }
      if (url.includes("search=fornecedor") && url.includes("page=2")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [], total: 20, page: 2, limit: 10, totalPages: 2 }),
        });
      }
      if (url.includes("/ledger/accounts/acc-1/transactions?page=1&limit=10")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [], total: 20, page: 1, limit: 10, totalPages: 2 }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    render(<TransactionTable accountId="acc-1" accountName="Tesouro" apiUrl="http://localhost:3001" />);

    await screen.findByRole("table", { name: /Transações de Tesouro/i });
    fireEvent.change(screen.getByPlaceholderText(/Buscar na descrição/i), {
      target: { value: "fornecedor" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Buscar/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("search=fornecedor"),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /go to next page/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("page=2"),
      );
    });
  });

  it("exporta CSV da página atual", async () => {
    (globalThis.fetch as any) = jest.fn((url: string) => {
      if (url.includes("/ledger/accounts/acc-1/transactions?page=1&limit=10")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [makeTx("tx-1", 100, "Transferência interna aprovada: ajuste")],
            total: 1,
            page: 1,
            limit: 10,
            totalPages: 1,
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });

    const originalCreateObjectURL = (URL as any).createObjectURL;
    const originalRevokeObjectURL = (URL as any).revokeObjectURL;
    const createObjectUrlSpy = jest.fn(() => "blob:test-url");
    const revokeObjectUrlSpy = jest.fn();
    (URL as any).createObjectURL = createObjectUrlSpy;
    (URL as any).revokeObjectURL = revokeObjectUrlSpy;
    const clickSpy = jest.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = jest
      .spyOn(document, "createElement")
      .mockImplementation(((tagName: string) => {
        if (tagName.toLowerCase() === "a") {
          return { href: "", download: "", click: clickSpy } as unknown as HTMLAnchorElement;
        }
        return originalCreateElement(tagName);
      }) as any);

    render(<TransactionTable accountId="acc-1" accountName="Tesouro" apiUrl="http://localhost:3001" />);

    await screen.findByText(/Transferência interna aprovada/i);
    fireEvent.click(screen.getByRole("button", { name: /Exportar CSV/i }));

    expect(createObjectUrlSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith("blob:test-url");

    createElementSpy.mockRestore();
    (URL as any).createObjectURL = originalCreateObjectURL;
    (URL as any).revokeObjectURL = originalRevokeObjectURL;
  });
});

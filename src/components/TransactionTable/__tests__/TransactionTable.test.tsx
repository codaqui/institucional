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
    if (jest.isMockFunction(globalThis.fetch)) {
      const fetchMock = globalThis.fetch as jest.Mock;
      fetchMock.mockReset();
    }
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

  it("exporta CSV da página atual com todos os campos escapados", async () => {
    (globalThis.fetch as any) = jest.fn((url: string) => {
      if (url.includes("/ledger/accounts/acc-1/transactions?page=1&limit=10")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              makeTx("tx-1", 100, "Transferência interna aprovada: ajuste"),
              makeTx("tx-2", 25.5, 'Pagamento de "serviços", etapa 1'),
            ],
            total: 2,
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
    const createObjectUrlSpy = jest.fn((_blob: Blob) => "blob:test-url");
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

    const blob = createObjectUrlSpy.mock.calls[0][0] as Blob;
    const csvText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
    const lines = csvText.split("\n");
    expect(lines[0]).toBe("Data,Tipo,Descrição,De,Para,Valor,Direção");
    // Data formatada em pt-BR contém vírgula ("18/05/2026, 07:00") e precisa ir entre aspas
    expect(lines[1]).toMatch(
      /^"\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}","Transferência Interna","Transferência interna aprovada: ajuste","Conta Origem","Conta Destino","100\.00","Crédito"$/,
    );
    // Aspas internas são dobradas e o campo com vírgula permanece intacto
    expect(lines[2]).toContain('"Pagamento de ""serviços"", etapa 1"');
    expect(lines[2]).toContain('"25.50"');

    createElementSpy.mockRestore();
    (URL as any).createObjectURL = originalCreateObjectURL;
    (URL as any).revokeObjectURL = originalRevokeObjectURL;
  });
});

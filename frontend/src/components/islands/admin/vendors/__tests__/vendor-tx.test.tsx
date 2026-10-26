import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../../../test/render-mui";
import VendorTransactionForm, {
  emptyVendorTxForm,
  type VendorTxFormValues,
} from "../VendorTransactionForm";
import VendorTransactionCard, {
  type VendorTransactionCardData,
} from "../VendorTransactionCard";

const vendors = [
  { id: "v1", name: "Acme Ltda", document: "44593429000105" },
  { id: "v2", name: "Fornecedor X", document: null },
];

const accounts = [
  { id: "a1", name: "Banco Principal", type: "BANK" },
  { id: "a2", name: "Caixa Externo", type: "EXTERNAL" },
];

function okResponse() {
  return { ok: true, status: 201, json: async () => ({}) } as unknown as Response;
}

async function fillCommonFields(directionLabel: string) {
  // Fornecedor (Autocomplete)
  const vendorInput = screen.getByLabelText(directionLabel);
  await userEvent.click(vendorInput);
  await userEvent.type(vendorInput, "Acme");
  await userEvent.click(await screen.findByRole("option", { name: /acme/i }));

  // Conta (Select) — mouseDown abre o listbox no MUI
  fireEvent.mouseDown(screen.getByLabelText(/conta de (origem|destino)/i));
  const listbox = await screen.findByRole("listbox");
  fireEvent.click(within(listbox).getByText("Banco Principal (BANK)"));

  await userEvent.type(screen.getByLabelText("Valor (R$) *"), "100.50");
  await userEvent.type(screen.getByLabelText("Descrição *"), "Hospedagem AWS");
}

describe("VendorTransactionForm", () => {
  it("renderiza labels de payment (Conta de Origem / Registrar Pagamento)", () => {
    renderWithMui(
      <VendorTransactionForm
        direction="payment"
        vendors={vendors}
        accounts={accounts}
        authFetch={vi.fn()}
        apiUrl="https://api.test"
        onSuccess={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Fornecedor *")).toBeInTheDocument();
    expect(screen.getByLabelText("Conta de Origem *")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar Pagamento" })).toBeInTheDocument();
  });

  it("renderiza labels de receipt (Conta de Destino / Registrar Recebimento)", () => {
    renderWithMui(
      <VendorTransactionForm
        direction="receipt"
        vendors={vendors}
        accounts={accounts}
        authFetch={vi.fn()}
        apiUrl="https://api.test"
        onSuccess={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Fornecedor / Origem do recebimento *")).toBeInTheDocument();
    expect(screen.getByLabelText("Conta de Destino *")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar Recebimento" })).toBeInTheDocument();
  });

  it("não lista contas do tipo EXTERNAL no select de conta", async () => {
    renderWithMui(
      <VendorTransactionForm
        direction="payment"
        vendors={vendors}
        accounts={accounts}
        authFetch={vi.fn()}
        apiUrl="https://api.test"
        onSuccess={vi.fn()}
      />,
    );
    fireEvent.mouseDown(screen.getByLabelText("Conta de Origem *"));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByText("Banco Principal (BANK)")).toBeInTheDocument();
    expect(within(listbox).queryByText(/caixa externo/i)).not.toBeInTheDocument();
  });

  it("bloqueia o submit com campos obrigatórios vazios", async () => {
    const authFetch = vi.fn();
    renderWithMui(
      <VendorTransactionForm
        direction="payment"
        vendors={vendors}
        accounts={accounts}
        authFetch={authFetch}
        apiUrl="https://api.test"
        onSuccess={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Registrar Pagamento" }));
    expect(await screen.findByText("Preencha todos os campos obrigatórios.")).toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalled();
  });

  it("rejeita valor inválido (zero)", async () => {
    const authFetch = vi.fn();
    const { container } = renderWithMui(
      <VendorTransactionForm
        direction="payment"
        vendors={vendors}
        accounts={accounts}
        authFetch={authFetch}
        apiUrl="https://api.test"
        onSuccess={vi.fn()}
      />,
    );
    await fillCommonFields("Fornecedor *");
    await userEvent.clear(screen.getByLabelText("Valor (R$) *"));
    await userEvent.type(screen.getByLabelText("Valor (R$) *"), "0");
    // O input number tem min=0.01 — a constraint validation nativa (jsdom e
    // browser) bloquearia o clique no botão antes do React. Dispara o submit
    // no form para exercitar a validação em nível de componente.
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByText("Valor inválido.")).toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalled();
  });

  it("payment: confirma e POSTa o body correto em /vendors/payments", async () => {
    const authFetch = vi.fn().mockResolvedValue(okResponse());
    const onSuccess = vi.fn();
    renderWithMui(
      <VendorTransactionForm
        direction="payment"
        vendors={vendors}
        accounts={accounts}
        authFetch={authFetch}
        apiUrl="https://api.test"
        onSuccess={onSuccess}
      />,
    );
    await fillCommonFields("Fornecedor *");
    await userEvent.type(
      screen.getByLabelText("URL do Comprovante (original)"),
      "https://exemplo.com/recibo.pdf",
    );

    await userEvent.click(screen.getByRole("button", { name: "Registrar Pagamento" }));

    // Modal de confirmação antes do POST
    expect(await screen.findByText("Confirmar pagamento")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(1));
    expect(authFetch).toHaveBeenCalledWith(
      "https://api.test/vendors/payments",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: "v1",
          sourceAccountId: "a1",
          amount: 10050,
          description: "Hospedagem AWS",
          receiptUrl: "https://exemplo.com/recibo.pdf",
        }),
      }),
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("Pagamento registrado e lançado no ledger!"),
    ).toBeInTheDocument();
  });

  it("receipt: POSTa em /vendors/receipts com destinationAccountId", async () => {
    const authFetch = vi.fn().mockResolvedValue(okResponse());
    renderWithMui(
      <VendorTransactionForm
        direction="receipt"
        vendors={vendors}
        accounts={accounts}
        authFetch={authFetch}
        apiUrl="https://api.test"
        onSuccess={vi.fn()}
      />,
    );
    await fillCommonFields("Fornecedor / Origem do recebimento *");

    await userEvent.click(screen.getByRole("button", { name: "Registrar Recebimento" }));
    expect(await screen.findByText("Confirmar recebimento")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse((authFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(authFetch.mock.calls[0][0]).toBe("https://api.test/vendors/receipts");
    expect(body).toEqual({
      vendorId: "v1",
      destinationAccountId: "a1",
      amount: 10050,
      description: "Hospedagem AWS",
    });
  });

  it("exibe a mensagem de erro da API quando o POST falha", async () => {
    const authFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: "Saldo insuficiente." }),
    } as unknown as Response);
    renderWithMui(
      <VendorTransactionForm
        direction="payment"
        vendors={vendors}
        accounts={accounts}
        authFetch={authFetch}
        apiUrl="https://api.test"
        onSuccess={vi.fn()}
      />,
    );
    await fillCommonFields("Fornecedor *");
    await userEvent.click(screen.getByRole("button", { name: "Registrar Pagamento" }));
    await userEvent.click(await screen.findByRole("button", { name: "Registrar" }));

    expect(await screen.findByText("Saldo insuficiente.")).toBeInTheDocument();
  });

  it("pré-preenche com initialValues e atualiza ao mudar initialKey", () => {
    const props = {
      direction: "payment" as const,
      vendors,
      accounts,
      authFetch: vi.fn(),
      apiUrl: "https://api.test",
      onSuccess: vi.fn(),
    };
    const initialValues: VendorTxFormValues = {
      ...emptyVendorTxForm,
      vendorId: "v2",
      amount: "42",
      description: "Reuso anterior",
    };
    const view = renderWithMui(
      <VendorTransactionForm {...props} initialValues={initialValues} initialKey={1} />,
    );
    const amountInput = screen.getByLabelText("Valor (R$) *");
    expect(amountInput).toHaveValue(42); // number input → jest-dom compara como número
    expect(screen.getByLabelText("Descrição *")).toHaveValue("Reuso anterior");

    view.rerender(
      <VendorTransactionForm {...props} initialValues={emptyVendorTxForm} initialKey={2} />,
    );
    expect((amountInput as HTMLInputElement).value).toBe("");
    expect(screen.getByLabelText("Descrição *")).toHaveValue("");
  });
});

const tx: VendorTransactionCardData = {
  id: "t1",
  amount: 123456,
  description: "Hospedagem AWS — janeiro/2026",
  occurredAt: "2026-01-15T14:30:00Z",
  receiptUrl: "https://exemplo.com/recibo.pdf",
  internalReceiptUrl: "https://drive.google.com/copia",
  vendor: { name: "Acme Ltda" },
  registeredBy: { name: "Ana", avatarUrl: "https://avatars.com/ana.png", githubHandle: "ana" },
};

describe("VendorTransactionCard", () => {
  it("renderiza os campos de um pagamento", () => {
    renderWithMui(
      <VendorTransactionCard
        tx={tx}
        direction="payment"
        accountLabel="Banco Principal (BANK)"
        onReuse={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Acme Ltda")).toBeInTheDocument();
    expect(screen.getByText("Hospedagem AWS — janeiro/2026")).toBeInTheDocument();
    // pagamento: sem prefixo "+"
    expect(screen.getByText(/R\$ 1\.234,56/)).toBeInTheDocument();
    expect(screen.getByText("@ana")).toBeInTheDocument();
    expect(screen.getByText("Banco Principal (BANK)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Comprovante" })).toHaveAttribute(
      "href",
      "https://exemplo.com/recibo.pdf",
    );
    expect(screen.getByRole("link", { name: "Cópia interna" })).toHaveAttribute(
      "href",
      "https://drive.google.com/copia",
    );
  });

  it("receipt: prefixa o valor com '+' e usa noun 'recebimento' nos aria-labels", () => {
    renderWithMui(
      <VendorTransactionCard
        tx={tx}
        direction="receipt"
        accountLabel="Banco Principal (BANK)"
        onReuse={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/\+ R\$ 1\.234,56/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reutilizar recebimento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir recebimento" })).toBeInTheDocument();
  });

  it("chama onReuse e onDelete nos respectivos botões", async () => {
    const onReuse = vi.fn();
    const onDelete = vi.fn();
    renderWithMui(
      <VendorTransactionCard
        tx={tx}
        direction="payment"
        accountLabel="Banco Principal (BANK)"
        onReuse={onReuse}
        onDelete={onDelete}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Reutilizar pagamento" }));
    expect(onReuse).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Excluir pagamento" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("renderiza fallback quando o vendor está ausente", () => {
    renderWithMui(
      <VendorTransactionCard
        tx={{ ...tx, vendor: undefined }}
        direction="payment"
        accountLabel="Banco Principal (BANK)"
        onReuse={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Fornecedor desconhecido")).toBeInTheDocument();
  });
});

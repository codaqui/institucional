import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import VendorTransactionForm, { type VendorTxFormValues } from "../index";

const API_URL = "http://localhost:3001";

const vendors = [
  { id: "v-1", name: "PrintShop", document: "44593429000105" },
  { id: "v-2", name: "Sem Documento", document: null },
];

const accounts = [
  { id: "a-1", name: "Codaqui", type: "COMMUNITY" },
  { id: "a-2", name: "DevParaná", type: "COMMUNITY" },
  { id: "a-3", name: "Stripe", type: "EXTERNAL" },
];

interface RenderOptions {
  direction?: "payment" | "receipt";
  authFetch?: jest.Mock;
  initialValues?: VendorTxFormValues;
}

function renderForm({ direction = "payment", authFetch, initialValues }: RenderOptions = {}) {
  const onSuccess = jest.fn();
  const fetchMock = authFetch ?? jest.fn();
  render(
    <VendorTransactionForm
      direction={direction}
      vendors={vendors}
      accounts={accounts}
      authFetch={fetchMock as any}
      apiUrl={API_URL}
      onSuccess={onSuccess}
      initialValues={initialValues}
    />,
  );
  return { onSuccess, authFetch: fetchMock };
}

async function selectVendor(name: string | RegExp) {
  const input = screen.getByRole("combobox", { name: /Fornecedor/ });
  fireEvent.change(input, { target: { value: "Print" } });
  fireEvent.click(await screen.findByRole("option", { name }));
}

async function selectAccount(label: RegExp, optionName: RegExp) {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: label }));
  const listbox = await screen.findByRole("listbox");
  fireEvent.click(within(listbox).getByRole("option", { name: optionName }));
}

function fillAmountAndDescription(amount: string, description = "Banner do evento") {
  fireEvent.change(screen.getByLabelText(/Valor \(R\$\)/), { target: { value: amount } });
  fireEvent.change(screen.getByLabelText(/Descrição/), { target: { value: description } });
}

async function fillValidForm() {
  await selectVendor(/PrintShop/);
  await selectAccount(/Conta de Origem/, /Codaqui \(COMMUNITY\)/);
  fillAmountAndDescription("150.50");
}

describe("VendorTransactionForm", () => {
  it("exige todos os campos obrigatórios antes de abrir a confirmação", () => {
    const { authFetch } = renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Registrar Pagamento" }));

    expect(screen.getByText("Preencha todos os campos obrigatórios.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalled();
  });

  it("rejeita valor zero ou negativo", async () => {
    renderForm();

    await selectVendor(/PrintShop/);
    await selectAccount(/Conta de Origem/, /Codaqui \(COMMUNITY\)/);
    fillAmountAndDescription("0");
    // jsdom (como o browser) bloqueia o submit via validação nativa min=0.01
    // ao clicar no botão; disparamos o submit direto para exercitar a validação JS.
    const form = screen.getByRole("button", { name: "Registrar Pagamento" }).closest("form");
    fireEvent.submit(form as HTMLFormElement);

    expect(screen.getByText("Valor inválido.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("não lista contas EXTERNAL no seletor de conta", async () => {
    renderForm();

    fireEvent.mouseDown(screen.getByRole("combobox", { name: /Conta de Origem/ }));
    const listbox = await screen.findByRole("listbox");

    expect(within(listbox).getByRole("option", { name: /Codaqui \(COMMUNITY\)/ })).toBeInTheDocument();
    expect(within(listbox).getByRole("option", { name: /DevParaná \(COMMUNITY\)/ })).toBeInTheDocument();
    expect(within(listbox).queryByRole("option", { name: /Stripe/ })).not.toBeInTheDocument();
  });

  it("registra pagamento com confirmação, limpa o formulário e chama onSuccess", async () => {
    const authFetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ id: "vp-1" }) }),
    );
    const { onSuccess } = renderForm({ authFetch: authFetch as any });

    await fillValidForm();
    fireEvent.change(screen.getByLabelText(/URL do Comprovante \(original\)/), {
      target: { value: "  https://receipt.example.com/nota.pdf  " },
    });
    fireEvent.change(screen.getByLabelText(/URL do Comprovante \(cópia interna/), {
      target: { value: "https://drive.google.com/copia" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Registrar Pagamento" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Confirmar pagamento")).toBeInTheDocument();
    expect(within(dialog).getByText("PrintShop")).toBeInTheDocument();
    expect(within(dialog).getByText(/pagará/)).toBeInTheDocument();
    expect(within(dialog).getByText(/R\$ 150\.50/)).toBeInTheDocument();
    expect(within(dialog).getByText("Codaqui")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Registrar" }));

    await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(1));
    const [url, init] = authFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${API_URL}/vendors/payments`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      vendorId: "v-1",
      sourceAccountId: "a-1",
      amount: 15050,
      description: "Banner do evento",
      receiptUrl: "https://receipt.example.com/nota.pdf",
      internalReceiptUrl: "https://drive.google.com/copia",
    });

    expect(
      await screen.findByText("Pagamento registrado e lançado no ledger!"),
    ).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/Descrição/)).toHaveValue("");
  });

  it("fecha o modal sem enviar ao cancelar", async () => {
    const { authFetch } = renderForm();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Registrar Pagamento" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(authFetch).not.toHaveBeenCalled();
  });

  it("exibe a mensagem de erro retornada pela API", async () => {
    const authFetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        json: async () => ({ message: "Conta inativa para lançamentos" }),
      }),
    );
    renderForm({ authFetch: authFetch as any });

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Registrar Pagamento" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Registrar" }),
    );

    expect(await screen.findByText("Conta inativa para lançamentos")).toBeInTheDocument();
  });

  it("usa o prefixo de erro padrão quando a API não retorna mensagem", async () => {
    const authFetch = jest.fn(() =>
      Promise.resolve({ ok: false, json: async () => ({}) }),
    );
    renderForm({ authFetch: authFetch as any });

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Registrar Pagamento" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Registrar" }),
    );

    expect(await screen.findByText("Erro ao registrar pagamento.")).toBeInTheDocument();
  });

  it("exibe erro desconhecido quando a requisição falha sem Error", async () => {
    const authFetch = jest.fn(() => Promise.reject("falha de rede"));
    renderForm({ authFetch: authFetch as any });

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Registrar Pagamento" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Registrar" }),
    );

    expect(await screen.findByText("Erro desconhecido.")).toBeInTheDocument();
  });

  it("registra recebimento usando destinationAccountId e endpoint de receipts", async () => {
    const authFetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ id: "vr-1" }) }),
    );
    const { onSuccess } = renderForm({ direction: "receipt", authFetch: authFetch as any });

    expect(screen.getByText("Conta da comunidade que vai receber o valor")).toBeInTheDocument();

    await selectVendor(/Sem Documento/);
    await selectAccount(/Conta de Destino/, /DevParaná \(COMMUNITY\)/);
    fillAmountAndDescription("200", "Repasse de ingressos");

    fireEvent.click(screen.getByRole("button", { name: "Registrar Recebimento" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Confirmar recebimento")).toBeInTheDocument();
    expect(within(dialog).getByText(/repassará/)).toBeInTheDocument();
    expect(within(dialog).getByText(/vendor-receipt/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Registrar" }));

    await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(1));
    const [url, init] = authFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${API_URL}/vendors/receipts`);
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toEqual({
      vendorId: "v-2",
      destinationAccountId: "a-2",
      amount: 20000,
      description: "Repasse de ingressos",
    });
    expect(body).not.toHaveProperty("receiptUrl");
    expect(body).not.toHaveProperty("internalReceiptUrl");

    expect(
      await screen.findByText("Recebimento registrado e lançado no ledger!"),
    ).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("preenche o formulário com initialValues e abre a confirmação diretamente", async () => {
    renderForm({
      initialValues: {
        vendorId: "v-1",
        accountId: "a-1",
        amount: "75",
        description: "Hospedagem mensal",
        receiptUrl: "",
        internalReceiptUrl: "",
      },
    });

    expect(screen.getByLabelText(/Valor \(R\$\)/)).toHaveValue(75);
    expect(screen.getByLabelText(/Descrição/)).toHaveValue("Hospedagem mensal");

    fireEvent.click(screen.getByRole("button", { name: "Registrar Pagamento" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Confirmar pagamento")).toBeInTheDocument();
    expect(within(dialog).getByText("PrintShop")).toBeInTheDocument();
    expect(within(dialog).getByText("Codaqui")).toBeInTheDocument();
  });
});

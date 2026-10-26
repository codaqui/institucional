import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMui } from "../../../../../test/render-mui";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MarkdownLite from "../MarkdownLite";
import EventReimbursementDialog from "../EventReimbursementDialog";
import EventOrdersDialog from "../EventOrdersDialog";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// MarkdownLite — regras reais do renderer original (subconjunto seguro)
// ---------------------------------------------------------------------------

describe("MarkdownLite", () => {
  it("renderiza '## ' como h2 e '### ' como h3", () => {
    const { container } = renderWithMui(
      <MarkdownLite text={"## Título da seção\n\n### Subtítulo"} />,
    );
    const h2 = screen.getByRole("heading", { level: 2, name: "Título da seção" });
    const h3 = screen.getByRole("heading", { level: 3, name: "Subtítulo" });
    expect(h2).toBeInTheDocument();
    expect(h3).toBeInTheDocument();
    expect(container.querySelector("p")).toBeNull();
  });

  it("renderiza **negrito** como <strong> e *itálico*/_itálico_ como <em>", () => {
    renderWithMui(<MarkdownLite text={"Texto com **negrito** e *itálico* e _sublinhado_."} />);
    expect(screen.getByText("negrito").tagName).toBe("STRONG");
    expect(screen.getByText("itálico").tagName).toBe("EM");
    expect(screen.getByText("sublinhado").tagName).toBe("EM");
  });

  it("renderiza [link](https://...) com target=_blank e rel seguro", () => {
    renderWithMui(<MarkdownLite text={"Veja [nosso site](https://codaqui.dev/) aqui."} />);
    const link = screen.getByRole("link", { name: "nosso site" });
    expect(link).toHaveAttribute("href", "https://codaqui.dev/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("BLOQUEIA link com esquema inseguro: renderiza a sintaxe como texto literal", () => {
    const { container } = renderWithMui(
      <MarkdownLite text={"Clique [aqui](javascript:alert(1)) agora."} />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("p")?.textContent).toBe(
      "Clique [aqui](javascript:alert(1)) agora.",
    );
  });

  it("BLOQUEIA HTML cru: tags são escapadas como texto, nunca viram elementos", () => {
    const { container } = renderWithMui(
      <MarkdownLite text={"<script>alert(1)</script>"} />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
  });

  it("renderiza blocos de lista '- ' como <ul>/<li>", () => {
    const { container } = renderWithMui(<MarkdownLite text={"- primeira\n- segunda"} />);
    expect(container.querySelector("ul")).not.toBeNull();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("primeira");
    expect(items[1]).toHaveTextContent("segunda");
  });

  it("quebra de linha simples vira <br> dentro do mesmo parágrafo", () => {
    const { container } = renderWithMui(<MarkdownLite text={"linha um\nlinha dois"} />);
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.querySelector("br")).not.toBeNull();
    expect(screen.getByText(/linha um/)).toBeInTheDocument();
    expect(screen.getByText(/linha dois/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// EventReimbursementDialog
// ---------------------------------------------------------------------------

describe("EventReimbursementDialog", () => {
  const balances = [
    { id: "acc-1", projectKey: "codaqui", name: "Codaqui", balance: 1250.5 },
    { id: "acc-2", projectKey: "devparana", name: "DevParaná", balance: 300 },
  ];

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(balances)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderDialog(overrides: Record<string, unknown> = {}) {
    const authFetch = vi.fn(async () => jsonResponse({ id: "abcdef12-3456", status: "pending" }));
    const utils = renderWithMui(
      <EventReimbursementDialog
        open
        onClose={vi.fn()}
        apiUrl="https://api.test"
        authFetch={authFetch}
        title="DevPR Conf"
        {...overrides}
      />,
    );
    return { authFetch, ...utils };
  }

  it("não monta o dialog nem busca saldos quando open=false", () => {
    renderDialog({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("carrega contas ao abrir e pré-seleciona communityProjectKey", async () => {
    renderDialog({ communityProjectKey: "devparana" });
    const combobox = await screen.findByRole("combobox");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.test/ledger/community-balances",
    );
    expect(combobox).toHaveTextContent("DevParaná");
  });

  it("exibe erro de carregamento quando o fetch de saldos falha", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    renderDialog();
    expect(await screen.findByText("Erro ao carregar contas.")).toBeInTheDocument();
  });

  it("valida campos obrigatórios antes de submeter", async () => {
    renderDialog();
    await screen.findByRole("combobox");
    await userEvent.click(screen.getByRole("button", { name: /lançar despesa/i }));
    expect(await screen.findByText("Selecione a conta da comunidade.")).toBeInTheDocument();
  });

  it("lança despesa com sucesso e chama onCreated", async () => {
    const onCreated = vi.fn();
    const authFetch = vi.fn(async () => jsonResponse({ id: "abcdef12-3456", status: "pending" }));
    renderWithMui(
      <EventReimbursementDialog
        open
        onClose={vi.fn()}
        apiUrl="https://api.test"
        authFetch={authFetch}
        title="DevPR Conf"
        eventId="evt-1"
        onCreated={onCreated}
      />,
    );

    await userEvent.click(await screen.findByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: /Codaqui/ }));

    await userEvent.type(screen.getByLabelText(/valor/i), "50");
    await userEvent.type(screen.getByLabelText(/descrição/i), "Coffee do evento");
    await userEvent.type(screen.getByLabelText(/link do comprovante/i), "https://drive.google.com/x");
    await userEvent.click(screen.getByRole("button", { name: /lançar despesa/i }));

    expect(await screen.findByText(/Solicitação #abcdef12/)).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith(
      "https://api.test/events/evt-1/reimbursements",
      expect.objectContaining({ method: "POST" }),
    );
    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1), { timeout: 3000 });
  });

  it("usa endpoint de evento externo quando eventKey é passado", async () => {
    const authFetch = vi.fn(async () =>
      jsonResponse({ message: "Saldo insuficiente" }, 400),
    );
    renderWithMui(
      <EventReimbursementDialog
        open
        onClose={vi.fn()}
        apiUrl="https://api.test"
        authFetch={authFetch}
        title="Meetup externo"
        eventKey="meetup:devparana:123"
      />,
    );

    await userEvent.click(await screen.findByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: /Codaqui/ }));
    await userEvent.type(screen.getByLabelText(/valor/i), "10");
    await userEvent.type(screen.getByLabelText(/descrição/i), "Kit");
    await userEvent.type(screen.getByLabelText(/link do comprovante/i), "https://imgur.com/x");
    await userEvent.click(screen.getByRole("button", { name: /lançar despesa/i }));

    expect(await screen.findByText("Saldo insuficiente")).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith(
      "https://api.test/events/external/meetup%3Adevparana%3A123/reimbursements",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

// ---------------------------------------------------------------------------
// EventOrdersDialog
// ---------------------------------------------------------------------------

describe("EventOrdersDialog", () => {
  const paidOrder = {
    id: "order-abc-123",
    status: "paid",
    quantity: 2,
    totalCents: 9000,
    paidAt: "2026-10-20T18:00:00.000Z",
    createdAt: "2026-10-20T17:00:00.000Z",
    stripePaymentIntentId: "pi_1",
    member: { id: "m1", name: "Ana Souza", email: "ana@ex.com", handle: "anasouza" },
    attendees: [{ name: "Ana Souza", email: "ana@ex.com" }],
    ticketType: { id: "t1", name: "Geral", kind: "paid", priceCents: 4500 },
  };

  it("não monta o dialog nem dispara fetches quando open=false", () => {
    const authFetch = vi.fn(async () => jsonResponse([]));
    renderWithMui(
      <EventOrdersDialog
        open={false}
        onClose={vi.fn()}
        eventId="evt-1"
        eventTitle="Meetup"
        apiUrl="https://api.test"
        authFetch={authFetch}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(authFetch).not.toHaveBeenCalled();
  });

  it("estado vazio: mostra mensagem quando não há pedidos", async () => {
    const authFetch = vi.fn(async () => jsonResponse([]));
    renderWithMui(
      <EventOrdersDialog
        open
        onClose={vi.fn()}
        eventId="evt-1"
        eventTitle="Meetup"
        apiUrl="https://api.test"
        authFetch={authFetch}
      />,
    );
    expect(
      await screen.findByText("Nenhum pedido encontrado para este evento."),
    ).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith("https://api.test/events/evt-1/orders");
  });

  it("estado de erro: authFetch rejeitado mostra alerta de falha", async () => {
    const authFetch = vi.fn(async () => {
      throw new Error("network down");
    });
    renderWithMui(
      <EventOrdersDialog
        open
        onClose={vi.fn()}
        eventId="evt-1"
        eventTitle="Meetup"
        apiUrl="https://api.test"
        authFetch={authFetch}
      />,
    );
    expect(
      await screen.findByText("Erro inesperado ao carregar pedidos."),
    ).toBeInTheDocument();
  });

  it("renderiza pedidos pagos com receita confirmada", async () => {
    const authFetch = vi.fn(async () => jsonResponse([paidOrder]));
    renderWithMui(
      <EventOrdersDialog
        open
        onClose={vi.fn()}
        eventId="evt-1"
        eventTitle="Meetup"
        apiUrl="https://api.test"
        authFetch={authFetch}
      />,
    );
    expect((await screen.findAllByText("Ana Souza")).length).toBeGreaterThan(0);
    expect(screen.getByText("@anasouza")).toBeInTheDocument();
    expect(screen.getByText("Pago")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 90,00").length).toBeGreaterThan(0);
    expect(screen.getByText(/Receita confirmada/)).toHaveTextContent("R$ 90,00");
  });

  it("usa endpoint de evento externo quando só eventKey é informado", async () => {
    const authFetch = vi.fn(async () => jsonResponse([]));
    renderWithMui(
      <EventOrdersDialog
        open
        onClose={vi.fn()}
        eventKey="meetup:devparana:123"
        eventTitle="Meetup externo"
        apiUrl="https://api.test"
        authFetch={authFetch}
      />,
    );
    await screen.findByText("Nenhum pedido encontrado para este evento.");
    expect(authFetch).toHaveBeenCalledWith(
      "https://api.test/events/external/meetup%3Adevparana%3A123/orders",
    );
  });

  it("aba Caixa: busca ledger e mostra estado vazio de transações", async () => {
    const authFetch = vi.fn(async (_url: string) =>
      jsonResponse({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 }),
    );
    renderWithMui(
      <EventOrdersDialog
        open
        onClose={vi.fn()}
        eventId="evt-1"
        eventTitle="Meetup"
        apiUrl="https://api.test"
        authFetch={authFetch}
      />,
    );
    await userEvent.click(await screen.findByRole("tab", { name: "Caixa" }));
    expect(
      await screen.findByText("Nenhuma transação encontrada para este evento."),
    ).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith(
      "https://api.test/events/evt-1/ledger?page=1&limit=10",
    );
  });

  it("reembolsa pedido pago via ModalConfirm", async () => {
    const authFetch = vi.fn(async (url: string) =>
      url.includes("/refund") ? jsonResponse({ ok: true }) : jsonResponse([paidOrder]),
    );
    renderWithMui(
      <EventOrdersDialog
        open
        onClose={vi.fn()}
        eventId="evt-1"
        eventTitle="Meetup"
        apiUrl="https://api.test"
        authFetch={authFetch}
      />,
    );
    expect((await screen.findAllByText("Ana Souza")).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "reembolsar" }));

    const confirmDialog = await screen.findByText("Reembolsar pedido");
    expect(confirmDialog).toBeInTheDocument();
    await userEvent.click(
      within(confirmDialog.closest('[role="dialog"]') as HTMLElement).getByRole("button", {
        name: "Reembolsar",
      }),
    );

    expect(await screen.findByText(/reembolsado com sucesso/)).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith(
      "https://api.test/events/orders/order-abc-123/refund",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

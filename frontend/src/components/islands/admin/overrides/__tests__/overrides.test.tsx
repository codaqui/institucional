import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithMui } from "../../../../../test/render-mui";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OverridesApp from "../OverridesApp";

const API = "http://localhost:3001";

const adminUser = {
  sub: "u1",
  githubId: "gh1",
  handle: "admin",
  name: "Admin",
  avatarUrl: "",
  roles: ["admin"],
};

const organizerUser = {
  ...adminUser,
  sub: "u2",
  handle: "organizer",
  roles: ["event_organizer"],
};

const manifest = {
  generatedAt: "2026-10-25T00:00:00.000Z",
  sources: [
    {
      source: "meetup",
      sourceId: "devparana",
      sourceKey: "meetup:devparana",
      type: "meetup",
      label: "Meetup DevParaná",
      emoji: "👥",
      description: "",
      itemCount: 1,
      indexPath: "",
    },
  ],
  events: [
    {
      id: "evt-1",
      title: "Meetup de Outubro",
      startAt: "2026-11-10T18:00:00.000Z",
      source: "meetup",
      sourceId: "devparana",
      sourceKey: "meetup:devparana",
      status: "scheduled",
      itemPath: "",
    },
  ],
};

const existingOverride = {
  sourceKey: "meetup:devparana",
  eventId: "evt-1",
  payload: { title: "Título Antigo", summary: "Resumo antigo" },
  ownerHandle: "admin",
  updatedAt: "2026-10-20T10:00:00.000Z",
  reason: "Primeira edição",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type RouteHandler = (url: string, init?: RequestInit) => Promise<Response> | Response;

/**
 * Handler padrão de rotas do backend para os testes. Cobre o fluxo de leitura
 * (auth/me, manifest de eventos, override público, organizers, activation);
 * mutações não têm rota — cada teste inspeciona as calls do mock.
 */
function defaultHandler(options: { user?: unknown; overrideGet?: Response } = {}): RouteHandler {
  const user = options.user ?? adminUser;
  return async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (url === `${API}/auth/me`) return jsonResponse(user);
    if (url === "/events/index.json") return jsonResponse(manifest);
    if (method === "GET" && url.startsWith(`${API}/events/overrides/`)) {
      return options.overrideGet ?? jsonResponse({ message: "Not found" }, 404);
    }
    if (url === `${API}/events/organizers`) return jsonResponse({ version: 1, ownerships: [] });
    if (method === "GET" && url.startsWith(`${API}/events/external/`) && url.endsWith("/activation")) {
      return jsonResponse({ message: "Not found" }, 404);
    }
    // Mutações de override respondem 200 — os testes inspecionam o payload.
    if (url.startsWith(`${API}/events/overrides`) && ["POST", "PUT", "DELETE"].includes(method)) {
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ message: `Rota não coberta: ${method} ${url}` }, 500);
  };
}

function stubFetch(handler: RouteHandler) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function fetchCall(
  fetchMock: ReturnType<typeof stubFetch>,
  predicate: (url: string, init?: RequestInit) => boolean,
): [string, RequestInit | undefined] | undefined {
  const call = fetchMock.mock.calls.find(([input, init]) =>
    predicate(String(input), init as RequestInit | undefined),
  );
  return call ? [String(call[0]), call[1] as RequestInit | undefined] : undefined;
}

/** Abre o Autocomplete de evento externo e seleciona a primeira opção. */
async function selectExternalEvent() {
  await userEvent.type(await screen.findByRole("combobox"), "outubro");
  const option = await screen.findByRole("option", { name: /Meetup de Outubro/i });
  await userEvent.click(option);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Abas
// ---------------------------------------------------------------------------

describe("OverridesApp — abas", () => {
  it("renderiza as três abas e o painel de override por padrão", async () => {
    stubFetch(defaultHandler());
    renderWithMui(<OverridesApp />);

    const tablist = await screen.findByRole("tablist");
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    expect(tabs.map((t) => t.textContent)).toEqual([
      "Override de metadados",
      "Organizers",
      "Ativação de features",
    ]);
    expect(screen.getByRole("tab", { name: "Organizers" })).toBeEnabled();

    // Painel padrão (aba 0): seletor de evento externo.
    expect(await screen.findByRole("combobox")).toBeInTheDocument();
  });

  it("aba Organizers renderiza o painel de ownerships para admin", async () => {
    const fetchMock = stubFetch(defaultHandler());
    renderWithMui(<OverridesApp />);

    await userEvent.click(await screen.findByRole("tab", { name: "Organizers" }));

    expect(
      await screen.findByText(/O mapeamento de ownership define quais eventos externos/),
    ).toBeInTheDocument();
    expect(screen.getByText("Adicionar organizer")).toBeInTheDocument();
    expect(screen.getByText("Nenhum organizer mapeado ainda.")).toBeInTheDocument();
    expect(fetchCall(fetchMock, (url) => url === `${API}/events/organizers`)).toBeDefined();
  });

  it("aba Organizers fica desabilitada para organizador não-admin", async () => {
    stubFetch(defaultHandler({ user: organizerUser }));
    renderWithMui(<OverridesApp />);

    expect(await screen.findByRole("tab", { name: "Organizers" })).toBeDisabled();
  });

  it("aba Ativação de features renderiza o painel com o formulário de features", async () => {
    stubFetch(defaultHandler());
    renderWithMui(<OverridesApp />);

    await userEvent.click(await screen.findByRole("tab", { name: "Ativação de features" }));
    await selectExternalEvent();

    expect(
      await screen.findByText(/Este evento externo ainda não está ativado/),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Check-in/ })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Certificados/ })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Pagamentos/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ativar evento" })).toBeDisabled();
  });

  it("ligar Certificados liga Check-in junto", async () => {
    stubFetch(defaultHandler());
    renderWithMui(<OverridesApp />);

    await userEvent.click(await screen.findByRole("tab", { name: "Ativação de features" }));
    await selectExternalEvent();

    await userEvent.click(await screen.findByRole("checkbox", { name: /Certificados/ }));
    expect(screen.getByRole("checkbox", { name: /Check-in/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Certificados/ })).toBeChecked();
  });
});

// ---------------------------------------------------------------------------
// OverridesTab — salvamento
// ---------------------------------------------------------------------------

describe("OverridesTab — salvamento de override", () => {
  it("cria override novo via POST com payload correto", async () => {
    const fetchMock = stubFetch(defaultHandler());
    renderWithMui(<OverridesApp />);

    await selectExternalEvent();
    // Carregou sem override: formulário vazio.
    expect(await screen.findByText("Nenhum override ativo para este evento.")).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText(/Título \(override — use com cautela\)/),
      "Meetup Corrigido",
    );
    await userEvent.type(screen.getByLabelText(/Motivo da alteração/), "Corrige título");
    await userEvent.click(screen.getByRole("button", { name: "Salvar override" }));

    expect(await screen.findByText(/Override salvo com sucesso/)).toBeInTheDocument();
    const call = fetchCall(
      fetchMock,
      (url, init) => url === `${API}/events/overrides` && init?.method === "POST",
    );
    expect(call).toBeDefined();
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      sourceKey: "meetup:devparana",
      eventId: "evt-1",
      payload: { extendData: { title: "Meetup Corrigido" } },
      reason: "Corrige título",
    });
  });

  it("atualiza override existente via PUT com payload correto", async () => {
    const fetchMock = stubFetch(
      defaultHandler({ overrideGet: jsonResponse(existingOverride) }),
    );
    renderWithMui(<OverridesApp />);

    await selectExternalEvent();
    expect(await screen.findByText("Override ativo · @admin")).toBeInTheDocument();
    expect(screen.getByLabelText(/Título \(override — use com cautela\)/)).toHaveValue(
      "Título Antigo",
    );

    const titleInput = screen.getByLabelText(/Título \(override — use com cautela\)/);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Novo Título");
    await userEvent.type(screen.getByLabelText(/Motivo da alteração/), "Ajuste de título");
    await userEvent.click(screen.getByRole("button", { name: "Salvar override" }));

    expect(await screen.findByText(/Override salvo com sucesso/)).toBeInTheDocument();
    const call = fetchCall(
      fetchMock,
      (url, init) =>
        url === `${API}/events/overrides/meetup%3Adevparana/evt-1` && init?.method === "PUT",
    );
    expect(call).toBeDefined();
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      payload: { extendData: { title: "Novo Título", summary: "Resumo antigo" } },
      reason: "Ajuste de título",
    });
  });

  it("estado de erro: exibe a mensagem retornada pelo backend", async () => {
    const fetchMock = stubFetch(async (url, init) => {
      if (url === `${API}/events/overrides` && init?.method === "POST") {
        return jsonResponse({ message: "Evento não encontrado na fonte" }, 400);
      }
      return defaultHandler()(url, init);
    });
    renderWithMui(<OverridesApp />);

    await selectExternalEvent();
    await userEvent.type(screen.getByLabelText(/Motivo da alteração/), "Tentativa");
    await userEvent.click(screen.getByRole("button", { name: "Salvar override" }));

    expect(await screen.findByText("Evento não encontrado na fonte")).toBeInTheDocument();
    expect(
      fetchCall(
        fetchMock,
        (url, init) => url === `${API}/events/overrides` && init?.method === "POST",
      ),
    ).toBeDefined();
  });
});

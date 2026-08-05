import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminEventosPage from "../eventos";
import { buildAuthState, mockUseAuth } from "../../../test-utils/auth";
import { jsonResponse } from "../../../test-utils/http";
import { mockHistory, resetRouterMocks } from "../../../test-utils/router";

jest.mock("../../../hooks/useAuth");
jest.mock(
  "../../../components/AdminNavbar",
  () => require("../../../test-utils/admin-component-mocks").mockAdminNavbarModule,
);
jest.mock(
  "../../../components/AdminPageContainer",
  () => require("../../../test-utils/admin-component-mocks").mockAdminPageContainerModule,
);

function buildEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-1",
    slug: "evento-teste",
    title: "Evento Teste",
    summary: "Resumo do evento teste",
    imageUrl: null,
    location: "Maringá, PR",
    startAt: "2026-08-10T13:00:00.000Z",
    endAt: null,
    timezone: "America/Sao_Paulo",
    communityProjectKey: "codaqui",
    status: "draft",
    capacity: 100,
    ticketTypes: [],
    staff: [],
    ...overrides,
  };
}

// ── Fixtures do hub (eventos externos via snapshot estático) ────────────────

const externalEvent = {
  id: "ext-1",
  title: "Meetup Externo",
  summary: "Resumo externo",
  startAt: "2026-09-01T18:00:00.000Z",
  timezone: "America/Sao_Paulo",
  platform: "Meetup",
  host: "DevParaná",
  location: "Maringá, PR",
  href: "https://www.meetup.com/devparana/events/1",
  tags: [],
  ctaLabel: "Abrir",
  status: "scheduled",
  source: "meetup",
  sourceId: "devparana",
  sourceKey: "meetup:devparana",
  itemPath: "/events/meetup/devparana/ext-1.json",
  hasOverride: true,
};

const externalIndex = {
  generatedAt: "2026-07-29T00:00:00.000Z",
  sources: [
    {
      source: "meetup",
      sourceId: "devparana",
      type: "meetup",
      label: "DevParaná no Meetup",
      emoji: "📍",
      description: "",
      sourceKey: "meetup:devparana",
      indexPath: "/events/meetup/devparana/index.json",
      itemCount: 1,
    },
  ],
  events: [externalEvent],
};

const EMPTY_INDEX = { sources: [], events: [] };
const EMPTY_ORGANIZERS = { version: 1, ownerships: [] };

/** Cria um authFetch mockado que responde aos endpoints usados pelo hub. */
function createAuthFetchMock(
  index: unknown = EMPTY_INDEX,
  organizers: unknown = EMPTY_ORGANIZERS,
  activations: unknown = [],
) {
  return jest.fn(async (url: string, options?: RequestInit) => {
    if (url.includes("/events/organizers")) return jsonResponse(organizers);
    if (url.includes("/events/external/activations")) return jsonResponse(activations);
    if (url.endsWith("/events") && !options) return jsonResponse([]);
    if (url.endsWith("/admin/members")) return jsonResponse([]);
    return jsonResponse(null, { ok: false, status: 404 });
  });
}

/** Stub do fetch global para os estáticos (/events/index.json). */
function stubStaticFetches(index: unknown = EMPTY_INDEX) {
  (global as Record<string, unknown>).fetch = jest.fn(async (url: unknown) => {
    const href = String(url);
    if (href.includes("/events/index.json")) return jsonResponse(index);
    return jsonResponse(null, { ok: false, status: 404 });
  });
}

describe("/admin/eventos", () => {
  beforeEach(() => {
    resetRouterMocks();
    stubStaticFetches();
  });

  it("redireciona para home quando não autenticado", async () => {
    mockUseAuth.mockReturnValue(buildAuthState({
      isLoggedIn: false,
      user: null,
      authFetch: jest.fn() as any,
    }));

    render(<AdminEventosPage />);

    await waitFor(() => {
      expect(mockHistory.replace).toHaveBeenCalledWith("/");
    });
  });

  it("exibe aviso de acesso restrito sem role de organizador", async () => {
    const authFetch = jest.fn();
    mockUseAuth.mockReturnValue(buildAuthState({
      authFetch: authFetch as any,
      user: { sub: "u-1", roles: ["membro"] } as any,
    }));

    render(<AdminEventosPage />);

    expect(
      await screen.findByText(/Acesso restrito a administradores e organizadores de eventos/i),
    ).toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalled();
  });

  it("lista eventos e publica um rascunho", async () => {
    const authFetch = createAuthFetchMock(EMPTY_INDEX, EMPTY_ORGANIZERS);
    authFetch.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url.endsWith("/events") && !options) {
        return jsonResponse([buildEvent()]);
      }
      if (url.endsWith("/admin/members")) {
        return jsonResponse([]);
      }
      if (url.endsWith("/events/evt-1/publish") && options?.method === "POST") {
        return jsonResponse({ ok: true });
      }
      return jsonResponse(null, { ok: false, status: 404 });
    });

    mockUseAuth.mockReturnValue(buildAuthState({
      isEventOrganizer: true,
      authFetch: authFetch as any,
      user: { sub: "org-1", roles: ["membro", "event_organizer"] } as any,
    }));

    render(<AdminEventosPage />);

    expect(await screen.findByText("Evento Teste")).toBeInTheDocument();
    expect(screen.getByText("Rascunho")).toBeInTheDocument();

    // Expande o accordion para revelar as ações
    fireEvent.click(screen.getByText("Evento Teste"));
    fireEvent.click(await screen.findByRole("button", { name: /Publicar/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/events/evt-1/publish"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    // Feedback de sucesso com link para a página pública do evento
    expect(await screen.findByText(/publicado com sucesso/i)).toBeInTheDocument();
    const publicLinks = screen.getAllByRole("link", { name: /Ver página pública/i });
    expect(publicLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of publicLinks) {
      expect(link).toHaveAttribute(
        "href",
        "/eventos/detalhe?source=internal&sourceId=codaqui&id=evt-1",
      );
    }
  });

  it("valida campos obrigatórios ao criar evento", async () => {
    const authFetch = createAuthFetchMock();

    mockUseAuth.mockReturnValue(buildAuthState({
      isAdmin: true,
      authFetch: authFetch as any,
      user: { sub: "admin-1", roles: ["admin"] } as any,
    }));

    render(<AdminEventosPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Novo evento/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/i }));

    expect(
      await screen.findByText(/Preencha slug, título, resumo e local/i),
    ).toBeInTheDocument();
  });

  it("renderiza lista unificada com badges e ações de evento externo", async () => {
    stubStaticFetches(externalIndex);
    const organizers = {
      version: 1,
      ownerships: [
        { memberId: "org-1", githubHandle: "org", scope: ["meetup:devparana:*"] },
      ],
    };
    const authFetch = createAuthFetchMock(externalIndex, organizers);
    authFetch.mockImplementation(async (url: string) => {
      if (url.includes("/events/organizers")) return jsonResponse(organizers);
      if (url.endsWith("/events")) return jsonResponse([buildEvent()]);
      if (url.endsWith("/admin/members")) return jsonResponse([]);
      if (url.endsWith("/events/external/activations")) {
        return jsonResponse([
          {
            id: "act-1",
            eventKey: "meetup:devparana:ext-1",
            features: ["checkin"],
            communityProjectKey: "devparana",
            title: "Meetup Externo",
            enabledByMemberId: "org-1",
          },
        ]);
      }
      return jsonResponse(null, { ok: false, status: 404 });
    });

    mockUseAuth.mockReturnValue(buildAuthState({
      isEventOrganizer: true,
      authFetch: authFetch as any,
      user: { sub: "org-1", handle: "org", roles: ["membro", "event_organizer"] } as any,
    }));

    render(<AdminEventosPage />);

    // Linha interna e externa na mesma lista unificada
    expect(await screen.findByText("Evento Teste")).toBeInTheDocument();
    expect(await screen.findByText("Meetup Externo")).toBeInTheDocument();

    // Badges da linha externa: fonte, override, ownership (wildcard) e feature
    expect(screen.getByText(/Externo · 📍 DevParaná no Meetup/)).toBeInTheDocument();
    expect(screen.getByText("Override")).toBeInTheDocument();
    // "Você pode editar" aparece na linha interna (sempre) e na externa (wildcard)
    expect(screen.getAllByText("Você pode editar").length).toBeGreaterThanOrEqual(2);

    // Ações da linha externa
    expect(screen.getByRole("link", { name: /Editar metadados/i })).toHaveAttribute(
      "href",
      "/admin/overrides?tab=0&sourceKey=meetup%3Adevparana&eventId=ext-1",
    );
    expect(screen.getByRole("link", { name: /Plugins/i })).toHaveAttribute(
      "href",
      "/admin/overrides?tab=2&sourceKey=meetup%3Adevparana&eventId=ext-1",
    );
    expect(screen.getByRole("link", { name: /^Check-in$/i })).toHaveAttribute(
      "href",
      `/admin/eventos-checkin?event=${encodeURIComponent("external:meetup:devparana:ext-1")}`,
    );
  });

  it("organizador não-admin vê apenas externos com ownership por padrão", async () => {
    const index = {
      ...externalIndex,
      events: [
        externalEvent,
        { ...externalEvent, id: "ext-2", title: "Outro Externo", hasOverride: false },
      ],
    };
    // Escopo exato apenas para ext-1
    stubStaticFetches(index);
    const organizers = {
      version: 1,
      ownerships: [
        { memberId: "org-1", githubHandle: "org", scope: ["meetup:devparana:ext-1"] },
      ],
    };
    const authFetch = createAuthFetchMock(index, organizers);
    authFetch.mockImplementation(async (url: string) => {
      if (url.includes("/events/organizers")) return jsonResponse(organizers);
      if (url.endsWith("/events")) return jsonResponse([]);
      if (url.endsWith("/admin/members")) return jsonResponse([]);
      if (url.endsWith("/events/external/activations")) return jsonResponse([]);
      return jsonResponse(null, { ok: false, status: 404 });
    });

    mockUseAuth.mockReturnValue(buildAuthState({
      isEventOrganizer: true,
      authFetch: authFetch as any,
      user: { sub: "org-1", handle: "org", roles: ["membro", "event_organizer"] } as any,
    }));

    render(<AdminEventosPage />);

    // Filtro "Posso editar" já vem ligado para não-admin
    expect(await screen.findByText("Meetup Externo")).toBeInTheDocument();
    expect(screen.queryByText("Outro Externo")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Posso editar"));

    expect(screen.getByText("Outro Externo")).toBeInTheDocument();
    expect(screen.getByText("Meetup Externo")).toBeInTheDocument();
  });

  it("admin vê todos os externos por padrão (filtro 'Posso editar' desligado)", async () => {
    const index = {
      ...externalIndex,
      events: [
        externalEvent,
        { ...externalEvent, id: "ext-2", title: "Outro Externo", hasOverride: false },
      ],
    };
    stubStaticFetches(index);
    const organizers = {
      version: 1,
      ownerships: [
        { memberId: "org-1", githubHandle: "org", scope: ["meetup:devparana:ext-1"] },
      ],
    };
    const authFetch = createAuthFetchMock(index, organizers);
    authFetch.mockImplementation(async (url: string) => {
      if (url.includes("/events/organizers")) return jsonResponse(organizers);
      if (url.endsWith("/events")) return jsonResponse([]);
      if (url.endsWith("/admin/members")) return jsonResponse([]);
      if (url.endsWith("/events/external/activations")) return jsonResponse([]);
      return jsonResponse(null, { ok: false, status: 404 });
    });

    mockUseAuth.mockReturnValue(buildAuthState({
      isAdmin: true,
      authFetch: authFetch as any,
      user: { sub: "admin-1", handle: "admin", roles: ["admin"] } as any,
    }));

    render(<AdminEventosPage />);

    expect(await screen.findByText("Meetup Externo")).toBeInTheDocument();
    expect(screen.getByText("Outro Externo")).toBeInTheDocument();
  });

  it("esconde botão Lançar despesa para organizador sem role financeira", async () => {
    const authFetch = createAuthFetchMock(EMPTY_INDEX, EMPTY_ORGANIZERS);
    authFetch.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url.endsWith("/events") && !options) {
        return jsonResponse([buildEvent()]);
      }
      if (url.endsWith("/admin/members")) {
        return jsonResponse([]);
      }
      return jsonResponse(null, { ok: false, status: 404 });
    });

    mockUseAuth.mockReturnValue(buildAuthState({
      isEventOrganizer: true,
      authFetch: authFetch as any,
      user: { sub: "org-1", roles: ["membro", "event_organizer"] } as any,
    }));

    render(<AdminEventosPage />);

    expect(await screen.findByText("Evento Teste")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Evento Teste"));
    expect(screen.queryByRole("button", { name: /Lançar despesa/i })).not.toBeInTheDocument();
  });

  it("exibe botão Lançar despesa para admin", async () => {
    const authFetch = createAuthFetchMock(EMPTY_INDEX, EMPTY_ORGANIZERS);
    authFetch.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url.endsWith("/events") && !options) {
        return jsonResponse([buildEvent()]);
      }
      if (url.endsWith("/admin/members")) {
        return jsonResponse([]);
      }
      return jsonResponse(null, { ok: false, status: 404 });
    });

    mockUseAuth.mockReturnValue(buildAuthState({
      isAdmin: true,
      authFetch: authFetch as any,
      user: { sub: "admin-1", roles: ["admin"] } as any,
    }));

    render(<AdminEventosPage />);

    expect(await screen.findByText("Evento Teste")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Evento Teste"));
    expect(screen.getByRole("button", { name: /Lançar despesa/i })).toBeInTheDocument();
  });
});

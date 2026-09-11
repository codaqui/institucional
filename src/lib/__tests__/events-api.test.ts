import type { EventIndexFile, EventSummary } from "../../data/events";
import type { EventOverrideMeta } from "../../utils/event-override";
import { fetchEventsIndexMerged, type MergedEventsIndex } from "../events-api";

function makeEvent(
  overrides: Partial<EventSummary> & { _override?: EventOverrideMeta } = {},
): EventSummary {
  const { _override, ...rest } = overrides;
  return {
    id: "evt-1",
    title: "Evento Base",
    summary: "Resumo base",
    startAt: "2026-08-01T18:00:00.000Z",
    timezone: "America/Sao_Paulo",
    location: "Online",
    href: "https://example.com/evt-1",
    ctaLabel: "Abrir",
    platform: "Meetup",
    host: "Comunidade",
    tags: [],
    status: "scheduled",
    source: "meetup",
    sourceId: "devparana",
    sourceKey: "meetup:devparana",
    itemPath: "/events/meetup/devparana/evt-1.json",
    ...rest,
    _override,
  } as EventSummary;
}

interface MockResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function jsonResponse(data: unknown, ok = true, status = 200): MockResponse {
  return { ok, status, json: async () => data };
}

describe("fetchEventsIndexMerged", () => {
  const indexPayload: EventIndexFile = {
    generatedAt: "2026-07-29T00:00:00.000Z",
    sources: [],
    events: [makeEvent()],
  };

  beforeEach(() => {
    (globalThis.fetch as unknown as jest.Mock) = jest.fn();
  });

  it("retorna o indice ja mesclado pelo sync", async () => {
    const mergedPayload: EventIndexFile = {
      ...indexPayload,
      events: [
        makeEvent({
          title: "Titulo Corrigido",
          hasOverride: true,
          _override: {
            ownerHandle: "endersonmenezes",
            updatedAt: "2026-07-29T00:00:00.000Z",
          },
        }),
      ],
    };
    (globalThis.fetch as unknown as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/events/overrides/public")) {
        return Promise.resolve(jsonResponse([], false, 404));
      }
      return Promise.resolve(jsonResponse(mergedPayload));
    });

    const result = await fetchEventsIndexMerged();
    expect(result.events[0].title).toBe("Titulo Corrigido");
    expect(result.events[0].hasOverride).toBe(true);
    expect(result.events[0]._override?.ownerHandle).toBe("endersonmenezes");
    expect(globalThis.fetch as unknown as jest.Mock).toHaveBeenCalledWith("/events/index.json");
  });

  it("lanca erro quando o indice principal falha", async () => {
    (globalThis.fetch as unknown as jest.Mock).mockImplementation(() =>
      Promise.resolve(jsonResponse(null, false, 500))
    );
    await expect(fetchEventsIndexMerged()).rejects.toThrow("Events index unavailable");
  });

  it("mescla overrides recentes do backend por cima do snapshot", async () => {
    const overrides = [
      {
        sourceKey: "meetup:devparana",
        eventId: "evt-1",
        ownerHandle: "endersonmenezes",
        updatedAt: "2026-08-15T12:00:00.000Z",
        reason: "Corrigir titulo",
        payload: { title: "Titulo via Override", featured: true },
      },
    ];
    (globalThis.fetch as unknown as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/events/overrides/public")) {
        return Promise.resolve(jsonResponse(overrides));
      }
      return Promise.resolve(jsonResponse(indexPayload));
    });

    const result = await fetchEventsIndexMerged();

    expect(result.events[0].title).toBe("Titulo via Override");
    expect(result.events[0].featured).toBe(true);
    expect(result.events[0].hasOverride).toBe(true);
    expect(result.events[0]._override).toEqual({
      ownerHandle: "endersonmenezes",
      updatedAt: "2026-08-15T12:00:00.000Z",
      reason: "Corrigir titulo",
    });
  });

  it("normaliza reason ausente para null no _override", async () => {
    const overrides = [
      {
        sourceKey: "meetup:devparana",
        eventId: "evt-1",
        ownerHandle: "endersonmenezes",
        updatedAt: "2026-08-15T12:00:00.000Z",
        payload: { summary: "Resumo novo" },
      },
    ];
    (globalThis.fetch as unknown as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/events/overrides/public")) {
        return Promise.resolve(jsonResponse(overrides));
      }
      return Promise.resolve(jsonResponse(indexPayload));
    });

    const result = await fetchEventsIndexMerged();

    expect(result.events[0].summary).toBe("Resumo novo");
    expect(result.events[0]._override?.reason).toBeNull();
  });

  it("nao altera eventos cujo sourceKey::id nao bate com nenhum override", async () => {
    const overrides = [
      {
        sourceKey: "discord:codaqui",
        eventId: "outro-evento",
        ownerHandle: "alguem",
        updatedAt: "2026-08-15T12:00:00.000Z",
        payload: { title: "Nao deve aplicar" },
      },
    ];
    (globalThis.fetch as unknown as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/events/overrides/public")) {
        return Promise.resolve(jsonResponse(overrides));
      }
      return Promise.resolve(jsonResponse(indexPayload));
    });

    const result = await fetchEventsIndexMerged();

    expect(result.events[0].title).toBe("Evento Base");
    expect(result.events[0]._override).toBeUndefined();
  });

  it("ignora overrides quando a chamada publica falha (rede)", async () => {
    (globalThis.fetch as unknown as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/events/overrides/public")) {
        return Promise.reject(new Error("backend down"));
      }
      return Promise.resolve(jsonResponse(indexPayload));
    });

    const result = await fetchEventsIndexMerged();

    expect(result.events).toHaveLength(1);
    expect(result.events[0].title).toBe("Evento Base");
  });

  it("prefixa a chamada de overrides com apiUrl quando informada", async () => {
    (globalThis.fetch as unknown as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/events/overrides/public")) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse(indexPayload));
    });

    await fetchEventsIndexMerged("https://api.codaqui.dev");

    const calls = (globalThis.fetch as unknown as jest.Mock).mock.calls.map(
      ([url]: [string]) => url,
    );
    expect(calls).toContain("https://api.codaqui.dev/events/overrides/public");
    expect(calls).toContain("/events/index.json");
  });
});

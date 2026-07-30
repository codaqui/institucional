import type { EventSummary } from "../../data/events";
import {
  fetchEventsIndexMerged,
  mergeEventsWithOverridesIndex,
  OVERRIDES_INDEX_URL,
  overrideIndexKey,
  type OverridesIndexFile,
} from "../events-api";

function makeEvent(overrides: Partial<EventSummary> = {}): EventSummary {
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
    ...overrides,
  } as EventSummary;
}

describe("mergeEventsWithOverridesIndex", () => {
  it("mantém o evento intacto quando não há entrada no manifesto", () => {
    const event = makeEvent();
    const merged = mergeEventsWithOverridesIndex([event], {});
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(event);
    expect(merged[0].hasOverride).toBeUndefined();
  });

  it("aplica o extendData por cima e marca hasOverride + override", () => {
    const event = makeEvent({ hasOverride: false });
    const merged = mergeEventsWithOverridesIndex([event], {
      "meetup:devparana:evt-1": {
        extendData: { title: "Título Corrigido", featured: true },
        ownerHandle: "endersonmenezes",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    });
    expect(merged[0].title).toBe("Título Corrigido");
    expect(merged[0].featured).toBe(true);
    expect(merged[0].hasOverride).toBe(true);
    expect(merged[0].override?.ownerHandle).toBe("endersonmenezes");
    // Campos não sobrescrevíveis permanecem
    expect(merged[0].id).toBe("evt-1");
    expect(merged[0].summary).toBe("Resumo base");
  });

  it("ignora entradas sem extendData", () => {
    const event = makeEvent();
    const merged = mergeEventsWithOverridesIndex([event], {
      [overrideIndexKey(event)]: {} as never,
    });
    expect(merged[0].hasOverride).toBeUndefined();
  });

  it("não mistura overrides de eventos diferentes", () => {
    const a = makeEvent({ id: "a" });
    const b = makeEvent({ id: "b" });
    const merged = mergeEventsWithOverridesIndex([a, b], {
      "meetup:devparana:b": { extendData: { title: "Só o B" } },
    });
    expect(merged[0].title).toBe("Evento Base");
    expect(merged[1].title).toBe("Só o B");
  });
});

interface MockResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function jsonResponse(data: unknown, ok = true, status = 200): MockResponse {
  return { ok, status, json: async () => data };
}

describe("fetchEventsIndexMerged", () => {
  const indexPayload = {
    generatedAt: "2026-07-29T00:00:00.000Z",
    sources: [],
    events: [makeEvent()],
  };

  beforeEach(() => {
    (globalThis.fetch as unknown as jest.Mock) = jest.fn();
  });

  it("usa o manifesto agregado quando disponível", async () => {
    const manifesto: OverridesIndexFile = {
      version: 1,
      updatedAt: "2026-07-29T00:00:00.000Z",
      overrides: {
        "meetup:devparana:evt-1": { extendData: { title: "Via Manifesto" } },
      },
    };
    (globalThis.fetch as unknown as jest.Mock).mockImplementation((url: string) => {
      if (url === OVERRIDES_INDEX_URL) {
        return Promise.resolve(jsonResponse(manifesto));
      }
      return Promise.resolve(jsonResponse(indexPayload));
    });

    const result = await fetchEventsIndexMerged();
    expect(result.events[0].title).toBe("Via Manifesto");
    expect(result.events[0].hasOverride).toBe(true);
    // Sem fetch individual de .override.json quando o manifesto existe
    expect(globalThis.fetch as unknown as jest.Mock).toHaveBeenCalledTimes(2);
  });

  it("faz fallback para a flag hasOverride + fetch individual quando o manifesto 404", async () => {
    const payloadComFlag = {
      ...indexPayload,
      events: [makeEvent({ hasOverride: true })],
    };
    const overrideFile = {
      eventId: "evt-1",
      sourceKey: "meetup:devparana",
      extendData: { title: "Via Fetch Individual" },
      ownerHandle: "alguem",
      updatedAt: "2026-07-01T00:00:00.000Z",
    };
    (globalThis.fetch as unknown as jest.Mock).mockImplementation((url: string) => {
      if (url === OVERRIDES_INDEX_URL) {
        return Promise.resolve(jsonResponse(null, false, 404));
      }
      if (url.endsWith(".override.json")) {
        return Promise.resolve(jsonResponse(overrideFile));
      }
      return Promise.resolve(jsonResponse(payloadComFlag));
    });

    const result = await fetchEventsIndexMerged();
    expect(result.events[0].title).toBe("Via Fetch Individual");
    expect(result.events[0].hasOverride).toBe(true);
    expect(result.events[0].override?.ownerHandle).toBe("alguem");
  });

  it("fallback sem hasOverride não busca override individual", async () => {
    (globalThis.fetch as unknown as jest.Mock).mockImplementation((url: string) => {
      if (url === OVERRIDES_INDEX_URL) {
        return Promise.resolve(jsonResponse(null, false, 404));
      }
      return Promise.resolve(jsonResponse(indexPayload));
    });

    const result = await fetchEventsIndexMerged();
    expect(result.events[0]).toEqual(indexPayload.events[0]);
  });

  it("lança erro quando o índice principal falha", async () => {
    (globalThis.fetch as unknown as jest.Mock).mockImplementation(() =>
      Promise.resolve(jsonResponse(null, false, 500))
    );
    await expect(fetchEventsIndexMerged()).rejects.toThrow("Events index unavailable");
  });
});

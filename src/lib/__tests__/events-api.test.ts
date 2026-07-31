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

  it("retorna o indice ja mesclado pelo sync (um unico fetch)", async () => {
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
    (globalThis.fetch as unknown as jest.Mock).mockImplementation(() =>
      Promise.resolve(jsonResponse(mergedPayload))
    );

    const result = await fetchEventsIndexMerged();
    expect(result.events[0].title).toBe("Titulo Corrigido");
    expect(result.events[0].hasOverride).toBe(true);
    expect(result.events[0]._override?.ownerHandle).toBe("endersonmenezes");
    expect(globalThis.fetch as unknown as jest.Mock).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch as unknown as jest.Mock).toHaveBeenCalledWith("/events/index.json");
  });

  it("lanca erro quando o indice principal falha", async () => {
    (globalThis.fetch as unknown as jest.Mock).mockImplementation(() =>
      Promise.resolve(jsonResponse(null, false, 500))
    );
    await expect(fetchEventsIndexMerged()).rejects.toThrow("Events index unavailable");
  });
});

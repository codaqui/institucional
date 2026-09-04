import type { EventDetailFile } from "../../data/events";
import {
  getEventDetailPagePath,
  loadEventWithOverride,
} from "../event-override";

const baseDetail: EventDetailFile = {
  generatedAt: "2026-04-29T00:00:00Z",
  source: {
    source: "meetup",
    sourceId: "devparana",
    type: "meetup",
    label: "DevParaná no Meetup",
    emoji: "📍",
    description: "Eventos do DevParaná",
  },
  event: {
    id: "226163759",
    title: "DevParaná MeetUP #42",
    summary: "Resumo original do sync.",
    startAt: "2026-05-10T17:00:00Z",
    timezone: "America/Sao_Paulo",
    platform: "Meetup",
    host: "DevParaná",
    location: "Local original",
    href: "https://www.meetup.com/devparana/events/226163759/",
    tags: ["meetup"],
    ctaLabel: "Abrir no Meetup",
    status: "scheduled",
  },
};

describe("loadEventWithOverride", () => {
  beforeEach(() => {
    (globalThis.fetch as unknown as jest.Mock) = jest.fn();
  });

  it("retorna o evento do snapshot já mesclado e extrai _override", async () => {
    const mergedEvent = {
      ...baseDetail.event,
      summary: "Resumo corrigido pelo organizador.",
      _override: {
        ownerHandle: "organizador",
        updatedAt: "2026-04-29T23:00:00-03:00",
        reason: "Corrigindo resumo",
      },
    };
    (globalThis.fetch as unknown as jest.Mock).mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, json: async () => ({ ...baseDetail, event: mergedEvent }) })
    );

    const result = await loadEventWithOverride("meetup", "devparana", "226163759");

    expect(result.event.summary).toBe("Resumo corrigido pelo organizador.");
    expect(result.override?.ownerHandle).toBe("organizador");
    expect(result.source.label).toBe("DevParaná no Meetup");

    const fetchMock = globalThis.fetch as unknown as jest.Mock;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/events/meetup/devparana/226163759.json");
  });

  it("trata evento sem _override como override null", async () => {
    (globalThis.fetch as unknown as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/events/overrides/")) {
        return Promise.resolve({ ok: false, status: 404, json: async () => null });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => baseDetail });
    });

    const result = await loadEventWithOverride("meetup", "devparana", "226163759");

    expect(result.override).toBeNull();
    expect(result.event).toEqual(baseDetail.event);
  });

  it("lança erro quando o evento base não existe", async () => {
    (globalThis.fetch as unknown as jest.Mock).mockImplementation(() =>
      Promise.resolve({ ok: false, status: 404, json: async () => null })
    );

    await expect(
      loadEventWithOverride("meetup", "devparana", "inexistente")
    ).rejects.toThrow("Evento não encontrado");
  });

  it("faz fallback para a API pública quando o snapshot de evento interno não existe", async () => {
    const startAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const managedEventPayload = {
      id: "uuid-interno-1",
      slug: "encontro-codaqui",
      title: "Encontro Codaqui",
      summary: "Evento próprio recém-publicado.",
      imageUrl: null,
      location: "Maringá, PR",
      startAt: startAt.toISOString(),
      endAt: new Date(startAt.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      timezone: "America/Sao_Paulo",
      status: "published",
    };
    (globalThis.fetch as unknown as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/events/public/managed/")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ event: managedEventPayload, ticketTypes: [] }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => null });
    });

    const result = await loadEventWithOverride("internal", "codaqui", "uuid-interno-1");

    expect(result.event.title).toBe("Encontro Codaqui");
    expect(result.event.platform).toBe("Site Codaqui");
    expect(result.event.host).toBe("Codaqui");
    expect(result.event.status).toBe("scheduled");
    expect(result.event.href).toBe(
      "/eventos/detalhe?source=internal&sourceId=codaqui&id=uuid-interno-1"
    );
    expect(result.source.label).toBe("Codaqui");
    expect(result.source.source).toBe("internal");

    const fetchMock = globalThis.fetch as unknown as jest.Mock;
    expect(fetchMock).toHaveBeenCalledWith("/events/internal/codaqui/uuid-interno-1.json");
    expect(fetchMock).toHaveBeenCalledWith("/events/public/managed/uuid-interno-1");
  });

  it("mantém o erro para fonte externa sem snapshot (sem fallback)", async () => {
    (globalThis.fetch as unknown as jest.Mock).mockImplementation(() =>
      Promise.resolve({ ok: false, status: 404, json: async () => null })
    );

    await expect(
      loadEventWithOverride("meetup", "devparana", "externo-sem-snapshot")
    ).rejects.toThrow("Evento não encontrado");

    const fetchMock = globalThis.fetch as unknown as jest.Mock;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/events/meetup/devparana/externo-sem-snapshot.json"
    );
  });
});

describe("paths helpers", () => {
  it("monta a URL da página de detalhe com query params", () => {
    expect(getEventDetailPagePath("meetup", "devparana", "123")).toBe(
      "/eventos/detalhe?source=meetup&sourceId=devparana&id=123"
    );
  });
});

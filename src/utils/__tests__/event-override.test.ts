import type { EventDetailFile } from "../../data/events";
import {
  getEventDetailPagePath,
  loadEventWithOverride,
  mergeEventWithOverride,
  type EventOverride,
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

const override: EventOverride = {
  sourceKey: "meetup:devparana",
  eventId: "226163759",
  payload: {
    summary: "Resumo corrigido pelo organizador.",
    imageUrl: "https://res.cloudinary.com/banner.png",
    featured: true,
    tags: ["meetup", "presencial"],
    speakers: [
      {
        name: "Fulano",
        handle: "fulano",
        talkTitle: "Docker para iniciantes",
      },
    ],
    slidesUrl: "https://slides.example.com/talk",
    videoUrl: "https://youtube.com/watch?v=abc",
    discussionUrl: "https://github.com/codaqui/institucional/discussions/1",
  },
  ownerHandle: "organizador",
  updatedAt: "2026-04-29T23:00:00-03:00",
  reason: "Corrigindo resumo e adicionando banner",
};

describe("mergeEventWithOverride", () => {
  it("sobrescreve campos presentes no payload", () => {
    const merged = mergeEventWithOverride(baseDetail.event, override);
    expect(merged.summary).toBe("Resumo corrigido pelo organizador.");
    expect(merged.imageUrl).toBe("https://res.cloudinary.com/banner.png");
    expect(merged.featured).toBe(true);
    expect(merged.tags).toEqual(["meetup", "presencial"]);
    expect(merged.speakers).toHaveLength(1);
    expect(merged.slidesUrl).toBe("https://slides.example.com/talk");
    expect(merged.videoUrl).toBe("https://youtube.com/watch?v=abc");
    expect(merged.discussionUrl).toBe(
      "https://github.com/codaqui/institucional/discussions/1"
    );
  });

  it("preserva campos do base ausentes no payload", () => {
    const merged = mergeEventWithOverride(baseDetail.event, override);
    expect(merged.title).toBe("DevParaná MeetUP #42");
    expect(merged.location).toBe("Local original");
    expect(merged.startAt).toBe("2026-05-10T17:00:00Z");
    expect(merged.href).toBe(baseDetail.event.href);
    expect(merged.status).toBe("scheduled");
  });

  it("retorna o base inalterado quando override é null", () => {
    const merged = mergeEventWithOverride(baseDetail.event, null);
    expect(merged).toEqual(baseDetail.event);
  });
});

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
    (globalThis.fetch as unknown as jest.Mock).mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, json: async () => baseDetail })
    );

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
});

describe("paths helpers", () => {
  it("monta a URL da página de detalhe com query params", () => {
    expect(getEventDetailPagePath("meetup", "devparana", "123")).toBe(
      "/eventos/detalhe?source=meetup&sourceId=devparana&id=123"
    );
  });
});

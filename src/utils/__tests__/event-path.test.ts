import {
  buildEventJsonLd,
  buildEventPath,
  resolveEventImageUrl,
  truncateEventSummary,
} from "../event-path";
import type { EventItem } from "../../data/events";

describe("buildEventPath", () => {
  it("monta a rota estática com os três segmentos", () => {
    expect(buildEventPath("meetup", "devparana", "123")).toBe(
      "/eventos/detalhe/meetup/devparana/123"
    );
  });

  it("codifica cada segmento individualmente", () => {
    expect(buildEventPath("sympla", "campos tech", "evt:123/abc")).toBe(
      "/eventos/detalhe/sympla/campos%20tech/evt%3A123%2Fabc"
    );
  });

  it("codifica caracteres especiais de query no id", () => {
    expect(buildEventPath("discord", "codaqui", "a?b&c=d")).toBe(
      "/eventos/detalhe/discord/codaqui/a%3Fb%26c%3Dd"
    );
  });
});

describe("resolveEventImageUrl", () => {
  const site = "https://codaqui.dev";

  it("mantém URL absoluta", () => {
    expect(resolveEventImageUrl("https://cdn.example.com/x.png", site)).toBe(
      "https://cdn.example.com/x.png"
    );
  });

  it("prefixa caminho relativo com a URL do site", () => {
    expect(resolveEventImageUrl("/img/evento.png", site)).toBe(
      "https://codaqui.dev/img/evento.png"
    );
  });

  it("adiciona barra inicial quando ausente", () => {
    expect(resolveEventImageUrl("img/evento.png", site)).toBe(
      "https://codaqui.dev/img/evento.png"
    );
  });

  it("cai na imagem OG padrão quando ausente", () => {
    expect(resolveEventImageUrl(undefined, site)).toBe(
      "https://codaqui.dev/img/og-codaqui.jpg"
    );
  });
});

describe("truncateEventSummary", () => {
  it("mantém texto curto inalterado", () => {
    expect(truncateEventSummary("Resumo curto.")).toBe("Resumo curto.");
  });

  it("trunca em ~160 chars com reticência", () => {
    const long = "a".repeat(200);
    const result = truncateEventSummary(long);
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result.endsWith("…")).toBe(true);
  });

  it("normaliza quebras de linha e espaços", () => {
    expect(truncateEventSummary("linha 1\n\n  linha   2")).toBe(
      "linha 1 linha 2"
    );
  });
});

describe("buildEventJsonLd", () => {
  const baseEvent: EventItem = {
    id: "evt-1",
    title: "Encontro Codaqui",
    summary: "Resumo do encontro.",
    startAt: "2026-10-01T19:00:00-03:00",
    timezone: "America/Sao_Paulo",
    platform: "Site Codaqui",
    host: "Codaqui",
    location: "Auditório Central",
    href: "/eventos/detalhe/internal/codaqui/evt-1",
    tags: [],
    ctaLabel: "Inscrever-se",
    status: "scheduled",
  };
  const url = "https://codaqui.dev/eventos/detalhe/internal/codaqui/evt-1";

  it("inclui os campos obrigatórios do schema.org/Event", () => {
    const jsonLd = buildEventJsonLd(baseEvent, url);
    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toBe("Event");
    expect(jsonLd.name).toBe("Encontro Codaqui");
    expect(jsonLd.description).toBe("Resumo do encontro.");
    expect(jsonLd.startDate).toBe("2026-10-01T19:00:00-03:00");
    expect(jsonLd.eventStatus).toBe("https://schema.org/EventScheduled");
    expect(jsonLd.location).toEqual({
      "@type": "Place",
      name: "Auditório Central",
    });
    expect(jsonLd.organizer).toEqual({
      "@type": "Organization",
      name: "Codaqui",
    });
    expect(jsonLd.url).toBe(url);
    expect(jsonLd.endDate).toBeUndefined();
    expect(jsonLd.image).toBeUndefined();
  });

  it("inclui endDate e image quando presentes", () => {
    const jsonLd = buildEventJsonLd(
      {
        ...baseEvent,
        endAt: "2026-10-01T21:00:00-03:00",
        imageUrl: "/img/evento.png",
      },
      url
    );
    expect(jsonLd.endDate).toBe("2026-10-01T21:00:00-03:00");
    expect(jsonLd.image).toBe("https://codaqui.dev/img/evento.png");
  });

  it.each([
    ["scheduled", "EventScheduled"],
    ["active", "EventScheduled"],
    ["completed", "EventCompleted"],
    ["canceled", "EventCancelled"],
  ] as const)("mapeia status %s → %s", (status, expected) => {
    const jsonLd = buildEventJsonLd({ ...baseEvent, status }, url);
    expect(jsonLd.eventStatus).toBe(`https://schema.org/${expected}`);
  });

  it("usa EventScheduled quando status está ausente", () => {
    const { status, ...semStatus } = baseEvent;
    const jsonLd = buildEventJsonLd(semStatus, url);
    expect(jsonLd.eventStatus).toBe("https://schema.org/EventScheduled");
  });
});

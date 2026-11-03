import { describe, expect, it } from "vitest";
import {
  ADULT_CONTENT_BADGE,
  ADULT_CONTENT_NOTICE_BODY,
  ADULT_CONTENT_NOTICE_TITLE,
  getEventLocalHour,
  shouldSuggestAdult,
} from "./adult-content";

describe("adult content", () => {
  it("suggests 18+ only for bar/restaurant at or after 18h", () => {
    expect(shouldSuggestAdult({ venueType: "bar", localHour: 18 })).toBe(true);
    expect(shouldSuggestAdult({ venueType: "restaurante", localHour: 17 })).toBe(false);
    expect(shouldSuggestAdult({ venueType: "campus", localHour: 20 })).toBe(false);
  });

  it("uses the event timezone to calculate the local hour", () => {
    expect(
      getEventLocalHour("2026-11-01T21:00:00.000Z", "America/Sao_Paulo"),
    ).toBe(18);
    expect(getEventLocalHour("2026-11-01T19:30", "America/Sao_Paulo")).toBe(19);
    expect(getEventLocalHour("invalid", "America/Sao_Paulo")).toBeNull();
  });

  it("keeps the informational copy exact", () => {
    expect(ADULT_CONTENT_BADGE).toBe("+18");
    expect(ADULT_CONTENT_NOTICE_TITLE).toBe(
      "Evento destinado a maiores de 18 anos",
    );
    expect(ADULT_CONTENT_NOTICE_BODY).toBe(
      "Este evento acontece em local, horário ou contexto destinado a maiores. Menores de idade devem participar acompanhados de um responsável legal. A sinalização é informativa e não substitui as regras do local nem a verificação de responsabilidade do organizador.",
    );
  });
});

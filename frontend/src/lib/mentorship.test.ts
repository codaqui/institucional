import { describe, expect, it } from "vitest";
import {
  buildMentorshipCalendarUrl,
  buildMentorshipSessionUrl,
  formatMentorshipDate,
  MENTORSHIP_STATUS_LABEL,
} from "./mentorship";

describe("mentorship presentation", () => {
  it("preserves wall-clock fields for availability slots without an offset", () => {
    const formatted = formatMentorshipDate("2026-11-16T19:00", "America/Sao_Paulo");
    expect(formatted).toContain("16/11/2026");
    expect(formatted).toContain("19:00");
  });

  it("formats the instant in the session timezone", () => {
    const formatted = formatMentorshipDate("2026-11-16T22:00:00.000Z", "America/Sao_Paulo");
    expect(formatted).toContain("16/11/2026");
    expect(formatted).toContain("19:00");
  });

  it("labels every session status in Portuguese", () => {
    expect(MENTORSHIP_STATUS_LABEL).toEqual({
      requested: "Solicitada",
      confirmed: "Confirmada",
      completed: "Concluída",
      canceled: "Cancelada",
      no_show: "No-show",
    });
  });
});

describe("buildMentorshipSessionUrl", () => {
  it("monta a URL pública da sessão a partir da origem e do token", () => {
    expect(buildMentorshipSessionUrl("https://codaqui.dev", "token-1")).toBe(
      "https://codaqui.dev/mentoria/sessao/token-1",
    );
  });

  it("codifica tokens com caracteres especiais", () => {
    expect(buildMentorshipSessionUrl("https://codaqui.dev", "a b/c")).toBe(
      "https://codaqui.dev/mentoria/sessao/a%20b%2Fc",
    );
  });
});

describe("buildMentorshipCalendarUrl", () => {
  const baseInput = {
    scheduledAt: "2026-11-16T22:00:00.000Z",
    durationMin: 60,
    sessionUrl: "https://codaqui.dev/mentoria/sessao/token-1",
    menteeName: "Bia",
  };

  it("monta a URL do Google Calendar com início e fim em UTC", () => {
    const url = buildMentorshipCalendarUrl(baseInput);
    expect(url.startsWith("https://calendar.google.com/calendar/render?action=TEMPLATE")).toBe(
      true,
    );
    expect(url).toContain("dates=20261116T220000Z%2F20261116T230000Z");
    const expectedDetails = new URLSearchParams({
      details:
        "Sessão de mentoria com Bia. Acompanhe a sessão: https://codaqui.dev/mentoria/sessao/token-1",
    }).toString();
    expect(url).toContain(expectedDetails);
  });

  it("preserva a duração total quando a sessão cruza a meia-noite", () => {
    const url = buildMentorshipCalendarUrl({
      ...baseInput,
      scheduledAt: "2026-11-16T23:30:00.000Z",
    });
    expect(url).toContain("dates=20261116T233000Z%2F20261117T003000Z");
  });

  it("inclui o link da videochamada como location apenas quando informado", () => {
    const withMeet = buildMentorshipCalendarUrl({
      ...baseInput,
      meetLink: "https://meet.example.test/session",
    });
    expect(withMeet).toContain(
      `location=${encodeURIComponent("https://meet.example.test/session")}`,
    );
    expect(buildMentorshipCalendarUrl(baseInput)).not.toContain("location=");
  });

  it("funciona sem o nome do mentorando", () => {
    const { menteeName: _ignored, ...input } = baseInput;
    const url = buildMentorshipCalendarUrl(input);
    expect(url).toContain("dates=20261116T220000Z%2F20261116T230000Z");
  });
});

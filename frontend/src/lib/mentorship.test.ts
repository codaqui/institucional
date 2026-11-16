import { describe, expect, it } from "vitest";
import { formatMentorshipDate, MENTORSHIP_STATUS_LABEL } from "./mentorship";

describe("mentorship presentation", () => {
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

import assert from "node:assert/strict";
import test from "node:test";

import {
  extractSymplaDateLine,
  mapSymplaEvent,
  mapSymplaEventStatus,
  parseSymplaDateText,
  resolveSymplaStartAt,
  SYMPLA_CARD_DATE_PATTERN,
} from "./sync-events.mjs";

const SYMPLA_BRAZIL_TZ = "-03:00";

// Reference date used to reproduce the 2026 sync bug where 2024 events were
// incorrectly placed in the present year.
const REFERENCE_DATE = new Date("2026-08-01T12:00:00-03:00");

function dt(iso) {
  return `${iso}:00${SYMPLA_BRAZIL_TZ}`;
}

test("parseSymplaDateText: rich detail format with explicit year", () => {
  assert.equal(
    parseSymplaDateText("12 mai - 2026 • 13:05"),
    dt("2026-05-12T13:05")
  );
});

test("parseSymplaDateText: card format with day-of-week and time", () => {
  // March has already passed relative to the August reference date, so a
  // scheduled event is pushed to the following year.
  assert.equal(
    parseSymplaDateText("Sab, 28 Mar · 14:00", "scheduled", REFERENCE_DATE),
    dt("2027-03-28T14:00")
  );
});

test("parseSymplaDateText: plain month-day without time defaults to 00:00", () => {
  assert.equal(
    parseSymplaDateText("16 Mai", "scheduled", REFERENCE_DATE),
    dt("2027-05-16T00:00")
  );
});

test("parseSymplaDateText: completed event from previous year is placed in the past", () => {
  assert.equal(
    parseSymplaDateText("Sab, 10 Ago · 13:00", "completed", REFERENCE_DATE),
    dt("2025-08-10T13:00")
  );
});

test("parseSymplaDateText: completed event from 2024 is inferred when running in 2026", () => {
  // When the date already falls in the past for the current year, the
  // heuristic keeps the most recent past year (2026). This is why fetching
  // the detail page — which contains the explicit year — is required for
  // events from previous years.
  assert.equal(
    parseSymplaDateText("Sab, 11 Mai · 13:00", "completed", REFERENCE_DATE),
    dt("2026-05-11T13:00")
  );
  assert.equal(
    parseSymplaDateText("Sab, 03 Fev · 13:00", "completed", REFERENCE_DATE),
    dt("2026-02-03T13:00")
  );

  // If the date is still in the future for the current year, the heuristic
  // walks backwards until it lands in the past.
  assert.equal(
    parseSymplaDateText("Sab, 10 Ago · 13:00", "completed", REFERENCE_DATE),
    dt("2025-08-10T13:00")
  );
});

test("parseSymplaDateText: scheduled future event crosses to next year if needed", () => {
  // If today is August and we read "03 Fev" on an available event, it must
  // belong to next year.
  assert.equal(
    parseSymplaDateText("Sab, 03 Fev · 13:00", "scheduled", REFERENCE_DATE),
    dt("2027-02-03T13:00")
  );
});

test("SYMPLA_CARD_DATE_PATTERN does not match false positives like venue text", () => {
  assert.equal(
    SYMPLA_CARD_DATE_PATTERN.test("312 Coworking and Offices - Ponta Grossa, PR"),
    false
  );
  assert.equal(
    SYMPLA_CARD_DATE_PATTERN.test("Minicurso: UX Design - Prototipando um app mobile na prática"),
    false
  );
});

test("SYMPLA_CARD_DATE_PATTERN matches real Sympla card date strings", () => {
  assert.ok(SYMPLA_CARD_DATE_PATTERN.test("Sab, 10 Ago · 13:00"));
  assert.ok(SYMPLA_CARD_DATE_PATTERN.test("Sex, 27 Mar · 19:00"));
  assert.ok(SYMPLA_CARD_DATE_PATTERN.test("16 Mai"));
});

// ── Real-world card fixtures captured from Sympla producer pages ─────────────
// These URLs are kept as documentation for E2E validation; the unit tests use
// the captured text snippets so they remain deterministic.
//
// https://codaqui.dev/eventos/detalhe?source=sympla&sourceId=campostech&id=sympla-2582075
// https://codaqui.dev/eventos/detalhe?source=sympla&sourceId=campostech&id=sympla-2452255
// https://codaqui.dev/eventos/detalhe?source=sympla&sourceId=campostech&id=sympla-2321587

const cardUxDesign = {
  id: "sympla-2582075",
  href: "https://www.sympla.com.br/evento/minicurso-ux-design-prototipando-um-app-mobile-na-pratica/2582075",
  title: "Minicurso: UX Design - Prototipando um app mobile na prática",
  imageUrl: "https://images.sympla.com.br/66afbfd82c57b-xs.png",
  allText: [
    "Sab, 10 Ago · 13:00",
    "Minicurso: UX Design - Prototipando um app mobile na prática",
    "312 Coworking and Offices - Ponta Grossa, PR",
  ],
};

const cardDevOps = {
  id: "sympla-2452255",
  href: "https://www.sympla.com.br/evento/minicurso-devops-uma-infraestrutura-agil-para-automatizar-o-seu-deploy/2452255",
  title: "Minicurso: DevOps - Uma infraestrutura ágil para automatizar o seu deploy",
  imageUrl: "https://images.sympla.com.br/6634e17e87c26-xs.png",
  allText: [
    "Sab, 11 Mai · 13:00",
    "Minicurso: DevOps - Uma infraestrutura ágil para automatizar o seu deploy",
    "312 Coworking and Offices - Ponta Grossa, PR",
  ],
};

const cardApiTesting = {
  id: "sympla-2321587",
  href: "https://www.sympla.com.br/evento/minicurso-teste-de-api-na-pratica/2321587",
  title: "Minicurso: Teste de API na Prática!",
  imageUrl: "https://images.sympla.com.br/65b3ba83dd44e-xs.png",
  allText: [
    "Sab, 03 Fev · 13:00",
    "Minicurso: Teste de API na Prática!",
    "312 Coworking and Offices - Ponta Grossa, PR",
  ],
};

const campostechConfig = {
  source: "sympla",
  sourceId: "campostech",
  producerSlug: "camposvalley",
  label: "CamposTech na Sympla",
  emoji: "🏙️",
  description: "Eventos organizados pelo CamposTech na plataforma Sympla.",
  ctaLabel: "Ver eventos na Sympla",
  ctaHref: "https://www.sympla.com.br/produtor/camposvalley",
  defaultHost: "CamposTech",
  defaultLocation: "Ponta Grossa, PR",
  defaultPlatform: "Sympla",
};

test("resolveSymplaStartAt picks card date and ignores venue false positive", () => {
  const startAt = resolveSymplaStartAt(null, cardUxDesign, "completed");
  // The parsed date uses the current year as a starting point; with the fix
  // it must be a real ISO string and not the fallback new Date().toISOString().
  assert.ok(startAt, "expected a parsed startAt, got undefined");
  assert.doesNotMatch(startAt, /T22:17:11\.031Z$/);
  assert.ok(startAt.includes("-08-10T13:00:00-03:00"));
});

test("mapSymplaEvent: detail page with explicit year places 2024 CamposTech events correctly", () => {
  // These are the date lines that appear on the Sympla detail pages.
  const detailUx = { startDateRaw: "10 ago - 2024 • 13:00", endDateRaw: "10 ago - 2024 • 17:00" };
  const detailDevOps = { startDateRaw: "11 mai - 2024 • 13:00", endDateRaw: "11 mai - 2024 • 17:00" };
  const detailApi = { startDateRaw: "03 fev - 2024 • 13:00", endDateRaw: "03 fev - 2024 • 17:00" };

  const eventUx = mapSymplaEvent({ ...cardUxDesign, isEnded: true, detail: detailUx }, campostechConfig);
  const eventDevOps = mapSymplaEvent({ ...cardDevOps, isEnded: true, detail: detailDevOps }, campostechConfig);
  const eventApi = mapSymplaEvent({ ...cardApiTesting, isEnded: true, detail: detailApi }, campostechConfig);

  // Exact historical dates confirmed on the original Sympla pages.
  assert.equal(eventUx.startAt, dt("2024-08-10T13:00"));
  assert.equal(eventDevOps.startAt, dt("2024-05-11T13:00"));
  assert.equal(eventApi.startAt, dt("2024-02-03T13:00"));
  assert.equal(eventUx.endAt, dt("2024-08-10T17:00"));

  for (const event of [eventUx, eventDevOps, eventApi]) {
    assert.equal(event.status, "completed");
    assert.equal(event.location, "312 Coworking and Offices - Ponta Grossa, PR");
  }
});

test("mapSymplaEvent: card-only fallback no longer uses sync timestamp", () => {
  // When the detail page cannot be fetched, the card date is parsed. The year
  // is inferred heuristically, so it may not match the real historical year,
  // but it must never fall back to new Date().toISOString().
  const event = mapSymplaEvent({ ...cardUxDesign, isEnded: true, detail: null }, campostechConfig);

  assert.ok(event.startAt, "expected a parsed startAt, got undefined");
  assert.doesNotMatch(event.startAt, /T22:17:11\.031Z$/);
  assert.ok(event.startAt.includes("-08-10T13:00:00-03:00"));
  assert.equal(event.status, "completed");
});

test("mapSymplaEvent: card-only fallback for all three CamposTech events", () => {
  // These events were originally published in 2024. When the detail page is
  // unreachable, the card text lacks the year, so the parser uses a heuristic
  // based on the current date. The important invariants are:
  //   1. startAt is a real ISO datetime (not the sync timestamp fallback);
  //   2. the day, month and time match the card text;
  //   3. status is "completed" because they came from the "Encerrados" tab.
  const cases = [
    { card: cardUxDesign, expected: "-08-10T13:00:00-03:00" },
    { card: cardDevOps, expected: "-05-11T13:00:00-03:00" },
    { card: cardApiTesting, expected: "-02-03T13:00:00-03:00" },
  ];

  for (const { card, expected } of cases) {
    const event = mapSymplaEvent({ ...card, isEnded: true, detail: null }, campostechConfig);

    assert.ok(event.startAt, `expected a parsed startAt for ${card.id}, got undefined`);
    assert.doesNotMatch(
      event.startAt,
      /T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      `sync timestamp fallback detected for ${card.id}`
    );
    assert.ok(
      event.startAt.includes(expected),
      `expected ${card.id} startAt to include ${expected}, got ${event.startAt}`
    );
    assert.equal(event.status, "completed", `expected ${card.id} status to be completed`);
  }
});

test("mapSymplaEvent: available event keeps scheduled status even if startAt is missing", () => {
  const raw = {
    id: "sympla-available",
    href: "https://www.sympla.com.br/evento/future-event/123456",
    title: "Future Event",
    allText: ["Future Event"],
    isEnded: false,
    detail: null,
  };
  const event = mapSymplaEvent(raw, campostechConfig);
  assert.equal(event.status, "scheduled");
  assert.equal(event.startAt, undefined);
});

test("mapSymplaEventStatus: isEnded wins over missing startAt", () => {
  assert.equal(mapSymplaEventStatus(undefined, true), "completed");
  assert.equal(mapSymplaEventStatus(undefined, false), "scheduled");
});

test("extractSymplaDateLine: rich date range from detail page body", () => {
  const body = "Minicurso UX Design 12 ago - 2026 • 13:05 > 12 ago - 2026 • 17:00 Descrição do evento";
  const result = extractSymplaDateLine(body);
  assert.equal(result.startDateRaw, "12 ago - 2026 • 13:05");
  assert.equal(result.endDateRaw, "12 ago - 2026 • 17:00");
});

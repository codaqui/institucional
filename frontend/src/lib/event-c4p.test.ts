import { describe, expect, it } from "vitest";
import { findPublicC4pForEvent } from "./event-c4p";
import type { C4pSnapshotCall } from "./c4p";
import type { EventSummary } from "./events";

const NOW = new Date("2026-11-18T12:00:00.000Z");
const call = (overrides: Partial<C4pSnapshotCall> = {}): C4pSnapshotCall => ({
  slug: "devpr-conf-2027-c4p",
  name: "C4P — DevPR Conf 2027",
  description: null,
  status: "open",
  submissionOpenAt: null,
  submissionCloseAt: null,
  publicResults: false,
  finalizedAt: null,
  community: null,
  event: { slug: "devpr-conf-2027", title: "DevPR Conf 2027" },
  externalEventKey: null,
  results: null,
  ...overrides,
});
const event = (overrides: Partial<EventSummary> = {}): EventSummary => ({
  id: "event-1",
  slug: "devpr-conf-2027",
  source: "internal",
  sourceId: "codaqui",
  sourceKey: "internal:codaqui",
  itemPath: "/eventos/devpr-conf-2027",
  title: "DevPR Conf 2027",
  summary: "Conferência",
  startAt: "2027-01-10T12:00:00.000Z",
  timezone: "America/Sao_Paulo",
  platform: "Codaqui",
  host: "DevParaná",
  location: "Maringá",
  href: "https://example.com",
  tags: [],
  ctaLabel: "Inscrever-se",
  ...overrides,
});

describe("findPublicC4pForEvent", () => {
  it("associa evento próprio por slug quando a chamada está aberta", () => {
    expect(findPublicC4pForEvent(event(), [call()], NOW)?.slug).toBe("devpr-conf-2027-c4p");
  });

  it("não associa chamada fora da janela ou fechada sem resultado público", () => {
    const calls = [
      call({ slug: "expirada", submissionCloseAt: "2026-11-17T12:00:00.000Z" }),
      call({ slug: "privada", status: "closed", publicResults: false }),
    ];
    expect(findPublicC4pForEvent(event(), calls, NOW)).toBeNull();
  });

  it("mantém resultado público de atividade passada", () => {
    const pastCall = call({
      status: "closed",
      publicResults: true,
      results: { talks: [{ title: "Palestra pública", speakerName: "Maria", track: null, level: null }] },
    });
    expect(findPublicC4pForEvent(event(), [pastCall], NOW)?.results?.talks[0].title).toBe("Palestra pública");
  });

  it("associa evento externo somente pelo eventKey completo", () => {
    const external = event({
      id: "123",
      slug: undefined,
      source: "sympla",
      sourceId: "devpr",
      sourceKey: "sympla:devpr",
    });
    const externalCall = call({ event: null, externalEventKey: "sympla:devpr:123" });
    expect(findPublicC4pForEvent(external, [externalCall], NOW)?.slug).toBe("devpr-conf-2027-c4p");
    expect(findPublicC4pForEvent(event(), [externalCall], NOW)).toBeNull();
  });
});

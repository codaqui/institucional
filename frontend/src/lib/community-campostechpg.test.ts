import { describe, expect, it } from "vitest";
import type { CommunitySiteConfig } from "../../../comunidades/shared/types";
import type { EventSummary } from "./events";
import {
  campostechFeatureCards,
  formatFullEventDate,
  upcomingCommunityEvents,
} from "./community-campostechpg";

const configFixture = (
  features: Partial<CommunitySiteConfig["features"]> = {},
): CommunitySiteConfig => ({
  slug: "campostechpg",
  name: "CamposTech",
  shortName: "CamposTech",
  tagline: "Comunidade de Tecnologia dos Campos Gerais.",
  description: "Descrição",
  logoUrl: "https://example.com/logo.png",
  theme: {
    primary: "#185E89",
    primaryDark: "#162542",
    primaryLight: "#2E4068",
    accent: "#ffcd3e",
    footerBg: "#162542",
  },
  basePath: "/comunidades/campostechpg",
  externalLinks: [],
  navMenu: [],
  features: {
    donations: true,
    transparency: true,
    events: true,
    blog: false,
    docs: true,
    ...features,
  },
  hero: {
    title: "CamposTech",
    subtitle: "Comunidade de Tecnologia dos Campos Gerais.",
    ctaPrimary: { label: "Apoiar a comunidade", to: "/comunidades/campostechpg/apoiar" },
  },
});

const eventFixture = (
  id: string,
  sourceKey: string,
  startAt: string,
  status: EventSummary["status"] = "scheduled",
): EventSummary => ({
  id,
  source: sourceKey.split(":")[0],
  sourceId: sourceKey.split(":")[1] ?? "",
  sourceKey,
  itemPath: `x/${id}.json`,
  title: `Evento ${id}`,
  summary: "",
  startAt,
  timezone: "America/Sao_Paulo",
  platform: "sympla",
  host: "CamposTech",
  location: "Ponta Grossa",
  href: "https://www.sympla.com.br/produtor/camposvalley",
  tags: [],
  ctaLabel: "Ver na Sympla",
  status,
});

describe("campostechFeatureCards", () => {
  it("retorna os 4 cards na ordem do original quando todas as features estão ligadas", () => {
    const cards = campostechFeatureCards(configFixture());
    expect(cards.map((c) => c.title)).toEqual([
      "Quem Somos",
      "Mentores",
      "Apoiar",
      "Transparência",
    ]);
    expect(cards.map((c) => c.icon)).toEqual([
      "menu_book",
      "school",
      "volunteer_activism",
      "paid",
    ]);
  });

  it("usa o basePath do config nos links internos", () => {
    const cards = campostechFeatureCards(configFixture());
    expect(cards.find((c) => c.title === "Quem Somos")?.to).toBe(
      "/comunidades/campostechpg/docs",
    );
    expect(cards.find((c) => c.title === "Mentores")?.to).toBe(
      "/comunidades/campostechpg/mentores",
    );
    expect(cards.find((c) => c.title === "Apoiar")?.to).toBe(
      "/comunidades/campostechpg/apoiar",
    );
    expect(cards.find((c) => c.title === "Transparência")?.to).toBe(
      "/comunidades/campostechpg/transparencia",
    );
  });

  it("filtra Quem Somos/Apoiar/Transparência pelas features, mantendo Mentores", () => {
    const cards = campostechFeatureCards(
      configFixture({ docs: false, donations: false, transparency: false }),
    );
    expect(cards.map((c) => c.title)).toEqual(["Mentores"]);
  });
});

describe("upcomingCommunityEvents", () => {
  const events: EventSummary[] = [
    eventFixture("a", "sympla:campostech", "2030-01-10T18:00:00Z"),
    eventFixture("b", "sympla:campostech", "2030-01-05T18:00:00Z", "completed"),
    eventFixture("c", "sympla:campostech", "2030-01-02T18:00:00Z"),
    eventFixture("d", "meetup:devparana", "2030-01-01T18:00:00Z"),
    eventFixture("e", "sympla:campostech", "2030-01-08T18:00:00Z", "active"),
  ];

  it("filtra por sourceKey, exclui completed, ordena ASC e limita", () => {
    const upcoming = upcomingCommunityEvents(events, ["sympla:campostech"]);
    expect(upcoming.map((e) => e.id)).toEqual(["c", "e", "a"]);
  });

  it("respeita o limite customizado", () => {
    const upcoming = upcomingCommunityEvents(events, ["sympla:campostech"], 2);
    expect(upcoming.map((e) => e.id)).toEqual(["c", "e"]);
  });

  it("retorna vazio sem sourceKeys", () => {
    expect(upcomingCommunityEvents(events, [])).toEqual([]);
  });
});

describe("formatFullEventDate", () => {
  it("formata em pt-BR com data completa e hora curta no timezone do evento", () => {
    const formatted = formatFullEventDate(
      "2030-06-15T18:30:00Z",
      "America/Sao_Paulo",
    );
    expect(formatted).toContain("15 de junho de 2030");
    expect(formatted).toMatch(/15:30/);
  });
});

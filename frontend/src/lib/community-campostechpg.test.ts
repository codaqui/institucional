import { describe, expect, it } from "vitest";
import type { CommunitySiteConfig } from "../../../comunidades/shared/types";
import type { EventSummary } from "./events";
import {
  CAMPOSTECH_EVENT_DISPLAY,
  describeFormatFullEventDate,
  describeUpcomingCommunityEvents,
  makeCommunityEventFixture,
} from "../test/community-events-fixtures";
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
): EventSummary =>
  makeCommunityEventFixture(CAMPOSTECH_EVENT_DISPLAY, id, sourceKey, startAt, status);

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

describeUpcomingCommunityEvents(
  upcomingCommunityEvents,
  eventFixture,
  "sympla:campostech",
  "meetup:devparana",
);

describeFormatFullEventDate(formatFullEventDate);

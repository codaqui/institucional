import { describe, expect, it } from "vitest";
import {
  exploreCardsFromConfig,
  impactStatsFromCampaigns,
  type CommunityCampaign,
} from "./community-sections";
import type { CommunitySiteConfig } from "../../../comunidades/shared/types";

const campaignsFixture: CommunityCampaign[] = [
  {
    slug: "acao-1",
    date: "01/2026",
    action: "Ação Um",
    details: "Detalhes",
    raised: 1000,
    peopleImpacted: 10,
    animalsImpacted: 0,
    status: "Finalizada",
    isFinalized: true,
  },
  {
    slug: "acao-2",
    date: "02/2026",
    action: "Ação Dois",
    details: "Detalhes",
    raised: 500,
    peopleImpacted: 20,
    animalsImpacted: 0,
    status: "Finalizada",
    isFinalized: true,
  },
];

function configFixture(
  features: CommunitySiteConfig["features"],
): CommunitySiteConfig {
  return {
    slug: "tisocial",
    name: "T.I. Social Maringá",
    shortName: "T.I. Social",
    tagline: "Tecnologia que transforma realidades.",
    description: "Descrição",
    logoUrl: "/img/tisocial.png",
    theme: {
      primary: "#8DC044",
      primaryDark: "#424143",
      primaryLight: "#a6d16a",
      accent: "#424143",
      footerBg: "#424143",
    },
    basePath: "/comunidades/tisocial",
    externalLinks: [],
    navMenu: [],
    features,
    hero: {
      title: "T.I. Social Maringá",
      subtitle: "Transformando comunidades através da tecnologia.",
      ctaPrimary: {
        label: "Apoiar a comunidade",
        to: "/comunidades/tisocial/apoiar",
      },
    },
  };
}

describe("impactStatsFromCampaigns", () => {
  it("deriva ações (count), pessoas (soma beneficiados) e R$ (formatBRL pt-BR)", () => {
    const stats = impactStatsFromCampaigns(campaignsFixture);
    expect(stats).toEqual([
      { value: "2", label: "Ações realizadas" },
      { value: "30", label: "Pessoas e animais impactados" },
      // O Intl pt-BR usa NBSP (U+00A0) entre "R$" e o valor.
      { value: "R$\u00A01.500,00", label: "Total arrecadado" },
    ]);
  });

  it("soma pessoas E animais impactados (derivação 1:1 do config tisocial)", () => {
    const stats = impactStatsFromCampaigns([
      { ...campaignsFixture[0], peopleImpacted: 4, animalsImpacted: 350 },
    ]);
    expect(stats[1]).toEqual({
      value: "354",
      label: "Pessoas e animais impactados",
    });
  });

  it("tolera campos opcionais ausentes (raised/impacted zerados)", () => {
    const stats = impactStatsFromCampaigns([
      {
        slug: "x",
        date: "03/2026",
        action: "Ação X",
        details: "",
        raised: 0,
        peopleImpacted: 0,
        animalsImpacted: 0,
        status: "Finalizada",
        isFinalized: true,
      },
    ]);
    expect(stats[0].value).toBe("1");
    expect(stats[1].value).toBe("0");
    expect(stats[2].value).toBe("R$\u00A00,00");
  });
});

describe("exploreCardsFromConfig", () => {
  it("gera os 4 cards na ordem blog → docs → donations → transparency", () => {
    const cards = exploreCardsFromConfig(
      configFixture({
        donations: true,
        transparency: true,
        events: false,
        blog: true,
        docs: true,
      }),
    );
    expect(cards).toHaveLength(4);
    expect(cards.map((c) => c.title)).toEqual([
      "Campanhas",
      "Documentação",
      "Apoiar",
      "Transparência",
    ]);
    expect(cards.map((c) => c.to)).toEqual([
      "/comunidades/tisocial/blog",
      "/comunidades/tisocial/docs",
      "/comunidades/tisocial/apoiar",
      "/comunidades/tisocial/transparencia",
    ]);
  });

  it("replica rótulos e descrições 1:1 do buildFeatureCards original", () => {
    const cards = exploreCardsFromConfig(
      configFixture({
        donations: true,
        transparency: true,
        events: false,
        blog: true,
        docs: true,
      }),
    );
    expect(cards[0]).toEqual({
      icon: "article",
      title: "Campanhas",
      description:
        "Prestações de contas, histórias e novidades das ações sociais da comunidade.",
      to: "/comunidades/tisocial/blog",
    });
    expect(cards[1]).toEqual({
      icon: "menu_book",
      title: "Documentação",
      description:
        "Cartilhas, guias e materiais de divulgação para parceiros e protetores.",
      to: "/comunidades/tisocial/docs",
    });
    expect(cards[2]).toEqual({
      icon: "volunteer_activism",
      title: "Apoiar",
      description: "Contribua com doações para campanhas da T.I. Social.",
      to: "/comunidades/tisocial/apoiar",
    });
    expect(cards[3]).toEqual({
      icon: "paid",
      title: "Transparência",
      description:
        "Veja saldo, entradas e saídas da conta da T.I. Social no ledger Codaqui.",
      to: "/comunidades/tisocial/transparencia",
    });
  });

  it("ignora features desligadas (events nunca gera card, como no original)", () => {
    const cards = exploreCardsFromConfig(
      configFixture({
        donations: false,
        transparency: false,
        events: true,
        blog: false,
        docs: false,
      }),
    );
    expect(cards).toEqual([]);
  });
});

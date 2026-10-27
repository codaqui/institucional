import type { CommunitySiteConfig } from "../../../comunidades/shared/types";
import { formatBRL } from "./transaction";

/**
 * Helpers puros das seções presentacionais das comunidades — extraídos dos
 * componentes-fonte do site Docusaurus (`comunidades/<slug>/`) para poderem
 * ser testados e reutilizados pelas páginas Astro da Fase 0.5.
 *
 * A derivação é 1:1 com o original — esses arquivos são o spec:
 * - `impactStatsFromCampaigns` replica os cálculos de
 *   `comunidades/tisocial/community.config.ts` (totalActions/totalImpact/totalRaised).
 * - `exploreCardsFromConfig` replica `buildFeatureCards()` de
 *   `comunidades/tisocial/src/pages/index.tsx` (mesma ordem: blog, docs,
 *   donations, transparency).
 */

/** Campanha no formato de `comunidades/<slug>/src/data/campaigns.json`. */
export interface CommunityCampaign {
  slug: string;
  date: string;
  action: string;
  details: string;
  raised: number;
  peopleImpacted: number;
  animalsImpacted: number;
  status: string;
  isFinalized: boolean;
}

export interface CommunityImpactStat {
  value: string;
  label: string;
}

/** Ícones MUI usados nos cards de "Explore a comunidade" (paths em CommunityExploreSection). */
export type CommunityExploreIcon =
  | "article"
  | "menu_book"
  | "volunteer_activism"
  | "paid"
  // devparana (buildFeatureCards de comunidades/devparana/src/pages/index.tsx)
  | "groups"
  | "calendar_month";

export interface CommunityExploreCard {
  icon: CommunityExploreIcon;
  title: string;
  description: string;
  to: string;
}

/**
 * Stats de impacto consolidados a partir do campaigns.json da comunidade:
 * ações = quantidade de campanhas, beneficiados = soma de pessoas + animais,
 * arrecadado = soma de `raised` formatada em BRL (pt-BR).
 */
export function impactStatsFromCampaigns(
  campaigns: CommunityCampaign[],
): CommunityImpactStat[] {
  const totalActions = campaigns.length;
  const totalImpact = campaigns.reduce(
    (acc, c) => acc + (c.peopleImpacted || 0) + (c.animalsImpacted || 0),
    0,
  );
  const totalRaised = campaigns.reduce((acc, c) => acc + (c.raised || 0), 0);
  const formatNumber = (value: number) =>
    new Intl.NumberFormat("pt-BR").format(value);

  return [
    { value: formatNumber(totalActions), label: "Ações realizadas" },
    { value: formatNumber(totalImpact), label: "Pessoas e animais impactados" },
    { value: formatBRL(totalRaised), label: "Total arrecadado" },
  ];
}

/**
 * Cards da seção "Explore a comunidade" a partir das features ligadas no
 * config — mesmos rótulos, descrições, ícones e ordem do
 * `buildFeatureCards()` original (blog → docs → donations → transparency;
 * `events` não gera card, como no original).
 */
export function exploreCardsFromConfig(
  config: CommunitySiteConfig,
): CommunityExploreCard[] {
  const base = config.basePath;
  const cards: CommunityExploreCard[] = [];

  if (config.features.blog) {
    cards.push({
      icon: "article",
      title: "Campanhas",
      description:
        "Prestações de contas, histórias e novidades das ações sociais da comunidade.",
      to: `${base}/blog`,
    });
  }
  if (config.features.docs) {
    cards.push({
      icon: "menu_book",
      title: "Documentação",
      description:
        "Cartilhas, guias e materiais de divulgação para parceiros e protetores.",
      to: `${base}/docs`,
    });
  }
  if (config.features.donations) {
    cards.push({
      icon: "volunteer_activism",
      title: "Apoiar",
      description: `Contribua com doações para campanhas da ${config.shortName}.`,
      to: `${base}/apoiar`,
    });
  }
  if (config.features.transparency) {
    cards.push({
      icon: "paid",
      title: "Transparência",
      description: `Veja saldo, entradas e saídas da conta da ${config.shortName} no ledger Codaqui.`,
      to: `${base}/transparencia`,
    });
  }

  return cards;
}

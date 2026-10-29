import type { CommunitySiteConfig } from "../../../comunidades/shared/types";
import type { CommunityExploreCard } from "./community-sections";

/**
 * Helpers puros da CamposTech (campostechpg) — extraídos 1:1 das páginas-fonte
 * do site Docusaurus (`comunidades/campostechpg/src/pages/`) para poderem ser
 * testados e consumidos pelos wrappers `/comunidades/campostechpg` do portal
 * Astro (Fase 0.5). A CamposTech não é tenant — não há build de domínio
 * próprio, só estes wrappers codaqui.
 *
 * Esse arquivo é o spec:
 * - `campostechFeatureCards` replica `buildFeatureCards()` de
 *   `comunidades/campostechpg/src/pages/index.tsx` (mesma ordem: Quem Somos
 *   [docs], Mentores, Apoiar [donations], Transparência [transparency]).
 * - `upcomingCommunityEvents`/`formatFullEventDate` replicam o filtro da
 *   seção "Próximos eventos" (sourceKey + status !== "completed", ASC por
 *   startAt, slice 3) e o `formatEventDate` (Intl pt-BR full+short). Foram
 *   extraídos para `./community-events` (duplicado byte-idêntico com o
 *   devparana) e são re-exportados aqui.
 */

/** Card de feature da home — mesmo shape de `CommunityExploreCard`. */
export type CampostechExploreCard = CommunityExploreCard;

/**
 * Cards de destaque da home da CamposTech, na ordem do original:
 * Quem Somos (docs), Mentores (sempre), Apoiar (donations) e
 * Transparência (transparency) — mesmo filtro do `buildFeatureCards()`
 * original (`community.features.docs/donations/transparency`).
 */
export function campostechFeatureCards(
  config: CommunitySiteConfig,
): CampostechExploreCard[] {
  const base = config.basePath;

  const cards: CampostechExploreCard[] = [];
  if (config.features.docs) {
    cards.push({
      icon: "menu_book",
      title: "Quem Somos",
      description: "Conheça a comunidade, seus pilares e parceiros.",
      to: `${base}/docs`,
    });
  }
  cards.push({
    icon: "school",
    title: "Mentores",
    description:
      "Mentores voluntários que compartilham conhecimento com a comunidade.",
    to: `${base}/mentores`,
  });
  if (config.features.donations) {
    cards.push({
      icon: "volunteer_activism",
      title: "Apoiar",
      description: `Contribua com doações para a ${config.shortName}.`,
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

// ── Próximos eventos (home) ────────────────────────────────────────────────
// `upcomingCommunityEvents`/`formatFullEventDate` vivem em `./community-events`
// (extraídos — eram duplicados byte-idênticos no devparana) e são
// re-exportados aqui para os consumidores desta lib.

export {
  upcomingCommunityEvents,
  formatFullEventDate,
} from "./community-events";

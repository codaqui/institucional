import { communities } from "../data/communities";

export interface DonationTarget {
  id: string;
  name: string;
  emoji: string;
  description: string;
  logo?: string;
}

export const TESOURO: DonationTarget = {
  id: "tesouro-geral",
  name: "Tesouro Codaqui",
  emoji: "🏦",
  description: "Suporta a associação diretamente: eventos, infraestrutura e programas.",
};

export const DONATION_TARGETS: DonationTarget[] = [
  TESOURO,
  ...communities.map((community) => ({
    id: community.id,
    name: community.name,
    emoji: community.emoji,
    description: community.description,
    logo: community.logo,
  })),
];

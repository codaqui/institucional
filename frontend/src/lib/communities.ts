import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CommunityLink } from "../data/communities";
import type { SocialProfile } from "../data/social-stats";

export type CommunityLevel = "parceira" | "integrada";
export type CommunityStatus = "proposed" | "active" | "suspended" | "exited";
export type CommunitySealStatus = "none" | "applied" | "sealed";

export interface CommunityResponsible {
  id: string;
  name: string;
  githubHandle: string;
  avatarUrl: string | null;
}

export interface CommunityIndexEntry {
  id: string;
  slug: string;
  name: string;
  description: string;
  emoji: string;
  logo: string;
  location: string | null;
  founded: number | null;
  links: CommunityLink[];
  socialProfiles: SocialProfile[];
  tags: string[];
  level: CommunityLevel;
  status: CommunityStatus;
  sealStatus: CommunitySealStatus;
  sealEffective?: boolean;
  sealGrantedAt: string | null;
  sealGrantedById: string | null;
  sealValidUntil: string | null;
  sealNotes: string | null;
  siteEnabled: boolean;
  siteDomain: string | null;
  responsible: CommunityResponsible | null;
}

export interface CommunityIndexFile {
  generatedAt: string;
  communities: CommunityIndexEntry[];
}

function snapshotCandidates(): string[] {
  return [
    fileURLToPath(new URL("../../../static/communities/index.json", import.meta.url)),
    resolve(process.cwd(), "..", "static", "communities", "index.json"),
    resolve(process.cwd(), "static", "communities", "index.json"),
  ];
}

export function loadCommunitiesIndex(snapshotPath?: string): CommunityIndexFile {
  const path = snapshotPath ?? snapshotCandidates().find((candidate) => existsSync(candidate));
  if (!path) {
    throw new Error(
      `Snapshot de comunidades não encontrado. Tentados: ${snapshotCandidates().join(", ")}`,
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as CommunityIndexFile;
}

export function getCommunityPrimaryLink(
  community: Pick<CommunityIndexEntry, "links">,
): CommunityLink | null {
  return community.links[0] ?? null;
}

export function communityLevelLabel(level: CommunityLevel): string {
  return level === "integrada" ? "Integrada" : "Parceira";
}

export function communitySealLabel(status: CommunitySealStatus): string | null {
  if (status === "sealed") return "Selo Codaqui";
  if (status === "applied") return "Selo em avaliação";
  return null;
}

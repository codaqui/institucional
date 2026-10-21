// Port build-time de src/hooks/useSocialStatsSnapshot.ts (Docusaurus).
// No Docusaurus o snapshot chega via fetch em runtime; no Astro ele é lido do
// filesystem durante o build (public/social-stats/index.json, copiado de
// static/social-stats/ pelo scripts/copy-snapshots.mjs). Se o arquivo estiver
// ausente/inválido, cai no snapshot de baselines — mesmo comportamento do
// estado inicial do hook original.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { communities } from "../data/communities";
import { codaquiSocialProfiles } from "../data/social";
import {
  BASELINE_TOTAL_EVENTS,
  type SocialProfile,
  type SocialStatEntry,
  type SocialStatsSnapshot,
} from "../data/social-stats";

export function buildFallbackSnapshot(): SocialStatsSnapshot {
  const now = new Date().toISOString();
  const profiles: SocialStatEntry[] = [
    ...codaquiSocialProfiles.map((p) => ({
      ...p,
      entityId: "codaqui",
      count: p.baselineCount ?? 0,
      isFallback: true,
      fetchedAt: now,
    })),
    ...communities.flatMap((c) =>
      (c.socialProfiles ?? []).map((p) => ({
        ...p,
        entityId: c.id,
        count: p.baselineCount ?? 0,
        isFallback: true,
        fetchedAt: now,
      })),
    ),
  ];
  return { generatedAt: now, totalEvents: BASELINE_TOTAL_EVENTS, profiles };
}

function isValidSnapshot(data: unknown): data is SocialStatsSnapshot {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as SocialStatsSnapshot).totalEvents === "number" &&
    Array.isArray((data as SocialStatsSnapshot).profiles)
  );
}

/** Lê o snapshot de social stats em build-time, com fallback de baselines. */
export function loadSocialStats(): SocialStatsSnapshot {
  try {
    // process.cwd(): o build do Astro roda com cwd = frontend/; import.meta.url
    // não serve aqui porque o frontmatter é rebundled pelo Vite (URL muda).
    const raw = readFileSync(
      join(process.cwd(), "public", "social-stats", "index.json"),
      "utf8",
    );
    const data: unknown = JSON.parse(raw);
    if (isValidSnapshot(data)) return data;
  } catch {
    // ausente ou inválido — cai no fallback abaixo
  }
  return buildFallbackSnapshot();
}

/** Espelha o `profilesFor` do hook original. */
export function profilesFor(
  snapshot: SocialStatsSnapshot,
  entityId: string,
): SocialStatEntry[] {
  return snapshot.profiles.filter((p) => p.entityId === entityId);
}

/**
 * Contagem de um perfil: a do snapshot quando a entrada existe; o baseline
 * manual caso contrário (mesmo fallback do hook, que usa baselineCount ?? 0).
 */
export function resolveSocialCount(
  profile: SocialProfile,
  entry: SocialStatEntry | undefined,
): number {
  return entry?.count ?? profile.baselineCount ?? 0;
}

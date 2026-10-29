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

/**
 * Path default do snapshot copiado pelo pipeline (scripts/copy-snapshots.mjs).
 *
 * Limitação conhecida: usa process.cwd() — o build/teste precisa rodar com
 * cwd = frontend/ (como fazem os scripts npm). import.meta.url foi descartado
 * após teste empírico: o Vite rebundla a lib no build do Astro e a URL passa
 * a apontar para o chunk, não para src/lib — verificado com
 * `astro build --root frontend` a partir da raiz do monorepo (caiu no fallback).
 */
const DEFAULT_SNAPSHOT_PATH = join(
  process.cwd(),
  "public",
  "social-stats",
  "index.json",
);

/**
 * Lê o snapshot de social stats em build-time, com fallback de baselines.
 * O fallback NÃO é silencioso: emite console.warn com o path tentado.
 *
 * @param snapshotPath override do path do JSON (usado pelos testes com
 * fixtures; em produção usar o default).
 */
export function loadSocialStats(
  snapshotPath: string = DEFAULT_SNAPSHOT_PATH,
): SocialStatsSnapshot {
  let data: unknown = null;
  try {
    data = JSON.parse(readFileSync(snapshotPath, "utf8"));
  } catch {
    // ausente/ilegível — warn abaixo
  }
  if (isValidSnapshot(data)) return data;
  console.warn(
    `[loadSocialStats] snapshot ausente/inválido em ${snapshotPath} — ` +
      "usando baselines de src/data/social-stats.ts (rode npm run sync:snapshots)",
  );
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

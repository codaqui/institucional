import { useEffect, useState } from "react";
import { communities } from "../data/communities";
import { codaquiSocialProfiles } from "../data/social";
import {
  SOCIAL_STATS_URL,
  type SocialStatEntry,
  type SocialStatsSnapshot,
} from "../data/social-stats";

function buildFallbackSnapshot(): SocialStatsSnapshot {
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
      }))
    ),
  ];
  return { generatedAt: now, totalEvents: 0, profiles };
}

export function useSocialStatsSnapshot() {
  const [snapshot, setSnapshot] = useState<SocialStatsSnapshot | null>(null);

  useEffect(() => {
    fetch(SOCIAL_STATS_URL)
      .then((r) => r.json())
      .then((data: SocialStatsSnapshot) => setSnapshot(data))
      .catch(() => setSnapshot(buildFallbackSnapshot()));
  }, []);

  function profilesFor(entityId: string): SocialStatEntry[] {
    return snapshot?.profiles.filter((p) => p.entityId === entityId) ?? [];
  }

  return { snapshot, profilesFor };
}

import { useCallback, useEffect, useState } from "react";
import { communities } from "../data/communities";
import { codaquiSocialProfiles } from "../data/social";
import {
  BASELINE_TOTAL_EVENTS,
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
  return { generatedAt: now, totalEvents: BASELINE_TOTAL_EVENTS, profiles };
}

export function useSocialStatsSnapshot() {
  const [snapshot, setSnapshot] = useState<SocialStatsSnapshot>(buildFallbackSnapshot);

  useEffect(() => {
    fetch(SOCIAL_STATS_URL)
      .then((r) => r.json())
      .then((data: SocialStatsSnapshot) => setSnapshot(data))
      .catch((err) => console.error("[useSocialStatsSnapshot] fetch failed:", err));
  }, []);

  const profilesFor = useCallback(
    (entityId: string): SocialStatEntry[] =>
      snapshot.profiles.filter((p) => p.entityId === entityId),
    [snapshot]
  );

  return { snapshot, profilesFor };
}

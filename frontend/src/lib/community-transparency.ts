export interface CommunityTransparencyActivity {
  key: string;
  title: string;
  kind: "managed" | "external";
  startAt: string;
}

export interface CommunityTransparencyData {
  community: { slug: string; name: string };
  responsible: {
    id: string;
    name: string;
    githubHandle: string;
    avatarUrl: string | null;
  } | null;
  year: number | null;
  availableYears: number[];
  metrics: {
    events: number;
    participations: number;
    certificates: number;
    eventHours: number;
  };
  upcomingActivities: CommunityTransparencyActivity[];
  recentActivities: CommunityTransparencyActivity[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isActivity(value: unknown): value is CommunityTransparencyActivity {
  return isRecord(value)
    && typeof value.key === "string" && typeof value.title === "string"
    && (value.kind === "managed" || value.kind === "external")
    && typeof value.startAt === "string" && Number.isFinite(Date.parse(value.startAt));
}

function parseTransparency(value: unknown): CommunityTransparencyData {
  if (!isRecord(value) || !isRecord(value.community) || !isRecord(value.metrics)) {
    throw new Error("Projeção de transparência inválida.");
  }
  const community = value.community;
  const metrics = value.metrics;
  const responsible = value.responsible;
  if (typeof community.slug !== "string" || typeof community.name !== "string"
    || !["events", "participations", "certificates", "eventHours"].every((key) => isNonNegativeNumber(metrics[key]))
    || !Array.isArray(value.availableYears) || !value.availableYears.every((year) => Number.isInteger(year))
    || (value.year !== null && !Number.isInteger(value.year))
    || !Array.isArray(value.upcomingActivities) || !value.upcomingActivities.every(isActivity)
    || !Array.isArray(value.recentActivities) || !value.recentActivities.every(isActivity)
    || (responsible !== null && (!isRecord(responsible)
      || typeof responsible.id !== "string" || typeof responsible.name !== "string"
      || typeof responsible.githubHandle !== "string"
      || (responsible.avatarUrl !== null && typeof responsible.avatarUrl !== "string")))) {
    throw new Error("Projeção de transparência inválida.");
  }
  return {
    community: { slug: community.slug, name: community.name },
    responsible: responsible as CommunityTransparencyData["responsible"],
    year: value.year as number | null,
    availableYears: value.availableYears as number[],
    metrics: {
      events: metrics.events as number,
      participations: metrics.participations as number,
      certificates: metrics.certificates as number,
      eventHours: metrics.eventHours as number,
    },
    upcomingActivities: value.upcomingActivities,
    recentActivities: value.recentActivities,
  };
}

export async function fetchCommunityTransparency(
  apiUrl: string,
  slug: string,
  year?: number,
  signal?: AbortSignal,
): Promise<CommunityTransparencyData> {
  const suffix = year === undefined ? "" : `?year=${encodeURIComponent(year)}`;
  const response = await fetch(
    `${apiUrl}/communities/public/${encodeURIComponent(slug)}/transparency${suffix}`,
    { signal },
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return parseTransparency(await response.json());
}

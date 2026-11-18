import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CommunitiesService } from './communities.service';
import type {
  CommunityTransparencyActivity,
  CommunityTransparencyResult,
} from './community-transparency.types';

interface TransparencyRow {
  events: number | string;
  participations: number | string;
  certificates: number | string;
  eventHours: number | string | null;
  availableYears: number[] | null;
  upcomingActivities: CommunityTransparencyActivity[] | null;
  recentActivities: CommunityTransparencyActivity[] | null;
}

@Injectable()
export class CommunityTransparencyService {
  constructor(
    private readonly communities: CommunitiesService,
    private readonly dataSource: DataSource,
  ) {}

  async get(slug: string, year?: number): Promise<CommunityTransparencyResult> {
    if (year !== undefined && (!Number.isInteger(year) || year < 2000 || year > 2100)) {
      throw new BadRequestException('Ano inválido.');
    }
    const community = (await this.communities.listPublic()).find((item) => item.slug === slug);
    if (!community) throw new NotFoundException('Comunidade não encontrada.');
    const effectiveYear = year ?? null;
    const rows = await this.dataSource.query(TRANSPARENCY_QUERY, [slug, effectiveYear]) as TransparencyRow[];
    const row = rows[0];
    return {
      community: { slug: community.slug, name: community.name },
      responsible: community.responsible,
      year: effectiveYear,
      availableYears: (row?.availableYears ?? []).map(Number).filter(Number.isInteger),
      metrics: {
        events: Number(row?.events ?? 0),
        participations: Number(row?.participations ?? 0),
        certificates: Number(row?.certificates ?? 0),
        eventHours: Number(row?.eventHours ?? 0),
      },
      upcomingActivities: publicActivities(row?.upcomingActivities),
      recentActivities: publicActivities(row?.recentActivities),
    };
  }
}

function publicActivities(
  activities: CommunityTransparencyActivity[] | null | undefined,
): CommunityTransparencyActivity[] {
  return (activities ?? []).map((activity) => ({
    key: activity.key,
    title: activity.title,
    kind: activity.kind,
    startAt: new Date(activity.startAt).toISOString(),
  }));
}

const TRANSPARENCY_QUERY = `
WITH eligible_events AS (
  SELECT id::text AS event_ref, title, "startAt", 'managed' AS kind
  FROM managed_events
  WHERE "communityProjectKey" = $1 AND status IN ('published', 'completed')
  UNION ALL
  SELECT id::text AS event_ref, COALESCE(title, 'Atividade externa') AS title,
    "startAt", 'external' AS kind
  FROM external_event_activations
  WHERE "communityProjectKey" = $1 AND "startAt" IS NOT NULL
),
filtered_events AS (
  SELECT * FROM eligible_events
  WHERE $2::int IS NULL OR EXTRACT(YEAR FROM "startAt")::int = $2
),
registration_events AS (
  SELECT er.id
  FROM event_registrations er
  JOIN filtered_events fe ON
    (fe.kind = 'managed' AND er."eventId"::text = fe.event_ref)
    OR (fe.kind = 'external' AND er."externalActivationId"::text = fe.event_ref)
  WHERE er.status = 'confirmed'
)
SELECT
  (SELECT COUNT(*) FROM filtered_events)::int AS events,
  (SELECT COUNT(*) FROM registration_events)::int AS participations,
  (SELECT COUNT(*) FROM registration_events re
    JOIN event_registrations er ON er.id = re.id
    WHERE er."certificateGrantedAt" IS NOT NULL)::int AS certificates,
  (SELECT COALESCE(SUM(h.hours), 0)::float8
    FROM hour_ledger h
    JOIN registration_events re ON re.id = h."sourceId"
    JOIN members m ON m.id = h."memberId" AND m."isActive" = true
    WHERE h."sourceType" = 'event_checkin' AND h.status = 'approved'
      AND COALESCE(m."profileVisibility"->>'hours', 'true') = 'true') AS "eventHours",
  (SELECT COALESCE(json_agg(y.year), '[]') FROM (
    SELECT DISTINCT EXTRACT(YEAR FROM "startAt")::int AS year
    FROM eligible_events ORDER BY year
  ) y) AS "availableYears",
  (SELECT COALESCE(json_agg(u), '[]') FROM (
    SELECT kind || ':' || title || ':' || "startAt"::text AS key,
      title, kind, "startAt"
    FROM filtered_events WHERE "startAt" > NOW()
    ORDER BY "startAt" ASC LIMIT 5
  ) u) AS "upcomingActivities",
  (SELECT COALESCE(json_agg(r), '[]') FROM (
    SELECT kind || ':' || title || ':' || "startAt"::text AS key,
      title, kind, "startAt"
    FROM filtered_events WHERE "startAt" <= NOW()
    ORDER BY "startAt" DESC LIMIT 5
  ) r) AS "recentActivities"
`;

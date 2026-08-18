/**
 * Schema reutilizável de frontmatter para RFCs do DevParaná.
 *
 * Cada arquivo em `docs/rfcs/*.mdx` deve exportar esse shape no frontmatter
 * para que o layout, hero e sidebar sejam renderizados automaticamente.
 */

export interface RfcPersonRef {
  name?: string;
  githubHandle?: string;
  email?: string;
}

export interface RfcTimelineItem {
  date: string;
  label: string;
}

export interface RfcFrontmatter {
  rfcId: string;
  title: string;
  status: "Draft" | "Ready" | "Archived";
  summary: string;
  authors: RfcPersonRef[];
  approvers?: RfcPersonRef[];
  writtenAt?: string;
  publishedAt?: string;
  timeline?: RfcTimelineItem[];
}

export function normalizePersonRef(value: unknown): RfcPersonRef {
  if (typeof value === "string") {
    return { name: value };
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return {
      name: typeof obj.name === "string" ? obj.name : undefined,
      githubHandle: typeof obj.githubHandle === "string" ? obj.githubHandle : undefined,
      email: typeof obj.email === "string" ? obj.email : undefined,
    };
  }
  return {};
}

export function normalizeFrontmatter(raw: Record<string, unknown>): RfcFrontmatter {
  const authors = Array.isArray(raw.authors)
    ? raw.authors.map(normalizePersonRef)
    : [];
  const approvers = Array.isArray(raw.approvers)
    ? raw.approvers.map(normalizePersonRef)
    : [];
  const timeline = Array.isArray(raw.timeline)
    ? raw.timeline
        .map((item) => {
          if (item && typeof item === "object") {
            const obj = item as Record<string, unknown>;
            return {
              date: typeof obj.date === "string" ? obj.date : "",
              label: typeof obj.label === "string" ? obj.label : "",
            };
          }
          return null;
        })
        .filter((item): item is RfcTimelineItem => Boolean(item?.date && item?.label))
    : [];

  return {
    rfcId: typeof raw.rfcId === "string" ? raw.rfcId : "",
    title: typeof raw.title === "string" ? raw.title : "",
    status: (raw.status as RfcFrontmatter["status"]) ?? "Draft",
    summary: typeof raw.summary === "string" ? raw.summary : "",
    authors,
    approvers,
    writtenAt: typeof raw.writtenAt === "string" ? raw.writtenAt : undefined,
    publishedAt: typeof raw.publishedAt === "string" ? raw.publishedAt : undefined,
    timeline,
  };
}

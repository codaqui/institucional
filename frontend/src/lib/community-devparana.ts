import type { CommunitySiteConfig } from "../../../comunidades/shared/types";
import type { EventSummary } from "./events";
import type { PublicMemberProfile } from "./member-path";
import type { CommunityExploreCard } from "./community-sections";

/**
 * Helpers puros do tenant DevParaná — extraídos 1:1 das páginas-fonte do
 * site Docusaurus (`comunidades/devparana/src/pages/`, `src/data/` e
 * `src/utils/rfc-members.ts`) para poderem ser testados e consumidos pelas
 * páginas Astro da Fase 0.5 (build tenant e wrappers `/comunidades/devparana`).
 *
 * Esses arquivos são o spec:
 * - `devparanaFeatureCards` replica `buildFeatureCards()` de
 *   `comunidades/devparana/src/pages/index.tsx` (mesma ordem, `required` e
 *   filtro por `features`).
 * - `upcomingCommunityEvents`/`formatFullEventDate` replicam o filtro da
 *   seção "Próximos eventos" (sourceKey + status !== "completed", ASC por
 *   startAt, slice 3) e o `formatEventDate` (Intl pt-BR full+short).
 * - `extractGithubHandle`/`findMemberByAmbassador`/`ambassadorHandles` são o
 *   matching de embaixador ↔ membro da API de `embaixadores.tsx`.
 * - `enrichDevparanaTeamMember`/`teamHandles` replicam `enrichMember` de
 *   `equipe.tsx` (incl. o card CTA "Você?").
 * - `normalizeRfcFrontmatter`/`findRfcMember`/`rfcDisplayName`/`rfcDisplayAvatar`
 *   são portes de `src/data/rfc-schema.ts` e `src/utils/rfc-members.ts`,
 *   usados pelos componentes `Rfc*` e pela rota `docs/[...slug].astro`.
 */

// ── "Explore a comunidade" (home) ──────────────────────────────────────────

/** Card de feature da home — mesmo shape de `CommunityExploreCard`. */
export type DevparanaExploreCard = CommunityExploreCard;

/**
 * Cards de destaque da home do DevParaná, na ordem do original:
 * Documentação, Equipe, Embaixadores, Eventos, Apoiar, Transparência.
 * Equipe/Embaixadores/Eventos são `required` (sempre presentes); Documentação,
 * Apoiar e Transparência obedecem `features.docs/donations/transparency`
 * (mesmo filtro do `buildFeatureCards()` original).
 */
export function devparanaFeatureCards(
  config: CommunitySiteConfig,
): DevparanaExploreCard[] {
  const base = config.basePath;

  const allCards: Array<DevparanaExploreCard & { readonly required?: boolean }> = [
    {
      icon: "menu_book",
      title: "Documentação",
      description:
        "Conheça a história, propósito, RFCs e links do DevParaná.",
      to: `${base}/docs`,
    },
    {
      icon: "groups",
      title: "Equipe",
      description: "Conheça as pessoas que coordenam a comunidade.",
      to: `${base}/equipe`,
      required: true,
    },
    {
      icon: "article",
      title: "Embaixadores",
      description:
        "Conheça as regiões do Paraná e os embaixadores da comunidade.",
      to: `${base}/embaixadores`,
      required: true,
    },
    {
      icon: "calendar_month",
      title: "Eventos",
      description:
        "Veja os próximos encontros do DevParaná e eventos das comunidades parceiras.",
      to: "/eventos",
      required: true,
    },
    {
      icon: "volunteer_activism",
      title: "Apoiar",
      description: `Contribua com doações para manter os eventos do ${config.shortName}.`,
      to: `${base}/apoiar`,
    },
    {
      icon: "paid",
      title: "Transparência",
      description: `Veja saldo, entradas e saídas da conta do ${config.shortName} no ledger Codaqui.`,
      to: `${base}/transparencia`,
    },
  ];

  return allCards.filter((card) => {
    if (card.required) return true;
    if (card.title === "Documentação") return config.features.docs;
    if (card.title === "Apoiar") return config.features.donations;
    if (card.title === "Transparência") return config.features.transparency;
    return true;
  });
}

// ── Próximos eventos (home) ────────────────────────────────────────────────

/**
 * Próximos eventos da comunidade: mesma derivação do `UpcomingEventsSection`
 * original — filtra por `sourceKeys` e `status !== "completed"`, ordena ASC
 * por `startAt` e limita (default 3, como o slice do original).
 */
export function upcomingCommunityEvents(
  events: EventSummary[],
  sourceKeys: string[],
  limit = 3,
): EventSummary[] {
  if (sourceKeys.length === 0) return [];
  return events
    .filter(
      (event) =>
        sourceKeys.includes(event.sourceKey) && event.status !== "completed",
    )
    .sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    )
    .slice(0, limit);
}

/**
 * href de um card de "Explore a comunidade" no build tenant (rotas limpas).
 *
 * - Cards prefixados com o basePath do portal viram rotas limpas do domínio
 *   próprio (`/comunidades/devparana/docs` → `/docs`);
 * - Cards cujo destino é uma rota do portal Codaqui que NÃO é prefixada com o
 *   basePath da comunidade (ex.: o card "Eventos", `to: "/eventos"`) ganham a
 *   origem absoluta do portal — o `_redirects` pós-build só cobre
 *   `/comunidades/<slug>[/*]`, então o link relativo 404aria no domínio
 *   próprio. Mesmo padrão dos CTAs da seção "Próximos eventos".
 *
 * No build codaqui o caller não usa este helper (os links relativos do
 * portal funcionam como estão).
 */
export function tenantExploreCardHref(
  to: string,
  basePath: string,
  portalOrigin: string,
): string {
  if (to.startsWith(basePath)) return to.slice(basePath.length) || "/";
  if (portalOrigin && to.startsWith("/")) return `${portalOrigin}${to}`;
  return to;
}

/** Formata a data do card de evento (Intl pt-BR `dateStyle: "full"`, `timeStyle: "short"` no timezone do evento). */
export function formatFullEventDate(date: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).format(new Date(date));
}

// ── Embaixadores ───────────────────────────────────────────────────────────

/** Subset do `Ambassador` de `comunidades/devparana/src/data/ambassadors.ts`
 *  (o tipo concreto é importado pelas páginas; aqui o helper só lê os campos
 *  usados no matching, para os testes não dependerem do path cruzado). */
export interface AmbassadorLike {
  name: string;
  github?: string;
  githubHandle?: string;
}

export interface RegionLike {
  id: string;
  name: string;
  cities: string[];
  ambassador?: AmbassadorLike;
}

/** Extrai o handle de uma URL de perfil do GitHub (`github.com/<handle>`). */
export function extractGithubHandle(url?: string): string | undefined {
  if (!url) return undefined;
  const match = /github\.com\/([^/]+)/.exec(url);
  return match?.[1];
}

/** Handles GitHub de todos os embaixadores nomeados (derivação 1:1 da página original). */
export function ambassadorHandles(regions: RegionLike[]): string[] {
  return regions
    .map((r) => r.ambassador)
    .filter((a): a is AmbassadorLike => Boolean(a))
    .map((a) => a.githubHandle?.trim() ?? extractGithubHandle(a.github))
    .filter((h): h is string => Boolean(h));
}

function normalizeHandle(handle?: string): string | undefined {
  return handle?.toLowerCase().trim();
}

/**
 * Localiza o membro da API correspondente a um embaixador: primeiro pelo
 * handle GitHub (case-insensitive), depois pelo nome exato (case-insensitive).
 * Port de `findMemberByAmbassador` de `embaixadores.tsx`.
 */
export function findMemberByAmbassador(
  ambassador: AmbassadorLike,
  members: PublicMemberProfile[],
): PublicMemberProfile | undefined {
  const handle = normalizeHandle(
    ambassador.githubHandle ?? extractGithubHandle(ambassador.github),
  );
  const normalizedName = ambassador.name.toLowerCase().trim();

  return members.find((member) => {
    const memberHandle = normalizeHandle(member.githubHandle);
    if (handle && memberHandle === handle) {
      return true;
    }
    return member.name?.toLowerCase().trim() === normalizedName;
  });
}

/** Responsabilidades dos embaixadores (texto 1:1 de `embaixadores.tsx`). */
export const ambassadorResponsibilities: readonly string[] = [
  "Liderar as iniciativas da comunidade na região;",
  "Representar a comunidade e seus interesses;",
  "Zelar pela boa imagem e reputação da comunidade;",
  "Garantir que o código de conduta seja aplicado;",
  "Identificar e formar novas lideranças, apoiando eventos locais;",
  "Ser o representante principal em eventos de entidades parceiras;",
  "Participar das reuniões da associação quando convocado;",
  "Gerenciar e entregar brindes da associação na região.",
];

// ── Equipe ─────────────────────────────────────────────────────────────────

/** Subset do `Member` de `comunidades/devparana/src/data/team.ts`. */
export interface DevparanaTeamMember {
  name: string;
  role: string;
  specialty?: string;
  avatar: string;
  linkedin?: string;
  github?: string;
  email?: string;
  githubHandle?: string;
}

/** Handles GitHub da equipe local (derivação 1:1 de `equipe.tsx`). */
export function teamHandles(team: DevparanaTeamMember[]): string[] {
  return team
    .map((m) => m.githubHandle?.trim())
    .filter((h): h is string => Boolean(h));
}

/** Port de `findApiMember` de `equipe.tsx`: handle primeiro, nome depois. */
export function findApiMember(
  member: DevparanaTeamMember,
  apiMembers: PublicMemberProfile[],
): PublicMemberProfile | undefined {
  const handle = member.githubHandle?.trim();
  const normalizedName = member.name.trim().toLowerCase();

  if (handle) {
    const byHandle = apiMembers.find(
      (m) => m.githubHandle.toLowerCase() === handle.toLowerCase(),
    );
    if (byHandle) return byHandle;
  }

  const byName = apiMembers.find(
    (m) => m.name.trim().toLowerCase() === normalizedName,
  );
  if (byName) return byName;

  return undefined;
}

export interface EnrichedDevparanaTeamMember {
  name: string;
  role: string;
  specialty?: string;
  avatar: string;
  bio?: string | null;
  linkedin?: string;
  github?: string;
  email?: string;
  isVolunteerCTA: boolean;
}

/**
 * Enriquece um membro local da equipe com os dados da API pública (nome,
 * avatar, bio, linkedin, github) — port 1:1 de `enrichMember` de `equipe.tsx`,
 * incluindo o card CTA "Você?" (`isVolunteerCTA`).
 */
export function enrichDevparanaTeamMember(
  member: DevparanaTeamMember,
  apiMembers: PublicMemberProfile[],
): EnrichedDevparanaTeamMember {
  const api = findApiMember(member, apiMembers);
  const isVolunteerCTA = member.name === "Você?";

  const githubUrl = api?.githubHandle
    ? `https://github.com/${api.githubHandle}`
    : member.github;
  const linkedinUrl = api?.linkedinUrl ?? member.linkedin;

  return {
    name: api?.name ?? member.name,
    role: member.role,
    specialty: member.specialty,
    avatar: api?.avatarUrl ?? member.avatar,
    bio: api?.bio,
    linkedin: linkedinUrl,
    github: githubUrl,
    email: member.email,
    isVolunteerCTA,
  };
}

// ── RFCs ───────────────────────────────────────────────────────────────────

/** Pessoa referenciada num frontmatter de RFC (port de `RfcPersonRef`). */
export interface RfcPersonRef {
  name?: string;
  githubHandle?: string;
  email?: string;
}

export interface RfcTimelineItem {
  date: string;
  label: string;
}

/** Frontmatter normalizado de um RFC (port de `RfcFrontmatter`/`normalizeFrontmatter`). */
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

/** Port de `normalizePersonRef` de `comunidades/devparana/src/data/rfc-schema.ts`. */
export function normalizeRfcPersonRef(value: unknown): RfcPersonRef {
  if (typeof value === "string") {
    return { name: value };
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return {
      name: typeof obj.name === "string" ? obj.name : undefined,
      githubHandle:
        typeof obj.githubHandle === "string" ? obj.githubHandle : undefined,
      email: typeof obj.email === "string" ? obj.email : undefined,
    };
  }
  return {};
}

/** Port de `normalizeFrontmatter` de `rfc-schema.ts` (usado pela rota docs). */
export function normalizeRfcFrontmatter(
  raw: Record<string, unknown>,
): RfcFrontmatter {
  const authors = Array.isArray(raw.authors)
    ? raw.authors.map(normalizeRfcPersonRef)
    : [];
  const approvers = Array.isArray(raw.approvers)
    ? raw.approvers.map(normalizeRfcPersonRef)
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
        .filter(
          (item): item is RfcTimelineItem => Boolean(item?.date && item?.label),
        )
    : [];

  return {
    rfcId: typeof raw.rfcId === "string" ? raw.rfcId : "",
    title: typeof raw.title === "string" ? raw.title : "",
    status: (raw.status as RfcFrontmatter["status"]) ?? "Draft",
    summary: typeof raw.summary === "string" ? raw.summary : "",
    authors,
    approvers,
    writtenAt: typeof raw.writtenAt === "string" ? raw.writtenAt : undefined,
    publishedAt:
      typeof raw.publishedAt === "string" ? raw.publishedAt : undefined,
    timeline,
  };
}

/** Tom do chip de status: "Ready" → success (verde), demais → default — 1:1 com os `getStatusColor`/Chips do fonte. */
export function rfcStatusTone(status: RfcFrontmatter["status"]): "success" | "default" {
  return status === "Ready" ? "success" : "default";
}

/** Port de `findMember` de `comunidades/devparana/src/utils/rfc-members.ts`. */
export function findRfcMember(
  ref: RfcPersonRef,
  members: PublicMemberProfile[],
): PublicMemberProfile | undefined {
  const handle = ref.githubHandle?.trim();
  const name = ref.name?.trim();

  if (handle) {
    const byHandle = members.find(
      (m) => m.githubHandle?.toLowerCase() === handle.toLowerCase(),
    );
    if (byHandle) return byHandle;
  }

  if (name) {
    const byName = members.find(
      (m) => m.name?.toLowerCase().trim() === name.toLowerCase(),
    );
    if (byName) return byName;
  }

  return undefined;
}

/** Port de `displayName`: nome do membro da API, depois nome do ref, depois e-mail. */
export function rfcDisplayName(
  ref: RfcPersonRef,
  member?: PublicMemberProfile,
): string {
  return member?.name ?? ref.name ?? ref.email ?? "—";
}

/** Port de `displayAvatar`: avatar do membro da API, fallback para `github.com/<handle>.png` (ghost sem handle). */
export function rfcDisplayAvatar(
  ref: RfcPersonRef,
  member?: PublicMemberProfile,
): string {
  return (
    member?.avatarUrl ??
    `https://github.com/${ref.githubHandle ?? "ghost"}.png`
  );
}

/** Metadados de um RFC na listagem `/rfcs` (1:1 com o array `rfcs` de `rfcs.tsx`). */
export interface RfcListItem {
  id: string;
  title: string;
  authors: string;
  status: "Ready" | "Draft";
  summary: string;
  /** Rota do documento completo em `/docs/rfcs/<slug>`. */
  to: string;
}

/**
 * Lista de RFCs do DevParaná. Nota do fonte (mantida): esses metadados devem
 * bater com o frontmatter de cada RFC em `comunidades/devparana/docs/rfcs/*.mdx`.
 */
export function devparanaRfcList(basePath: string): RfcListItem[] {
  return [
    {
      id: "001",
      title: "Projeto Embaixadores",
      authors: "Everton Tavares",
      status: "Ready",
      summary:
        "Formaliza a organização do DevParaná por regiões do Paraná, definindo responsabilidades, processo de nomeação e acompanhamento dos embaixadores.",
      to: `${basePath}/docs/rfcs/projeto-embaixadores`,
    },
    {
      id: "002",
      title: "DevParaná na Estrada 2026",
      authors: "Everton Tavares, Luiz Schons",
      status: "Ready",
      summary:
        "Planejamento executado da edição 2026 do evento itinerante, com formatos de meetup e workshop+palestras, patrocínios locais, custos e cronograma.",
      to: `${basePath}/docs/rfcs/devparana-na-estrada-2026`,
    },
  ];
}

import { randomInt } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function fetchWithTimeout(url, init = {}, timeoutMs = 30_000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

const rootDir = process.cwd();
const configPath = path.join(rootDir, "events.config.json");
const outputDir = path.join(rootDir, "static", "events");

const OVERRIDES_API_URL = process.env.EVENT_OVERRIDES_API_URL || "http://localhost:3000/events/overrides/public";

async function readJson(filePath) {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function fetchJson(url, init) {
  const response = await fetchWithTimeout(url, init);
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }
  return response.json();
}

function getSourceKey(source, sourceId) {
  return `${source}:${sourceId}`;
}

async function fetchOverridesFromApi() {
  try {
    const response = await fetchWithTimeout(OVERRIDES_API_URL, {}, 30_000);
    if (!response.ok) {
      console.warn(`  ⚠ API de overrides indisponivel (${response.status}) — usando snapshot sem overrides.`);
      return [];
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn(`  ⚠ Falha ao buscar overrides do backend: ${error.message}`);
    return [];
  }
}

function applyOverride(event, override) {
  if (!override?.payload) return event;
  const extendData = typeof override.payload === "string"
    ? JSON.parse(override.payload)
    : override.payload;
  return {
    ...event,
    ...extendData,
    hasOverride: true,
    _override: {
      ownerHandle: override.ownerHandle || "",
      updatedAt: override.updatedAt || new Date().toISOString(),
      reason: override.reason || null,
    },
  };
}

function buildSourceDir(source, sourceId) {
  return path.join(outputDir, source, sourceId);
}

function buildSourceIndexPath(source, sourceId) {
  return `/events/${source}/${sourceId}/index.json`;
}

function buildEventItemPath(source, sourceId, eventId) {
  return `/events/${source}/${sourceId}/${eventId}.json`;
}

function stripMarkdown(text) {
  return (text || "")
    .replaceAll(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replaceAll(/[*_`>#]/g, " ")
    .replaceAll(/\\([()[\].-])/g, "$1")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function truncateText(text, maxLength = 220) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function formatDiscordLocation(event, config) {
  if (event.entity_metadata?.location) {
    return event.entity_metadata.location;
  }
  return config.defaultLocation;
}

function mapDiscordStatus(status) {
  const statusMap = {
    1: "scheduled",
    2: "active",
    3: "completed",
    4: "canceled"
  };
  return statusMap[status] || "scheduled";
}

function mapDiscordEntityType(entityType) {
  const entityTypeMap = {
    1: "stage_instance",
    2: "voice",
    3: "external"
  };
  return entityTypeMap[entityType] || "external";
}

function buildDiscordImageUrl(event) {
  if (!event.image) {
    return undefined;
  }
  return `https://cdn.discordapp.com/guild-events/${event.id}/${event.image}.png?size=1024`;
}

function normalizeDiscordRecurrence(rule) {
  if (!rule) {
    return undefined;
  }

  return {
    start: rule.start || undefined,
    end: rule.end || undefined,
    frequency: rule.frequency ?? undefined,
    interval: rule.interval ?? undefined,
    byWeekday: rule.by_weekday ?? undefined,
    byMonth: rule.by_month ?? undefined,
    byMonthDay: rule.by_month_day ?? undefined,
    count: rule.count ?? undefined
  };
}

function formatDiscordRecurrence(rule) {
  if (!rule) {
    return undefined;
  }

  const weekdayNames = [
    "segunda",
    "terca",
    "quarta",
    "quinta",
    "sexta",
    "sabado",
    "domingo"
  ];

  if (rule.frequency === 2 && Array.isArray(rule.by_weekday) && rule.by_weekday.length === 1) {
    const weekday = weekdayNames[rule.by_weekday[0]] || "dia";
    const interval = rule.interval === 2 ? "quinzenal" : "semanal";
    return `${interval} · ${weekday}`;
  }

  if (rule.frequency === 3 && Array.isArray(rule.by_weekday) && rule.by_weekday.length > 0) {
    return "recorrencia semanal";
  }

  if (rule.frequency === 1) {
    return "recorrencia mensal";
  }

  if (rule.frequency === 0) {
    return "recorrencia anual";
  }

  return "recorrente";
}

function mapDiscordEvent(event, config) {
  const url = config.ctaHref || config.widgetUrl || "https://discord.com/";
  const creatorName = event.creator?.global_name || event.creator?.username || config.defaultHost;
  const recurrenceRule = normalizeDiscordRecurrence(event.recurrence_rule);

  return {
    id: event.id,
    title: event.name,
    summary: event.description || "Evento publicado pela comunidade no Discord.",
    startAt: event.scheduled_start_time,
    endAt: event.scheduled_end_time || undefined,
    timezone: "America/Sao_Paulo",
    platform: config.defaultPlatform,
    host: config.defaultHost,
    location: formatDiscordLocation(event, config),
    href: url,
    tags: ["discord", "comunidade"],
    ctaLabel: config.ctaLabel || "Ver evento",
    featured: false,
    status: mapDiscordStatus(event.status),
    entityType: mapDiscordEntityType(event.entity_type),
    userCount: event.user_count ?? undefined,
    creatorName,
    creatorId: event.creator_id ?? undefined,
    organizers: creatorName
      ? [{ name: creatorName, id: event.creator_id == null ? undefined : String(event.creator_id) }]
      : [],
    channelId: event.channel_id ?? undefined,
    recurrenceLabel: formatDiscordRecurrence(event.recurrence_rule),
    recurrenceRule,
    imageUrl: buildDiscordImageUrl(event)
  };
}

function buildMeetupPageUrl(config, type) {
  return `https://www.meetup.com/${config.locale || "pt-BR"}/${config.urlname}/events/?type=${type}`;
}

async function fetchMeetupCsrf(config) {
  const pageUrl = buildMeetupPageUrl(config, "past");
  const response = await fetchWithTimeout(pageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Meetup page unavailable: ${response.status}`);
  }

  const html = await response.text();
  const match = /<meta name="next_csrf" content="([^"]+)"/.exec(html);
  if (!match) {
    throw new Error("Meetup CSRF token not found");
  }

  return {
    csrf: match[1],
    referer: pageUrl,
  };
}

const meetupPastQuery = `
  query getPastGroupEvents($urlname: String!, $after: String, $beforeDateTime: DateTime, $first: Int!) {
    groupByUrlname(urlname: $urlname) {
      id
      events(
        filter: { status: [ACTIVE, PAST, CANCELLED], beforeDateTime: $beforeDateTime }
        sort: DESC
        first: $first
        after: $after
      ) {
        totalCount
        pageInfo {
          endCursor
          hasNextPage
        }
        edges {
          node {
            id
            title
            eventUrl
            dateTime
            endTime
            status
            isOnline
            eventType
            description
            maxTickets
            going {
              totalCount
            }
            creatorMember {
              id
              name
            }
            eventHosts {
              memberId
              name
            }
            venue {
              id
              name
              address
              city
              state
              country
            }
            featuredEventPhoto {
              id
              highResUrl
              baseUrl
            }
          }
        }
      }
    }
  }
`;

const meetupUpcomingQuery = `
  query getUpcomingGroupEvents($urlname: String!, $after: String, $afterDateTime: DateTime, $first: Int!) {
    groupByUrlname(urlname: $urlname) {
      id
      events(
        filter: { status: [ACTIVE, PAST, CANCELLED], afterDateTime: $afterDateTime }
        sort: ASC
        first: $first
        after: $after
      ) {
        totalCount
        pageInfo {
          endCursor
          hasNextPage
        }
        edges {
          node {
            id
            title
            eventUrl
            dateTime
            endTime
            status
            isOnline
            eventType
            description
            maxTickets
            going {
              totalCount
            }
            creatorMember {
              id
              name
            }
            eventHosts {
              memberId
              name
            }
            venue {
              id
              name
              address
              city
              state
              country
            }
            featuredEventPhoto {
              id
              highResUrl
              baseUrl
            }
          }
        }
      }
    }
  }
`;

async function fetchMeetupEventsPage(config, kind, cursor, boundary, session) {
  const payload = {
    operationName: kind === "past" ? "getPastGroupEvents" : "getUpcomingGroupEvents",
    query: kind === "past" ? meetupPastQuery : meetupUpcomingQuery,
    variables:
      kind === "past"
        ? {
            urlname: config.urlname,
            after: cursor,
            beforeDateTime: boundary,
            first: 50,
          }
        : {
            urlname: config.urlname,
            after: cursor,
            afterDateTime: boundary,
            first: 50,
          },
  };

  const response = await fetchWithTimeout("https://www.meetup.com/gql2", {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Content-Type": "application/json",
      "x-csrf-token": session.csrf,
      Origin: "https://www.meetup.com",
      Referer: session.referer,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Meetup gql2 failed: ${response.status}`);
  }

  const result = await response.json();
  const connection = result?.data?.groupByUrlname?.events;
  if (!connection) {
    throw new Error("Meetup events connection missing");
  }

  return connection;
}

function processConnectionEdges(connection, events, seenIds, kind, stopBefore) {
  let reachedCutoff = false;
  for (const edge of connection.edges ?? []) {
    if (!edge?.node?.id || seenIds.has(edge.node.id)) continue;
    // In incremental mode for past events, stop when events are older than cutoff
    if (stopBefore && kind === "past") {
      const eventDate = edge.node.dateTime ?? edge.node.endTime ?? null;
      if (eventDate && eventDate < stopBefore) {
        reachedCutoff = true;
        break;
      }
    }
    seenIds.add(edge.node.id);
    events.push(edge.node);
  }
  return reachedCutoff;
}

async function paginateMeetupEvents(config, kind, boundary, session, stopBefore = null) {
  const events = [];
  const seenIds = new Set();
  let cursor = null;
  let hasNextPage = true;
  let loops = 0;

  while (hasNextPage) {
    loops += 1;
    if (loops > 50) {
      throw new Error(`Meetup pagination exceeded safe limit for ${kind}`);
    }

    const connection = await fetchMeetupEventsPage(config, kind, cursor, boundary, session);
    const reachedCutoff = processConnectionEdges(connection, events, seenIds, kind, stopBefore);

    if (reachedCutoff) break;
    hasNextPage = Boolean(connection.pageInfo?.hasNextPage);
    cursor = connection.pageInfo?.endCursor ?? null;
  }

  return events;
}

function mapMeetupStatus(rawStatus, startAt, endAt) {
  const now = Date.now();
  const startTime = Date.parse(startAt);
  const endTime = Date.parse(endAt || startAt);

  if (rawStatus === "PAST" || endTime < now) {
    return "completed";
  }

  if (rawStatus === "CANCELLED") {
    return "canceled";
  }

  if (startTime <= now && endTime >= now) {
    return "active";
  }

  return "scheduled";
}

function formatMeetupLocation(event, config) {
  if (event.isOnline) {
    return "Online via Meetup";
  }

  const venue = event.venue;
  if (!venue) {
    return config.defaultLocation;
  }

  return [venue.name, venue.address, venue.city, venue.state].filter(Boolean).join(" · ");
}

function buildMeetupTags(event, config) {
  return [
    "meetup",
    config.sourceId,
    event.isOnline ? "online" : "presencial",
  ];
}

function mapMeetupEvent(event, config) {
  const cleanDescription = stripMarkdown(event.description);

  return {
    id: event.id,
    title: event.title,
    summary: truncateText(cleanDescription || "Evento publicado pelo Dev Paraná no Meetup."),
    startAt: event.dateTime,
    endAt: event.endTime || undefined,
    timezone: "America/Sao_Paulo",
    platform: config.defaultPlatform,
    host: config.defaultHost,
    location: formatMeetupLocation(event, config),
    href: event.eventUrl || config.ctaHref,
    tags: buildMeetupTags(event, config),
    ctaLabel: "Ver evento no Meetup",
    featured: false,
    status: mapMeetupStatus(event.status, event.dateTime, event.endTime),
    entityType: "external",
    userCount: event.going?.totalCount ?? undefined,
    creatorName: event.creatorMember?.name ?? config.defaultHost,
    creatorId: event.creatorMember?.id ?? undefined,
    organizers: (() => {
      const hosts = Array.isArray(event.eventHosts) && event.eventHosts.length > 0
        ? event.eventHosts.map((h) => ({ name: h.name, id: h.memberId == null ? undefined : String(h.memberId) }))
        : null;
      if (hosts) return hosts;
      if (event.creatorMember?.name) return [{ name: event.creatorMember.name, id: event.creatorMember.id == null ? undefined : String(event.creatorMember.id) }];
      return [];
    })(),
    imageUrl: event.featuredEventPhoto?.highResUrl ?? undefined,
  };
}

async function readExistingEvents(source, sourceId) {
  try {
    const snapshot = await readJson(path.join(buildSourceDir(source, sourceId), "index.json"));
    return Array.isArray(snapshot.events)
      ? snapshot.events.map(({ sourceKey, itemPath, source: _, sourceId: __, ...event }) => event)
      : [];
  } catch {
    return [];
  }
}

function mergeExistingEvents(freshById, existingEvents) {
  for (const existing of existingEvents) {
    if (!freshById.has(existing.id)) {
      freshById.set(existing.id, existing);
    }
  }
  return freshById;
}

async function resolveDiscordEvents(config, existingEvents) {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    return existingEvents.length > 0 ? existingEvents : config.fallbackEvents ?? [];
  }

  const eventsUrl = `https://discord.com/api/v10/guilds/${config.guildId}/scheduled-events?with_user_count=true`;

  try {
    const payload = await fetchJson(eventsUrl, {
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json"
      }
    });

    const freshEvents = payload.map((event) => mapDiscordEvent(event, config));
    const freshById = new Map(freshEvents.map((e) => [e.id, e]));

    // Merge: keep existing past events that are no longer in the API.
    // Discord only returns scheduled/active events — once an event ends,
    // it disappears from the API. We preserve those as "completed".
    const now = new Date();
    for (const existing of existingEvents) {
      if (!freshById.has(existing.id)) {
        // Mark as completed if the event has already started
        const startAt = new Date(existing.startAt);
        if (startAt <= now && existing.status !== "canceled") {
          existing.status = "completed";
        }
        freshById.set(existing.id, existing);
      }
    }

    return [...freshById.values()];
  } catch (error) {
    console.warn(`Skipping live Discord sync for ${config.source}/${config.sourceId}:`, error.message);
    return existingEvents.length > 0 ? existingEvents : config.fallbackEvents ?? [];
  }
}

async function resolveMeetupEvents(config, existingEvents, fullSync = false) {
  try {
    const session = await fetchMeetupCsrf(config);
    const now = new Date().toISOString();

    let pastEvents, upcomingEvents;

    if (fullSync) {
      // Full consolidation: paginate all past + all upcoming
      [pastEvents, upcomingEvents] = await Promise.all([
        paginateMeetupEvents(config, "past", now, session),
        paginateMeetupEvents(config, "upcoming", now, session),
      ]);
    } else {
      // Incremental: only last 30 days of past + all upcoming
      const lookbackDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      [pastEvents, upcomingEvents] = await Promise.all([
        paginateMeetupEvents(config, "past", now, session, lookbackDate),
        paginateMeetupEvents(config, "upcoming", now, session),
      ]);
    }

    const freshById = new Map();
    for (const event of [...pastEvents, ...upcomingEvents].map((e) => mapMeetupEvent(e, config))) {
      freshById.set(event.id, event);
    }

    if (!fullSync) {
      // Merge: preserve existing events not in the fresh window, overlay fresh on top
      for (const existing of existingEvents) {
        if (!freshById.has(existing.id)) {
          freshById.set(existing.id, existing);
        }
      }
    }

    return [...freshById.values()];
  } catch (error) {
    console.warn(`Skipping Meetup sync for ${config.source}/${config.sourceId}:`, error.message);
    return existingEvents.length > 0 ? existingEvents : config.fallbackEvents ?? [];
  }
}

// ─── Sympla (Playwright) ──────────────────────────────────────────────────────

const SYMPLA_MONTH_MAP = {
  jan: "01", fev: "02", mar: "03", abr: "04",
  mai: "05", jun: "06", jul: "07", ago: "08",
  set: "09", out: "10", nov: "11", dez: "12",
};

function normalizeSymplaDateText(text) {
  return text
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseSymplaRichDate(norm) {
  const m = /(\d{1,2})\s+([a-z]{3})\s-\s(\d{4})\s[•·]\s(\d{2}:\d{2})/.exec(norm);
  if (!m) return null;
  const month = SYMPLA_MONTH_MAP[m[2]];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1].padStart(2, "0")}T${m[4]}:00-03:00`;
}

function resolveSymplaYear(day, month, time, defaultStatus, referenceDate) {
  const currentYear = referenceDate.getFullYear();
  let year = currentYear;
  let candidate = new Date(`${year}-${month}-${day}T${time}:00-03:00`);
  const minYear = currentYear - 5;
  const maxYear = currentYear + 2;

  if (defaultStatus === "completed") {
    while (candidate > referenceDate && year > minYear) {
      year -= 1;
      candidate = new Date(`${year}-${month}-${day}T${time}:00-03:00`);
    }
  } else {
    while (candidate < referenceDate && year < maxYear) {
      year += 1;
      candidate = new Date(`${year}-${month}-${day}T${time}:00-03:00`);
    }
  }

  return year;
}

function parseSymplaCardDate(norm, defaultStatus, referenceDate) {
  const m = /(?:[a-z]{3},\s)?(\d{1,2})\s+([a-z]{3})(?:\s[·-]\s(\d{2}:\d{2}))?/.exec(norm);
  if (!m) return null;

  const day = m[1].padStart(2, "0");
  const month = SYMPLA_MONTH_MAP[m[2]];
  if (!month) return null;
  const time = m[3] ?? "00:00";
  const year = resolveSymplaYear(day, month, time, defaultStatus, referenceDate);

  return `${year}-${month}-${day}T${time}:00-03:00`;
}

/**
 * Parses a rich Sympla date string from the event page body text:
 *   "12 mai - 2026 • 13:05"  → "2026-05-12T13:05:00-03:00"
 *   "Sab, 28 Mar · 14:00"   → "2026-03-28T14:00:00-03:00" (year inferred)
 *   "16 Mai"                 → "2026-05-16T00:00:00-03:00" (time+year inferred)
 *
 * Year inference supports multi-year gaps: events from 2024 are correctly
 * placed in the past when they appear in the "Encerrados" tab in 2026.
 */
function parseSymplaDateText(text, defaultStatus = "scheduled", referenceDate = new Date()) {
  if (!text) return null;
  const norm = normalizeSymplaDateText(text);
  return parseSymplaRichDate(norm) ?? parseSymplaCardDate(norm, defaultStatus, referenceDate);
}

function mapSymplaEventStatus(startAt, isEnded) {
  if (isEnded) return "completed";
  if (!startAt) return "scheduled";
  const now = Date.now();
  const start = Date.parse(startAt);
  if (!Number.isNaN(start) && start < now) return "completed";
  return "scheduled";
}

function extractSymplaDateLine(body) {
  const datePart = String.raw`\d{1,2} [a-z]{3} - \d{4} [•·] \d{2}:\d{2}`;
  const rangeMatch = new RegExp(`(${datePart}) > (${datePart})`, "i").exec(body);
  if (rangeMatch) {
    return {
      startDateRaw: rangeMatch[1].trim(),
      endDateRaw: rangeMatch[2].trim(),
      singleDateRaw: null,
    };
  }

  const singleMatch = /(\d{1,2} [a-z]{3} - \d{4} [•·] \d{2}:\d{2})/i.exec(body);
  return {
    startDateRaw: null,
    endDateRaw: null,
    singleDateRaw: singleMatch?.[1]?.trim() ?? null,
  };
}

function extractSymplaLocation(body) {
  const onlinePattern = "Evento Online(?: via [^,]+)?";
  // Venue names in Sympla look like "312 Coworking, Ponta Grossa - PR" or
  // "Auditório UniCesumar - Ponta Grossa - PR". They contain a comma or a
  // hyphen separating address parts; challenge text does not follow this shape.
  const venuePattern = String.raw`\b[A-Z][^•,]{3,80}(?:, [A-Z][^•,]{2,40}|-[A-Z][^•,]{2,40})`;
  const match = new RegExp(`(?:${onlinePattern}|${venuePattern})(?= |$)`, "i").exec(body);
  const raw = match?.[0]?.trim() ?? null;
  if (!raw) return null;
  const forbidden = /verificacao|seguranca|executando|cloudflare|queue-it|checking|please wait/i;
  if (forbidden.test(raw.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) return null;
  return raw;
}

function extractSymplaDescription(body) {
  const descStart = body.indexOf("Descrição do evento");
  if (descStart < 0) return null;

  const descEnd = body.indexOf("Política do evento");
  const raw = body
    .slice(descStart + "Descrição do evento".length, descEnd > descStart ? descEnd : descStart + 2000)
    .trim();
  return raw.length >= 20 ? raw : null;
}

function extractSymplaUserCount(body) {
  const countMatch = /(\d+)\s*(?:inscritos?|participantes?)/i.exec(body);
  return countMatch ? Number.parseInt(countMatch[1]) : undefined;
}

function isSymplaQueueItUrl(url) {
  return /queue-it\.net|secure\.queue-it\.net/i.test(url);
}

const SYMPLA_USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
];

function getRandomSymplaUserAgent() {
  return SYMPLA_USER_AGENTS[randomInt(0, SYMPLA_USER_AGENTS.length)];
}

function getSymplaBrowserHeaders() {
  return {
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Cache-Control": "max-age=0",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
  };
}

function symplaDelayMs(baseMs = 1000) {
  // Add +/- 30% jitter to avoid a perfectly regular request pattern.
  const jitter = randomInt(700, 1301) / 1000;
  return Math.round(baseMs * jitter);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


/**
 * Warms up the Sympla session by visiting the homepage once. This lets
 * Playwright pick up basic cookies/TLS fingerprinting before we hit detail
 * pages, which lowers the chance of an immediate Cloudflare challenge.
 */
async function warmupSymplaSession(browser) {
  const page = await browser.newPage();
  try {
    await configureSymplaPage(page);
    await page.setExtraHTTPHeaders({
      ...getSymplaBrowserHeaders(),
      "User-Agent": getRandomSymplaUserAgent(),
    });
    await page.goto("https://www.sympla.com.br/", {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
    await page.waitForTimeout(symplaDelayMs(1500));
  } catch (err) {
    // Non-fatal: even a failed warm-up still leaves cookies in the context.
    console.warn(`    ⚠ Sympla warm-up failed: ${err.message}`);
  } finally {
    await page.close().catch(() => {});
  }
}

function isSymplaChallengePage(body) {
  const challengeMarkers = [
    "executando verificacao de seguranca",
    "verificacao de seguranca",
    "checking your browser",
    "please wait",
    "queue-it",
    "seguranca da cloudflare",
    "cloudflare",
    "antes de continuar",
  ];
  const normalized = (body || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return challengeMarkers.some((marker) => normalized.includes(marker));
}

/**
 * Fetches precise dates, description, and location from an individual Sympla event page.
 * Tries the canonical URL first; online events may also load via the /evento-online/ variant.
 * Returns null when the page is behind Queue-it, redirects to a different event, or fails.
 *
 * Robustness measures:
 * - Blocks heavy third-party resources to reduce Cloudflare exposure.
 * - Visits the Sympla homepage once per browser context to warm up cookies.
 * - Rotates user-agent and adds jittered delays between attempts.
 * - Uses exponential backoff with jitter on challenge/failure.
 * - Waits for an explicit date marker in the page text before extraction.
 */
async function fetchSymplaEventDetail(browser, href) {
  const urlsToTry = [href];
  if (/\/evento\//.test(href) && !/\/evento-online\//.test(href)) {
    urlsToTry.push(href.replace(/\/evento\//, "/evento-online/"));
  }

  const page = await browser.newPage();
  try {
    await configureSymplaPage(page);

    for (const detailUrl of urlsToTry) {
      // Retry a few times with increasing backoff; Cloudflare challenges can be
      // intermittent and a fresh user-agent + delay sometimes lets the real page
      // through.
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          await page.setExtraHTTPHeaders({
            ...getSymplaBrowserHeaders(),
            "User-Agent": getRandomSymplaUserAgent(),
          });

          // Longer initial delay on later attempts to let any challenge settle.
          if (attempt > 1) {
            await sleep(symplaDelayMs(2000 * 2 ** (attempt - 1)));
          }

          await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

          // Wait for the date marker that only appears on real event pages.
          // If it never shows, the body extraction below will likely hit a
          // challenge page and we will retry.
          await page
            .waitForFunction(
              () => /\d{1,2} [a-z]{3} - \d{4} [•·] \d{2}:\d{2}/i.test(document.body.innerText),
              { timeout: 8_000 }
            )
            .catch(() => {});

          await page.waitForTimeout(symplaDelayMs(1500));

          const finalUrl = page.url();

          // Queue-it protection serves a waiting page instead of the event content.
          if (isSymplaQueueItUrl(finalUrl)) {
            console.warn(`    ⚠ Sympla queued event ${href}, skipping detail`);
            break;
          }

          // If Sympla redirected away ("event ended / see similar events"), the final URL
          // will have a different numeric ID — skip enrichment to avoid picking up wrong data.
          const expectedId = /\/(\d+)$/.exec(new URL(detailUrl).pathname)?.[1];
          const finalId = /\/(\d+)$/.exec(new URL(finalUrl).pathname)?.[1];
          if (expectedId && finalId && expectedId !== finalId) {
            console.warn(`    ⚠ Sympla redirected event ${expectedId} → ${finalId}, skipping detail`);
            break;
          }

          const body = await page.evaluate(() => (document.body.innerText ?? "").replace(/\s+/g, " "));

          // Cloudflare / Sympla challenge pages render generic security text and
          // no event metadata — discard them so the card data is used instead.
          if (isSymplaChallengePage(body)) {
            console.warn(`    ⚠ Sympla challenge page for ${href} (attempt ${attempt}), ${attempt < 3 ? "retrying" : "giving up"}`);
            if (attempt < 3) {
              continue;
            }
            break;
          }

          const dateLine = extractSymplaDateLine(body);

          return {
            startDateRaw: dateLine.startDateRaw ?? dateLine.singleDateRaw ?? null,
            endDateRaw: dateLine.endDateRaw,
            location: extractSymplaLocation(body),
            description: extractSymplaDescription(body),
            userCount: extractSymplaUserCount(body),
          };
        } catch (err) {
          console.warn(`    ⚠ Could not fetch detail for ${href} via ${detailUrl} (attempt ${attempt}): ${err.message}`);
          if (attempt < 3) {
            await sleep(symplaDelayMs(2000 * 2 ** (attempt - 1)));
          }
        }
      }
    }
  } finally {
    await page.close().catch(() => {});
  }

  return null;
}

// Sympla card date format: "Sab, 10 Ago · 13:00", "Sex, 27 Mar · 19:00" or "16 Mai".
// Word boundaries prevent false positives such as "312 Coworking" matching as a date.
const SYMPLA_CARD_DATE_PATTERN = /\b(?:[a-záéíóúãõ]{3},\s+)?\d{1,2}\s+[a-záéíóúãõ]{3}(?:\s*[·-]\s*\d{2}:\d{2})?\b/i;

function resolveSymplaStartAt(detail, raw, defaultStatus) {
  if (detail?.startDateRaw) {
    const parsed = parseSymplaDateText(detail.startDateRaw, defaultStatus);
    if (parsed) return parsed;
  }

  // Card dates: take last date-looking text (avoids registration-opening date)
  const dateTexts = (raw.allText ?? []).filter((t) => SYMPLA_CARD_DATE_PATTERN.test(t));
  return parseSymplaDateText(dateTexts.at(-1) ?? "", defaultStatus) ?? undefined;
}

function resolveSymplaEndAt(detail, defaultStatus) {
  if (!detail?.endDateRaw) return undefined;
  return parseSymplaDateText(detail.endDateRaw, defaultStatus) ?? undefined;
}

function resolveSymplaIsOnline(raw, detail) {
  return (raw.allText ?? []).some((t) => /online/i.test(t))
    || /online/i.test(detail?.location ?? "");
}

function resolveSymplaLocation(raw, detail, isOnline, config) {
  const cardLocation = (raw.allText ?? [])
    .findLast((t) => !SYMPLA_CARD_DATE_PATTERN.test(t) && t !== raw.title && t.length > 3) ?? null;

  // Use detail location only when it looks like a real place, not Sympla placeholder text
  const detailLocationOk = detail?.location
    && !/fale com o produtor|a definir|a confirmar/i.test(detail.location);

  if (detailLocationOk) return detail.location;
  if (cardLocation && !isOnline) return cardLocation;
  return isOnline ? "Evento Online" : (config.defaultLocation ?? "Sympla");
}

function resolveSymplaSummary(detail, config) {
  return detail?.description
    ? truncateText(detail.description)
    : truncateText(`Evento organizado pelo ${config.defaultHost} na Sympla.`);
}

function mapSymplaEvent(raw, config) {
  const detail = raw.detail;
  const defaultStatus = raw.isEnded ? "completed" : "scheduled";

  const startAt = resolveSymplaStartAt(detail, raw, defaultStatus);
  const endAt = resolveSymplaEndAt(detail, defaultStatus);
  const status = mapSymplaEventStatus(startAt, raw.isEnded);
  const isOnline = resolveSymplaIsOnline(raw, detail);
  const location = resolveSymplaLocation(raw, detail, isOnline, config);
  const summary = resolveSymplaSummary(detail, config);

  return {
    id: raw.id,
    title: raw.title ?? `Evento Sympla ${raw.id}`,
    summary,
    startAt,
    endAt,
    timezone: "America/Sao_Paulo",
    platform: config.defaultPlatform ?? "Sympla",
    host: config.defaultHost,
    location,
    href: raw.href,
    tags: [config.sourceId, "sympla", isOnline ? "online" : "presencial"],
    ctaLabel: "Ver evento na Sympla",
    featured: false,
    status,
    entityType: "external",
    userCount: detail?.userCount ?? undefined,
    creatorName: config.defaultHost,
    creatorId: undefined,
    organizers: [],
    imageUrl: raw.imageUrl ?? undefined,
  };
}

async function scrapeSymplaTab(page) {
  return page.evaluate(() => {
    const eventLinks = Array.from(document.querySelectorAll("a[href*=\"/evento\"]"))
      .filter((a) => /\/evento(?:-online)?\/[^/]+\/\d+/.test(a.href));

    return eventLinks.map((link) => {
      let card = link;
      for (let i = 0; i < 8; i++) {
        const p = card.parentElement;
        if (!p || p === document.body) break;
        if (p.querySelector("h2, h3, h4") && p.querySelector("img")) { card = p; break; }
        card = p;
      }

      const allText = Array.from(card.querySelectorAll("*"))
        .filter((el) => el.children.length === 0 && !["SCRIPT", "STYLE", "IMG"].includes(el.tagName))
        .map((el) => el.textContent?.trim())
        .filter(Boolean);

      const idMatch = link.href.match(/\/(\d+)(?:[?#].*)?$/);
      return {
        id: idMatch ? `sympla-${idMatch[1]}` : `sympla-${Date.now()}`,
        href: link.href,
        title: card.querySelector("h2, h3, h4")?.textContent?.trim(),
        imageUrl: card.querySelector("img")?.src ?? undefined,
        allText,
      };
    });
  });
}

async function scrapeSymplaListPage(listPage, config) {
  const producerUrl = `https://www.sympla.com.br/produtor/${config.producerSlug}`;
  console.log(`    opening ${producerUrl} with Playwright...`);
  await listPage.goto(producerUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await sleep(symplaDelayMs(2500));

  const body = await listPage.evaluate(() => (document.body.innerText ?? "").replace(/\s+/g, " "));
  if (isSymplaChallengePage(body)) {
    throw new Error("Sympla producer page is behind a Cloudflare human verification challenge");
  }

  // Wait for event cards to render (Sympla SPA)
  try {
    await listPage.waitForSelector("a[href*=\"/evento\"]", { timeout: 20_000 });
  } catch {
    // No events yet on the available tab — may still have "Encerrados"
  }
  await listPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(symplaDelayMs(1500));

  const availableRaw = await scrapeSymplaTab(listPage);
  console.log(`    found ${availableRaw.length} available event(s)`);

  const encerradosBtn = listPage.locator("button", { hasText: "Encerrados" });
  await encerradosBtn.click();
  await sleep(symplaDelayMs(4500));

  const endedRaw = await scrapeSymplaTab(listPage);
  console.log(`    found ${endedRaw.length} ended event(s)`);

  return { availableRaw, endedRaw };
}

async function enrichSymplaEvents(allRaw, browser, config) {
  const freshById = new Map();
  for (let i = 0; i < allRaw.length; i += 1) {
    const raw = allRaw[i];
    // Fetch details for every event: the detail page contains the full year,
    // which is required to correctly place past events from previous years.
    const detail = await fetchSymplaEventDetail(browser, raw.href);
    const event = mapSymplaEvent({ ...raw, detail }, config);
    freshById.set(event.id, event);
    const enrichmentLabel = detail?.startDateRaw ? " (detail enriched)" : " (card only)";
    console.log(`    ✓ ${event.id}: "${event.title}" [${event.status}]${enrichmentLabel}`);
    // Polite, jittered delay between detail requests to reduce Cloudflare challenges.
    if (i < allRaw.length - 1) {
      await sleep(symplaDelayMs(1500));
    }
  }
  return freshById;
}

async function configureSymplaPage(page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({
    ...getSymplaBrowserHeaders(),
    "User-Agent": getRandomSymplaUserAgent(),
  });

  const blockedResourceTypes = new Set([
    "image",
    "stylesheet",
    "font",
    "media",
    "websocket",
  ]);
  const blockedUrlPatterns = [
    /google-analytics\.com/,
    /googletagmanager\.com/,
    /googleadservices\.com/,
    /doubleclick\.net/,
    /facebook\.net/,
    /connect\.facebook\.net/,
    /bat\.bing\.com/,
    /clarity\.ms/,
    /hotjar/,
    /analytics/,
    /recaptcha/,
    /gstatic\.com\/recaptcha/,
    /datadoghq\.com/,
    /trackjs\.com/,
    /audima\.co/,
  ];

  await page.route("**/*", (route) => {
    const request = route.request();
    if (blockedResourceTypes.has(request.resourceType())) {
      return route.abort("blockedbyclient");
    }
    const url = request.url();
    if (blockedUrlPatterns.some((pattern) => pattern.test(url))) {
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
}

async function resolveSymplaEvents(config, existingEvents) {
  let browser;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });

    const listPage = await browser.newPage();
    await configureSymplaPage(listPage);

    const { availableRaw, endedRaw } = await scrapeSymplaListPage(listPage, config);
    await listPage.close();

    // Warm up the browser context once before detail requests.
    await warmupSymplaSession(browser);

    const allRaw = [
      ...availableRaw.map((r) => ({ ...r, isEnded: false })),
      ...endedRaw.map((r) => ({ ...r, isEnded: true })),
    ];

    const freshById = await enrichSymplaEvents(allRaw, browser, config);

    mergeExistingEvents(freshById, existingEvents);
    return [...freshById.values()];
  } catch (error) {
    console.warn(`Skipping Sympla sync for ${config.source}/${config.sourceId}:`, error.message);
    return existingEvents.length > 0 ? existingEvents : config.fallbackEvents ?? [];
  } finally {
    await browser?.close();
  }
}

// ─── CNCF Open Community Groups (ocgroups.dev) ────────────────────────────────

const OCGROUPS_BROWSER_UA = "Mozilla/5.0 (compatible; Codaqui/1.0; +https://codaqui.dev)";

const OCGROUPS_MONTH_MAP = {
  January: "01", February: "02", March: "03", April: "04",
  May: "05", June: "06", July: "07", August: "08",
  September: "09", October: "10", November: "11", December: "12",
};

const HTML_NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Single-pass HTML entity decoder — avoids double-unescaping from chained replaces. */
function decodeHtmlEntities(str) {
  return str.replaceAll(/&(?:#(\d+)|#x([0-9a-fA-F]+)|([a-zA-Z]+));/g, (_, dec, hex, name) => {
    if (dec) return String.fromCodePoint(Number(dec));
    if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
    return HTML_NAMED_ENTITIES[name] ?? "";
  });
}

async function fetchOcgroupsHtml(url) {
  const response = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": OCGROUPS_BROWSER_UA,
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) {
    throw new Error(`ocgroups.dev request failed for ${url}: ${response.status}`);
  }
  return response.text();
}

function extractOcgroupsEventSlugs(html, groupId) {
  const pattern = new RegExp(`/cncf/group/${groupId}/event/([a-z0-9]+)`, "g");
  const slugs = new Set();
  let match;
  while ((match = pattern.exec(html)) !== null) {
    slugs.add(match[1]);
  }
  return [...slugs];
}

function parseOcgroupsTime(timePart) {
  const m = /(\d{1,2}):(\d{2})\s+(AM|PM)/i.exec(timePart.trim());
  if (!m) return null;
  let h = Number.parseInt(m[1]);
  const min = m[2];
  const ampm = m[3].toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}:00`;
}

function buildOcgroupsDateTime(year, month, day, timePart, tzRaw) {
  const d = String(day).padStart(2, "0");
  const tz = `${tzRaw}:00`;
  const h = parseOcgroupsTime(timePart);
  return h ? `${year}-${month}-${d}T${h}${tz}` : null;
}

function parseOcgroupsDateRange(dateText) {
  // Matches: "April 25, 2026 09:30 AM - 12:00 PM -03"
  // Pre-normalize whitespace to simplify the regex and avoid backtracking
  const normalized = dateText.replaceAll(/\s+/g, " ").trim();
  const match = /([A-Z]+) (\d{1,2}), (\d{4}) (\d+:\d+ \w+) - (\d+:\d+ \w+) ([+-]\d{2})/i.exec(normalized);
  if (!match) return { startAt: null, endAt: null };

  const [, monthName, day, year, startTime, endTime, tzRaw] = match;
  const month = OCGROUPS_MONTH_MAP[monthName];
  if (!month) return { startAt: null, endAt: null };

  return {
    startAt: buildOcgroupsDateTime(year, month, day, startTime, tzRaw),
    endAt: buildOcgroupsDateTime(year, month, day, endTime, tzRaw),
  };
}

function mapOcgroupsEventStatus(startAt, endAt) {
  const now = Date.now();
  const start = startAt ? Date.parse(startAt) : Number.NaN;
  const end = endAt ? Date.parse(endAt) : Number.NaN;
  if (!Number.isNaN(end) && end < now) return "completed";
  if (!Number.isNaN(start) && start <= now && (Number.isNaN(end) || end >= now)) return "active";
  return "scheduled";
}

function extractOcgroupsUuid(html, slug) {
  const uuidMatch = /\/cncf\/event\/([0-9a-f-]{36})\/attend/.exec(html);
  return uuidMatch ? uuidMatch[1] : slug;
}

function extractOcgroupsTitle(html, slug) {
  const startIdx = html.search(/<h1\b/i);
  if (startIdx === -1) return slug;
  const openEnd = html.indexOf(">", startIdx);
  if (openEnd === -1) return slug;
  const closeStart = html.indexOf("</h1>", openEnd);
  if (closeStart === -1) return slug;
  const inner = html.slice(openEnd + 1, closeStart);
  const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text ? decodeHtmlEntities(text) : slug;
}

function extractOcgroupsDates(html) {
  const dateSectionMatch = /Event date[\s\S]*?<\/[^>]+>([\s\S]*?)(?=Location)/is.exec(html);
  if (!dateSectionMatch) return { startAt: null, endAt: null };
  const dateText = dateSectionMatch[1].replaceAll(/<[^>]+>/g, " ").replaceAll(/\s+/g, " ").trim();
  return parseOcgroupsDateRange(dateText);
}

function stripHtmlTags(input) {
  let current = input;
  let previous;
  do {
    previous = current;
    current = current.replace(/<[^>]+>/g, "");
  } while (current !== previous);
  return current;
}

function extractOcgroupsLocation(html, config) {
  const marker = "pointer-events-none";
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) return config.defaultLocation;
  const tagEnd = html.indexOf(">", startIdx);
  if (tagEnd === -1) return config.defaultLocation;
  const newlineAfter = html.indexOf("\n", tagEnd);
  if (newlineAfter === -1) return config.defaultLocation;
  const nextNewline = html.indexOf("\n", newlineAfter + 1);
  const line = nextNewline === -1
    ? html.slice(newlineAfter + 1)
    : html.slice(newlineAfter + 1, nextNewline);
  const text = stripHtmlTags(line).trim();
  return text || config.defaultLocation;
}

function extractOcgroupsSummary(html, config) {
  const marker = "About this event";
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) return `Evento publicado por ${config.defaultHost}.`;
  const sectionStart = html.indexOf(">", startIdx);
  if (sectionStart === -1) return `Evento publicado por ${config.defaultHost}.`;
  const endMarkers = ["Speakers", "Organizers", "Copyright"];
  let endIdx = html.length;
  for (const m of endMarkers) {
    const idx = html.indexOf(m, sectionStart);
    if (idx !== -1 && idx < endIdx) endIdx = idx;
  }
  const section = html.slice(sectionStart + 1, endIdx);
  const withoutScripts = section.replace(/<script\b[^>]*>[\s\S]*?<\/\s*script\b[^>]*>/gi, " ");
  const rawDesc = decodeHtmlEntities(
    withoutScripts
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
  return rawDesc.length >= 20 ? truncateText(rawDesc) : `Evento publicado por ${config.defaultHost}.`;
}

function extractOcgroupsOrganizers(html) {
  const orgIdx = html.indexOf("Organizers");
  const orgSection = orgIdx >= 0 ? html.slice(orgIdx, orgIdx + 8000) : "";
  const userChipMatches = [...orgSection.matchAll(/<user-chip\s+user='([^']+)'/g)];
  return userChipMatches.flatMap((m) => {
    try {
      return [JSON.parse(decodeHtmlEntities(m[1]))];
    } catch {
      return [];
    }
  });
}

function extractOcgroupsImage(html) {
  const galleryMatch = /<images-gallery\s[\s\S]*?images="([^"]+)"[\s\S]*?>/i.exec(html);
  if (!galleryMatch) return undefined;
  try {
    const galleryImages = JSON.parse(decodeHtmlEntities(galleryMatch[1]));
    const first = Array.isArray(galleryImages) ? galleryImages[0] : undefined;
    if (first) {
      return first.startsWith("http") ? first : `https://ocgroups.dev${first}`;
    }
  } catch {
    // ignore malformed gallery JSON
  }
  return undefined;
}

function detectOcgroupsEventType(html) {
  const isOnline = /\bonline\b/i.test(html) && !/\bin-person\b/i.test(html);
  return isOnline ? "online" : "presencial";
}

function buildOcgroupsEvent(config, slug, html, availabilityResult) {
  const url = `https://ocgroups.dev/cncf/group/${config.groupId}/event/${slug}`;
  const uuid = extractOcgroupsUuid(html, slug);
  const title = extractOcgroupsTitle(html, slug);
  const { startAt, endAt } = extractOcgroupsDates(html);
  const location = extractOcgroupsLocation(html, config);
  const summary = extractOcgroupsSummary(html, config);
  const organizers = extractOcgroupsOrganizers(html);
  const primaryOrganizer = organizers[0] ?? null;
  const eventType = detectOcgroupsEventType(html);
  const status = mapOcgroupsEventStatus(startAt, endAt);
  const imageUrl = extractOcgroupsImage(html);
  const registeredCount =
    availabilityResult?.capacity != null && availabilityResult?.remaining_capacity != null
      ? availabilityResult.capacity - availabilityResult.remaining_capacity
      : undefined;

  return {
    id: `ocgroups-${uuid}`,
    title,
    summary,
    startAt: startAt ?? new Date().toISOString(),
    endAt: endAt ?? undefined,
    timezone: config.timezone || "America/Sao_Paulo",
    platform: config.defaultPlatform,
    host: config.defaultHost,
    location,
    href: url,
    tags: ["cncf", config.sourceId, eventType].filter(Boolean),
    ctaLabel: config.ctaLabel || "Ver evento",
    featured: false,
    status,
    entityType: "external",
    userCount: registeredCount,
    imageUrl,
    creatorName: primaryOrganizer?.name ?? config.defaultHost,
    creatorId: primaryOrganizer?.user_id ?? undefined,
    organizers: organizers.length > 0
      ? organizers.map((o) => ({
          name: o.name,
          id: o.user_id == null ? undefined : String(o.user_id),
          photoUrl: o.photo_url ?? undefined,
        }))
      : [],
  };
}

async function scrapeOcgroupsEvent(config, slug) {
  const url = `https://ocgroups.dev/cncf/group/${config.groupId}/event/${slug}`;
  const availabilityUrl = `${url}/availability`;

  const [html, availabilityResult] = await Promise.all([
    fetchOcgroupsHtml(url),
    fetchWithTimeout(availabilityUrl, {
      headers: {
        "User-Agent": OCGROUPS_BROWSER_UA,
        "HX-Request": "true",
        Referer: url,
      },
    }).then((r) => r.ok ? r.json() : null).catch(() => null),
  ]);

  return buildOcgroupsEvent(config, slug, html, availabilityResult);
}

function resolveOcgroupsCanonicalSlug(groupHtml, groupId) {
  const canonicalMatch = /<link[\s\S]*?rel="canonical"[\s\S]*?href="https:\/\/ocgroups\.dev\/cncf\/group\/([^"]+)"/.exec(groupHtml)
    ?? /<link[\s\S]*?href="https:\/\/ocgroups\.dev\/cncf\/group\/([^"]+)"[\s\S]*?rel="canonical"/.exec(groupHtml);
  const effectiveGroupSlug = canonicalMatch?.[1] ?? groupId;
  if (effectiveGroupSlug !== groupId) {
    console.log(`    ↪ groupId "${groupId}" resolved to canonical slug "${effectiveGroupSlug}"`);
  }
  return effectiveGroupSlug;
}

async function scrapeOcgroupsEventList(config, slugs) {
  const freshById = new Map();
  for (const slug of slugs) {
    try {
      const event = await scrapeOcgroupsEvent(config, slug);
      freshById.set(event.id, event);
      console.log(`    ✓ scraped event/${slug}: "${event.title}"`);
    } catch (err) {
      console.warn(`    ⚠ Failed to scrape event/${slug}: ${err.message}`);
    }
  }
  return freshById;
}

async function resolveOcgroupsEvents(config, existingEvents) {
  try {
    const groupId = config.groupId;
    if (!groupId) {
      console.warn(`  ⚠ No groupId for ${config.sourceId}, using fallback`);
      return existingEvents.length > 0 ? existingEvents : config.fallbackEvents ?? [];
    }

    const groupHtml = await fetchOcgroupsHtml(`https://ocgroups.dev/cncf/group/${groupId}`);
    const effectiveGroupSlug = resolveOcgroupsCanonicalSlug(groupHtml, groupId);

    const slugs = extractOcgroupsEventSlugs(groupHtml, effectiveGroupSlug);
    console.log(`    found ${slugs.length} event slug(s) on group page`);

    if (slugs.length === 0) {
      console.warn(`    ⚠ No event slugs found, using fallback`);
      return existingEvents.length > 0 ? existingEvents : config.fallbackEvents ?? [];
    }

    const freshById = await scrapeOcgroupsEventList(config, slugs);
    mergeExistingEvents(freshById, existingEvents);
    return [...freshById.values()];
  } catch (error) {
    console.warn(`Skipping ocgroups sync for ${config.source}/${config.sourceId}:`, error.message);
    return existingEvents.length > 0 ? existingEvents : config.fallbackEvents ?? [];
  }
}

async function cleanSourceDir(sourceDir) {
  // Limpa todos os arquivos JSON (overrides agora ficam no banco, nao mais em disco).
  await mkdir(sourceDir, { recursive: true });
  const entries = await readdir(sourceDir);
  await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => rm(path.join(sourceDir, entry), { force: true }))
  );
}

async function writeSourceOutputs(sourceConfig, events, generatedAt, overridesByKey) {
  const sourceDir = buildSourceDir(sourceConfig.source, sourceConfig.sourceId);
  const sourceKey = getSourceKey(sourceConfig.source, sourceConfig.sourceId);
  const overridesForSource = overridesByKey.get(sourceKey) ?? new Map();

  await cleanSourceDir(sourceDir);

  const eventsWithOverrides = events.map((event) => {
    const override = overridesForSource.get(String(event.id));
    return override ? applyOverride(event, override) : event;
  });

  const sourceMeta = {
    source: sourceConfig.source,
    sourceId: sourceConfig.sourceId,
    type: sourceConfig.source,
    label: sourceConfig.label,
    emoji: sourceConfig.emoji,
    description: sourceConfig.description,
    ctaLabel: sourceConfig.ctaLabel,
    ctaHref: sourceConfig.ctaHref,
    widgetUrl: sourceConfig.widgetUrl,
    refreshStrategy:
      "Workflow periodico consulta a API da fonte, gera um indice leve para a UI e salva um arquivo por evento para detalhe e cache.",
    generatedAt
  };

  const summaries = eventsWithOverrides
    .map((event) => ({
      ...event,
      source: sourceConfig.source,
      sourceId: sourceConfig.sourceId,
      sourceKey: getSourceKey(sourceConfig.source, sourceConfig.sourceId),
      itemPath: buildEventItemPath(sourceConfig.source, sourceConfig.sourceId, event.id),
      hasOverride: Boolean(event.hasOverride)
    }))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const sourceSummary = {
    ...sourceMeta,
    sourceKey: getSourceKey(sourceConfig.source, sourceConfig.sourceId),
    indexPath: buildSourceIndexPath(sourceConfig.source, sourceConfig.sourceId),
    itemCount: summaries.length
  };

  for (const event of eventsWithOverrides) {
    await writeFile(
      path.join(sourceDir, `${event.id}.json`),
      `${JSON.stringify({ generatedAt, source: sourceMeta, event }, null, 2)}\n`,
      "utf8"
    );
  }

  await writeFile(
    path.join(sourceDir, "index.json"),
    `${JSON.stringify({ generatedAt, source: sourceSummary, events: summaries }, null, 2)}\n`,
    "utf8"
  );

  console.log(`    ✓ ${summaries.length} events written`);
  return { sourceSummary, summaries };
}

async function processSource(sourceConfig, fullSync, generatedAt, overridesByKey) {
  console.log(`  syncing ${sourceConfig.source}/${sourceConfig.sourceId}...`);
  const existingEvents = await readExistingEvents(sourceConfig.source, sourceConfig.sourceId);

  let events = existingEvents;
  if (sourceConfig.source === "discord") {
    events = await resolveDiscordEvents(sourceConfig, existingEvents);
  } else if (sourceConfig.source === "meetup") {
    events = await resolveMeetupEvents(sourceConfig, existingEvents, fullSync);
  } else if (sourceConfig.source === "ocgroups") {
    events = await resolveOcgroupsEvents(sourceConfig, existingEvents);
  } else if (sourceConfig.source === "sympla") {
    events = await resolveSymplaEvents(sourceConfig, existingEvents);
  }

  return writeSourceOutputs(sourceConfig, events, generatedAt, overridesByKey);
}

// ─── Internal (backend Codaqui) ─────────────────────────────────────────────
// Fonte dinamica (docs/EVENT_PLAN.md, Fase 1): o EventSourceConfig e os EventItem[]
// vem do backend via GET /events/public/managed (URL na env
// INTERNAL_EVENTS_API_URL). Nao consta no events.config.json porque e resolvida
// via API; se o backend estiver fora do ar, reutiliza o ultimo snapshot em
// disco — mesmo comportamento de fallback das demais fontes.

const INTERNAL_SOURCE = "internal";
const INTERNAL_SOURCE_ID = "codaqui";

async function readExistingSourceMeta(source, sourceId) {
  try {
    const snapshot = await readJson(path.join(buildSourceDir(source, sourceId), "index.json"));
    return snapshot?.source && typeof snapshot.source === "object" ? snapshot.source : null;
  } catch {
    return null;
  }
}

async function processInternalSource(generatedAt, overridesByKey) {
  console.log(`  syncing ${INTERNAL_SOURCE}/${INTERNAL_SOURCE_ID}...`);
  const apiBaseUrl = process.env.INTERNAL_EVENTS_API_URL || "http://localhost:3000";
  const existingEvents = await readExistingEvents(INTERNAL_SOURCE, INTERNAL_SOURCE_ID);
  const cachedMeta = await readExistingSourceMeta(INTERNAL_SOURCE, INTERNAL_SOURCE_ID);

  let payload = null;
  try {
    payload = await fetchJson(`${apiBaseUrl}/events/public/managed`);
    if (!payload || typeof payload !== "object" || !payload.source || !Array.isArray(payload.events)) {
      throw new Error(`unexpected payload shape from ${apiBaseUrl}/events/public/managed`);
    }
  } catch (error) {
    console.warn(`  ⚠ Skipping live internal sync (backend offline?):`, error.message);
  }

  if (!payload && !cachedMeta) {
    console.log("    ⚠ sem snapshot em cache e API indisponivel — fonte ignorada neste run");
    return null;
  }

  // EventSourceConfig vem do backend; em fallback, reutiliza o meta cacheado.
  // source/sourceId sao fixados pelo path do snapshot.
  const sourceConfig = {
    ...(payload?.source ?? cachedMeta),
    source: INTERNAL_SOURCE,
    sourceId: INTERNAL_SOURCE_ID,
  };
  const events = payload ? payload.events : existingEvents;

  const result = await writeSourceOutputs(sourceConfig, events, generatedAt, overridesByKey);
  if (!payload) {
    console.log("    ↪ usando snapshot em cache (backend indisponivel)");
  }
  return result;
}

function buildOverridesMap(overrides) {
  const map = new Map();
  for (const override of overrides) {
    if (!override.sourceKey || !override.eventId) continue;
    if (!map.has(override.sourceKey)) {
      map.set(override.sourceKey, new Map());
    }
    map.get(override.sourceKey).set(override.eventId, override);
  }
  return map;
}

async function main() {
  const fullSync =
    process.argv.includes("--full") || process.env.FULL_CONSOLIDATION === "true";

  const config = await readJson(configPath);
  const generatedAt = new Date().toISOString();
  const rootIndex = {
    generatedAt,
    sources: [],
    events: []
  };

  console.log(`mode: ${fullSync ? "full consolidation" : "incremental (last 30 days past + all upcoming)"}`);
  await mkdir(outputDir, { recursive: true });

  // Overrides agora vem do banco via API — nao mais de arquivos .override.json.
  const overrides = await fetchOverridesFromApi();
  const overridesByKey = buildOverridesMap(overrides);
  console.log(`  ↪ ${overrides.length} override(s) carregado(s) do backend`);

  for (const sourceConfig of config.sources) {
    const { sourceSummary, summaries } = await processSource(sourceConfig, fullSync, generatedAt, overridesByKey);
    rootIndex.sources.push(sourceSummary);
    rootIndex.events.push(...summaries);
  }

  // Fonte internal:codaqui — dinamica via API do backend (nao esta no
  // events.config.json). Retorna null se a API estiver fora e nao houver cache.
  const internalResult = await processInternalSource(generatedAt, overridesByKey);
  if (internalResult) {
    rootIndex.sources.push(internalResult.sourceSummary);
    rootIndex.events.push(...internalResult.summaries);
  }

  rootIndex.events.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  await writeFile(path.join(outputDir, "index.json"), `${JSON.stringify(rootIndex, null, 2)}\n`, "utf8");

  console.log(`✓ events synced at ${generatedAt}`);
  console.log(`  sources: ${rootIndex.sources.length} | total events: ${rootIndex.events.length}`);
}

// Exported for unit testing. The guard keeps `main()` from running when the
// module is imported by tests.
export {
  extractSymplaDateLine,
  extractSymplaDescription,
  extractSymplaLocation,
  extractSymplaUserCount,
  mapSymplaEvent,
  mapSymplaEventStatus,
  parseSymplaDateText,
  resolveSymplaEndAt,
  resolveSymplaEvents,
  resolveSymplaIsOnline,
  resolveSymplaLocation,
  resolveSymplaStartAt,
  resolveSymplaSummary,
  SYMPLA_CARD_DATE_PATTERN,
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

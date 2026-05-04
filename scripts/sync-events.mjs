import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

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
      ? [{ name: creatorName, id: event.creator_id != null ? String(event.creator_id) : undefined }]
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
        ? event.eventHosts.map((h) => ({ name: h.name, id: h.memberId != null ? String(h.memberId) : undefined }))
        : null;
      if (hosts) return hosts;
      if (event.creatorMember?.name) return [{ name: event.creatorMember.name, id: event.creatorMember.id != null ? String(event.creatorMember.id) : undefined }];
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
  return str.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|([a-zA-Z]+));/g, (_, dec, hex, name) => {
    if (dec) return String.fromCharCode(Number(dec));
    if (hex) return String.fromCharCode(parseInt(hex, 16));
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
  let h = parseInt(m[1]);
  const min = m[2];
  const ampm = m[3].toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}:00`;
}

function parseOcgroupsDateRange(dateText) {
  // Matches: "April 25, 2026 09:30 AM - 12:00 PM -03"
  const match = /([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)\s*([-+]\d{2})/i.exec(dateText);
  if (!match) return { startAt: null, endAt: null };

  const [, monthName, day, year, startTime, endTime, tzRaw] = match;
  const month = OCGROUPS_MONTH_MAP[monthName];
  if (!month) return { startAt: null, endAt: null };

  const d = String(day).padStart(2, "0");
  const tz = `${tzRaw}:00`;
  const startH = parseOcgroupsTime(startTime);
  const endH = parseOcgroupsTime(endTime);

  return {
    startAt: startH ? `${year}-${month}-${d}T${startH}${tz}` : null,
    endAt: endH ? `${year}-${month}-${d}T${endH}${tz}` : null,
  };
}

function mapOcgroupsEventStatus(startAt, endAt) {
  const now = Date.now();
  const start = startAt ? Date.parse(startAt) : NaN;
  const end = endAt ? Date.parse(endAt) : NaN;
  if (!isNaN(end) && end < now) return "completed";
  if (!isNaN(start) && start <= now && (isNaN(end) || end >= now)) return "active";
  return "scheduled";
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

  // Internal UUID from HTMX: hx-get="/cncf/event/{uuid}/attend"
  const uuidMatch = /\/cncf\/event\/([0-9a-f-]{36})\/attend/.exec(html);
  const uuid = uuidMatch ? uuidMatch[1] : slug;

  // Title from H1 (most reliable)
  const h1Match = /<h1[^>]*>([^<]+)<\/h1>/i.exec(html);
  const title = h1Match ? h1Match[1].trim() : slug;

  // Date from "Event date" section header up to "Location"
  const dateSectionMatch = /Event date[^<]*<\/[^>]+>(.*?)(?=Location)/is.exec(html);
  let startAt = null, endAt = null;
  if (dateSectionMatch) {
    const dateText = dateSectionMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const parsed = parseOcgroupsDateRange(dateText);
    startAt = parsed.startAt;
    endAt = parsed.endAt;
  }

  // Location from the map badge (clean, non-duplicated)
  const mapBadgeMatch = /pointer-events-none[^>]+>\s*\n\s*([^\n<]+)\s*\n/.exec(html);
  const location = mapBadgeMatch ? mapBadgeMatch[1].trim() : config.defaultLocation;

  // Description from "About this event" section
  const descMatch = /About this event[^<]*<\/[^>]+>(.*?)(?=Speakers|Organizers|Copyright)/is.exec(html);
  let summary = `Evento publicado por ${config.defaultHost}.`;
  if (descMatch) {
    const rawDesc = decodeHtmlEntities(
      descMatch[1]
        .replace(/<script[^>]*>[\s\S]*?<\/\s*script[^>]*>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    );
    if (rawDesc.length >= 20) {
      summary = truncateText(rawDesc);
    }
  }

  // Organizers from <user-chip user='...'> custom elements (HTML-entity-encoded JSON)
  const orgIdx = html.indexOf("Organizers");
  const orgSection = orgIdx >= 0 ? html.slice(orgIdx, orgIdx + 8000) : "";
  const userChipMatches = [...orgSection.matchAll(/<user-chip\s+user='([^']+)'/g)];
  const organizers = userChipMatches.flatMap((m) => {
    try {
      return [JSON.parse(decodeHtmlEntities(m[1]))];
    } catch {
      return [];
    }
  });
  const primaryOrganizer = organizers[0] ?? null;

  // Event format: in-person vs online
  const isOnline = /\bonline\b/i.test(html) && !/\bin-person\b/i.test(html);
  const eventType = isOnline ? "online" : "presencial";

  const status = mapOcgroupsEventStatus(startAt, endAt);

  // Attendance count from availability endpoint: capacity - remaining_capacity
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
    creatorName: primaryOrganizer?.name ?? config.defaultHost,
    creatorId: primaryOrganizer?.user_id ?? undefined,
    organizers: organizers.length > 0
      ? organizers.map((o) => ({
          name: o.name,
          id: o.user_id != null ? String(o.user_id) : undefined,
          photoUrl: o.photo_url ?? undefined,
        }))
      : [],
  };
}

async function resolveOcgroupsEvents(config, existingEvents) {
  try {
    const groupId = config.groupId;
    if (!groupId) {
      console.warn(`  ⚠ No groupId for ${config.sourceId}, using fallback`);
      return existingEvents.length > 0 ? existingEvents : config.fallbackEvents ?? [];
    }

    const groupHtml = await fetchOcgroupsHtml(`https://ocgroups.dev/cncf/group/${groupId}`);
    const slugs = extractOcgroupsEventSlugs(groupHtml, groupId);
    console.log(`    found ${slugs.length} event slug(s) on group page`);

    if (slugs.length === 0) {
      console.warn(`    ⚠ No event slugs found, using fallback`);
      return existingEvents.length > 0 ? existingEvents : config.fallbackEvents ?? [];
    }

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

    // Preserve existing events not found on the group page (e.g., very old ones)
    for (const existing of existingEvents) {
      if (!freshById.has(existing.id)) {
        freshById.set(existing.id, existing);
      }
    }

    return [...freshById.values()];
  } catch (error) {
    console.warn(`Skipping ocgroups sync for ${config.source}/${config.sourceId}:`, error.message);
    return existingEvents.length > 0 ? existingEvents : config.fallbackEvents ?? [];
  }
}

async function cleanSourceDir(sourceDir) {
  await rm(sourceDir, { recursive: true, force: true });
  await mkdir(sourceDir, { recursive: true });
}

async function processSource(sourceConfig, fullSync, generatedAt) {
  console.log(`  syncing ${sourceConfig.source}/${sourceConfig.sourceId}...`);
  const sourceDir = buildSourceDir(sourceConfig.source, sourceConfig.sourceId);
  const existingEvents = await readExistingEvents(sourceConfig.source, sourceConfig.sourceId);

  let events = existingEvents;
  if (sourceConfig.source === "discord") {
    events = await resolveDiscordEvents(sourceConfig, existingEvents);
  } else if (sourceConfig.source === "meetup") {
    events = await resolveMeetupEvents(sourceConfig, existingEvents, fullSync);
  } else if (sourceConfig.source === "ocgroups") {
    events = await resolveOcgroupsEvents(sourceConfig, existingEvents);
  }

  await cleanSourceDir(sourceDir);

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

  const summaries = events
    .map((event) => ({
      ...event,
      source: sourceConfig.source,
      sourceId: sourceConfig.sourceId,
      sourceKey: getSourceKey(sourceConfig.source, sourceConfig.sourceId),
      itemPath: buildEventItemPath(sourceConfig.source, sourceConfig.sourceId, event.id)
    }))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const sourceSummary = {
    ...sourceMeta,
    sourceKey: getSourceKey(sourceConfig.source, sourceConfig.sourceId),
    indexPath: buildSourceIndexPath(sourceConfig.source, sourceConfig.sourceId),
    itemCount: summaries.length
  };

  for (const event of events) {
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

  for (const sourceConfig of config.sources) {
    const { sourceSummary, summaries } = await processSource(sourceConfig, fullSync, generatedAt);
    rootIndex.sources.push(sourceSummary);
    rootIndex.events.push(...summaries);
  }

  rootIndex.events.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  await writeFile(path.join(outputDir, "index.json"), `${JSON.stringify(rootIndex, null, 2)}\n`, "utf8");

  console.log(`✓ events synced at ${generatedAt}`);
  console.log(`  sources: ${rootIndex.sources.length} | total events: ${rootIndex.events.length}`);
}

await main();

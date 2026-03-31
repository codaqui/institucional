import { mkdir, readFile, writeFile } from "node:fs/promises";
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
const syncConfigPath = path.join(rootDir, "social-stats.config.json");
const outputDir = path.join(rootDir, "static", "social-stats");
const outputFile = path.join(outputDir, "index.json");
const communitiesPath = path.join(rootDir, "src", "data", "communities.ts");
const socialPath = path.join(rootDir, "src", "data", "social.ts");
const eventsIndexPath = path.join(rootDir, "static", "events", "index.json");

// ─── Discord ─────────────────────────────────────────────────────────────────

async function fetchDiscordMemberCount(guildId) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.warn("DISCORD_BOT_TOKEN not set — skipping Discord member count");
    return null;
  }

  const url = `https://discord.com/api/v10/guilds/${guildId}?with_counts=true`;
  const res = await fetchWithTimeout(url, {
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    console.warn(`Discord guild fetch failed: ${res.status}`);
    return null;
  }

  const data = await res.json();
  return data.approximate_member_count ?? data.member_count ?? null;
}

// ─── Meetup ───────────────────────────────────────────────────────────────────

async function fetchMeetupCsrf(urlname) {
  const pageUrl = `https://www.meetup.com/pt-BR/${urlname}/`;
  const res = await fetchWithTimeout(pageUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Meetup page unavailable: ${res.status}`);

  const html = await res.text();
  const match = html.match(/<meta name="next_csrf" content="([^"]+)"/);
  if (!match) throw new Error("Meetup CSRF token not found");

  return { csrf: match[1], referer: pageUrl };
}

const meetupMemberCountQuery = `
  query getMemberCount($urlname: String!) {
    groupByUrlname(urlname: $urlname) {
      memberships {
        totalCount
      }
    }
  }
`;

async function fetchMeetupMemberCount(urlname) {
  try {
    const session = await fetchMeetupCsrf(urlname);

    const res = await fetchWithTimeout("https://www.meetup.com/gql2", {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Content-Type": "application/json",
        "x-csrf-token": session.csrf,
        Origin: "https://www.meetup.com",
        Referer: session.referer,
      },
      body: JSON.stringify({
        operationName: "getMemberCount",
        query: meetupMemberCountQuery,
        variables: { urlname },
      }),
    });

    if (!res.ok) {
      console.warn(`Meetup gql2 failed: ${res.status}`);
      return null;
    }

    const result = await res.json();
    return result?.data?.groupByUrlname?.memberships?.totalCount ?? null;
  } catch (err) {
    console.warn(`Meetup member count error for ${urlname}:`, err.message);
    return null;
  }
}

// ─── CNCF Community (Bevy) ───────────────────────────────────────────────────

async function fetchCncfMemberCount(chapterSlug) {
  try {
    const res = await fetchWithTimeout(`https://community.cncf.io/${chapterSlug}/`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;

    const html = await res.text();
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) return null;

    const data = JSON.parse(match[1]);
    return data?.props?.pageProps?.chapterData?.members_count ?? null;
  } catch (err) {
    console.warn(`CNCF member count error for ${chapterSlug}:`, err.message);
    return null;
  }
}

// ─── WhatsApp Business Groups API v25 ────────────────────────────────────────
// fetchId: GROUP_ID (opaque base64 string assigned by the API)
// The group must be created/managed by the business phone number registered in Meta.
// Requires META_ACCESS_TOKEN with whatsapp_business_messaging permission.
// total_participant_count excludes the business itself — we add +1 for the actual total.

async function fetchWhatsAppGroupParticipants(groupId) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    console.warn("  META_ACCESS_TOKEN not set — skipping WhatsApp group count");
    return null;
  }

  const url = `https://graph.facebook.com/v25.0/${groupId}?fields=total_participant_count,subject&access_token=${token}`;
  try {
    const res = await fetchWithTimeout(url, {
      headers: { "User-Agent": "codaqui-social-stats" },
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn(`WhatsApp Groups API error (${res.status}):`, body.slice(0, 200));
      return null;
    }
    const data = await res.json();
    if (data.error) {
      console.warn(`WhatsApp Groups API error:`, data.error.message);
      return null;
    }
    const count = (data.total_participant_count ?? 0) + 1; // +1 = the business itself
    console.log(`  WhatsApp group "${data.subject}": ${count} participants`);
    return count;
  } catch (err) {
    console.warn(`WhatsApp group fetch error for ${groupId}:`, err.message);
    return null;
  }
}

// ─── GitHub ───────────────────────────────────────────────────────────────────

async function fetchGitHubFollowers(username) {
  try {
    const res = await fetchWithTimeout(`https://api.github.com/users/${username}`, {
      headers: { "User-Agent": "codaqui-social-stats" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.followers ?? null;
  } catch {
    return null;
  }
}

// ─── Instagram via blastup.com wrapper ───────────────────────────────────────
// Scrapes blastup.com/instagram-follower-count (no auth needed).
// Flow: GET page → extract CSRF token + session cookies → POST with username.
// fetchId: Instagram username without "@" (e.g. "codaqui.dev")

async function fetchInstagramFollowers(username) {
  const handle = (username || "").replace(/^@/, "");
  if (!handle) return null;

  const BASE = "https://blastup.com/instagram-follower-count";
  const UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
  try {
    // Step 1: load the page to get CSRF token + session cookies
    const pageRes = await fetchWithTimeout(BASE, { headers: { "User-Agent": UA } });
    const html = await pageRes.text();

    // Extract CSRF token from window.__config = { token: "..." }
    const tokenMatch = html.match(/window\.__config\s*=\s*\{[^}]*token:\s*"([^"]+)"/);
    if (!tokenMatch) {
      console.warn("  blastup: could not find CSRF token in page");
      return null;
    }
    const csrfToken = tokenMatch[1];

    // Collect Set-Cookie headers
    const cookies = pageRes.headers.getSetCookie?.() ?? [];
    const cookieHeader = cookies
      .map((c) => c.split(";")[0])
      .join("; ");

    // Step 2: POST with username + CSRF token + cookies
    const postRes = await fetchWithTimeout(BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": UA,
        "Referer": BASE,
        "X-Requested-With": "XMLHttpRequest",
        "Cookie": cookieHeader,
      },
      body: JSON.stringify({ _token: csrfToken, username: handle }),
    });

    const data = await postRes.json();
    if (!data.success) {
      console.warn(`  blastup Instagram error for @${handle}:`, JSON.stringify(data).slice(0, 100));
      return null;
    }
    console.log(`  Instagram @${handle}: ${data.followers} seguidores (via blastup)`);
    return data.followers ?? null;
  } catch (err) {
    console.warn(`  blastup Instagram fetch error for @${handle}:`, err.message);
    return null;
  }
}
/** Parses YouTube subscriber text like "17 subscribers", "1.57K subscribers", "2.3M subscribers" */
function parseYouTubeSubscriberText(text) {
  const clean = text.replace(/,/g, "").toLowerCase();
  const m = clean.match(/^([\d.]+)\s*([km]?)\s*subscriber/);
  if (!m) return null;
  const num = parseFloat(m[1]);
  const mult = m[2] === "k" ? 1000 : m[2] === "m" ? 1_000_000 : 1;
  return Math.round(num * mult);
}

async function fetchYouTubeSubscribers(handle) {
  // handle: "@codaqui" or "devparana" (with or without @)
  const slug = handle.startsWith("@") ? handle : handle;
  const url = `https://www.youtube.com/${slug}`;
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // YouTube embeds subscriber count in ytInitialData as: "content":"X subscribers"
    const m = html.match(/"content":"([\d,\.]+[KkMm]? subscribers?)"/);
    if (!m) return null;
    return parseYouTubeSubscriberText(m[1]);
  } catch (err) {
    console.warn(`YouTube subscriber fetch error for ${handle}:`, err.message);
    return null;
  }
}

// ─── Platform fetch dispatcher ────────────────────────────────────────────────

async function fetchByPlatform(platform, fetchId) {
  switch (platform) {
    case "discord": return fetchDiscordMemberCount(fetchId);
    case "meetup": return fetchMeetupMemberCount(fetchId);
    case "github": return fetchGitHubFollowers(fetchId);
    case "youtube": return fetchYouTubeSubscribers(fetchId);
    case "instagram": return fetchInstagramFollowers(fetchId);
    case "whatsapp": return fetchWhatsAppGroupParticipants(fetchId);
    case "cncf": return fetchCncfMemberCount(fetchId);
    default:
      console.warn(`No auto-fetch for platform "${platform}" (fetchId: ${fetchId})`);
      return null;
  }
}

// ─── Total events ─────────────────────────────────────────────────────────────

async function readTotalEvents() {
  try {
    const raw = await readFile(eventsIndexPath, "utf8");
    const index = JSON.parse(raw);
    return Array.isArray(index.events) ? index.events.length : 0;
  } catch {
    return 0;
  }
}

// ─── Existing snapshot (to preserve counts between syncs) ────────────────────

async function readExistingSnapshot() {
  try {
    const raw = await readFile(outputFile, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── Read communities display data from TS source (regex extract) ─────────────
// Reads socialProfiles from communities.ts and codaquiSocialProfiles from social.ts
// to get handle, url, countLabel, baselineCount for each profile.

function extractSocialProfiles(tsSource, arrayName) {
  // Extract the array block and parse socialProfiles objects using JSON-like regex
  const profiles = [];
  // Match platform, handle, url, countLabel, baselineCount fields
  const blockRegex = /platform:\s*["']([^"']+)["'][^}]*?handle:\s*["']([^"']+)["'][^}]*?url:\s*["']([^"']+)["'][^}]*?countLabel:\s*["']([^"']+)["'](?:[^}]*?baselineCount:\s*(\d+))?/gs;

  let m;
  while ((m = blockRegex.exec(tsSource)) !== null) {
    profiles.push({
      platform: m[1],
      handle: m[2],
      url: m[3],
      countLabel: m[4],
      baselineCount: m[5] ? parseInt(m[5], 10) : 0,
    });
  }

  return profiles;
}

async function readAllSocialProfiles() {
  // Returns: Map<entityId, SocialProfile[]>
  const result = new Map();

  // Codaqui profiles from social.ts
  const socialSrc = await readFile(socialPath, "utf8");
  const codaquiBlock = socialSrc.match(/codaquiSocialProfiles[^=]*=\s*\[([\s\S]*?)\];/)?.[0] ?? "";
  result.set("codaqui", extractSocialProfiles(codaquiBlock));

  // Community profiles from communities.ts
  const commSrc = await readFile(communitiesPath, "utf8");
  // Split by community objects and find socialProfiles for each
  const communityBlocks = commSrc.matchAll(/id:\s*["']([^"']+)["'][\s\S]*?socialProfiles:\s*\[([\s\S]*?)\]/g);
  for (const match of communityBlocks) {
    const entityId = match[1];
    const profiles = extractSocialProfiles(match[2]);
    if (profiles.length > 0) {
      result.set(entityId, profiles);
    }
  }

  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function logMissingSecrets() {
  if (!process.env.DISCORD_BOT_TOKEN) console.warn("⚠️  DISCORD_BOT_TOKEN not set — Discord skipped");
  if (!process.env.META_BUSINESS_APP_ID && !process.env.META_ACCESS_TOKEN) {
    console.warn("⚠️  No Meta credentials — Instagram/WhatsApp skipped");
  }
}

async function main() {
  logMissingSecrets();
  const generatedAt = new Date().toISOString();
  const now = generatedAt;
  const existing = await readExistingSnapshot();
  const syncConfig = JSON.parse(await readFile(syncConfigPath, "utf8"));
  const allProfiles = await readAllSocialProfiles();

  // Build a lookup for which entityId+platform has a fetchId configured
  const fetchMap = new Map();
  for (const entity of syncConfig.entities) {
    for (const fp of entity.fetchProfiles ?? []) {
      fetchMap.set(`${entity.entityId}:${fp.platform}`, fp.fetchId);
    }
  }

  // Run fetches in parallel across all configured entries
  const fetchResults = new Map();
  const fetchPromises = [];
  for (const [key, fetchId] of fetchMap) {
    const [, platform] = key.split(":");
    fetchPromises.push(
      fetchByPlatform(platform, fetchId).then((count) => fetchResults.set(key, count))
    );
  }
  await Promise.all(fetchPromises);

  // Build profiles array from communities.ts / social.ts data + fetched counts
  const profiles = [];
  for (const [entityId, entityProfiles] of allProfiles) {
    for (const profile of entityProfiles) {
      const key = `${entityId}:${profile.platform}`;
      const fetchedCount = fetchResults.has(key) ? fetchResults.get(key) : null;
      const prevEntry = existing?.profiles?.find(
        (p) => p.entityId === entityId && p.platform === profile.platform
      );
      const count = fetchedCount ?? prevEntry?.count ?? profile.baselineCount ?? 0;
      const isFallback = fetchedCount === null;

      profiles.push({
        entityId,
        platform: profile.platform,
        handle: profile.handle,
        url: profile.url,
        countLabel: profile.countLabel,
        baselineCount: profile.baselineCount ?? 0,
        count,
        fetchedAt: isFallback ? (prevEntry?.fetchedAt ?? null) : now,
        isFallback,
      });
    }
  }

  const totalEvents = await readTotalEvents();
  const snapshot = { generatedAt, totalEvents, profiles };

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log(`✓ social-stats synced at ${generatedAt}`);
  console.log(`  totalEvents: ${totalEvents}`);
  console.log(`  profiles: ${profiles.length} total`);
  for (const [key, count] of fetchResults) {
    console.log(`  ${key}: ${count ?? "fallback"}`);
  }
}

await main();

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

const MAX_SCRAPE_BYTES = 1_000_000; // 1MB limit for scraping external pages

/** Safely reads text from a response up to a limit to prevent ReDoS on massive inputs */
async function fetchSafeText(res, limit = MAX_SCRAPE_BYTES) {
  if (!res.ok) return "";
  const reader = res.body.getReader();
  let text = "";
  let bytesRead = 0;
  const decoder = new TextDecoder();
  
  while (bytesRead < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.length;
    text += decoder.decode(value, { stream: true });
  }
  reader.releaseLock();
  return text;
}

const rootDir = process.cwd();
const syncConfigPath = path.join(rootDir, "social-stats.config.json");
const outputDir = path.join(rootDir, "static", "social-stats");
const outputFile = path.join(outputDir, "index.json");
const communitiesPath = path.join(rootDir, "src", "data", "communities.ts");
const socialPath = path.join(rootDir, "src", "data", "social.ts");
const eventsIndexPath = path.join(rootDir, "static", "events", "index.json");

// ─── Discord ─────────────────────────────────────────────────────────────────

async function fetchDiscordGuildData(guildId) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.warn("DISCORD_BOT_TOKEN not set — skipping Discord member count");
    return null;
  }

  const headers = { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
  const [guildRes, channelsRes] = await Promise.all([
    fetchWithTimeout(`https://discord.com/api/v10/guilds/${guildId}?with_counts=true`, { headers }),
    fetchWithTimeout(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers }),
  ]);

  if (!guildRes.ok) {
    console.warn(`Discord guild fetch failed: ${guildRes.status}`);
    return null;
  }

  const guild = await guildRes.json();
  const memberCount = guild.approximate_member_count ?? guild.member_count ?? null;

  let channelCount = null;
  if (channelsRes.ok) {
    const channels = await channelsRes.json();
    // type 4 = GUILD_CATEGORY — exclude categories, count only real channels
    channelCount = Array.isArray(channels) ? channels.filter((c) => c.type !== 4).length : null;
  }

  return { memberCount, channelCount };
}

// ─── Meetup ───────────────────────────────────────────────────────────────────

async function fetchMeetupCsrf(urlname) {
  const pageUrl = `https://www.meetup.com/pt-BR/${urlname}/`;
  const res = await fetchWithTimeout(pageUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  const html = await fetchSafeText(res);

  // Restricted match: don't match beyond quotes
  const match = /<meta name="next_csrf" content="([^"]+)"/.exec(html);
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
    const html = await fetchSafeText(res);
    // Safer match with restricted range
    const match = /<script id="__NEXT_DATA__"[^>]*>([\s\S]{1,200000}?)<\/script>/.exec(html);
    if (!match) return null;

    const data = JSON.parse(match[1]);
    return data?.props?.pageProps?.chapterData?.members_count ?? null;
  } catch (err) {
    console.warn(`CNCF member count error for ${chapterSlug}:`, err.message);
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
    const html = await fetchSafeText(pageRes);

    // Safer match: restrict object depth and token length
    const tokenMatch = /window\.__config\s*=\s*\{[^{}]*?token:\s*"([^"]{1,255})"/.exec(html);
    if (!tokenMatch) {
      console.warn(`  blastup: CSRF token not found for @${handle} — page structure may have changed`);
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
  const clean = text.replaceAll(",", "").toLowerCase();
  const m = clean.match(/^([\d.]+)\s*([km]?)\s*subscriber/);
  if (!m) return null;
  const num = Number.parseFloat(m[1]);
  let mult = 1;
  if (m[2] === "k") mult = 1000;
  else if (m[2] === "m") mult = 1_000_000;
  return Math.round(num * mult);
}

async function fetchYouTubeSubscribers(handle) {
  // handle: "@codaqui", "devparana", or legacy channel ID "UCxxxx"
  let path;
  if (handle.startsWith("UC") && !handle.startsWith("@")) {
    path = `/channel/${handle}`;
  } else {
    path = `/${handle}`;
  }
  const url = `https://www.youtube.com${path}`;
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const html = await fetchSafeText(res);
    // YouTube embeds subscriber count in ytInitialData. Restricted content match.
    const m = /"content":"([\d,.]+[KkMm]?\s*subscribers?)"/.exec(html);
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
    case "discord": return fetchDiscordGuildData(fetchId);
    case "meetup": return fetchMeetupMemberCount(fetchId);
    case "github": return fetchGitHubFollowers(fetchId);
    case "youtube": return fetchYouTubeSubscribers(fetchId);
    case "instagram": return fetchInstagramFollowers(fetchId);
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

function extractExportedConstants(tsSource) {
  const constants = new Map();
  const constRegex = /(?:export\s+)?const\s+([A-Z_][A-Z_0-9]*)\s*=\s*["']([^"']+)["']/g;
  let m;
  while ((m = constRegex.exec(tsSource)) !== null) {
    constants.set(m[1], m[2]);
  }
  return constants;
}

function extractSocialProfiles(tsSource, constants = new Map()) {
  const profiles = [];
  // Safer object match: limit search distance and avoid nested universal quantifiers
  const objectRegex = /\{[^{}]{1,1000}platform:\s*["']([a-z]{3,20})["'][^{}]{1,1000}\}/g;
  let match;
  while ((match = objectRegex.exec(tsSource)) !== null) {
    const block = match[0];
    
    const platform = match[1];
    const handleMatch = /handle:\s*["']([^"']+)["']/.exec(block);
    const urlMatch = /url:\s*(?:["']([^"']+)["']|([A-Z_][A-Z_0-9]*))/.exec(block);
    const countLabelMatch = /countLabel:\s*["']([^"']+)["']/.exec(block);
    const baselineCountMatch = /baselineCount:\s*(\d+)/.exec(block);
    
    if (handleMatch && urlMatch && countLabelMatch) {
      // url can be a string literal (group 1) or a variable reference (group 2)
      let urlValue = urlMatch[1] || "";
      if (!urlValue && urlMatch[2]) {
        urlValue = constants.get(urlMatch[2]) || urlMatch[2];
      }
      profiles.push({
        platform,
        handle: handleMatch[1],
        url: urlValue,
        countLabel: countLabelMatch[1],
        baselineCount: baselineCountMatch ? Number.parseInt(baselineCountMatch[1], 10) : 0,
      });
    }
  }

  return profiles;
}

async function readAllSocialProfiles() {
  const result = new Map();

  const socialSrc = await readFile(socialPath, "utf8");
  const constants = extractExportedConstants(socialSrc);
  // Limit source scan to the array block itself
  const codaquiMatch = /codaquiSocialProfiles[^=]{1,100}=\s*\[([\s\S]{1,5000}?)\];/.exec(socialSrc);
  if (codaquiMatch) {
    result.set("codaqui", extractSocialProfiles(codaquiMatch[1], constants));
  }

  const commSrc = await readFile(communitiesPath, "utf8");
  // Find each community block and extract profiles within it locally
  const communityBlocks = commSrc.matchAll(/id:\s*["']([a-z0-9-]{1,50})["'][\s\S]{1,2000}?socialProfiles:\s*\[([\s\S]{1,5000}?)\]/g);
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
}

function buildProfilesList(allProfiles, fetchResults, existing, now) {
  const profiles = [];
  for (const [entityId, entityProfiles] of allProfiles) {
    for (const profile of entityProfiles) {
      const key = `${entityId}:${profile.platform}`;
      let rawFetched = fetchResults.has(key) ? fetchResults.get(key) : null;

      let extra = {};
      if (rawFetched !== null && typeof rawFetched === "object") {
        extra = { channelCount: rawFetched.channelCount ?? null };
        rawFetched = rawFetched.memberCount ?? null;
      }

      const prevEntry = existing?.profiles?.find(
        (p) => p.entityId === entityId && p.platform === profile.platform
      );
      const count = rawFetched ?? prevEntry?.count ?? profile.baselineCount ?? 0;
      const isFallback = rawFetched === null;

      profiles.push({
        entityId,
        platform: profile.platform,
        handle: profile.handle,
        url: profile.url,
        countLabel: profile.countLabel,
        baselineCount: profile.baselineCount ?? 0,
        count,
        ...extra,
        fetchedAt: isFallback ? (prevEntry?.fetchedAt ?? null) : now,
        isFallback,
      });
    }
  }
  return profiles;
}

async function main() {
  logMissingSecrets();
  const generatedAt = new Date().toISOString();
  const now = generatedAt;
  const existing = await readExistingSnapshot();
  const syncConfig = JSON.parse(await readFile(syncConfigPath, "utf8"));
  const allProfiles = await readAllSocialProfiles();

  const fetchMap = new Map();
  for (const entity of syncConfig.entities) {
    for (const fp of entity.fetchProfiles ?? []) {
      fetchMap.set(`${entity.entityId}:${fp.platform}`, fp.fetchId);
    }
  }

  const fetchResults = new Map();
  const fetchPromises = [];
  for (const [key, fetchId] of fetchMap) {
    const [, platform] = key.split(":");
    fetchPromises.push(
      fetchByPlatform(platform, fetchId).then((count) => fetchResults.set(key, count))
    );
  }
  await Promise.all(fetchPromises);

  const profiles = buildProfilesList(allProfiles, fetchResults, existing, now);

  const totalEvents = await readTotalEvents();
  const snapshot = { generatedAt, totalEvents, profiles };

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log(`✓ social-stats synced at ${generatedAt}`);
  console.log(`  totalEvents: ${totalEvents}`);
  console.log(`  profiles: ${profiles.length} total`);
  for (const [key, count] of fetchResults) {
    const display = count !== null && typeof count === "object" ? count.memberCount : count;
    console.log(`  ${key}: ${display ?? "fallback"}`);
  }
}

await main();

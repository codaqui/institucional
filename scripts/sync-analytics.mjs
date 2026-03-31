/**
 * sync-analytics.mjs
 *
 * Fetches monthly analytics data from codaqui/dados and writes
 * static/analytics/index.json for the site.
 *
 * If a month that *should* exist is missing from the dados repo, it dispatches
 * the `report.yaml` workflow in codaqui/dados so the data gets generated.
 *
 * Required env vars:
 *   DADOS_DISPATCH_TOKEN  — GitHub PAT with `actions:write` on codaqui/dados
 *                           (only needed for auto-dispatch; fetch works without it)
 *
 * Usage:
 *   npm run sync:analytics           # incremental — only fetches latest period
 *   npm run sync:analytics -- --full # full consolidation — re-fetches all months
 */

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
const outputDir = path.join(rootDir, "static", "analytics");
const outputFile = path.join(outputDir, "index.json");

const RAW_BASE =
  "https://raw.githubusercontent.com/codaqui/dados/main/data";
const DISPATCH_REPO = "codaqui/dados";
const DISPATCH_WORKFLOW = "report.yaml";
const DISPATCH_API = `https://api.github.com/repos/${DISPATCH_REPO}/actions/workflows/${DISPATCH_WORKFLOW}/dispatches`;

const FULL_MODE = process.argv.includes("--full");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns all YYYY-MM periods from 2024-01 up to (and including) last month. */
function expectedPeriods() {
  const now = new Date();
  // "last month" — data published on the 2nd of each month for the previous month
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const periods = [];
  const cursor = new Date(2024, 0, 1); // 2024-01
  while (cursor <= lastMonth) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    periods.push(`${y}-${m}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return periods;
}

async function fetchJson(url) {
  const res = await fetchWithTimeout(url);
  if (!res.ok) return null;
  return res.json();
}

// ─── Dispatch missing month to codaqui/dados ─────────────────────────────────

async function dispatchReport(period) {
  const token = process.env.DADOS_DISPATCH_TOKEN;
  if (!token) {
    console.warn(
      `⚠️  DADOS_DISPATCH_TOKEN not set — cannot dispatch report for ${period}`
    );
    return false;
  }

  const res = await fetchWithTimeout(DISPATCH_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref: "main",
      inputs: { month: period },
    }),
  });

  if (res.status === 204) {
    console.log(`📬 Dispatched report.yaml for period ${period}`);
    return true;
  } else {
    const body = await res.text();
    console.warn(`⚠️  Dispatch failed for ${period}: ${res.status} ${body}`);
    return false;
  }
}

// ─── Fetch one period ─────────────────────────────────────────────────────────

async function fetchPeriod(period) {
  const base = `${RAW_BASE}/${period}`;
  const [info, pages, sources] = await Promise.all([
    fetchJson(`${base}/website_info.json`),
    fetchJson(`${base}/pages_info.json`),
    fetchJson(`${base}/website_dimensions_info.json`),
  ]);
  return { info, pages, sources };
}

function parsePeriodInfo(period, info) {
  const row = Array.isArray(info) ? info[0] : info;
  return {
    period,
    screenPageViews: parseInt(row.screenPageViews, 10),
    activeUsers: parseInt(row.activeUsers, 10),
    sessions: parseInt(row.sessions, 10),
    averageSessionDuration: parseFloat(
      parseFloat(row.averageSessionDuration ?? 0).toFixed(1)
    ),
    bounceRate: parseFloat(parseFloat(row.bounceRate ?? 0).toFixed(4)),
  };
}

function parseTopPages(pages) {
  if (!Array.isArray(pages)) return [];
  return pages
    .sort(
      (a, b) =>
        parseInt(b.screenPageViews, 10) - parseInt(a.screenPageViews, 10)
    )
    .slice(0, 8)
    .map((p) => ({
      pagePath: p.pagePath,
      screenPageViews: parseInt(p.screenPageViews, 10),
      activeUsers: parseInt(p.activeUsers, 10),
    }));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await mkdir(outputDir, { recursive: true });

  const allPeriods = expectedPeriods();
  console.log(
    `📅 Expected periods: ${allPeriods[0]} → ${allPeriods[allPeriods.length - 1]} (${allPeriods.length} months)`
  );

  // Load existing snapshot if not full mode
  let existing = null;
  if (!FULL_MODE) {
    try {
      const raw = await readFile(outputFile, "utf8");
      existing = JSON.parse(raw);
      console.log(
        `📂 Loaded existing snapshot (latestPeriod: ${existing.latestPeriod})`
      );
    } catch {
      console.log("📂 No existing snapshot — running full fetch");
    }
  }

  const existingByPeriod = {};
  if (existing?.monthly) {
    for (const m of existing.monthly) existingByPeriod[m.period] = m;
  }

  const monthly = [];
  let latestPages = existing?.topPages ?? [];
  let latestSources = existing?.trafficSources ?? {};
  let latestPeriod = existing?.latestPeriod ?? "";
  const dispatched = [];

  for (const period of allPeriods) {
    // In incremental mode, reuse data we already have
    if (!FULL_MODE && existingByPeriod[period]) {
      monthly.push(existingByPeriod[period]);
      continue;
    }

    process.stdout.write(`  ↓ ${period} … `);
    const { info, pages, sources } = await fetchPeriod(period);

    if (!info) {
      console.log("missing");
      const ok = await dispatchReport(period);
      if (ok) dispatched.push(period);
      continue;
    }

    const row = parsePeriodInfo(period, info);
    monthly.push(row);
    latestPeriod = period;

    // Keep latest period's pages + sources for the component
    if (pages) latestPages = parseTopPages(pages);
    if (sources) latestSources = sources;

    console.log(`${row.screenPageViews.toLocaleString()} views`);
  }

  // Recompute totals
  let totalViews = 0,
    totalUsers = 0,
    totalSessions = 0;
  let peakViews = 0,
    peakMonth = "";
  for (const m of monthly) {
    totalViews += m.screenPageViews;
    totalUsers += m.activeUsers;
    totalSessions += m.sessions;
    if (m.screenPageViews > peakViews) {
      peakViews = m.screenPageViews;
      peakMonth = m.period;
    }
  }

  const snapshot = {
    updatedAt: new Date().toISOString(),
    latestPeriod,
    totals: {
      screenPageViews: totalViews,
      activeUsers: totalUsers,
      sessions: totalSessions,
      peakMonth,
      peakViews,
    },
    monthly,
    topPages: latestPages,
    trafficSources: latestSources,
  };

  await writeFile(outputFile, JSON.stringify(snapshot, null, 2));
  console.log(`\n✅ Wrote ${outputFile}`);
  console.log(`   ${monthly.length} months · ${totalViews.toLocaleString()} total views`);

  if (dispatched.length > 0) {
    console.log(
      `\n📬 Triggered codaqui/dados report.yaml for: ${dispatched.join(", ")}`
    );
    console.log(
      "   Re-run sync:analytics after those workflows complete to include the new data."
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

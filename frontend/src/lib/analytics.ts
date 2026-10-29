// Carregamento do snapshot de analytics (/sobre/insights) com failover para o
// repositório codaqui/dados (raw.githubusercontent.com, CORS *) quando o
// snapshot same-origin /analytics/index.json falha ou veio corrompido.
// O formato raw tem números como string — o parse aqui é defensivo (mesma
// lógica do scripts/sync-analytics.mjs, que gera o snapshot consolidado).
import {
  ANALYTICS_URL,
  type AnalyticsSnapshot,
  type MonthlyMetric,
  type PageMetric,
} from "../data/analytics";

export const DADOS_RAW_BASE =
  "https://raw.githubusercontent.com/codaqui/dados/main/data";
const DADOS_LISTING_API =
  "https://api.github.com/repos/codaqui/dados/contents/data";
const FETCH_TIMEOUT_MS = 10_000;
// Fan-out limitado no modo contingência: cobre o filtro padrão (6 meses) e o
// de 12 meses sem bombardear o raw com um request por mês de histórico.
const FALLBACK_MONTHS = 12;

export interface AnalyticsLoadResult {
  snapshot: AnalyticsSnapshot;
  fromFallback: boolean;
}

/**
 * Validação de host por parsing real — `startsWith("https://api.github.com")`
 * deixa passar `https://api.github.com.evil.example/x` ou
 * `https://api.github.com@evil.example` (CodeQL
 * js/incomplete-url-substring-sanitization). Exige HTTPS (os endpoints do
 * failover são https-only) e devolve `false` em URL inválida.
 */
export function isAllowedHost(url: string, hosts: readonly string[]): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && hosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    return await res.json();
  } finally {
    clearTimeout(id);
  }
}

// ─── Parse defensivo do formato raw (codaqui/dados) ───────────────────────────

function toInt(value: unknown): number | null {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : null;
}

function toFloat(value: unknown): number | null {
  const n = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : null;
}

export function parseRawWebsiteInfo(
  period: string,
  info: unknown,
): MonthlyMetric | null {
  const row = Array.isArray(info) ? info[0] : info;
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const screenPageViews = toInt(r.screenPageViews);
  const activeUsers = toInt(r.activeUsers);
  if (screenPageViews === null || activeUsers === null) return null;
  return {
    period,
    screenPageViews,
    activeUsers,
    sessions: toInt(r.sessions) ?? 0,
    averageSessionDuration: toFloat(r.averageSessionDuration) ?? 0,
    bounceRate: toFloat(r.bounceRate) ?? 0,
  };
}

export function parseRawPages(pages: unknown): PageMetric[] {
  if (!Array.isArray(pages)) return [];
  return pages
    .map((p) => {
      const row = p as Record<string, unknown> | null;
      if (!row || typeof row !== "object") return null;
      const pagePath = String(row.pagePath ?? "");
      if (!pagePath) return null;
      return {
        pagePath,
        screenPageViews: toInt(row.screenPageViews) ?? 0,
        activeUsers: toInt(row.activeUsers) ?? 0,
      };
    })
    .filter((p): p is PageMetric => p !== null)
    .sort((a, b) => b.screenPageViews - a.screenPageViews)
    .slice(0, 8);
}

export function parseRawDimensions(dims: unknown): Record<string, number> {
  if (!dims || typeof dims !== "object" || Array.isArray(dims)) return {};
  return Object.fromEntries(
    Object.entries(dims as Record<string, unknown>)
      .map(([k, v]): [string, number] => [k, toInt(v) ?? 0])
      .filter(([, v]) => v > 0),
  );
}

export async function listRawPeriods(): Promise<string[]> {
  const data = await fetchJson(DADOS_LISTING_API);
  if (!Array.isArray(data)) throw new Error("listagem do dados repo inválida");
  return data
    .filter(
      (e): e is { type: string; name: string } =>
        !!e &&
        typeof e === "object" &&
        (e as { type?: unknown }).type === "dir" &&
        /^\d{4}-\d{2}$/.test(String((e as { name?: unknown }).name ?? "")),
    )
    .map((e) => e.name)
    .sort();
}

// ─── Normalização do snapshot consolidado (mesmo gerado pelo sync) ───────────

function computeTotals(monthly: MonthlyMetric[]): AnalyticsSnapshot["totals"] {
  let screenPageViews = 0;
  let activeUsers = 0;
  let sessions = 0;
  let peakViews = 0;
  let peakMonth = "";
  for (const m of monthly) {
    screenPageViews += m.screenPageViews;
    activeUsers += m.activeUsers;
    sessions += m.sessions;
    if (m.screenPageViews > peakViews) {
      peakViews = m.screenPageViews;
      peakMonth = m.period;
    }
  }
  return { screenPageViews, activeUsers, sessions, peakMonth, peakViews };
}

function normalizeSnapshot(raw: unknown): AnalyticsSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<AnalyticsSnapshot>;
  if (!Array.isArray(s.monthly) || s.monthly.length === 0) return null;
  if (typeof s.latestPeriod !== "string" || !s.latestPeriod) return null;
  const monthly = s.monthly.filter(
    (m): m is MonthlyMetric =>
      !!m &&
      typeof m.period === "string" &&
      typeof m.screenPageViews === "number" &&
      typeof m.activeUsers === "number",
  );
  if (monthly.length === 0) return null;
  return {
    updatedAt: typeof s.updatedAt === "string" ? s.updatedAt : "",
    latestPeriod: s.latestPeriod,
    totals:
      s.totals && typeof s.totals === "object"
        ? s.totals
        : computeTotals(monthly),
    monthly,
    topPages: Array.isArray(s.topPages) ? s.topPages : [],
    trafficSources:
      s.trafficSources &&
      typeof s.trafficSources === "object" &&
      !Array.isArray(s.trafficSources)
        ? s.trafficSources
        : {},
  };
}

// ─── Failover: reconstrói um snapshot a partir do raw do mês ──────────────────

async function loadFromRaw(): Promise<AnalyticsSnapshot> {
  const periods = (await listRawPeriods()).slice(-FALLBACK_MONTHS);
  if (periods.length === 0) throw new Error("codaqui/dados sem períodos");

  const monthly = (
    await Promise.all(
      periods.map(async (period) => {
        try {
          const info = await fetchJson(
            `${DADOS_RAW_BASE}/${period}/website_info.json`,
          );
          return parseRawWebsiteInfo(period, info);
        } catch {
          return null;
        }
      }),
    )
  ).filter((m): m is MonthlyMetric => m !== null);

  if (monthly.length === 0) throw new Error("nenhum período válido no raw");
  const latestPeriod = monthly[monthly.length - 1].period;

  const [pages, dims] = await Promise.all([
    fetchJson(`${DADOS_RAW_BASE}/${latestPeriod}/pages_info.json`).catch(
      () => null,
    ),
    fetchJson(
      `${DADOS_RAW_BASE}/${latestPeriod}/website_dimensions_info.json`,
    ).catch(() => null),
  ]);

  return {
    updatedAt: new Date().toISOString(),
    latestPeriod,
    totals: computeTotals(monthly),
    monthly,
    topPages: parseRawPages(pages),
    trafficSources: parseRawDimensions(dims),
  };
}

// ─── API pública ──────────────────────────────────────────────────────────────

export async function loadAnalyticsWithFallback(): Promise<AnalyticsLoadResult> {
  try {
    const data = await fetchJson(ANALYTICS_URL);
    const snapshot = normalizeSnapshot(data);
    if (snapshot) return { snapshot, fromFallback: false };
  } catch {
    // primário indisponível — segue para a contingência
  }
  return { snapshot: await loadFromRaw(), fromFallback: true };
}

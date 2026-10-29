import { describe, it, expect, vi, afterEach } from "vitest";
import {
  loadAnalyticsWithFallback,
  parseRawWebsiteInfo,
  parseRawPages,
  parseRawDimensions,
  DADOS_RAW_BASE,
} from "./analytics";
import { ANALYTICS_URL, type AnalyticsSnapshot } from "../data/analytics";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function snapshotFixture(): AnalyticsSnapshot {
  return {
    updatedAt: "2026-10-29T00:00:00.000Z",
    latestPeriod: "2026-09",
    totals: {
      screenPageViews: 300,
      activeUsers: 150,
      sessions: 180,
      peakMonth: "2026-09",
      peakViews: 300,
    },
    monthly: [
      {
        period: "2026-08",
        screenPageViews: 100,
        activeUsers: 50,
        sessions: 60,
        averageSessionDuration: 100,
        bounceRate: 0.5,
      },
      {
        period: "2026-09",
        screenPageViews: 200,
        activeUsers: 100,
        sessions: 120,
        averageSessionDuration: 110,
        bounceRate: 0.4,
      },
    ],
    topPages: [
      { pagePath: "/", screenPageViews: 500, activeUsers: 300 },
    ],
    trafficSources: { google: 10, "(direct)": 5 },
  };
}

const RAW_INFO = {
  screenPageViews: "3916",
  activeUsers: "1076",
  sessions: "1537",
  averageSessionDuration: "162.66",
  bounceRate: "0.4977",
};

/** Router de fetch para o modo contingência (dados repo). */
function dadosRouter(periods: string[]) {
  return vi.fn(async (url: string | URL | Request): Promise<Response> => {
    const u = String(url);
    if (u.startsWith("https://api.github.com")) {
      return jsonResponse(
        periods.map((name) => ({ name, type: "dir" })),
      );
    }
    if (u.endsWith("/website_info.json")) {
      return jsonResponse([RAW_INFO]);
    }
    if (u.endsWith("/pages_info.json")) {
      return jsonResponse([
        {
          pagePath: "/blog/x",
          screenPageViews: "739",
          activeUsers: "263",
        },
      ]);
    }
    if (u.endsWith("/website_dimensions_info.json")) {
      return jsonResponse({ google: 619, "(direct)": 784 });
    }
    throw new Error(`URL inesperada: ${u}`);
  });
}

describe("loadAnalyticsWithFallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("usa o snapshot primário quando o fetch OK (sem contingência)", async () => {
    const fixture = snapshotFixture();
    const fetchMock = vi.fn(async () => jsonResponse(fixture));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadAnalyticsWithFallback();

    expect(result.fromFallback).toBe(false);
    expect(result.snapshot.latestPeriod).toBe("2026-09");
    expect(result.snapshot.monthly).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      ANALYTICS_URL,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("contingência: primário falha → lista períodos e reconstrói do raw", async () => {
    const periods = [
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ];
    const router = dadosRouter(periods);
    const routingMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url) === ANALYTICS_URL) throw new Error("rede fora do ar");
      return router(url);
    });
    vi.stubGlobal("fetch", routingMock);

    const result = await loadAnalyticsWithFallback();

    expect(result.fromFallback).toBe(true);
    expect(result.snapshot.latestPeriod).toBe("2026-09");
    expect(result.snapshot.monthly).toHaveLength(12);
    expect(result.snapshot.monthly.map((m) => m.period)).toEqual(periods);
    // parse defensivo: strings do raw viraram números
    const last = result.snapshot.monthly.at(-1)!;
    expect(last.screenPageViews).toBe(3916);
    expect(last.activeUsers).toBe(1076);
    expect(last.sessions).toBe(1537);
    expect(last.bounceRate).toBeCloseTo(0.4977);
    expect(result.snapshot.topPages).toEqual([
      { pagePath: "/blog/x", screenPageViews: 739, activeUsers: 263 },
    ]);
    expect(result.snapshot.trafficSources).toEqual({
      google: 619,
      "(direct)": 784,
    });
    // fan-out limitado: 1 primário + 1 listagem + 12 meses + pages + dims
    expect(routingMock).toHaveBeenCalledTimes(16);
    const rawUrls = routingMock.mock.calls
      .map(([u]) => String(u))
      .filter((u) => u.startsWith(DADOS_RAW_BASE));
    expect(rawUrls).toHaveLength(14);
    expect(rawUrls.every((u) => u.endsWith(".json"))).toBe(true);
  });

  it("contingência limita o histórico aos últimos 12 períodos", async () => {
    const periods = [
      "2025-07",
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ];
    const router = dadosRouter(periods);
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url) === ANALYTICS_URL) throw new Error("down");
      return router(url);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadAnalyticsWithFallback();

    expect(result.snapshot.monthly).toHaveLength(12);
    expect(result.snapshot.monthly[0].period).toBe("2025-10");
    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(urls.some((u) => u.includes("2025-07"))).toBe(false);
    expect(urls.some((u) => u.includes("2025-08"))).toBe(false);
    expect(urls.some((u) => u.includes("2025-09"))).toBe(false);
  });

  it("contingência: primário com shape inválido → cai no raw", async () => {
    const periods = ["2026-08", "2026-09"];
    const router = dadosRouter(periods);
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url) === ANALYTICS_URL) {
        return jsonResponse({ monthly: [], latestPeriod: "" });
      }
      return router(url);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadAnalyticsWithFallback();

    expect(result.fromFallback).toBe(true);
    expect(result.snapshot.monthly).toHaveLength(2);
  });

  it("contingência: mês ausente no raw é pulado, não quebra", async () => {
    const periods = ["2026-08", "2026-09"];
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u === ANALYTICS_URL) throw new Error("down");
      if (u.startsWith("https://api.github.com")) {
        return jsonResponse(periods.map((name) => ({ name, type: "dir" })));
      }
      if (u.endsWith("/website_info.json")) {
        if (u.includes("2026-08")) return jsonResponse(null, false, 404);
        return jsonResponse([RAW_INFO]);
      }
      return dadosRouter(periods)(url);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadAnalyticsWithFallback();

    expect(result.fromFallback).toBe(true);
    expect(result.snapshot.monthly.map((m) => m.period)).toEqual(["2026-09"]);
    expect(result.snapshot.latestPeriod).toBe("2026-09");
  });

  it("lança erro quando primário E contingência falham (estado de erro visível)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const u = String(url);
        if (u === ANALYTICS_URL) throw new Error("down");
        throw new Error("github down");
      }),
    );

    await expect(loadAnalyticsWithFallback()).rejects.toThrow();
  });
});

describe("parse defensivo do formato raw", () => {
  it("parseRawWebsiteInfo coage strings e rejeita linhas inválidas", () => {
    expect(parseRawWebsiteInfo("2026-09", [RAW_INFO])).toEqual({
      period: "2026-09",
      screenPageViews: 3916,
      activeUsers: 1076,
      sessions: 1537,
      averageSessionDuration: 162.66,
      bounceRate: 0.4977,
    });
    expect(parseRawWebsiteInfo("2026-09", [])).toBeNull();
    expect(parseRawWebsiteInfo("2026-09", null)).toBeNull();
    expect(
      parseRawWebsiteInfo("2026-09", [{ screenPageViews: "abc" }]),
    ).toBeNull();
    expect(parseRawWebsiteInfo("2026-09", "lixo")).toBeNull();
  });

  it("parseRawPages ordena por views, filtra inválidos e limita a 8", () => {
    const pages = Array.from({ length: 10 }, (_, i) => ({
      pagePath: `/p${i}`,
      screenPageViews: String(100 - i * 10),
      activeUsers: "10",
    }));
    pages.push({ pagePath: "", screenPageViews: "999", activeUsers: "1" });
    const parsed = parseRawPages(pages);
    expect(parsed).toHaveLength(8);
    expect(parsed[0].pagePath).toBe("/p0");
    expect(parsed[0].screenPageViews).toBe(100);
    expect(parsed.every((p) => p.pagePath !== "")).toBe(true);
    expect(parseRawPages("não-array")).toEqual([]);
  });

  it("parseRawDimensions ignora zeros e não-objetos", () => {
    expect(parseRawDimensions({ google: "10", zero: "0", lixo: "x" })).toEqual({
      google: 10,
    });
    expect(parseRawDimensions([1, 2])).toEqual({});
    expect(parseRawDimensions(null)).toEqual({});
  });
});

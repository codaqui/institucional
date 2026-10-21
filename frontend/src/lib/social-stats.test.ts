import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildFallbackSnapshot,
  loadSocialStats,
  profilesFor,
  resolveSocialCount,
} from "./social-stats";
import type { SocialProfile, SocialStatEntry } from "../data/social-stats";

const profile: SocialProfile = {
  platform: "discord",
  handle: "@codaqui",
  url: "https://discord.com/invite/xuTtxqCPpz",
  countLabel: "membros",
  baselineCount: 100,
};

const entry: SocialStatEntry = {
  ...profile,
  entityId: "codaqui",
  count: 250,
  isFallback: false,
};

describe("resolveSocialCount", () => {
  it("usa o count do snapshot quando presente", () => {
    expect(resolveSocialCount(profile, entry)).toBe(250);
  });
  it("cai no baseline quando o snapshot não tem a entrada", () => {
    expect(resolveSocialCount(profile, undefined)).toBe(100);
  });
  it("retorna 0 quando não há entrada nem baseline", () => {
    expect(resolveSocialCount({ ...profile, baselineCount: undefined }, undefined)).toBe(0);
  });
});

describe("buildFallbackSnapshot", () => {
  it("marca todas as entradas como fallback com o baselineCount", () => {
    const snapshot = buildFallbackSnapshot();
    expect(snapshot.profiles.length).toBeGreaterThan(0);
    for (const p of snapshot.profiles) {
      expect(p.isFallback).toBe(true);
    }
    expect(snapshot.totalEvents).toBeGreaterThan(0);
  });
});

describe("profilesFor", () => {
  it("filtra as entradas pelo entityId", () => {
    const snapshot = buildFallbackSnapshot();
    const codaqui = profilesFor(snapshot, "codaqui");
    expect(codaqui.length).toBeGreaterThan(0);
    expect(codaqui.every((p) => p.entityId === "codaqui")).toBe(true);
  });
});

describe("loadSocialStats", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "social-stats-"));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  const FIXTURE = {
    generatedAt: "2026-10-21T00:00:00.000Z",
    totalEvents: 999,
    profiles: [
      {
        entityId: "codaqui",
        platform: "discord",
        handle: "@codaqui",
        url: "https://discord.com/invite/xuTtxqCPpz",
        countLabel: "membros",
        baselineCount: 100,
        count: 4242,
        isFallback: false,
        fetchedAt: "2026-10-21T00:00:00.000Z",
      },
    ],
  };

  it("caminho feliz: lê o count real do arquivo, não o baseline", () => {
    const fixturePath = join(tmpDir, "index.json");
    writeFileSync(fixturePath, JSON.stringify(FIXTURE));

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const snapshot = loadSocialStats(fixturePath);

    // 4242 só existe na fixture; 100 seria o baseline — prova que leu o arquivo.
    expect(snapshot.profiles[0].count).toBe(4242);
    expect(snapshot.totalEvents).toBe(999);
    expect(warn).not.toHaveBeenCalled();
  });

  it("fallback por JSON inválido: baselines + warn com o path tentado", () => {
    const fixturePath = join(tmpDir, "index.json");
    writeFileSync(fixturePath, "{ not json");

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const snapshot = loadSocialStats(fixturePath);

    expect(snapshot.profiles.every((p) => p.isFallback)).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain(fixturePath);
  });

  it("fallback por shape inválido (profiles não-array): baselines + warn", () => {
    const fixturePath = join(tmpDir, "index.json");
    writeFileSync(fixturePath, JSON.stringify({ totalEvents: "oops" }));

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const snapshot = loadSocialStats(fixturePath);

    expect(snapshot.profiles.every((p) => p.isFallback)).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("fallback por arquivo ausente: baselines + warn", () => {
    const missingPath = join(tmpDir, "nao-existe.json");

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const snapshot = loadSocialStats(missingPath);

    expect(snapshot.profiles.length).toBeGreaterThan(0);
    expect(snapshot.profiles.every((p) => p.isFallback)).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain(missingPath);
  });
});

import { describe, expect, it } from "vitest";
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
  it("retorna um snapshot válido (arquivo copiado ou fallback)", () => {
    const snapshot = loadSocialStats();
    expect(typeof snapshot.totalEvents).toBe("number");
    expect(Array.isArray(snapshot.profiles)).toBe(true);
    expect(snapshot.profiles.length).toBeGreaterThan(0);
  });
});

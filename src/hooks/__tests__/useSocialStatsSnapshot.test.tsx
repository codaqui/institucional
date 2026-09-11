/**
 * Tests para useSocialStatsSnapshot.
 *
 * O hook inicializa com um snapshot fallback (baselines manuais de
 * src/data) e busca SOCIAL_STATS_URL no mount; em erro, mantém o fallback.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { useSocialStatsSnapshot } from "../useSocialStatsSnapshot";
import { jsonResponse } from "../../test-utils/http";
import {
  BASELINE_TOTAL_EVENTS,
  SOCIAL_STATS_URL,
  type SocialStatsSnapshot,
} from "../../data/social-stats";
import { communities } from "../../data/communities";
import { codaquiSocialProfiles } from "../../data/social";

const fetchMock = jest.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

const expectedFallbackProfiles =
  codaquiSocialProfiles.length +
  communities.reduce((acc, c) => acc + (c.socialProfiles?.length ?? 0), 0);

function makeRemoteSnapshot(): SocialStatsSnapshot {
  return {
    generatedAt: "2026-09-10T00:00:00.000Z",
    totalEvents: 400,
    profiles: [
      {
        platform: "discord",
        handle: "codaqui",
        url: "https://discord.com/invite/xuTtxqCPpz",
        countLabel: "membros",
        entityId: "codaqui",
        count: 999,
        isFallback: false,
        fetchedAt: "2026-09-10T00:00:00.000Z",
      },
    ],
  };
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("useSocialStatsSnapshot", () => {
  it("inicializa com o snapshot fallback (baselines manuais)", async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeRemoteSnapshot()));

    const { result } = renderHook(() => useSocialStatsSnapshot());

    // Antes do fetch resolver já existe um snapshot utilizável
    expect(result.current.snapshot.totalEvents).toBe(BASELINE_TOTAL_EVENTS);
    expect(result.current.snapshot.profiles).toHaveLength(expectedFallbackProfiles);
    expect(result.current.snapshot.profiles.every((p) => p.isFallback)).toBe(true);

    await waitFor(() =>
      expect(result.current.snapshot.generatedAt).toBe("2026-09-10T00:00:00.000Z"),
    );
  });

  it("substitui o fallback pelo snapshot remoto quando o fetch tem sucesso", async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeRemoteSnapshot()));

    const { result } = renderHook(() => useSocialStatsSnapshot());

    await waitFor(() => expect(result.current.snapshot.totalEvents).toBe(400));

    expect(fetchMock).toHaveBeenCalledWith(SOCIAL_STATS_URL);
    expect(result.current.snapshot.profiles[0].count).toBe(999);
    expect(result.current.snapshot.profiles[0].isFallback).toBe(false);
  });

  it("mantém o fallback quando o fetch falha", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useSocialStatsSnapshot());

    await waitFor(() => expect(consoleSpy).toHaveBeenCalled());

    expect(result.current.snapshot.totalEvents).toBe(BASELINE_TOTAL_EVENTS);
    expect(result.current.snapshot.profiles).toHaveLength(expectedFallbackProfiles);
    consoleSpy.mockRestore();
  });

  it("profilesFor filtra por entityId", async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeRemoteSnapshot()));

    const { result } = renderHook(() => useSocialStatsSnapshot());
    await waitFor(() => expect(result.current.snapshot.totalEvents).toBe(400));

    expect(result.current.profilesFor("codaqui")).toHaveLength(1);
    expect(result.current.profilesFor("codaqui")[0].handle).toBe("codaqui");
    expect(result.current.profilesFor("inexistente")).toEqual([]);
  });
});

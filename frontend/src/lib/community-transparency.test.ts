import { describe, expect, it, vi } from "vitest";
import { fetchCommunityTransparency } from "./community-transparency";

const payload = {
  community: { slug: "tisocial", name: "T.I. Social" },
  responsible: null,
  year: 2026,
  availableYears: [2025, 2026],
  metrics: { events: 2, participations: 30, certificates: 10, eventHours: 4.5 },
  upcomingActivities: [],
  recentActivities: [],
};

describe("fetchCommunityTransparency", () => {
  it("loads and validates the public projection for an event year", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await expect(fetchCommunityTransparency("https://api.test", "tisocial", 2026, controller.signal))
      .resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/communities/public/tisocial/transparency?year=2026",
      { signal: controller.signal },
    );
    vi.unstubAllGlobals();
  });

  it.each([
    ["HTTP failure", new Response("{}", { status: 503 })],
    ["invalid payload", new Response(JSON.stringify({ ...payload, metrics: null }), { status: 200 })],
  ])("rejects %s instead of rendering fabricated zeros", async (_label, response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(fetchCommunityTransparency("https://api.test", "tisocial"))
      .rejects.toThrow();
    vi.unstubAllGlobals();
  });
});

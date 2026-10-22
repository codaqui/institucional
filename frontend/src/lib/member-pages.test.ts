import { describe, it, expect, vi, afterEach } from "vitest";
import { loadPublicMembers } from "./member-pages";
import type { PublicMemberProfile } from "./member-path";

function member(id: string, handle: string): PublicMemberProfile {
  return {
    id,
    githubHandle: handle,
    name: `Membro ${handle}`,
    avatarUrl: `https://avatars.githubusercontent.com/${handle}?v=4`,
    bio: null,
    linkedinUrl: null,
    roles: ["membro"],
    joinedAt: "2024-01-01T00:00:00.000Z",
  };
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("loadPublicMembers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("agrega páginas até totalPages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: [member("1", "ana")], totalPages: 2 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: [member("2", "bia")], totalPages: 2 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const members = await loadPublicMembers("https://api.test");

    expect(members.map((m) => m.githubHandle)).toEqual(["ana", "bia"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.test/members?limit=100&page=1",
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.test/members?limit=100&page=2",
    );
  });

  it("retorna [] com warn quando o fetch falha (não quebra o build)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );

    const members = await loadPublicMembers("https://api.test");

    expect(members).toEqual([]);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("retorna [] com warn quando a API responde HTTP não-ok", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({}, false, 500)),
    );

    const members = await loadPublicMembers("https://api.test");

    expect(members).toEqual([]);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("tolera payload sem data/totalPages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({})));

    const members = await loadPublicMembers("https://api.test");

    expect(members).toEqual([]);
  });
});

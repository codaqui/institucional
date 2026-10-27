// @vitest-environment jsdom
// renderHook precisa de DOM; o glob do vitest.config só envia *.test.tsx para
// jsdom, e este arquivo segue o padrão do use-auth-roles.test.ts (.test.ts).
//
// C5 (QA wave Fase 0.5): useAuth deve resolver a base da API via
// resolveApiUrl (mesmo padrão das ilhas) — não pelo API_URL direto. Em
// builds tenant o guard PUBLIC_TENANT força same-origin; com API_URL cru o
// login/fetch das ilhas apontava para o fallback de build.
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const resolveApiUrlMock = vi.hoisted(() => vi.fn(() => "https://tenant.example"));

vi.mock("./api-url", () => ({
  resolveApiUrl: resolveApiUrlMock,
}));

import { useAuth } from "./use-auth";

const meResponse = new Response(
  JSON.stringify({
    sub: "uuid",
    githubId: "1",
    handle: "octocat",
    name: "Octo",
    avatarUrl: "https://x",
    roles: ["membro"],
  }),
  { status: 200 },
);

describe("useAuth — base de API resolvida (C5)", () => {
  beforeEach(() => {
    resolveApiUrlMock.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => meResponse.clone()),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchMe usa a URL resolvida por resolveApiUrl(SITE)", async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(resolveApiUrlMock).toHaveBeenCalledWith(import.meta.env.SITE);
    expect(fetch).toHaveBeenCalledWith("https://tenant.example/auth/me", {
      credentials: "include",
    });
    expect(result.current.isLoggedIn).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { matchesDynamicRoute } from "./url-walk.mjs";

const pages = [
  "/app/src/pages/assembleias/[entitySlug]/[slug].astro",
  "/app/src/pages/eventos/[...path].astro",
  "/app/src/pages/projetos/[slug].astro",
];

describe("matchesDynamicRoute", () => {
  it("matches a splat target against nested dynamic segments with an empty snapshot", () => {
    expect(matchesDynamicRoute("/assembleias/codaqui/:splat", pages, "/app/src/pages")).toBe(true);
  });

  it("matches rest parameters only at their declared route prefix", () => {
    expect(matchesDynamicRoute("/eventos/meetup/devparana/123", pages, "/app/src/pages")).toBe(true);
    expect(matchesDynamicRoute("/assembleias/codaqui/ordinaria-1/extra", pages, "/app/src/pages")).toBe(false);
  });

  it("rejects targets without a matching dynamic route", () => {
    expect(matchesDynamicRoute("/assembleias/codaqui/:splat", pages.slice(1), "/app/src/pages")).toBe(false);
    expect(matchesDynamicRoute("/projetos/outro/extra", pages, "/app/src/pages")).toBe(false);
  });
});

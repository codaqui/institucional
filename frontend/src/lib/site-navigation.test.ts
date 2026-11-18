import { describe, expect, it } from "vitest";
import {
  FOOTER_NAVIGATION,
  INTEGRATE_COMMUNITY_LINK,
  SITE_NAVIGATION,
  isNavigationCurrent,
} from "./site-navigation";

describe("isNavigationCurrent", () => {
  it.each([
    ["/comunidades/devparana", "/comunidades", true],
    ["/eventos/foo", "/eventos", true],
    ["/transparencia/", "/transparencia", true],
    ["/", "/", true],
    ["/", "/comunidades", false],
    ["/eventos-legado", "/eventos", false],
    ["/comunidades", "/comunidades", true],
  ])("matches %s against %s as %s", (pathname, href, expected) => {
    expect(isNavigationCurrent(pathname, href)).toBe(expected);
  });
});

describe("journey navigation", () => {
  it("exposes the five public journeys and the community integration action", () => {
    expect(SITE_NAVIGATION.map(({ label, href }) => [label, href])).toEqual([
      ["Comunidades", "/comunidades"],
      ["Atividades", "/eventos"],
      ["Transparência", "/transparencia"],
      ["Aprender", "/participe/estudar"],
      ["Apoiar", "/participe/apoiar"],
    ]);
    expect(INTEGRATE_COMMUNITY_LINK).toEqual({
      label: "Integrar minha comunidade",
      href: "/sobre/ong",
    });
  });

  it("keeps secondary destinations reachable from the footer", () => {
    const hrefs = FOOTER_NAVIGATION.flatMap((group) =>
      group.links.map((link) => link.href),
    );
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/blog",
        "/projetos",
        "/patrocinadores",
        "/c4p",
        "/contato",
        "/sobre/ong",
        "/trilhas",
      ]),
    );
  });
});

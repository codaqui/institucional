import { describe, expect, it } from "vitest";
import {
  FOOTER_NAVIGATION,
  INTEGRATE_COMMUNITY_LINK,
  SITE_NAVIGATION,
  isNavigationCurrent,
  isNavigationItemCurrent,
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
  it("exposes direct journeys and discovery groups without a dedicated C4P item", () => {
    expect(SITE_NAVIGATION).toEqual([
      { kind: "link", label: "Comunidades", href: "/comunidades" },
      { kind: "link", label: "Atividades", href: "/eventos" },
      {
        kind: "group",
        label: "Aprender",
        links: [
          { label: "Visão geral", href: "/participe/estudar" },
          { label: "Trilhas", href: "/trilhas" },
          { label: "Mentoria", href: "/participe/mentoria" },
        ],
      },
      {
        kind: "group",
        label: "Explorar",
        links: [
          { label: "Projetos", href: "/projetos" },
          { label: "Blog", href: "/blog" },
        ],
      },
      { kind: "link", label: "Transparência", href: "/transparencia" },
      { kind: "link", label: "Apoiar", href: "/participe/apoiar" },
    ]);
    expect(JSON.stringify(SITE_NAVIGATION)).not.toContain('"C4P"');
    expect(INTEGRATE_COMMUNITY_LINK).toEqual({
      label: "Integrar minha comunidade",
      href: "/sobre/ong",
    });
  });

  it("marks a group current when any child destination is active", () => {
    const learn = SITE_NAVIGATION.find((item) => item.label === "Aprender");
    const explore = SITE_NAVIGATION.find((item) => item.label === "Explorar");
    expect(learn && isNavigationItemCurrent("/trilhas/python", learn)).toBe(true);
    expect(learn && isNavigationItemCurrent("/participe/mentoria", learn)).toBe(true);
    expect(explore && isNavigationItemCurrent("/blog/2026/10/post", explore)).toBe(true);
    expect(explore && isNavigationItemCurrent("/eventos", explore)).toBe(false);
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

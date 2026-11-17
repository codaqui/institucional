import { describe, expect, it } from "vitest";
import type { CommunityIndexEntry } from "./communities";
import { listCommunityPortals, type TenantDefinition } from "./community-portals";

function communityFixture(
  slug = "devparana",
  overrides: Partial<CommunityIndexEntry> = {},
): CommunityIndexEntry {
  return {
    id: `community-${slug}`,
    slug,
    name: `Nome público ${slug}`,
    description: `Descrição pública ${slug}`,
    emoji: "👥",
    logo: `/img/${slug}.svg`,
    location: null,
    founded: null,
    links: [],
    socialProfiles: [],
    tags: [],
    level: "integrada",
    status: "active",
    sealStatus: "none",
    sealGrantedAt: null,
    sealGrantedById: null,
    sealValidUntil: null,
    sealNotes: null,
    siteEnabled: true,
    siteDomain: null,
    responsible: null,
    ...overrides,
  };
}

function tenantFixture(slug = "devparana"): TenantDefinition {
  return {
    tenant: slug,
    community: slug,
    site: `https://${slug}.example.org`,
    project: slug,
  };
}

describe("listCommunityPortals", () => {
  it("joins an active site-enabled community with its configured tenant", () => {
    expect(listCommunityPortals([communityFixture()], [tenantFixture()])).toEqual([
      {
        slug: "devparana",
        name: "Nome público devparana",
        tagline: "Comunidade de pessoas desenvolvedoras de software do Paraná.",
        description: "Descrição pública devparana",
        logoUrl: "/img/devparana.svg",
        logoUrlDark:
          "https://avatars.githubusercontent.com/u/15199454?s=200&v=4",
        href: "https://devparana.example.org",
      },
    ]);
  });

  it("omits inactive, site-disabled and unconfigured communities", () => {
    expect(
      listCommunityPortals(
        [
          communityFixture("inactive", { status: "suspended" }),
          communityFixture("without-site", { siteEnabled: false }),
          communityFixture("missing-tenant"),
        ],
        [tenantFixture("inactive"), tenantFixture("without-site")],
      ),
    ).toEqual([]);
  });

  it("uses visual fallbacks without requiring local branding", () => {
    expect(listCommunityPortals([communityFixture("newcommunity")], [tenantFixture("newcommunity")])).toEqual([
      {
        slug: "newcommunity",
        name: "Nome público newcommunity",
        tagline: "",
        description: "Descrição pública newcommunity",
        logoUrl: "/img/newcommunity.svg",
        logoUrlDark: "/img/newcommunity.svg",
        href: "https://newcommunity.example.org",
      },
    ]);
  });

  it("preserves tenant order and deduplicates repeated inputs", () => {
    const first = communityFixture("first");
    const second = communityFixture("second");

    expect(
      listCommunityPortals(
        [first, first, second],
        [tenantFixture("second"), tenantFixture("first"), tenantFixture("first")],
      ).map((portal) => portal.slug),
    ).toEqual(["second", "first"]);
  });
});

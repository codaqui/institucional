import { TENANTS } from "../../tenants.config.mjs";
import { communityPortalBranding } from "../data/community-portals";
import type { CommunityIndexEntry } from "./communities";

export interface TenantDefinition {
  tenant: string;
  community: string;
  site: string;
  project: string;
}

export interface CommunityPortalView {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  logoUrl: string;
  logoUrlDark: string;
  href: string;
}

export function listCommunityPortals(
  communities: CommunityIndexEntry[],
  tenants: TenantDefinition[] = TENANTS,
): CommunityPortalView[] {
  const seen = new Set<string>();
  const portals: CommunityPortalView[] = [];

  for (const tenant of tenants) {
    if (seen.has(tenant.community)) continue;
    const community = communities.find(
      (candidate) =>
        candidate.slug === tenant.community &&
        candidate.status === "active" &&
        candidate.siteEnabled,
    );
    if (!community) continue;

    seen.add(tenant.community);
    const branding = communityPortalBranding.find(
      (candidate) => candidate.slug === community.slug,
    );
    portals.push({
      slug: community.slug,
      name: community.name,
      tagline: branding?.tagline ?? "",
      description: community.description,
      logoUrl: community.logo,
      logoUrlDark: branding?.logoUrlDark ?? community.logo,
      href: tenant.site,
    });
  }

  return portals;
}

/**
 * Resolve which community (if any) is active for a given pathname.
 * Used by Navbar/Logo, Footer and BlogLayout swizzles to render
 * community-specific branding without leaving the main Docusaurus build.
 *
 * The list of communities lives in `comunidades/index.ts` so it's shared
 * with `docusaurus.config.ts` (which uses it to generate plugin entries).
 */

import { COMMUNITIES_CONFIG } from "@site/comunidades";
import type { CommunitySiteConfig } from "@site/comunidades";

export function resolveCommunityFromPath(
  pathname: string | undefined,
): CommunitySiteConfig | null {
  if (!pathname) return null;
  return (
    COMMUNITIES_CONFIG.find(
      (c) => pathname === c.basePath || pathname.startsWith(`${c.basePath}/`),
    ) ?? null
  );
}

export type { CommunitySiteConfig } from "@site/comunidades";


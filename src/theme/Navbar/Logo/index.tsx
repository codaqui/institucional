import React from "react";
import { useLocation } from "@docusaurus/router";
import OriginalLogo from "@theme-original/Navbar/Logo";
import Link from "@docusaurus/Link";
import { resolveCommunityFromPath } from "@site/src/lib/community-context";

export default function LogoWrapper(props: React.ComponentProps<typeof OriginalLogo>): React.JSX.Element {
  const { pathname } = useLocation();
  const community = resolveCommunityFromPath(pathname);

  if (!community) {
    return <OriginalLogo {...props} />;
  }

  return (
    <Link
      to={community.basePath}
      className="navbar__brand"
      style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
    >
      <img
        src={community.logoUrl}
        alt={`${community.name} — comunidade parceira da Codaqui`}
        height={36}
        style={{ display: "block" }}
      />
      <span
        style={{
          fontWeight: 700,
          fontSize: "0.95rem",
          color: "var(--ifm-navbar-link-color)",
          lineHeight: 1.1,
        }}
      >
        {community.shortName}
      </span>
    </Link>
  );
}

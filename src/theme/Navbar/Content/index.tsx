import React from "react";
import clsx from "clsx";
import { useLocation } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { resolveCodaquiUrl } from "@site/src/lib/api-url";
import {
  useThemeConfig,
  ErrorCauseBoundary,
  ThemeClassNames,
} from "@docusaurus/theme-common";
import {
  splitNavbarItems,
  useNavbarMobileSidebar,
} from "@docusaurus/theme-common/internal";
import NavbarItem from "@theme/NavbarItem";
import NavbarColorModeToggle from "@theme/Navbar/ColorModeToggle";
import SearchBar from "@theme/SearchBar";
import NavbarMobileSidebarToggle from "@theme/Navbar/MobileSidebar/Toggle";
import NavbarLogo from "@theme/Navbar/Logo";
import NavbarSearch from "@theme/Navbar/Search";
import Chip from "@mui/material/Chip";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import styles from "./styles.module.css";
import {
  resolveCommunityFromPath,
  type CommunitySiteConfig,
} from "@site/src/lib/community-context";

interface AnyNavItem {
  type?: string;
  position?: "left" | "right";
  [key: string]: unknown;
}

function useNavbarItems(): AnyNavItem[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (useThemeConfig() as any).navbar.items as AnyNavItem[];
}

function NavbarItems({ items }: Readonly<{ items: AnyNavItem[] }>) {
  return (
    <>
      {items.map((item, i) => (
        <ErrorCauseBoundary
          key={`${item.type ?? "item"}-${(item.label as string) ?? (item.to as string) ?? i}`}
          onError={(error) =>
            new Error(
              `A theme navbar item failed to render.\n${JSON.stringify(item, null, 2)}`,
              { cause: error },
            )
          }
        >
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <NavbarItem {...(item as any)} />
        </ErrorCauseBoundary>
      ))}
    </>
  );
}

function NavbarContentLayout({
  left,
  right,
}: Readonly<{
  left: React.ReactNode;
  right: React.ReactNode;
}>) {
  return (
    <div className="navbar__inner">
      <div
        className={clsx(
          ThemeClassNames.layout.navbar.containerLeft,
          "navbar__items",
        )}
      >
        {left}
      </div>
      <div
        className={clsx(
          ThemeClassNames.layout.navbar.containerRight,
          "navbar__items navbar__items--right",
        )}
      >
        {right}
      </div>
    </div>
  );
}

function buildCommunityItems(community: CommunitySiteConfig): AnyNavItem[] {
  const left: AnyNavItem[] = community.navMenu.map((item) => ({
    label: item.label,
    to: item.to,
    position: "left" as const,
    activeBaseRegex:
      item.to === community.basePath ? `^${community.basePath}/?$` : undefined,
  }));
  // Auth (login/logout) intentionally omitted in community context — preparing
  // for future custom-domain deployments where the auth cookie won't be shared.
  return left;
}

function CodaquiBackChip() {
  const { siteConfig } = useDocusaurusContext();
  // Adapta ao ambiente: em dev (`*.localhost`) volta pro `localhost:3000`;
  // em prod volta para `siteConfig.url` (codaqui.dev).
  const codaquiHref = resolveCodaquiUrl(siteConfig.url, siteConfig.baseUrl);
  return (
    <a
      href={codaquiHref}
      style={{ textDecoration: "none", display: "inline-flex", marginRight: 8 }}
      aria-label="Voltar para o site da Codaqui"
    >
      <Chip
        icon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
        label="Codaqui"
        size="small"
        variant="outlined"
        clickable
        sx={{
          fontWeight: 600,
          borderColor: "primary.main",
          color: "primary.main",
          "& .MuiChip-icon": { color: "primary.main" },
          "&:hover": {
            backgroundColor: "primary.main",
            color: "primary.contrastText",
            "& .MuiChip-icon": { color: "primary.contrastText" },
          },
        }}
      />
    </a>
  );
}

export default function NavbarContent(): React.JSX.Element {
  const mobileSidebar = useNavbarMobileSidebar();
  const { pathname } = useLocation();
  const community = resolveCommunityFromPath(pathname);
  const defaultItems = useNavbarItems();
  const items = community ? buildCommunityItems(community) : defaultItems;
  const [leftItems, rightItems] = splitNavbarItems(
    items as Parameters<typeof splitNavbarItems>[0],
  );
  const searchBarItem = items.find((item) => item.type === "search");
  return (
    <NavbarContentLayout
      left={
        <>
          {!mobileSidebar.disabled && <NavbarMobileSidebarToggle />}
          <NavbarLogo />
          <NavbarItems items={leftItems as AnyNavItem[]} />
        </>
      }
      right={
        <>
          {community && <CodaquiBackChip />}
          <NavbarItems items={rightItems as AnyNavItem[]} />
          <NavbarColorModeToggle className={styles.colorModeToggle} />
          {!searchBarItem && (
            <NavbarSearch>
              <SearchBar />
            </NavbarSearch>
          )}
        </>
      }
    />
  );
}

import React from "react";
import { useLocation } from "@docusaurus/router";
import OriginalPrimaryMenu from "@theme-original/Navbar/MobileSidebar/PrimaryMenu";
import { useNavbarMobileSidebar } from "@docusaurus/theme-common/internal";
import NavbarItem from "@theme/NavbarItem";
import { resolveCommunityFromPath } from "@site/src/lib/community-context";

/**
 * Swizzle de NavbarMobileSidebar/PrimaryMenu.
 *
 * Quando o usuário está em uma página de comunidade (/comunidades/<slug>/*),
 * exibe os itens do navMenu da comunidade em vez do menu principal da Codaqui.
 * Fora de contexto de comunidade, delega ao componente original.
 */
export default function PrimaryMenuWrapper(): React.JSX.Element {
  const { pathname } = useLocation();
  const community = resolveCommunityFromPath(pathname);
  const mobileSidebar = useNavbarMobileSidebar();

  if (!community) {
    return <OriginalPrimaryMenu />;
  }

  const items = community.navMenu.map((item) => ({
    label: item.label,
    to: item.to,
    activeBaseRegex:
      item.to === community.basePath ? `^${community.basePath}/?$` : undefined,
  }));

  return (
    <ul className="menu__list">
      {items.map((item) => (
        <NavbarItem
          key={item.to}
          mobile
          {...item}
          onClick={() => mobileSidebar.toggle()}
        />
      ))}
    </ul>
  );
}

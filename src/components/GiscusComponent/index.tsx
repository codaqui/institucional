import React from "react";
import Giscus from "@giscus/react";
import { useColorMode } from "@docusaurus/theme-common";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";

/**
 * Wrapper around @giscus/react that:
 * - Reads configuration from docusaurus.config themeConfig.giscus
 * - Automatically syncs the Giscus theme with the site color mode
 */
export default function GiscusComponent(): React.JSX.Element {
  const { colorMode } = useColorMode();
  const { siteConfig } = useDocusaurusContext();
  const giscusConfig = siteConfig.themeConfig.giscus as Record<string, string>;

  return (
    <Giscus
      repo={giscusConfig.repo as `${string}/${string}`}
      repoId={giscusConfig.repoId}
      category={giscusConfig.category}
      categoryId={giscusConfig.categoryId}
      mapping={giscusConfig.mapping as "url" | "og:title" | "specific" | "number" | "pathname" | "title"}
      strict={giscusConfig.strict as "0" | "1"}
      reactionsEnabled={giscusConfig.reactionsEnabled as "0" | "1"}
      emitMetadata={giscusConfig.emitMetadata as "0" | "1"}
      inputPosition={giscusConfig.inputPosition as "top" | "bottom"}
      theme={colorMode === "dark" ? "dark" : "light"}
      lang={giscusConfig.lang}
      loading="lazy"
    />
  );
}

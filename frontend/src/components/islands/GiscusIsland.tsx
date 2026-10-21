import { useEffect, useState } from "react";
import Giscus from "@giscus/react";
import { GISCUS_CONFIG } from "../../data/giscus";

export default function GiscusIsland() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const read = () =>
      document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    setTheme(read());
    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return (
    <Giscus
      repo={GISCUS_CONFIG.repo}
      repoId={GISCUS_CONFIG.repoId}
      category={GISCUS_CONFIG.category}
      categoryId={GISCUS_CONFIG.categoryId}
      mapping="og:title"
      strict="0"
      reactionsEnabled="1"
      emitMetadata="1"
      inputPosition="bottom"
      theme={theme}
      lang="pt"
      loading="lazy"
    />
  );
}

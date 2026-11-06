import { useEffect, useState } from "react";
import Giscus from "@giscus/react";
import { GISCUS_CONFIG, type GiscusConfig } from "../../data/giscus";

interface GiscusIslandProps {
  config?: GiscusConfig;
}

export default function GiscusIsland({ config = GISCUS_CONFIG }: Readonly<GiscusIslandProps>) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const read = () =>
      document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(read());
    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return <Giscus {...config} theme={theme} loading="lazy" />;
}

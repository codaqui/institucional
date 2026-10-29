import { useEffect, useState } from "react";
import Giscus from "@giscus/react";
import { GISCUS_CONFIG } from "../../data/giscus";

export default function GiscusIsland() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const read = () =>
      document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(read());
    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return <Giscus {...GISCUS_CONFIG} theme={theme} loading="lazy" />;
}

import { useEffect, useState, type ReactNode } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { createCodaquiTheme } from "../../lib/mui-theme";

/**
 * Envolve ilhas MUI. Lê `data-theme` do <html> (setado pelo script
 * anti-FOUC do BaseLayout) e reage a mudanças via MutationObserver.
 * Ilhas React rodam só no client (client:only/client:load) — sem SSR,
 * portanto sem a restrição do useColorMode do Docusaurus.
 */
export default function MuiIslandProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const getMode = () =>
      document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setMode(getMode());
    const observer = new MutationObserver(() => setMode(getMode()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <ThemeProvider theme={createCodaquiTheme(mode)}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}

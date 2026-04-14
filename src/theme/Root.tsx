import React, { useState, useEffect } from "react";
import { ThemeProvider } from "@mui/material";
import { createCodaquiTheme } from "./muiTheme";
import ApiHealthBanner from "../components/ApiHealthBanner";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";

function ApiHealthCheck() {
  const { siteConfig } = useDocusaurusContext();
  const apiUrl =
    (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";

  return <ApiHealthBanner apiUrl={apiUrl} />;
}

function MuiThemeWrapper({ children }: Readonly<{ children: React.ReactNode }>) {
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const getMode = (): "light" | "dark" =>
      document.documentElement.dataset.theme === "dark"
        ? "dark"
        : "light";

    setMode(getMode());

    const observer = new MutationObserver(() => setMode(getMode()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const theme = createCodaquiTheme(mode);
  return (
    <ThemeProvider theme={theme}>
      <ApiHealthCheck />
      {children}
    </ThemeProvider>
  );
}

export default function Root({ children }: Readonly<{ children: React.ReactNode }>) {
  return <MuiThemeWrapper>{children}</MuiThemeWrapper>;
}


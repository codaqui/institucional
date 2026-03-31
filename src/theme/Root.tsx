import React, { useState, useEffect } from "react";
import { ThemeProvider } from "@mui/material";
import { createCodaquiTheme } from "./muiTheme";

function MuiThemeWrapper({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const getMode = (): "light" | "dark" =>
      document.documentElement.getAttribute("data-theme") === "dark"
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
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

export default function Root({ children }: { children: React.ReactNode }) {
  return <MuiThemeWrapper>{children}</MuiThemeWrapper>;
}


import { createTheme, type Theme } from "@mui/material/styles";

export function createCodaquiTheme(mode: "light" | "dark"): Theme {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: "#22c55e",
        dark: "#16a34a",
        light: "#4ade80",
        contrastText: "#ffffff",
      },
      secondary: {
        main: "#0ea5e9",
        dark: "#0284c7",
        light: "#38bdf8",
        contrastText: "#ffffff",
      },
      background: {
        default: mode === "dark" ? "#1b1b1d" : "#ffffff",
        paper: mode === "dark" ? "#242526" : "#ffffff",
      },
    },
    typography: {
      fontFamily:
        "var(--ifm-font-family-base, system-ui, -apple-system, sans-serif)",
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
      },
    },
  });
}

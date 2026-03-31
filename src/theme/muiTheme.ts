import { createTheme, type Theme } from "@mui/material/styles";

/**
 * Codaqui brand palette:
 *   #57B593 — teal green (primary)
 *   #3A2F39 — dark plum (dark mode backgrounds)
 *   #F8F8F8 — near-white (light mode background)
 */

const BRAND = {
  primary: "#57B593",
  primaryDark: "#4AA07A",
  primaryDarker: "#3D8A68",
  primaryLight: "#6DC4A5",
  primaryLighter: "#87D2B7",
  darkBg: "#2A2130",       // darker variant of #3A2F39 for default bg
  darkPaper: "#3A2F39",    // dark plum for cards/paper
  lightBg: "#F8F8F8",
  lightPaper: "#FFFFFF",
};

export function createCodaquiTheme(mode: "light" | "dark"): Theme {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: BRAND.primary,
        dark: BRAND.primaryDark,
        light: BRAND.primaryLight,
        contrastText: "#ffffff",
      },
      secondary: {
        main: BRAND.primaryLighter,
        dark: BRAND.primaryDark,
        light: "#ABE0CB",
        contrastText: "#3A2F39",
      },
      background: {
        default: mode === "dark" ? BRAND.darkBg : BRAND.lightBg,
        paper: mode === "dark" ? BRAND.darkPaper : BRAND.lightPaper,
      },
      ...(mode === "dark" && {
        text: {
          primary: "#F0EDF2",
          secondary: "#C9BFD1",
          disabled: "#7A6F80",
        },
      }),
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
      MuiChip: {
        styleOverrides: {
          colorPrimary: {
            backgroundColor: mode === "dark" ? BRAND.primaryDarker : BRAND.primary,
            color: "#ffffff",
          },
        },
      },
    },
  });
}

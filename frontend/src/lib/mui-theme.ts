import { createTheme, type Theme } from "@mui/material/styles";

/** Tema MUI do Design System Codaqui — espelha src/styles/tokens.css (fonte única). */

/** Primitivos — idênticos aos tokens --cq-color-* do CSS */
export const cqColors = {
  primary: {
    50: "#EEF8F4",
    100: "#DAEFE7",
    200: "#B3DECE",
    300: "#89CBB3",
    400: "#6FBFA2",
    500: "#57B593", // marca — uso decorativo/grandes áreas
    600: "#499F81",
    700: "#378369", // texto normal AA sobre claro (4.55:1)
    800: "#2C6753", // links / AAA (6.62:1)
    900: "#1C4538", // texto sobre verdes claros (10.73:1)
  },
  neutral: {
    50: "#F9F9F9",
    100: "#F1F0F1",
    200: "#E1E0E1",
    300: "#C8C5C8",
    400: "#A6A1A6",
    500: "#857E84",
    600: "#696169",
    700: "#524851",
    800: "#3A2F39", // ameixa da marca
    900: "#20181F",
  },
  info: "#2F6FED",
  success: "#2C7A4B",
  warning: "#B45309",
  error: "#C0392B",
  // Variantes dark — ≥4.5:1 sobre os -bg escuros (espelha tokens.css)
  infoDark: "#8FB3F9",
  successDark: "#5CB87A",
  warningDark: "#E8963C",
  errorDark: "#E8826F",
} as const;

/* Escala tipográfica modular 1.25 (base 16px) */
const typeScale = {
  h1: { fontSize: "3rem", fontWeight: 800, lineHeight: 1.2 },
  h2: { fontSize: "2.25rem", fontWeight: 700, lineHeight: 1.2 },
  h3: { fontSize: "1.875rem", fontWeight: 700, lineHeight: 1.25 },
  h4: { fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.3 },
  h5: { fontSize: "1.25rem", fontWeight: 700, lineHeight: 1.4 },
  h6: { fontSize: "1rem", fontWeight: 700, lineHeight: 1.5 },
} as const;

/** Paleta por modo — mesmas decisões de contraste do tokens.css (fonte única). */
function buildPalette(mode: "light" | "dark") {
  const isDark = mode === "dark";
  return {
    mode,
    primary: {
      // main = cor ACIONÁVEL (botões/ícones interativos), não a marca crua
      main: isDark ? cqColors.primary[300] : cqColors.primary[700],
      dark: isDark ? cqColors.primary[200] : cqColors.primary[800],
      light: isDark ? cqColors.primary[400] : cqColors.primary[600],
      contrastText: isDark ? cqColors.primary[900] : "#FFFFFF",
    },
    secondary: {
      main: isDark ? cqColors.neutral[200] : cqColors.neutral[800],
      dark: cqColors.neutral[900],
      light: isDark ? cqColors.neutral[300] : cqColors.neutral[700],
      contrastText: isDark ? cqColors.neutral[900] : "#FFFFFF",
    },
    info: { main: isDark ? cqColors.infoDark : cqColors.info },
    success: { main: isDark ? cqColors.successDark : cqColors.success },
    warning: { main: isDark ? cqColors.warningDark : cqColors.warning },
    error: { main: isDark ? cqColors.errorDark : cqColors.error },
    background: {
      default: isDark ? "#2A2130" : "#F8F8F8",
      paper: isDark ? cqColors.neutral[800] : "#FFFFFF",
    },
    text: isDark
      ? {
          primary: "#F0EDF2", // 13.32:1
          secondary: "#C9BFD1", // 8.73:1
          disabled: "#7A6F80",
        }
      : {
          primary: cqColors.neutral[800], // 12.76:1
          secondary: cqColors.neutral[600], // 5.98:1
          disabled: cqColors.neutral[400],
        },
    divider: isDark ? "#4A3E4A" : cqColors.neutral[200],
  };
}

export function createCodaquiTheme(mode: "light" | "dark"): Theme {
  const isDark = mode === "dark";

  return createTheme({
    palette: buildPalette(mode),
    typography: {
      fontFamily:
        'var(--cq-font-family-base, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif)',
      ...typeScale,
      button: { fontWeight: 700, textTransform: "none" },
    },

    shape: { borderRadius: 8 },

    /* Espaçamento MUI em 8px ≡ --cq-space-4; use múltiplos de 0.5 (4px) */
    spacing: 8,

    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 8,
            transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",
            "&:focus-visible": {
              outline: `3px solid ${
                isDark ? cqColors.primary[300] : cqColors.primary[700]
              }`,
              outlineOffset: 2,
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            border: `1px solid ${
              isDark ? "#4A3E4A" : cqColors.neutral[200]
            }`,
            borderRadius: 12,
          },
        },
      },
      MuiLink: {
        styleOverrides: {
          root: {
            color: isDark ? cqColors.primary[300] : cqColors.primary[800],
            textUnderlineOffset: 3,
          },
        },
      },
      MuiTextField: {
        defaultProps: { variant: "outlined", size: "medium" },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 16 },
        },
      },
    },
  });
}

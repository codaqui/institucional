// Paleta da página /design-system — DERIVADA de frontend/src/styles/tokens.css
// (fonte canônica). Não inventar valores: qualquer mudança de token exige
// atualizar este arquivo. Os contrastes são calculados por lib/contrast.ts.
import { contrastRatio, wcagBadge } from "../lib/contrast";

export interface Swatch {
  /** Nome do token, ex: "primary-500" → --cq-color-primary-500 */
  token: string;
  hex: string;
  /** Nota de uso/contraste vinda do comentário do token */
  note?: string;
}

export interface SemanticPair {
  name: "info" | "success" | "warning" | "error";
  label: string;
  light: { fg: string; bg: string };
  dark: { fg: string; bg: string };
}

export const primaryScale: Swatch[] = [
  { token: "primary-50", hex: "#EEF8F4" },
  { token: "primary-100", hex: "#DAEFE7" },
  { token: "primary-200", hex: "#B3DECE" },
  { token: "primary-300", hex: "#89CBB3", note: "cor acionável no tema escuro" },
  { token: "primary-400", hex: "#6FBFA2" },
  {
    token: "primary-500",
    hex: "#57B593",
    note: "cor oficial da marca — decoração, hero, logo; NUNCA texto ou ação",
  },
  { token: "primary-600", hex: "#499F81", note: "texto grande (≥18pt/14pt bold)" },
  { token: "primary-700", hex: "#378369", note: "cor acionável no tema claro — AA" },
  { token: "primary-800", hex: "#2C6753", note: "links no tema claro — AAA" },
  { token: "primary-900", hex: "#1C4538", note: "texto sobre verdes claros" },
];

export const neutralScale: Swatch[] = [
  { token: "neutral-50", hex: "#F9F9F9" },
  { token: "neutral-100", hex: "#F1F0F1" },
  { token: "neutral-200", hex: "#E1E0E1" },
  { token: "neutral-300", hex: "#C8C5C8" },
  { token: "neutral-400", hex: "#A6A1A6" },
  { token: "neutral-500", hex: "#857E84" },
  { token: "neutral-600", hex: "#696169", note: "texto secundário — AA" },
  { token: "neutral-700", hex: "#524851" },
  { token: "neutral-800", hex: "#3A2F39", note: "ameixa da marca — 12.76:1" },
  { token: "neutral-900", hex: "#20181F" },
];

export const semanticPairs: SemanticPair[] = [
  {
    name: "info",
    label: "Info",
    light: { fg: "#2F6FED", bg: "#EAF0FD" },
    dark: { fg: "#8FB3F9", bg: "#1E2A45" },
  },
  {
    name: "success",
    label: "Sucesso",
    light: { fg: "#2C7A4B", bg: "#E8F4EC" },
    dark: { fg: "#5CB87A", bg: "#16301F" },
  },
  {
    name: "warning",
    label: "Aviso",
    light: { fg: "#B45309", bg: "#FBF0E4" },
    dark: { fg: "#E8963C", bg: "#3A2410" },
  },
  {
    name: "error",
    label: "Erro",
    light: { fg: "#C0392B", bg: "#FBEAE8" },
    dark: { fg: "#E8826F", bg: "#3D1B17" },
  },
];

/** Texto legível sobre o swatch (branco ou ameixa-900, o de maior contraste). */
export function swatchTextColor(hex: string): string {
  const white = "#FFFFFF";
  const plum = "#1C4538";
  return contrastRatio(white, hex) >= contrastRatio(plum, hex) ? white : plum;
}

/** Badge WCAG do swatch usado como cor de TEXTO sobre superfície clara (#FFF). */
export function swatchBadgeOnWhite(hex: string): ReturnType<typeof wcagBadge> {
  return wcagBadge(hex, "#FFFFFF");
}

export function semanticBadge(fg: string, bg: string): ReturnType<typeof wcagBadge> {
  return wcagBadge(fg, bg);
}

/** Razão formatada em pt-BR, ex: "4,55:1". */
export function formatRatio(fg: string, bg: string): string {
  return `${contrastRatio(fg, bg).toFixed(2).replace(".", ",")}:1`;
}

// O alerta central do DS: por que o verde de marca não é acionável.
export const brandVsActionable = {
  brand: { hex: "#57B593", ratio: formatRatio("#57B593", "#FFFFFF") },
  actionable: { hex: "#378369", ratio: formatRatio("#378369", "#FFFFFF") },
  actionableDark: "#89CBB3",
};

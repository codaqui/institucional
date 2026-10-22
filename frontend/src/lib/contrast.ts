// Contraste WCAG 2.x: luminância relativa sRGB e razão (L1 + 0.05) / (L2 + 0.05).
// Usado pela página /design-system para os badges AA/AAA dos swatches.

function channelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [light, dark] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}

/** Badge WCAG para texto `fg` sobre fundo `bg`; null quando reprova AA até para texto grande. */
export function wcagBadge(
  fg: string,
  bg: string,
): "AAA" | "AA" | "AA 18pt+" | null {
  const ratio = contrastRatio(fg, bg);
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA 18pt+";
  return null;
}

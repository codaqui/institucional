/**
 * Comportamento de menus do SiteHeader (fix wave UI/UX — fase 0.6).
 *
 * U2 — menus desktop em <details>: single-open (abrir um fecha os demais),
 * ESC fecha, clique fora do header fecha. O <details>/<summary> continua
 * funcionando sem JS (baseline acessível); estes helpers só aprimoram.
 *
 * U1 — drawer mobile: helpers puros do ciclo de foco (light dismiss, lista
 * de focáveis, wrap do Tab) usados pelo script inline do SiteHeader.astro.
 */

/** Fecha todos os <details> abertos dentro de `root`, exceto `current`. */
export function closeSiblingDetails(root: ParentNode, current: Element): void {
  root.querySelectorAll("details[open]").forEach((el) => {
    if (el !== current) el.removeAttribute("open");
  });
}

/** Fecha todos os <details> abertos dentro de `root`. */
export function closeAllDetails(root: ParentNode): void {
  root.querySelectorAll("details[open]").forEach((el) => {
    el.removeAttribute("open");
  });
}

/** true quando o alvo do evento está fora de `root` (light dismiss). */
export function isOutside(target: EventTarget | null, root: Node): boolean {
  return target instanceof Node && !root.contains(target);
}

/**
 * Ativa single-open + ESC + clique-fora nos <details> dentro de `root`.
 * `toggle` não propaga: o listener usa captura no ancestral (`root`).
 */
export function initHeaderDetailsNav(root: HTMLElement): void {
  root.addEventListener(
    "toggle",
    (event) => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement) || !details.open) return;
      closeSiblingDetails(root, details);
    },
    true,
  );
  document.addEventListener("click", (event) => {
    if (isOutside(event.target, root)) closeAllDetails(root);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllDetails(root);
  });
}

/** Elementos focáveis do painel, na ordem do tab order. */
export function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

/**
 * Alvo do Tab dentro do painel (focus trap): nas bordas da lista o foco
 * "enrola" para o outro extremo. Retorna null quando o foco está no meio
 * da lista (o navegador segue o tab order normal).
 */
export function nextTrapTarget(
  focusables: HTMLElement[],
  active: Element | null,
  shiftKey: boolean,
): HTMLElement | null {
  if (focusables.length === 0) return null;
  const index = active ? focusables.indexOf(active as HTMLElement) : -1;
  if (index < 0) return focusables[0];
  if (!shiftKey && index === focusables.length - 1) return focusables[0];
  if (shiftKey && index === 0) return focusables.at(-1) ?? null;
  return null;
}

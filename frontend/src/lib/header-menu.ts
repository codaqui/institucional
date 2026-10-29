/**
 * Comportamento de menus do SiteHeader (fix wave UI/UX — fase 0.6).
 *
 * U2 — menus desktop em <details>: single-open (abrir um fecha os demais),
 * ESC fecha, clique fora do header fecha. O <details>/<summary> continua
 * funcionando sem JS (baseline acessível); estes helpers só aprimoram.
 *
 * Hover-intent (melhorias UI): bindHover abre no hover com delay
 * anti-flicker e fecha com delay que permite atravessar para o painel
 * (guia viewport-aware-dropdowns). Clique/touch e teclado seguem nativos.
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

/** Opções de timing do hover-intent (guia viewport-aware-dropdowns). */
export interface HoverMenuOptions {
  /** Delay para abrir no hover (anti-flicker em passagens rápidas). Default 200ms. */
  openDelay?: number;
  /** Delay para fechar após sair (tempo de atravessar para o painel). Default 300ms. */
  closeDelay?: number;
}

/** Hover fino disponível? Em touch/teclado o menu segue 100% clique. */
function hasFinePointer(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );
}

/**
 * Hover-intent num par `<details>/<summary>` de menu desktop:
 * - `pointerenter` no summary agenda a abertura após `openDelay`;
 * - `pointerleave` do details agenda o fechamento após `closeDelay` (tempo
 *   de atravessar o gap até o painel — reforçado pela bridge `::before` no
 *   `ul` do SiteHeader, que cobre o `mt-2` entre summary e painel);
 * - re-entrar no summary cancela o fechamento pendente;
 * - clique/touch e teclado seguem nativos do `<details>` (o summary alterna;
 *   single-open / ESC / clique-fora da wave anterior continuam valendo).
 *
 * Só instala listeners quando há hover fino — em touch nada muda.
 * Retorna cleanup (remove listeners e timers pendentes).
 */
export function bindHover(
  details: HTMLDetailsElement,
  summary: HTMLElement,
  { openDelay = 200, closeDelay = 300 }: HoverMenuOptions = {},
): () => void {
  if (!hasFinePointer()) return () => {};

  let openTimer: ReturnType<typeof setTimeout> | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  const cancelOpen = () => {
    if (openTimer) clearTimeout(openTimer);
    openTimer = null;
  };
  const cancelClose = () => {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = null;
  };

  const isMouseLike = (event: PointerEvent) =>
    event.pointerType === "mouse" || event.pointerType === "pen";

  const onSummaryEnter = (event: PointerEvent) => {
    if (!isMouseLike(event)) return;
    cancelClose();
    if (!details.open && !openTimer) {
      openTimer = setTimeout(() => {
        openTimer = null;
        if (!details.open) details.setAttribute("open", "");
      }, openDelay);
    }
  };

  const onSummaryLeave = (event: PointerEvent) => {
    if (!isMouseLike(event)) return;
    // passagem rápida sem abrir (anti-flicker)
    cancelOpen();
  };

  const onDetailsLeave = (event: PointerEvent) => {
    if (!isMouseLike(event)) return;
    if (!details.open) return;
    cancelClose();
    closeTimer = setTimeout(() => {
      closeTimer = null;
      details.removeAttribute("open");
    }, closeDelay);
  };

  const onDetailsEnter = (event: PointerEvent) => {
    if (!isMouseLike(event)) return;
    cancelClose();
  };

  const onToggle = () => {
    if (details.open) {
      // aberto por clique/teclado/hover: um open timer pendente é desnecessário.
      // NÃO cancelar o close timer aqui — o `toggle` da PRÓPRIA abertura pode
      // ser entregue depois de um pointerleave (jsdom fila o toggle via
      // setTimeout; browser também queue-a como task) e mataria um fechamento
      // legítimo. Só pointerenter (ou fechamento) cancela o close.
      cancelOpen();
    } else {
      cancelOpen();
      cancelClose();
    }
  };

  summary.addEventListener("pointerenter", onSummaryEnter);
  summary.addEventListener("pointerleave", onSummaryLeave);
  details.addEventListener("pointerenter", onDetailsEnter);
  details.addEventListener("pointerleave", onDetailsLeave);
  details.addEventListener("toggle", onToggle);

  return () => {
    cancelOpen();
    cancelClose();
    summary.removeEventListener("pointerenter", onSummaryEnter);
    summary.removeEventListener("pointerleave", onSummaryLeave);
    details.removeEventListener("pointerenter", onDetailsEnter);
    details.removeEventListener("pointerleave", onDetailsLeave);
    details.removeEventListener("toggle", onToggle);
  };
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

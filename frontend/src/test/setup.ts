import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// `globals` está desligado no vitest.config, então o RTL não detecta o
// `afterEach` global e NÃO registra seu cleanup automático — sem isto o
// jsdom acumula renders entre testes do mesmo arquivo (múltiplos matches
// nas queries). Registrado aqui para todos os testes .test.tsx.
afterEach(() => {
  cleanup();
});

// Node ≥ 22 expõe um `localStorage` experimental nativo. Por já existir no
// global, o Vitest não injeta o do jsdom (getWindowKeys filtra chaves
// presentes no global), e sem `--localstorage-file` o nativo é um objeto
// vazio — `clear`/`setItem` inexistentes. Restaura o do jsdom quando esse
// for o caso (setupFiles roda também no ambiente `node`, onde `jsdom` não
// existe no global — o `if` fica falso e nada acontece).
const dom = (globalThis as { jsdom?: { window: Window } }).jsdom;
if (dom?.window && typeof globalThis.localStorage?.clear !== "function") {
  Object.defineProperty(globalThis, "localStorage", {
    value: dom.window.localStorage,
    configurable: true,
    writable: true,
  });
}

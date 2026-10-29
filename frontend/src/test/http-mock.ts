import { afterEach, beforeEach, vi } from "vitest";

// Helpers HTTP compartilhados entre testes de ilhas que mockam fetch
// (padrão src/test/ — evita cópia do jsonResponse/ciclo de vida em cada
// arquivo de teste novo).

/** `Response` JSON para fetch mocks (status default 200, content-type JSON). */
export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

/**
 * Ciclo de vida padrão de um fetch mockado: instância fresca por teste,
 * exposta via `.current`, com `vi.unstubAllGlobals()` no fim.
 *
 *   const fetchMock = useFetchMock();
 *   it("...", async () => {
 *     fetchMock.current.mockResolvedValue(jsonResponse({}));
 *     expect(fetchMock.current).toHaveBeenCalledWith("https://api.test/x");
 *   });
 */
export function useFetchMock(): { current: ReturnType<typeof vi.fn> } {
  const holder: { current: ReturnType<typeof vi.fn> } = { current: vi.fn() };
  beforeEach(() => {
    holder.current = vi.fn();
    vi.stubGlobal("fetch", holder.current);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  return holder;
}

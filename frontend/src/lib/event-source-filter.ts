/**
 * Decide se o filtro por fonte deve ser aplicado na listagem /eventos.
 * Aplica somente quando a query `source` existe e é uma fonte conhecida —
 * query ausente, vazia ou desconhecida cai no fallback (todos os eventos).
 */
export function shouldApplySourceFilter(
  params: URLSearchParams,
  knownSources: Set<string>,
): boolean {
  const sourceKey = params.get("source");
  if (!sourceKey) return false;
  return knownSources.has(sourceKey);
}

export function resolveSourceFilter(search: string, knownSources: Set<string>): string {
  const params = new URLSearchParams(search);
  return shouldApplySourceFilter(params, knownSources) ? params.get("source")! : "all";
}

export function urlWithSourceFilter(
  url: URL,
  sourceKey: string,
  knownSources: Set<string>,
): URL {
  const next = new URL(url);
  if (sourceKey === "all" || !knownSources.has(sourceKey)) {
    next.searchParams.delete("source");
  } else {
    next.searchParams.set("source", sourceKey);
  }
  return next;
}

export function bindSourceFilterHistory(
  knownSources: Set<string>,
  applyFilter: (sourceKey: string) => void,
  target: Window,
): () => void {
  const restoreFilter = () => {
    applyFilter(resolveSourceFilter(target.location.search, knownSources));
  };
  target.addEventListener("popstate", restoreFilter);
  return () => target.removeEventListener("popstate", restoreFilter);
}

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

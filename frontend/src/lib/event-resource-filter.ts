export type EventResourceFilter = "all" | "c4p";

export function resolveResourceFilter(search: string): EventResourceFilter {
  return new URLSearchParams(search).get("recurso") === "c4p" ? "c4p" : "all";
}

export function urlWithResourceFilter(url: URL, resource: EventResourceFilter): URL {
  const next = new URL(url);
  if (resource === "c4p") next.searchParams.set("recurso", "c4p");
  else next.searchParams.delete("recurso");
  return next;
}

export function matchesResourceFilter(
  resource: EventResourceFilter,
  card: { c4p?: string; sourceKey?: string },
  sourceKey: string,
): boolean {
  const matchesResource = resource === "all" || card.c4p === "true";
  const matchesSource = sourceKey === "all" || card.sourceKey === sourceKey;
  return matchesResource && matchesSource;
}

export function bindResourceFilterHistory(
  applyFilter: (resource: EventResourceFilter) => void,
  target: Window,
): () => void {
  const restore = () => applyFilter(resolveResourceFilter(target.location.search));
  target.addEventListener("popstate", restore);
  return () => target.removeEventListener("popstate", restore);
}

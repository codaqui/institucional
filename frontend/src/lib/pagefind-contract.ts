const SEARCH_EXCLUDED_PATH = /^\/(?:admin(?:\/|$)|membro(?:\/|$)|membros\/empresa(?:\/|$)|auth(?:\/|$)|eventos\/(?:detalhe|comprovante)(?:\/|$)|pagefind(?:\/|$)|_astro(?:\/|$)|_)/;

export function shouldRunPagefind(tenant?: string | null): boolean {
  return !tenant;
}

export function shouldExcludeFromSearch(path: string): boolean {
  return SEARCH_EXCLUDED_PATH.test(path);
}

const SEARCH_EXCLUDED_PATHS = [
  "/admin",
  "/membro",
  "/membros/empresa",
  "/auth",
  "/eventos/detalhe",
  "/eventos/comprovante",
  "/pagefind",
  "/_astro",
  "/_",
];

export function shouldRunPagefind(tenant?: string | null): boolean {
  return !tenant;
}

export function shouldExcludeFromSearch(path: string): boolean {
  return SEARCH_EXCLUDED_PATHS.some(
    (excluded) => path === excluded || path.startsWith(`${excluded}/`),
  );
}

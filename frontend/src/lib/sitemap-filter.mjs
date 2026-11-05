const EXCLUDED_PATHS = new Set([
  "/404",
  "/busca",
  "/eventos/detalhe",
  "/eventos/comprovante",
  "/eventos/convite",
  "/team",
  "/contact",
  "/conduta",
  "/ong",
  "/timeline",
  "/sobre/timeline",
  "/pais_responsaveis",
  "/admin",
  "/auth",
  "/membro",
]);

const EXCLUDED_PREFIXES = [
  "/quero/",
  "/blog/archive/",
  "/admin/",
  "/auth/",
  "/membro/",
  "/membros/empresa",
];

export function isExcludedFromSitemap(pathname) {
  return EXCLUDED_PATHS.has(pathname)
    || EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// Portado de docusaurus.config.ts themeConfig.giscus — mapping "og:title" exige
// og:title idêntico ao Docusaurus nos posts (verificado na Task 11, diff de meta).
export const GISCUS_CONFIG = {
  repo: "codaqui/institucional",
  repoId: "R_kgDOG9s0Ng",
  category: "Blog",
  categoryId: "DIC_kwDOG9s0Ns4CRk25",
  mapping: "og:title",
  strict: "0",
  reactionsEnabled: "1",
  emitMetadata: "1",
  inputPosition: "bottom",
  lang: "pt",
} as const;

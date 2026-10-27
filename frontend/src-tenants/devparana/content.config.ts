// Stub intencional (ruling R2 do plano): o build tenant da Fase 0.5 ainda não
// consome content collections — as páginas são .astro estáticas + ilhas, e os
// docs do DevParaná (`docs/[...slug].astro`) leem os arquivos canônicos de
// `comunidades/devparana/docs/` em build time via
// src/lib/community-devparana-docs.ts (parse do frontmatter com o parser
// oficial do @astrojs/markdown-remark).
export const collections = {};

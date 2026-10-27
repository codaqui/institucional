// Stub intencional (ruling R2 do plano): o build tenant da Fase 0.5 ainda não
// consome content collections — as páginas são .astro estáticas + ilhas.
// A collection `communityBlog` entra na task de blog/docs posterior, que
// estenderá este arquivo (loader glob sobre o symlink `content/`, que aponta
// para `src/content` — populado em prebuild pelo sync:content).
export const collections = {};

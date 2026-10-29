/// <reference types="astro/client" />

// Declaração ambiente do swagger-ui-dist (lib publicada sem @types) — usada
// pela ApiDocsIsland (/desenvolvedores/api) via dynamic import.
declare module "swagger-ui-dist/swagger-ui-es-bundle.js" {
  export interface SwaggerUiConfig {
    spec?: unknown;
    url?: string;
    dom_id?: string;
    domNode?: HTMLElement;
    deepLinking?: boolean;
    persistAuthorization?: boolean;
    [key: string]: unknown;
  }
  export default function SwaggerUI(config: SwaggerUiConfig): unknown;
}

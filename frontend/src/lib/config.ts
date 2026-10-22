/** URL base da API NestJS. Em dev: http://localhost:3001 (compose). */
export const API_URL: string =
  import.meta.env.PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Chave pública (publishable) do Stripe usada pelo checkout embutido.
 * No Docusaurus vinha de `customFields.stripePublishableKey` (env
 * `STRIPE_PUBLISHABLE_KEY` injetada no build); no Astro segue o padrão
 * `PUBLIC_*` do Vite. Vazia = checkout desativado (a ilha mostra aviso).
 */
export const STRIPE_PUBLISHABLE_KEY: string =
  import.meta.env.PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

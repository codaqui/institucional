/**
 * Whitelist de origens (scheme://host[:porta]) permitidas para receber redirects
 * pós-OAuth e pós-Stripe. **Fonte única de verdade** para deploys whitelabel.
 *
 * Adicionar nova comunidade com domínio próprio = PR adicionando uma entrada
 * em `ALLOWED_ORIGINS_PROD`. Sem env vars, sem I/O em runtime.
 *
 * Lido por `allowed-origins.ts`. Em dev (`NODE_ENV !== 'production'`) os dois
 * arrays são unidos para que `ALLOWED_ORIGINS_DEV` não dependa de produção.
 */

export const ALLOWED_ORIGINS_PROD: string[] = [
  'https://codaqui.dev',
  'https://tisocial.org.br',
];

export const ALLOWED_ORIGINS_DEV: string[] = [
  'http://localhost:3000',
  'http://localhost:3030',
  'http://localhost:8787',
  'http://tisocial.localhost:8787',
];

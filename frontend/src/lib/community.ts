import type { CommunitySiteConfig } from "../../../comunidades/shared/types";
import type { TenantName } from "./tenant";

/**
 * Adapters sobre os configs das comunidades (`comunidades/<slug>/community.config.ts`).
 *
 * Esses configs pertencem ao site Docusaurus (em produção até a 0.6) e são
 * READ-ONLY aqui: importamos o default export de cada tenant e derivamos
 * dados consumidos pelo app Astro (CSS vars do tema, nav achatado, base path).
 *
 * Os imports são literais por tenant (não dinâmicos por variável) para o
 * Vite conseguir empacotar os três configs no build de cada tenant.
 */

/**
 * Carrega o `CommunitySiteConfig` do tenant. Cada `community.config.ts` pode
 * importar dados locais (ex.: `tisocial` lê `./src/data/campaigns.json`) —
 * os caminhos relativos dentro de `comunidades/` resolvem naturalmente.
 */
export async function loadTenantConfig(
  tenant: TenantName
): Promise<CommunitySiteConfig> {
  switch (tenant) {
    case "tisocial":
      return (await import("../../../comunidades/tisocial/community.config"))
        .default;
    case "elasnocodigo":
      return (await import("../../../comunidades/elasnocodigo/community.config"))
        .default;
    case "devparana":
      return (await import("../../../comunidades/devparana/community.config"))
        .default;
    default:
      throw new Error(`Tenant desconhecido: ${tenant}`);
  }
}

/**
 * CSS vars da comunidade a partir de `config.theme`. As cores vêm do config
 * como dados — nada de hex hardcoded no app.
 */
export function tenantCssVars(
  config: CommunitySiteConfig
): Record<string, string> {
  return {
    "--community-primary": config.theme.primary,
    "--community-primary-dark": config.theme.primaryDark,
    "--community-primary-light": config.theme.primaryLight,
    "--community-accent": config.theme.accent,
    "--community-footer-bg": config.theme.footerBg,
  };
}

export interface TenantNavLink {
  label: string;
  to: string;
}

/**
 * `navMenu` achatado para o nav do tenant: item com submenu vira link para o
 * primeiro `to` do submenu (mesmo achatamento que o swizzle
 * `src/theme/Navbar/Content/index.tsx` do Docusaurus); item com `to` passa
 * como está; item sem link nem submenu é ignorado.
 */
export function tenantNav(config: CommunitySiteConfig): TenantNavLink[] {
  return config.navMenu.flatMap((item) => {
    if (item.items && item.items.length > 0) {
      return [{ label: item.label, to: item.items[0].to }];
    }
    return item.to ? [{ label: item.label, to: item.to }] : [];
  });
}

/**
 * href do nav para o build renderizado. Os configs das comunidades apontam
 * os links para o basePath do portal (`/comunidades/<slug>/…`) — certo nos
 * wrappers do build codaqui, mas no build tenant (domínio próprio) os links
 * devem nascer limpos:
 *
 * - `to === basePath` → `/` (raiz da comunidade);
 * - prefixado com `basePath + "/"` → prefixo removido (`/docs`, `/rfcs`…);
 * - rota do portal fora do basePath (ex.: `/eventos`) → origem absoluta do
 *   portal — o `_redirects` do tenant só cobre `/comunidades/<slug>[/*]`,
 *   então o link relativo 404aria no domínio próprio. Mesmo padrão de
 *   `tenantExploreCardHref` em `community-devparana.ts`.
 *
 * `tenantBuild === false` (wrappers `/comunidades/<slug>` do build codaqui)
 * devolve `to` sem alteração.
 */
export function tenantNavHref(
  to: string,
  basePath: string,
  tenantBuild: boolean,
  portalOrigin: string,
): string {
  if (!tenantBuild) return to;
  if (to === basePath) return "/";
  if (to.startsWith(`${basePath}/`)) return to.slice(basePath.length);
  if (portalOrigin && to.startsWith("/")) return `${portalOrigin}${to}`;
  return to;
}

/** Base path da comunidade no portal (`/comunidades/<slug>`). */
export function communityBasePath(config: CommunitySiteConfig): string {
  return config.basePath;
}

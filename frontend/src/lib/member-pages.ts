// Port de src/plugins/member-pages.ts (Docusaurus) para função pura usada
// pelo getStaticPaths da rota /@<handle> (pages/[...handle].astro).
// Falha na API NÃO quebra o build: loga warn e retorna [] (o redirect
// client-side do 404.astro cobre os perfis nesse caso).
import { API_URL } from "./config";
import type { PublicMemberProfile } from "./member-path";

interface MembersPage {
  data?: PublicMemberProfile[];
  total?: number;
  page?: number;
  totalPages?: number;
}

/** Cap de segurança contra loops infinitos de paginação. */
const MAX_PAGES = 50;
const PAGE_LIMIT = 100;

/** Busca todos os membros ativos na API pública (`GET /members`, paginado). */
async function fetchAllMembers(baseUrl: string): Promise<PublicMemberProfile[]> {
  const members: PublicMemberProfile[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= MAX_PAGES) {
    const response = await fetch(
      `${baseUrl}/members?limit=${PAGE_LIMIT}&page=${page}`,
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} em /members?page=${page}`);
    }
    const payload = (await response.json()) as MembersPage;
    members.push(...(payload.data ?? []));
    totalPages = payload.totalPages ?? 1;
    page += 1;
  }

  if (totalPages > MAX_PAGES) {
    console.warn(
      `[member-pages] Paginação truncada em ${MAX_PAGES} páginas (totalPages=${totalPages})`,
    );
  }

  return members;
}

/**
 * Carrega os membros ativos para geração das páginas estáticas `/@<handle>`.
 * Em qualquer falha (API fora, HTTP não-ok, JSON inválido) retorna [] com
 * warn — o build segue sem páginas e o fallback do 404 cobre os perfis.
 */
export async function loadPublicMembers(
  baseUrl: string = API_URL,
): Promise<PublicMemberProfile[]> {
  try {
    return await fetchAllMembers(baseUrl);
  } catch (error) {
    console.warn(
      `[member-pages] Falha ao buscar membros em ${baseUrl} — build segue sem páginas estáticas de perfil (fallback: redirect do 404).`,
      error,
    );
    return [];
  }
}

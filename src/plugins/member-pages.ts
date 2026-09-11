import type { Plugin } from "@docusaurus/types";
import {
  MEMBER_HANDLE_REGEX,
  buildMemberPath,
} from "../utils/member-path";
import type { PublicMemberProfile } from "../utils/member-path";

interface MembersPage {
  data?: PublicMemberProfile[];
  total?: number;
  page?: number;
  totalPages?: number;
}

/** Cap de segurança contra loops infinitos de paginação. */
const MAX_PAGES = 50;
const PAGE_LIMIT = 100;

/**
 * Busca todos os membros ativos na API pública (`GET /members`, paginado).
 * Falha na API NÃO quebra o build: loga warn e retorna [] (o redirect
 * client-side do NotFound cobre os perfis nesse caso).
 */
async function fetchAllMembers(baseUrl: string): Promise<PublicMemberProfile[]> {
  const members: PublicMemberProfile[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= MAX_PAGES) {
    const response = await fetch(
      `${baseUrl}/members?limit=${PAGE_LIMIT}&page=${page}`
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
      `[codaqui-member-pages] Paginação truncada em ${MAX_PAGES} páginas (totalPages=${totalPages})`
    );
  }

  return members;
}

/**
 * Gera uma página estática `/@<handle>` por membro ativo, com OG/JSON-LD
 * (schema.org/Person) corretos para crawlers de preview que não executam JS.
 * A lista vem da API pública em build time (`DOCUSAURUS_API_URL`); em
 * qualquer falha o build segue sem páginas e o 404 swizzlado continua
 * redirecionando `/@handle` para `/membros/perfil?handle=`.
 */
export default function memberPagesPlugin(): Plugin {
  return {
    name: "codaqui-member-pages",

    async loadContent(): Promise<PublicMemberProfile[]> {
      const baseUrl =
        process.env.DOCUSAURUS_API_URL ?? "http://localhost:3001";
      try {
        return await fetchAllMembers(baseUrl);
      } catch (error) {
        console.warn(
          `[codaqui-member-pages] Falha ao buscar membros em ${baseUrl} — build segue sem páginas estáticas de perfil (fallback: redirect do 404).`,
          error
        );
        return [];
      }
    },

    async contentLoaded({ content, actions }): Promise<void> {
      const { createData, addRoute } = actions;
      const members = content as PublicMemberProfile[];
      const seenPaths = new Set<string>();
      let counter = 0;

      for (const member of members) {
        if (!MEMBER_HANDLE_REGEX.test(member.githubHandle)) {
          console.warn(
            `[codaqui-member-pages] Handle inválido ignorado: ${JSON.stringify(member.githubHandle)} (membro ${member.id})`
          );
          continue;
        }

        const routePath = buildMemberPath(member.githubHandle);
        if (seenPaths.has(routePath.toLowerCase())) {
          console.warn(
            `[codaqui-member-pages] Rota duplicada ignorada: ${routePath} (membro ${member.id})`
          );
          continue;
        }
        seenPaths.add(routePath.toLowerCase());

        const dataPath = await createData(
          `member-${counter}.json`,
          JSON.stringify(member)
        );
        counter += 1;

        addRoute({
          path: routePath,
          exact: true,
          component: "@site/src/components/MemberProfileRoute/index.tsx",
          modules: { content: dataPath },
        });
      }

      console.log(
        `[codaqui-member-pages] ✔ ${counter} páginas de membro geradas`
      );
    },
  };
}

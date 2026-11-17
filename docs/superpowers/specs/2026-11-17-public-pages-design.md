<!-- AGENT-INDEX
purpose: Design da Fase 8 — conectar /sobre/equipe e /sobre/ong às projeções públicas existentes, preservando curadoria institucional, fallbacks e arquitetura estática.
audience: Presidência, mantenedores, implementadores e revisores.
status: Proposta para revisão em 2026-11-17; não aprovada e não implementada. Nenhum backend ou migration é necessário.
sections:
  - Intenção e evidências
  - Objetivos, não objetivos e restrições
  - Abordagens
  - Equipe e mentores
  - Associação, comunidades e portais
  - Privacidade, falhas e acessibilidade
  - Verificação, documentação e rollout
related-docs:
  - ../../plans/pos-1-0/README.md — Fase 8 no roadmap.
  - ../../plans/frontend-jornadas/README.md — inventário das jornadas públicas.
  - ../../adrs/007-community-registry.md — contrato existente do snapshot de comunidades.
  - ../../adrs/009-mentorship.md — contrato existente do snapshot de mentores.
  - ../../adrs/011-frontend-astro-multi-tenant-pages.md — arquitetura preservada.
agent-protocol:
  - Não criar membros/placeholders no PostgreSQL nem associação por nome; match somente por GitHub handle.
  - Não alterar APIs, migrations, tokens, layouts, rotas ou Design System.
  - Implementar somente após revisão/aprovação desta spec e do plano TDD correspondente.
-->

# Fase 8 — Páginas públicas conectadas às projeções existentes

## 1. Intenção e evidências

`/sobre/equipe` ainda renderiza diretoria, membros, alumni e mentores exclusivamente de `frontend/src/data/team.ts`. A página não usa `loadPublicMembers()`, embora embaixadores e perfis públicos já façam enriquecimento em build-time. Entradas sem GitHub usam avatar genérico, e a lista de mentores pode divergir do snapshot público do programa.

`/sobre/ong` usa `frontend/src/data/communities.ts` e uma lista independente em `community-portals.ts`. O registro público de comunidades já possui nível, status, selo, descrição, links, perfis sociais e flag de site em `static/communities/index.json`; os três portais ativos já estão em `frontend/tenants.config.mjs`.

A intenção é remover divergências visíveis sem transformar curadoria institucional em um roster automático e sem criar um backend novo.

## 2. Objetivos, não objetivos e restrições

### Objetivos

1. Enriquecer cards da equipe com dados públicos de membros ativos, usando somente o handle do GitHub como chave.
2. Preservar seção, papel institucional, especialidade e fallback editorial definidos localmente.
3. Substituir a lista editorial de mentores pela projeção pública de mentores ativos e vigentes.
4. Exibir comunidades a partir do snapshot, incluindo nível e selo efetivo, sem duplicar a lista local nessa página.
5. Derivar a disponibilidade e o destino dos portais da interseção entre snapshot e `TENANTS`.
6. Manter build estático, fallbacks explícitos, acessibilidade e paridade de URLs.

### Não objetivos

- Não criar, reativar ou vincular membros/placeholders no PostgreSQL.
- Não derivar diretoria, voluntários ou alumni automaticamente de designations nesta fase.
- Não alterar endpoints, schemas de snapshot, migrations, autenticação ou autorização.
- Não mudar outras páginas que ainda consomem `data/communities.ts`; a consolidação global é trabalho separado.
- Não alterar Design System, frameworks, layouts, sitemap, URLs ou conteúdo canônico de blog/trilhas.

### Anti-objetivos

- Não associar pessoas por semelhança ou igualdade de nome.
- Não exibir mentores históricos/inativos como se estivessem ativos.
- Não anunciar portal para comunidade inativa, sem `siteEnabled` ou sem tenant configurado.
- Não esconder falha de dados criando membros ou métricas fictícias.

## 3. Abordagens

1. **Curadoria local + projeções públicas existentes — proposta recomendada.** A equipe mantém composição e papéis no repositório; dados de perfil são enriquecidos em build. Mentores e comunidades usam snapshots já publicados. Não exige backend e tem blast radius limitado a duas páginas e libs puras.
2. **Roster institucional totalmente automático — rejeitada nesta fase.** Exigiria uma projeção pública autorizada de designations, regras para alumni e ordenação editorial, além de fluxos de revisão. Fica como evolução futura, não como dependência oculta.
3. **Somente corrigir os dados estáticos — rejeitada.** Reduziria o erro imediato, mas preservaria duas fontes de verdade e o problema retornaria na próxima mudança.

A escolha proposta não cria “placeholders da Codaqui” no banco. Uma entrada local sem match permanece apenas um card editorial com fallback; isso não representa uma conta nem uma designation.

## 4. Equipe e mentores

### 4.1 Fonte e matching da equipe

`frontend/src/data/team.ts` continua sendo a fonte das seções **Diretoria**, **Membros** e **Alumni**, inclusive dos campos `role`, `specialty` e URLs editoriais de fallback. O export `mentores` deixa de ser usado/removido se não houver outro consumidor.

Uma lib pura nova, `frontend/src/lib/team.ts`, terá:

```ts
export interface EnrichedTeamMember extends Member {
  profilePath?: string;
}

export function enrichTeamMember(
  local: Member,
  publicMembers: PublicMemberProfile[],
): EnrichedTeamMember;

export function publicProfilePathForHandle(
  handle: string,
  publicMembers: PublicMemberProfile[],
): string | undefined;
```

Regras:

- extrair o handle somente de uma URL de perfil `https://github.com/<handle>` válida, sem aceitar credenciais, subdomínio lookalike ou path adicional como parte do handle;
- comparar handles sem distinguir maiúsculas/minúsculas;
- não fazer fallback por nome;
- com match, preferir `name`, `avatarUrl` e `linkedinUrl` públicos, usando o valor local quando o campo público opcional estiver ausente; `bio` não é enriquecida nem exibida nesta fase;
- com match, gerar GitHub canônico a partir do handle e `profilePath = "/@<handle>"` por `publicProfilePathForHandle()`;
- sem match ou com API indisponível, preservar integralmente o card local e omitir `profilePath`;
- `role` e `specialty` nunca vêm das roles derivadas da API nesta fase.

A página chama `loadPublicMembers()` uma vez e enriquece as três listas em build-time. A falha da API já retorna `[]` com warning e não interrompe o build.

### 4.2 Mentores

A seção **Mentores** usa `loadMentorsIndex()` e somente `snapshot.mentors`, que já representa perfis ativos com designation vigente. Cada card usa `name`, `handle`, `avatarUrl`, `areas` e `focus` públicos e sempre oferece link para `/participe/mentoria`. O link para `/@<handle>` só aparece quando `publicProfilePathForHandle()` encontra esse mentor entre os membros públicos carregados no mesmo build; caso contrário, o card permanece sem link de perfil, sem depender do redirect de 404.

- Não fazer merge com o array editorial antigo.
- Snapshot vazio ou ausente produz um empty state com link para o programa, não uma lista histórica fabricada.
- A descrição da seção usa “encontros individuais”, não “aulas”.
- A ordem segue o snapshot; não criar ranking ou métricas novas.

### 4.3 Card público

Os cards continuam visualmente no Design System atual e não ganham bloco de bio. Usam `<article>` e heading próprio; avatar tem texto alternativo com o nome. O perfil `/@handle` é um link textual acessível, sem transformar o card inteiro em um alvo ambíguo. LinkedIn/GitHub externos mantêm `target="_blank" rel="noopener noreferrer"` e nomes acessíveis.

## 5. Associação, comunidades e portais

### 5.1 Comunidades apoiadas

`/sobre/ong` chama `loadCommunitiesIndex()` e renderiza a coleção pública na ordem recebida. O mapeamento para `CommunityPresenceCard` usa `slug`, `name`, `emoji`, `logo`, `description`, `location`, `tags`, `links` e `socialProfiles` do snapshot de comunidades.

- A contagem de presença social continua vindo de `loadSocialStats()`/`profilesFor()`, agora relacionada por `community.slug`.
- Cada card mostra o rótulo `Integrada`/`Parceira` por `communityLevelLabel()`.
- “Selo em avaliação” usa `sealStatus === "applied"`; “Selo Codaqui” somente aparece com `sealStatus === "sealed"` e `sealEffective === true`.
- A página mostra a data de `generatedAt` em UTC, sem apresentá-la como horário local.
- Não expor `sealGrantedById`, `sealNotes`, IDs internos ou qualquer campo novo.

O array local `data/communities.ts` permanece para os demais consumidores até uma consolidação própria; esta fase não o apaga nem altera suas regras.

### 5.2 Portais

`frontend/src/data/community-portals.ts` deixa de definir quais portais existem e seus `basePath`. Conserva apenas metadados visuais/editoriais por slug (`tagline` e logo dark; demais campos somente se indispensáveis ao tema).

Uma lib pura `frontend/src/lib/community-portals.ts` produz:

```ts
export interface CommunityPortalView {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  logoUrl: string;
  logoUrlDark: string;
  href: string;
}

export function listCommunityPortals(
  communities: CommunityIndexEntry[],
  tenants?: TenantDefinition[],
): CommunityPortalView[];
```

O default de `tenants` é `TENANTS`. A lista é a interseção de:

- comunidade presente no snapshot com `status === "active"` e `siteEnabled === true`;
- tenant configurado com o mesmo slug em `TENANTS`.

`name`, `description` e logo claro vêm do snapshot; `href` vem de `tenant.site`; logo dark e tagline usam o metadado local, com fallback ao logo claro e string vazia. Um tenant sem comunidade elegível não gera card, e uma comunidade elegível sem tenant não inventa URL.

### 5.3 Transparência e narrativa

A seção de transparência aponta primariamente para `/assembleias` como “Atas e assembleias”. O Google Drive pode permanecer identificado apenas como arquivo histórico, sem ser apresentado como a fonte operacional atual. Demais textos e o muro de doadores não mudam de fluxo.

## 6. Privacidade, falhas e acessibilidade

- Somente projeções públicas já existentes são consumidas; não há e-mail, consentimento, IDs de atores, notas ou sessões individuais.
- Falha da API de membros usa fallback local; snapshot de mentores vazio/ausente usa empty state; snapshot de comunidades ausente continua sendo erro de build, como nas páginas atuais, para não publicar uma rede desatualizada silenciosamente.
- Dados ausentes não quebram cards: links e campos opcionais são omitidos; logo dark e tagline têm fallback.
- A página preserva um único `main`, hierarquia h1→h2→h3, dimensões/lazy loading das imagens, foco e contraste pelos tokens existentes.
- Não há ilha nova nem JavaScript de cliente novo para essas listas.

## 7. Verificação, documentação e rollout

Testes Vitest obrigatórios:

- match por handle case-insensitive, prioridade de campos, fallback sem API e ausência de match por nome;
- rejeição de URL de GitHub inválida/lookalike e geração de `/@handle` somente com match;
- mentores somente do snapshot e empty state sem fallback histórico;
- portais somente na interseção válida, `href` de `tenant.site`, fallbacks visuais e ausência de duplicatas;
- selo efetivo/vencido/em avaliação e nenhum campo privado na projeção usada pela página.

Gates: `make astro-verify`, `make astro-verify-tenants` e `git diff --check`. Como a lib compartilhada e páginas públicas mudam, os quatro builds são obrigatórios. Não há testes de backend ou migrations porque nenhum contrato de servidor muda.

Documentação: atualizar a decisão 17 de `AGENTS.md`, o roadmap pós-1.0 e o índice de planos. ADRs 007/009/011 não precisam de alteração, pois seus contratos são apenas consumidos. Se aprovada como próxima feature, a release alvo é **1.3.0** nos manifests/lockfiles de frontend e backend, com entrada no changelog; isso não implica mudança de código no backend.

Rollout: revisão da spec/plano → implementação em `develop` → revisão independente e gates → PR para `main` → publicação do frontend. Não há sync inicial novo nem redeploy manual de backend exigido pela funcionalidade.

<!-- AGENT-INDEX
purpose: Ponto de entrada leve para agentes e contribuidores; aponta para os guias vivos sem duplicar seu conteúdo.
audience: AI agents, maintainers, contributors
read-first: true
sections:
  - Navegação da documentação
  - Mapa e stack do monorepo
  - Comandos e gates
  - Regras críticas
  - Guia por assunto
  - Fluxo de trabalho e releases
related-docs:
  - DEVELOPMENT.md — setup, variáveis, migrations, deploy e runbooks
  - docs/README.md — índice de ADRs, módulos e planos
  - docs/modules/MONOREPO_OPERATIONS.md — convenções detalhadas de frontend, backend, UI, CI e manutenção
  - CHANGELOG.md — histórico de releases
agent-protocol:
  - Leia primeiro o AGENT-INDEX de cada Markdown; depois abra somente a seção necessária.
  - Não execute planos históricos sem revalidar seu status em docs/plans/README.md.
-->

# AGENTS.md — Codaqui Monorepo

Ponto de entrada para agentes e contribuidores. Este arquivo contém somente orientação de navegação, comandos e invariantes; o detalhamento vive nos documentos ligados.

## 1. Navegação da documentação

Todo Markdown do repositório começa com `<!-- AGENT-INDEX -->`. Leia esse bloco antes do corpo e preserve o formato ao criar documentos novos.

| Necessidade | Fonte |
|---|---|
| Entender uma decisão ou módulo | [Índice da documentação](docs/README.md) |
| Conhecer convenções de código, UI, CI e manutenção | [Guia operacional do monorepo](docs/modules/MONOREPO_OPERATIONS.md) |
| Rodar localmente, configurar segredos, migrar ou publicar | [DEVELOPMENT.md](DEVELOPMENT.md) |
| Consultar roadmap e planos | [Índice de planos](docs/plans/README.md) |
| Conferir o que já foi publicado | [CHANGELOG.md](CHANGELOG.md) |

Decisão implementada vira ADR; comportamento atual fica em `docs/modules/`; hipótese ou backlog fica em `docs/plans/`. Atualize a documentação viva quando mudar o comportamento correspondente.

## 2. Mapa e stack

| Caminho | Responsabilidade |
|---|---|
| `frontend/` | Site Astro 7 estático, ilhas React 19/MUI v9, Tailwind v4 e Pages Function |
| `backend/` | API NestJS 11, TypeORM, PostgreSQL 18, Stripe e autenticação GitHub/JWT |
| `blog/`, `trilhas/` | Conteúdo canônico copiado para o frontend no build |
| `comunidades/` | Branding e conteúdo canônico dos tenants |
| `static/` | Snapshots gerados por workflows; não editar manualmente |
| `scripts/` | Syncs e validações executados na raiz |
| `docs/` | ADRs, documentação viva e planos |

- Node 24 ou superior; dependências de produto ficam em `frontend/package.json` e `backend/package.json`.
- O portal usa `frontend/src/`; tenants usam `frontend/src-tenants/<slug>/` por `TENANT=<slug>` em build-time.
- O deploy do site é Cloudflare Pages; o backend roda em container e seu redeploy de produção é manual no Coolify.
- Site: https://codaqui.dev · API: https://api.codaqui.dev.

## 3. Comandos e gates

```bash
make astro-verify           # build codaqui + check + testes + Function + smoke + URLs
make astro-verify-tenants   # codaqui e tenants + allow-list de URLs por tenant

cd frontend && npm run build
cd frontend && npm run check
cd frontend && npm run test

cd backend && npm run build
cd backend && npx jest --silent

npm run test:scripts        # quando alterar scripts/*.mjs
```

Use `make help` e [DEVELOPMENT.md](DEVELOPMENT.md) para dev server, infra, migrations, syncs individuais e deploy. `astro check` é gate do build codaqui, não dos builds tenant (regra R7).

## 4. Regras críticas

1. **Conteúdo:** edite `blog/` e `trilhas/` na raiz, nunca as cópias em `frontend/src/content/`; edite comunidades em `comunidades/`, nunca nos symlinks de `src-tenants/`.
2. **Tenants:** `frontend/tenants.config.mjs` e os matrices de `deploy-astro.yml`/`pr-check.yml` devem mudar juntos. Build codaqui não define `TENANT`; nunca use `TENANT=codaqui`.
3. **Proxy:** mantenha a allow-list de `frontend/src/lib/api-proxy-paths.ts` estreita e cheque colisões com páginas estáticas. Nunca use o prefixo amplo `/admin/`.
4. **API no cliente:** use `resolveApiUrl(import.meta.env.SITE)` e `authFetch`; não consuma `API_URL` cru.
5. **Design:** cores vêm de `frontend/src/styles/tokens.css` ou do tema MUI; zero hex solto. MUI v9 usa `slotProps`, `sx` e Grid com `size`.
6. **Listagens:** use `src/lib/pagination.ts`, `PaginationControls` e o envelope/DTO paginado do backend.
7. **Financeiro:** todo movimento passa pelo ledger de dupla partida. Preserve `referenceId` único e use a factory de `persistWithLedger` para IDs gerados no save.
8. **URLs:** não mude slugs de posts publicados; redirects legados pertencem a `build-tenant-redirects.mjs`; não regenere `url-reference.json`.
9. **Rotas de app:** `/admin/*`, `/auth/*` e demais rotas privadas permanecem `noindex` e fora do sitemap.
10. **Segredos e dados:** não commite segredos, não exponha PII em snapshots e valide hosts por `new URL`, protocolo HTTPS e hostname exato.
11. **Acessibilidade e linguagem:** use hierarquia correta de headings, `alt`, `aria-label`, “participantes”, “programa”, “encontros” e “Associação”.
12. **Escopo:** não trate planos, visões ou pendências como funcionalidades publicadas; consulte ADR/changelog antes de afirmar o estado atual.

O detalhamento, exemplos e anti-patterns estão no [guia operacional](docs/modules/MONOREPO_OPERATIONS.md).

## 5. Guia por assunto

| Assunto | Documentação principal |
|---|---|
| Frontend Astro, tokens, build matrix e proxy | [ADR 011](docs/adrs/011-frontend-astro-multi-tenant-pages.md) · [guia operacional](docs/modules/MONOREPO_OPERATIONS.md) |
| Setup e operação multi-tenant | [DEVELOPMENT.md](DEVELOPMENT.md) · [sites de comunidades](docs/modules/community/COMMUNITY_SITES.md) |
| Eventos, inscrições, check-in e certificados | [Manual de eventos](docs/modules/events/CODE_MANUAL.md) · [ADR 001](docs/adrs/001-event-platform.md) |
| Papéis e permissões | [Mapa de papéis](docs/modules/events/ROLES.md) |
| Diretorias e designations | [ADR 006](docs/adrs/006-directorates-designations.md) |
| Registro e selo de comunidades | [ADR 007](docs/adrs/007-community-registry.md) |
| Entidades e projetos de extensão | [ADR 008](docs/adrs/008-entities-extension-projects.md) |
| Horas, guests e badges | [ADR 013](docs/adrs/013-hour-ledger.md) |
| Assembleias | [ADR 014](docs/adrs/014-assemblies.md) |
| Codaqui Universitário | [ADR 015](docs/adrs/015-codaqui-universitario.md) |
| Mentoria | [ADR 009](docs/adrs/009-mentorship.md) |
| Clube PF/PJ e Business tiers | [ADR 002](docs/adrs/002-club-sortcoins.md) · [ADR 003](docs/adrs/003-club-business-pj.md) · [ADR 010](docs/adrs/010-business-tiers.md) |
| Convites de certificado | [ADR 016](docs/adrs/016-certificate-invite-queue.md) |
| Announcements e campanhas de e-mail | [ADR 017](docs/adrs/017-announcements.md) · [ADR 018](docs/adrs/018-email-campaigns.md) |
| C4P | [ADR 012](docs/adrs/012-c4p.md) |
| Privacidade e exclusão de conta | [ADR 019](docs/adrs/019-privacy-self-service.md) · [privacidade](docs/modules/privacy/README.md) |
| Insights e estatísticas | [SOCIAL_STATS.md](docs/modules/insights/SOCIAL_STATS.md) |
| Jornadas, mockups e Fase 10 | [Design da Fase 10](docs/superpowers/specs/2026-11-18-journeys-mockups-design.md) · [índice de planos](docs/plans/README.md) |

## 6. Fluxo de trabalho e releases

1. Crie `feat/nome` ou `fix/nome` a partir de `develop`.
2. Rode os gates das camadas alteradas e abra PR para `develop`.
3. Homologue no branch deployment do Pages; somente depois promova `develop` para `main`.
4. Use `feat(escopo): ...`, `fix(escopo): ...` ou `docs(escopo): ...`.

Toda release mantém `frontend/package.json`, `backend/package.json` e seus lockfiles na mesma versão de produto e adiciona entrada ao [CHANGELOG.md](CHANGELOG.md): feature → minor, correção → patch. `publish-backend.yml` usa a versão do backend para imagem e release; sem bump, uma publicação sobrescreve a anterior.

Antes de concluir, revise o checklist completo no [guia operacional](docs/modules/MONOREPO_OPERATIONS.md#8-checklist-de-pr) e o `git status` para não entregar artefatos de build ou dados temporários.

<!-- AGENT-INDEX
purpose: Guia operacional detalhado de convenções transversais do monorepo, mantido fora do AGENTS.md para leitura sob demanda.
audience: AI agents, maintainers, contributors
sections:
  - Arquitetura e frontend
  - Conteúdo, URLs e UI
  - Backend financeiro e autorização
  - Contratos transversais de backend
  - Anti-patterns
  - CI, deploy e manutenção
  - Convenções de nomes
  - Checklist de PR
related-docs:
  - ../../AGENTS.md — ponto de entrada resumido
  - ../../DEVELOPMENT.md — setup, variáveis, migrations e deploy
  - ../README.md — índice de ADRs e módulos
agent-protocol: Consulte somente a seção relacionada à mudança; ADRs e manuais de módulo têm precedência sobre este resumo em seus domínios.
-->

# Guia operacional do monorepo

## 1. Arquitetura e frontend

### Stack

- Astro 7 estático com MDX/RSS/sitemap, React 19, MUI v9 e Tailwind v4.
- NestJS 11, TypeORM 0.3, PostgreSQL 18, Passport GitHub/JWT e Stripe Checkout/webhooks com assinatura obrigatória.
- Cloudflare Pages para os quatro sites; Pages Function em `frontend/functions/[[path]].ts` para API same-origin.
- Comprovantes são links HTTPS validados por allowlist; o backend não faz upload nem grava em S3/disco.
- O force-sync de eventos via GitHub-as-Database é legado e não deve ser expandido.

### Multi-tenant

`TENANT=<slug>` troca o `srcDir` em build-time. `frontend/tenants.config.mjs` é a fonte única de slug, domínio e projeto Pages; os matrices de deploy e PR devem espelhá-la. O build codaqui não define `TENANT`.

Os gates são diferentes por motivo: codaqui executa o conjunto completo; tenant executa build e `tenant-urls`, sem `astro check` como gate (R7). Canonical, OG e sitemap usam a URL do tenant em build-time.

### Proxy same-origin

`frontend/src/lib/api-proxy-paths.ts` limita os paths encaminhados à API. A Function roda antes dos assets e `_redirects`; prefixos amplos podem interceptar páginas do painel. Use prefixos estreitos, normalmente com trailing slash, e verifique rotas estáticas antes de adicionar um path. `/auth/callback` é página; `/auth/github/callback` é API.

Nos clientes, use `resolveApiUrl(import.meta.env.SITE)`; em tenant, o guard `PUBLIC_TENANT` garante same-origin.

### Design e ilhas

- `frontend/src/styles/tokens.css` é a fonte única de cores; Tailwind consome via `@theme inline` e MUI espelha os tokens em `src/lib/mui-theme.ts`.
- `primary-500` é decorativo sobre fundo claro; texto e ícones essenciais usam `primary-700` ou superior e links usam `primary-800`.
- Comportamento complexo fica em ilhas MUI; apresentação fica em Astro/Tailwind.
- `BaseLayout.astro` define `data-theme` antes do paint. Ilhas devem observar esse atributo, sem assumir tema.
- Telas admin são `.astro` finos com `AppLayout` e ilha `client:only`. A ilha usa `useAuth`, `authFetch`, `parseAuthJson`, `extractErrorMessage` e estado de erro visível.

## 2. Conteúdo, URLs e UI

### Fontes canônicas e snapshots

- `blog/` e `trilhas/` são copiados por `copy-content.mjs`; nunca edite as cópias.
- Páginas soltas ficam versionadas em `frontend/src/content/pages/`.
- `blog/authors.yml` é canônico e deve ser replicado em `frontend/src/data/blog-authors.ts` quando mudar.
- `comunidades/<slug>/` é editável; `frontend/src-tenants/` consome esse conteúdo por symlink.
- `copy-snapshots.mjs` copia os JSONs/SVGs de `static/` no prebuild. Exceções estáticas exatas do proxy incluem `/assemblies/index.json`, `/universities/index.json`, `/announcements/index.json`, `/c4p/index.json` e os demais contratos documentados nas ADRs.

### Blog, redirects e indexação

Posts seguem `blog/YYYY-MM-DD-slug.md(x)` e frontmatter `slug: YYYY/MM/DD/slug`. Não mude slug nem `og:title` de posts publicados: isso quebra URLs e comentários Giscus. `<!-- truncate -->` delimita o resumo; `enableComments: false` desativa comentários.

Redirects legados são gerados em `dist/_redirects` por `build-tenant-redirects.mjs`. Não crie páginas-sombra. `frontend/scripts/url-reference.json` é a referência congelada de paridade e não deve ser regenerada para contornar falha.

Rotas privadas/de app usam `noindex` e `SITEMAP_EXCLUDE`. O build codaqui aponta o sitemap em `robots.txt`; tenants usam seus próprios domínios.

### Componentes e contratos compartilhados

- Paginação: `src/lib/pagination.ts`, `PaginationControls` e envelope `{data,total,page,totalPages,limit}`. DTOs usam transformação e validação numérica; controles só aparecem com mais de uma página.
- Admonitions: `:::info[Título]`, `:::tip`, `:::warning`, `:::note` e fechamento `:::`. O transformer é `src/lib/remark-admonitions.ts`; bloco sem fechamento permanece literal para sinalizar erro de autoria.
- API pública: `/desenvolvedores/api` carrega Swagger UI por dynamic import e consome `/docs-json` ao vivo.
- Menus: `src/lib/header-menu.ts` implementa single-open, ESC, clique fora, hover-intent e focus trap. `NavbarAuth` decide os links por papel e empresa.
- Analytics: `src/lib/analytics.ts` usa snapshot com fallback ao repositório de dados. Validação de host usa `new URL`, HTTPS e hostname exato.
- Dados locais: equipe fica em `src/data/team.ts`, sociais em `src/data/social.ts` e timeline em `src/data/timeline.ts`. Enriquecimento por API tem fallback local e nunca casa membro apenas por nome.

## 3. Backend financeiro e autorização

### Ledger

Todo movimento financeiro usa `LedgerService.recordTransaction` com contas de origem/destino. Módulos especializados persistem sua entidade e o movimento de forma atômica. Em `persistWithLedger`, use a factory `(saved) => ledgerArgs`: o UUID só existe depois do save.

| Movimento | `referenceId` |
|---|---|
| Doação Stripe | PaymentIntent puro, `pi_...` |
| Taxa Stripe | `stripe-fee:<balanceTransactionId>` |
| Reembolso Stripe | `stripe-refund:<paymentIntentId>:<refundId>` |
| Reembolso interno | `reimbursement:<id>` |
| Transferência | `transfer:<id>` |
| Pagamento/recibo de fornecedor | `vendor-payment:<id>` / `vendor-receipt:<id>` |
| Despesa direta | `expense:<id>` |
| Ingresso | `event-ticket:<orderId>` |

As reversões seguem o padrão `<prefixo>-reversal:<id>:<timestamp>` quando aplicável. O frontend classifica os cartões por prefixo em `src/lib/transaction.ts`. Taxas de ingressos ainda não entram no ledger; o fluxo de taxas atual procura uma doação pelo PaymentIntent.

### Reconciliação de taxas Stripe

`POST /stripe/reconcile-fee` exige role `admin` e recebe `{paymentIntentId}`. A operação somente lê o PaymentIntent no Stripe, com charge e balance transaction expandidos, e cria a taxa ausente no ledger. Retorna `created`, `already_exists` ou `no_fee`; doação original ausente, BT indisponível e falhas de consulta/gravação não são tratados como sucesso.

A referência única `stripe-fee:<balanceTransactionId>` impede duplicidade, inclusive quando duas chamadas concorrem. Criações manuais geram auditoria `stripe.fee_reconciled`. No admin, a aba **Taxas Stripe** fica em `/admin/lancamento?tab=stripe`, visível somente para administradores.

### Papéis

| Role | Escopo |
|---|---|
| `membro` | Todo membro |
| `admin` | Global |
| `finance-analyzer` | Relatórios financeiros globais |
| `event_organizer` | Global e ownership por evento externo |
| `event_finance` | Relatórios e reembolsos de eventos |
| `event_host`, `event_checker` | Por evento via `event_staff` |

`member_designations` é a única fonte dos vínculos organizacionais novos; não crie tabelas paralelas. Roles derivadas não são editadas pelo CRUD de membros. Ownership e staff de eventos mantêm seus modelos próprios. Detalhes: [mapa de papéis](events/ROLES.md) e [ADR 006](../adrs/006-directorates-designations.md).

## 4. Contratos transversais de backend

- **Comunidades:** PostgreSQL é o registro; snapshots alimentam o build. Checkout direcionado aceita somente Integrada ativa, além das exceções já implementadas. Não prometa split/payout ou comunidade Autônoma.
- **E-mail:** sem SMTP, logs ficam `skipped/SMTP_NOT_CONFIGURED`, sem desfazer a operação. Somente `sent` e `failed` deduplicam crons. A fila e a serialização global seguem a ADR 016.
- **CSV financeiro:** filtros `from`/`to` são compartilhados com listagem; `to` inclui o dia inteiro, o range exporta todas as linhas e o CSV tem BOM e proteção contra formula injection.
- **Auditoria:** governo é permanente e sem IP; operacional expira entre 7 e 365 dias conforme setting. Cleanup nunca apaga governo.
- **Turnstile:** hostname exato, ação esperada, timeout e cache; produção falha fechada sem secret. Desenvolvimento aceita o token documentado apenas no modo permitido.
- **Eventos 18+:** badge e aviso são informativos; não bloqueiam inscrição nem coletam documento.
- **Horas:** `hour_ledger` é separada do ledger financeiro. Aprovação, concessão e créditos exactly-once seguem a ADR 013.
- **Snapshots:** syncs validam a coleção e gravam com temp + rename; falha preserva a versão anterior. Não edite os artefatos gerados.

Os contratos por fase e seus estados de publicação estão nas ADRs listadas em [docs/README.md](../README.md), não duplicados aqui.

## 5. Anti-patterns

| Evite | Faça |
|---|---|
| `<Grid item xs={12}>`, system props ou `import *` do MUI | `size={{ xs: 12 }}`, `slotProps`, `sx` e named imports |
| Hex fora de `tokens.css` | Tokens CSS/Tailwind ou tema MUI |
| Editar conteúdo gerado ou symlinks de tenant | Editar as fontes canônicas |
| `fetch(API_URL...)` | `resolveApiUrl(...)` e `authFetch` |
| Prefixo `/admin/` no proxy | Endpoints específicos fora desse prefixo ou allow-list estreita |
| Página-sombra de redirect | Regra em `build-tenant-redirects.mjs` |
| `TENANT=codaqui` ou `astro check` como gate tenant | Build codaqui sem `TENANT`; tenant = build + `tenant-urls` |
| ID da entidade usado antes do save | Factory de `persistWithLedger` |
| URLs sociais ou equipe inline | `src/data/social.ts` e `src/data/team.ts` |
| Slug curto novo ou slug antigo alterado | `YYYY/MM/DD/slug` e URLs publicadas estáveis |
| Limites de paginação hardcoded | Lib, componente, DTO e envelope compartilhados |
| `startsWith` para validar host | `new URL` + HTTPS + hostname exato |
| Avisos HTML em blog/trilhas | Admonitions padronizadas |

## 6. CI, deploy e manutenção

- `deploy-astro.yml`: push em `main`/`develop` e dispatch; build matrix, gates e upload por Wrangler.
- `pr-check.yml`: backend, Trivy, quatro builds Astro e verificações codaqui.
- `publish-backend.yml`: manual; imagem multi-arch e release pela versão do backend. Redeploy no Coolify é separado e manual.
- Syncs de eventos e comunidades são horários; C4P também é horário. Badges, assembleias, projetos, universidades, mentores, anúncios, social stats e analytics têm workflows diários próprios.
- O agregador `npm run sync` não inclui todos os syncs; consulte `package.json` e DEVELOPMENT antes de publicar uma dependência nova.
- Releases com snapshot seguem a ordem da ADR: backend/migration, sync inicial quando exigido, depois frontend.

| Manutenção | Onde |
|---|---|
| Equipe, timeline e links sociais | `frontend/src/data/` |
| Comunidades e selos | API/admin + `sync:communities` + build |
| Fontes externas de eventos | `events.config.json` |
| Assembleias e documentos | Operação manual + admin + `sync:assemblies` |
| Novo tenant | `tenants.config.mjs`, matrices, Pages/DNS e runbook |
| Dependências | Revisão trimestral, sem upgrades acoplados a features |

## 7. Convenções de nomes

| Tipo | Padrão |
|---|---|
| Post | `blog/YYYY-MM-DD-slug.md` |
| Imagem de post | `blog/img/YYYY-MM-DD-slug/hero.png` |
| Página Astro | `frontend/src/pages/<rota>.astro` |
| Layout/componente servidor | `NomeLayout.astro` / `Nome.astro` |
| Ilha React | `NomeIsland.tsx` |
| Lib e teste | `src/lib/nome.ts` e `nome.test.ts` |
| Dados | `src/data/nome.ts` |
| Script | `frontend/scripts/nome.mjs` ou `scripts/nome.mjs` |
| Asset | `static/img/descricao.ext` |

## 8. Checklist de PR

- [ ] Gates das camadas alteradas passaram; builds tenants incluídos quando houver código/conteúdo compartilhado.
- [ ] Versões e changelog foram atualizados quando a mudança compõe uma release.
- [ ] Conteúdo e dados foram alterados nas fontes canônicas.
- [ ] Paginação, proxy, tokens e MUI seguem os contratos compartilhados.
- [ ] URLs antigas, sitemap, `noindex` e redirects continuam válidos.
- [ ] Imagens estão otimizadas e têm `alt`; IconButtons têm `aria-label`; headings não pulam nível.
- [ ] Links externos usam `target="_blank" rel="noopener noreferrer"`.
- [ ] Linguagem usa “participantes”, “programa”, “encontros” e “Associação”.
- [ ] Nenhum segredo, dump, snapshot editado ou artefato temporário foi incluído.
- [ ] Documentação viva e ADRs afetadas foram atualizadas sem reclassificar planos como publicados.

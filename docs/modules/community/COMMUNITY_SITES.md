<!-- AGENT-INDEX
purpose: Documentação viva do registro de comunidades, snapshots e sites whitelabel/tenants no portal Codaqui.
audience: AI agents, mantenedores, contribuidores
sections:
  - Visão geral e fontes de verdade
  - Registro PostgreSQL e seed
  - Onde vive cada peça
  - APIs, selo e doações
  - Checklist para nova comunidade
  - Domínio próprio e anti-patterns
related-docs:
  - AGENTS.md — guia geral do monorepo
  - ../../adrs/004-multisite-communities.md — decisão histórica do multi-tenant
  - ../../adrs/007-community-registry.md — registro, seed, snapshot e doações
  - ../../adrs/011-frontend-astro-multi-tenant-pages.md — build matrix atual
  - ../../../DEVELOPMENT.md — runbook dos tenants e syncs
agent-protocol:
  - Edite branding/conteúdo em comunidades/<slug>/ e o registro estruturado pela API/admin; não trate siteEnabled como provisionamento de tenant.
  - Não editar src-tenants nem snapshots gerados manualmente.
-->

# Comunidades e Sites Whitelabel

O portal tem seis comunidades no registro público. DevParaná, Elas no Código e T.I. Social também possuem domínio próprio por build Astro no Cloudflare Pages; CamposTech usa somente o portal. Cloud Native Maringá e Cumbuca Dev são Parceiras, sem site tenant.

## Visão geral e fontes de verdade

- **Registro estruturado:** tabela `communities` no PostgreSQL (migration 028), administrada pela API e por `/admin/comunidades`. Guarda dados públicos, nível, lifecycle, selo e configuração declarativa de site.
- **Snapshot público:** `static/communities/index.json`, gerado por `scripts/sync-communities.mjs` e copiado no prebuild. `/comunidades` lê esse snapshot em build time; o browser não consulta o backend para montar a listagem.
- **Branding e conteúdo whitelabel:** `comunidades/<slug>/community.config.ts`, `blog/`, `docs/` e dados locais continuam canônicos e versionados. `frontend/src-tenants/` consome esse conteúdo por symlink e é read-only para edição.
- **Provisionamento de tenant:** `frontend/tenants.config.mjs` + matrix de `deploy-astro.yml`/`pr-check.yml` + projeto Pages/DNS. `siteEnabled=true` não executa esse provisionamento.

## Registro PostgreSQL e seed

`scripts/export-community-seed.mjs` gera o JSON da migration a partir dos seis registros históricos de `frontend/src/data/communities.ts`, preservando os dados públicos. A migration é idempotente por slug e não fabrica responsáveis.

| Nível | Registros | Configuração de site entregue |
|---|---|---|
| Integrada (4) | `devparana`, `elasnocodigo`, `tisocial`, `campostechpg` | Os três primeiros têm `siteEnabled=true` e domínio histórico; CamposTech tem `siteEnabled=false`, `siteDomain=null`. |
| Parceira (2) | `cloudnativemaringa`, `cumbucadev` | Sem site tenant. |

Responsible é uma designation ativa `responsible @ community`, não uma coluna na tabela. As quatro Integradas começam sem responsible legado; isso não interrompe sites, doações ou transparência. O seed inicial e o snapshot podem divergir depois de alterações administrativas: o valor corrente vem do banco via sync, não de uma nova execução manual do seed.

## Onde vive cada peça

| Item | Caminho | Responsabilidade |
|---|---|---|
| Registro/API | `backend/src/communities/` | CRUD, listagem pública/gestão, selo e destino de doação |
| Seed | `backend/src/communities/seed/communities.json` + `scripts/export-community-seed.mjs` | Migração fiel dos seis registros históricos |
| Sync | `scripts/sync-communities.mjs` | `GET /communities/public` → snapshot atômico |
| Leitura no build | `frontend/src/lib/communities.ts` + `frontend/scripts/copy-snapshots.mjs` | Tipos e carregamento do snapshot |
| Listagem pública | `frontend/src/pages/comunidades/index.astro` | Badges de nível/selo, dados públicos e responsible |
| Gestão | `frontend/src/pages/admin/comunidades.astro` + ilha `CommunitiesAdminApp` | CRUD, solicitação/concessão de selo |
| Config da comunidade | `comunidades/<slug>/community.config.ts` | Branding, slug Stripe, navMenu e features |
| Páginas de domínio próprio | `frontend/src-tenants/<slug>/pages/*.astro` | Home, apoiar, transparência, equipe, blog/docs do tenant |
| Wrappers do portal | `frontend/src/pages/comunidades/<slug>/` | Espelham o tenant em `/comunidades/<slug>` |
| Componentes compartilhados | `frontend/src/components/astro/community/` | Hero, explore, blog, docs e transparência |
| Resolver de tenant | `frontend/src/lib/community.ts` | `loadTenantConfig`, `tenantNav`, `communityBasePath` |

## APIs, selo e doações

- `GET /communities/public`: somente ativas; preserva `id=slug` e `logo=logoUrl`, acrescenta governança/site/responsible. Selo expirado não aparece como efetivo; concessão e validade históricas permanecem no payload.
- `GET /communities/manage`: admin lista todas; responsible lista somente as próprias. Busca e paginação padrão (50, cap 100).
- `POST /communities`: admin; `tesouro-geral` é reservado.
- `PATCH /communities/:id`: admin ou responsible ativo da comunidade; responsible edita somente perfil, slug existente é imutável e mudanças gravam auditoria com before/after.
- `POST /communities/:id/seal/request`: admin ou responsible ativo; nova solicitação parte de `none`, renovação por esse fluxo só após expiração.
- `POST /communities/:id/seal`: admin; exige responsible ativo e `sealNotes`, define validade futura ou um ano e grava auditoria de governo. É também o fluxo de renovação com selo vigente.

No checkout, `communityId` direcionado precisa ser Integrada ativa. Parceira é recusada antes de chamar Stripe; `tesouro-geral` segue aceito. CamposTech continua aceito e seu ledger/transparência continuam por `projectKey=campostechpg`, independentemente de não ter tenant.

O proxy recebeu apenas `/communities/`. Não adicione `/admin/` nem confunda `/admin/comunidades` (asset) com a API.

## Sync e publicação

```bash
npm run sync:communities
# ou, apontando explicitamente para um backend local:
COMMUNITIES_API_URL=http://localhost:3001 npm run sync:communities
```

O workflow `sync-community-snapshots.yml` roda de hora em hora no minuto 7 e por dispatch. Depois do sync, um novo build copia o snapshot. Se o conteúdo não mudou, o script preserva o arquivo e seu `generatedAt`.

## Checklist para nova comunidade

1. Criar o registro pela API/admin e definir nível/lifecycle; conceder responsible por `POST /designations` quando houver, sem criar coluna paralela.
2. Se houver espaço whitelabel, criar `comunidades/<slug>/` e `community.config.ts` (use T.I. Social como referência), além de `blog/` e `docs/` quando necessários.
3. Preencher `socialImage` (JPG/PNG ~1200×630) e registrar a config em `comunidades/index.ts`.
4. Criar páginas tenant reutilizando componentes compartilhados e wrappers no portal quando aplicável.
5. Confirmar `metadata.communityId === '<slug>'` no checkout e que o nível permite doação direcionada.
6. Para domínio próprio, atualizar **juntos** `frontend/tenants.config.mjs` e os matrices dos workflows, criar projeto Pages e configurar DNS/secrets pelo runbook.
7. Rodar sync de comunidades e validar `make astro-verify` + `make astro-verify-tenants`.

## Domínio próprio

Os três domínios atuais usam build matrix no Cloudflare Pages e proxy same-origin por Pages Function. Consulte [DEVELOPMENT.md §Multi-tenant](../../../DEVELOPMENT.md) para operação, R7, previews e DNS. A whitelist de origens do backend e o callback OAuth continuam necessários.

## Anti-patterns

| ❌ Don't | ✅ Do |
|---|---|
| Criar `responsibleMemberId` ou vínculo paralelo | `responsible @ community` em `member_designations` |
| Achar que `siteEnabled` cria um tenant | Atualizar tenants config + workflows + Pages/DNS |
| Recusar CamposTech por `siteEnabled=false` | Validar doação por Integrada ativa |
| Permitir doação para qualquer comunidade ativa | Exigir `level=integrada` e `status=active` |
| Editar snapshot ou `frontend/src-tenants/<slug>/` | Rodar sync; editar conteúdo em `comunidades/<slug>/` |
| Hardcode nome/cor da comunidade | `community.shortName` / `community.theme.primary` |
| Filtrar ledger por UUID de comunidade | `projectKey` igual ao slug histórico |
| Adicionar prefixo `/admin/` ao proxy | APIs `/communities/`, `/designations/` etc.; páginas admin continuam assets |

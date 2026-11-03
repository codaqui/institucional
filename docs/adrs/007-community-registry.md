<!-- AGENT-INDEX
purpose: ADR do registro PostgreSQL de comunidades, seed histórico, snapshot público, selo e validação de doações da Fase 1a.
audience: AI agents, mantenedores e admins trabalhando em comunidades, doações e sites tenant.
status: Implementado na Fase 1a (2026-11-02).
sections:
  - Contexto
  - Decisão
  - Seed e compatibilidade
  - APIs, selo e doações
  - Snapshot e frontend
  - Consequências e limites
related-docs:
  - 004-multisite-communities.md — decisão histórica de sites whitelabel
  - 006-directorates-designations.md — responsible @ community
  - ../modules/community/COMMUNITY_SITES.md — operação dos tenants e conteúdo canônico
  - ../../DEVELOPMENT.md — sync de comunidades e endpoints
agent-protocol:
  - Existem somente Parceira e Integrada; Autônoma, split/payout e campos de mantenedor não foram implementados.
  - O conteúdo whitelabel continua em comunidades/<slug>/; o registro PostgreSQL não substitui esses arquivos.
-->

# ADR 007 — Registro de Comunidades

- **Data da decisão:** 2026-11-02
- **Status:** Implementado (Fase 1a)
- **Escopo:** `backend/src/communities/`, migration 028, `scripts/sync-communities.mjs`, snapshot e página `/comunidades`, validação do checkout

## Contexto

Os seis registros públicos de comunidades existiam somente em `frontend/src/data/communities.ts`, enquanto tenants, conteúdo whitelabel, contas do ledger e checkout já usavam slugs de comunidade. A Fase 1a precisava de um registro administrável com nível, lifecycle, selo e responsible, sem perder os dados públicos nem interromper sites e doações existentes.

## Decisão

Criar a tabela `communities` no PostgreSQL como fonte do registro estruturado e publicar uma cópia pública em `static/communities/index.json`. O snapshot preserva o shape legado (`id` igual ao slug e `logo` derivado de `logoUrl`) e acrescenta governança e responsible público. O conteúdo narrativo e o branding dos sites continuam nos arquivos canônicos de `comunidades/<slug>/`.

Foram implementados somente os níveis **Parceira** e **Integrada**, os lifecycle `proposed`, `active`, `suspended` e `exited`, e os estados de selo `none`, `applied` e `sealed`. Responsible é `responsible @ community` em `member_designations`; não há `responsibleMemberId` na comunidade.

## Seed e compatibilidade

`scripts/export-community-seed.mjs` gera `backend/src/communities/seed/communities.json` a partir dos seis registros históricos. A migration 028 aplica o seed com `ON CONFLICT (slug) DO NOTHING` e preserva nome, descrição, emoji, logo, localização, fundação, links, perfis sociais e tags. O build Nest copia o JSON como asset para que a migration compilada também o encontre.

| Nível | Comunidades | Sites na Fase 1a |
|---|---|---|
| Integrada (4) | DevParaná, Elas no Código, T.I. Social e CamposTech | Os três primeiros têm `siteEnabled=true` e seus domínios históricos. CamposTech tem `siteEnabled=false` e `siteDomain=null`, usando o portal. |
| Parceira (2) | Cloud Native Maringá e Cumbuca Dev | Sem site tenant. |

As quatro Integradas nascem **sem responsible fabricado**. A migration apenas reporta as pendências; não inventa membros ou vínculos. Isso não desativa sites, doações ou transparência já existentes.

## APIs, selo e doações

| Endpoint | Acesso e comportamento |
|---|---|
| `GET /communities/public` | Público; somente comunidades ativas, shape legado + nível/lifecycle/selo/site/responsible. |
| `GET /communities/manage` | Admin; busca server-side e envelope paginado (`limit=50`, cap 100). |
| `POST /communities` | Admin; cria registro com slug único. |
| `PATCH /communities/:id` | Admin ou responsible ativo da comunidade via `DesignationsGuard`. |
| `POST /communities/:id/seal/request` | Admin ou responsible ativo; marca o selo como `applied`. |
| `POST /communities/:id/seal` | Admin; exige responsible ativo e avaliação manual em `sealNotes`. Usa validade futura explícita ou default de um ano e grava auditoria de governo. |

`POST /stripe/checkout-session` valida todo `communityId` direcionado antes de chamar o Stripe: somente comunidade **Integrada ativa** é aceita. Parceira, desconhecida, suspensa ou inativa é recusada. O destino especial `tesouro-geral` permanece aceito. CamposTech continua aceito porque é Integrada ativa, mesmo sem site tenant.

O proxy same-origin recebeu somente `/communities/`; `/admin/comunidades` e as páginas públicas `/comunidades/*` continuam sendo assets estáticos.

## Snapshot e frontend

`npm run sync:communities` lê `GET /communities/public` (`COMMUNITIES_API_URL`, default local) e grava `static/communities/index.json` por rename atômico. Se os dados não mudaram, preserva inclusive o `generatedAt` anterior. O workflow `sync-community-snapshots.yml` executa o sync de hora em hora, no minuto 7, e por dispatch.

O prebuild copia o snapshot para o app; `frontend/src/lib/communities.ts` o carrega em build time e `/comunidades` renderiza os seis registros ativos com badges de nível/selo e responsible quando existente. Uma alteração no registro passa a aparecer no site após sync e novo build, não por fetch do browser.

## Consequências e limites

- O registro estruturado deixa de depender de edição manual do array público, enquanto o snapshot mantém leitura pública estática.
- Sites tenant continuam definidos por `frontend/tenants.config.mjs` e pelos workflows; `siteEnabled` no registro não cria build, DNS ou projeto Pages automaticamente.
- Contas e transações do ledger continuam identificadas por `projectKey`; a tabela de comunidades não migra nem duplica o ledger.
- Não foram implementados nível Autônoma, criação pública por membros, split Stripe, payout, taxa de plataforma, campos de mantenedor ou painel completo do responsible.

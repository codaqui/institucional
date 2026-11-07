<!-- AGENT-INDEX
purpose: Design aprovado da Fase 3 — Assembleias com registro fino, Discussion manual e páginas públicas.
audience: Mantenedores, revisores e implementers da Fase 3.
status: Implementado e integrado pela PR #613; categoria Reuniões configurada, com validação real de Giscus pendente.
sections:
  - Decisão e escopo
  - Modelo e invariantes
  - API e autorização
  - Discussions/Giscus
  - Snapshot e frontend
  - Verificação e release
related-docs:
  - docs/plans/codaqui-1-0/README.md — subsistema A e decisões gerais
  - docs/plans/codaqui-1-0/rbac.md — permissões de assembleias
  - docs/adrs/013-hour-ledger.md — exemplo de ADR e handoff de fase anterior
agent-protocol:
  - Discussions são manuais e imutáveis por pathname; não automatizar via GitHub App.
  - Não implementar entidades, mentoria, Universitário, Business tiers ou C4P.
-->

# Fase 3 — Assembleias: design

## Decisão e escopo

A Fase 3 entrega assembleias com registro estruturado mínimo, Discussion vinculada manualmente, páginas públicas estáticas, comentários via Giscus e operação administrativa. A narrativa de pauta, quórum, votos e ata vive no GitHub; o banco contém apenas dados consultáveis e metadados de registro/cartório.

Não há criação de Discussion via GitHub App, upload de PDF, votação, novas tabelas de vínculo ou mudanças na ledger financeira/de horas. Fases 4–7 permanecem fora do escopo.

## Modelo e invariantes

Migration **036**, backend **0.15.0**.

`Assembly`:

- `id`: UUID.
- `type`: `ordinaria | oficial`.
- `number`: inteiro positivo, sequencial por tipo.
- `title`: texto limitado, obrigatório.
- `scheduledAt`: data/hora prevista, obrigatória.
- `heldAt`: data/hora efetiva, obrigatória somente quando `status=held`.
- `status`: `scheduled | held | canceled`.
- `agendaSummary`: resumo curto, não a pauta narrativa completa.
- `discussionUrl`: URL pública da Discussion, obrigatória.
- `ataPdfUrl`: URL externa HTTPS opcional até ser exigida para `oficial` realizada.
- `notaryRegistry`: `{ book, page, registeredAt } | null`.
- `createdById`: membro criador, somente trilha; não é permissão.
- `createdAt`, `updatedAt`.

Regras:

- `(type, number)` é único. O slug é derivado como `<type>-<number>` e não muda depois da criação.
- A numeração usa transação e atualização condicional; duas criações concorrentes do mesmo tipo nunca compartilham número.
- `scheduled` permite `held` ou `canceled`. `held` é terminal para status; dados cartorários podem ser completados por admin sem alterar o slug ou a Discussion.
- `heldAt` é exigido para realizar e não pode ser anterior a `scheduledAt`.
- `oficial` realizada exige `ataPdfUrl` e `notaryRegistry` completo. `ordinaria` aceita esses dados como opcionais.
- `discussionUrl` usa HTTPS, hostname exato `github.com` e path `/codaqui/institucional/discussions/<número>`.
- PDF usa o `StorageService` e sua allowlist existente. Nenhum arquivo é enviado ao backend.
- `createdById` não altera autorização e não aparece no payload público.

## API e autorização

Endpoints:

- `GET /assemblies/public`: coleção completa para o snapshot, ordenada por `scheduledAt DESC`.
- `GET /assemblies/public/:slug`: detalhe público derivado de tipo/número.
- `GET /assemblies`: listagem administrativa paginada, com filtros por tipo/status e envelope `{data,total,page,totalPages,limit}`.
- `POST /assemblies`: cria, exigindo admin ou diretor ativo.
- `PATCH /assemblies/:id`: edita campos permitidos e transições, com as mesmas regras de domínio; cartório somente admin.

Todas as mutações gravam audit de governo com ação, ator, alvo e mudanças relevantes. Não há endpoint sob `/admin/`. O prefixo `/assemblies/` entra na allow-list do proxy após confirmar que não colide com `/assembleias` ou outras páginas estáticas.

O payload público contém `id`, tipo, número, slug, título, datas, status, resumo, Discussion, PDF e cartório público quando aplicável. Não inclui `createdById`, dados do membro, cookies ou tokens.

## Discussion e Giscus

- Usar a categoria **Reuniões** já existente no repositório e persistir seu `categoryId` na configuração do frontend.
- Cada cadastro informa manualmente uma Discussion dessa categoria.
- O título da Discussion é exatamente `/assembleias/<type>-<number>`, igual ao pathname da página.
- `discussionUrl` e slug não mudam após a criação; título da assembleia pode mudar sem afetar comentários.
- Giscus usa `pathname`, `strict=0`, reações e metadados como no blog, com a categoria Reuniões.
- A configuração de Assembleias fica separada de `GISCUS_CONFIG` do blog para não alterar comentários existentes.

## Snapshot e frontend

- `static/assemblies/index.json`: `{ generatedAt, assemblies }`, produzido por `scripts/sync-assemblies.mjs` a partir de `GET /assemblies/public`.
- Sync valida toda a resposta, escreve por arquivo temporário + rename e preserva o snapshot anterior em qualquer falha.
- Workflow diário às **06:23 UTC** + dispatch, com permissões mínimas. O snapshot inicial é validado localmente antes da publicação.
- `/assembleias`: listagem com título, tipo/número, datas, status e resumo, incluindo canceladas para transparência.
- `/assembleias/:slug`: detalhe com Giscus, data efetiva quando houver e PDF/cartório para oficial.
- `/admin/assembleias`: página fina com ilha MUI, CRUD, realização/cancelamento e cartório. Navegação entra em Governança.
- Rotas de app usam noindex; páginas públicas têm OG/JSON-LD e entram no sitemap.

## Verificação e release

- Testes unitários e de integração para numeração concorrente, transições, cartório obrigatório, URLs, autorização e payload sem dados privados.
- Migration 036 down/up no dump isolado, preservando os dados existentes.
- Sync com resposta inválida/falha preservando o arquivo anterior.
- Testes das ilhas, listagem/detalhe, configuração Giscus e acessibilidade.
- Fluxo real em Podman: criar assembleia e Discussion manual, realizar/cancelar, anexar PDF, renderizar página e comentários.
- Gates: backend build/Jest, `make astro-verify`, `make astro-verify-tenants`, `npm run test:scripts`, revisão independente e PR para `develop`.
- Backend `0.15.0` só é publicado após revisão e integração no HEAD correto de `main`. Reconcile e claim da Fase 2 não bloqueiam esta fase.

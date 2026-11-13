<!-- AGENT-INDEX
purpose: Consolidação das fases candidatas pós-1.0.0 para avaliação da presidência e coordenação de agentes — levantamento de 2026-11-13, após a Fase 7 (C4P) fechar o plano 1.0.0. Substitui o snapshot histórico de docs/plans/PROXIMOS_PASSOS.md (2026-09-10, arquivado).
audience: Presidência, mantenedores, AI agents planejando o pós-1.0.0.
status: Consolidação viva (2026-11-13) — revalidar cada item no código antes de executar; itens marcados ⚠️ exigem revalidação explícita.
sections:
  - Contexto — por que este documento
  - Gate 0 — rollout da Fase 7 (pré-requisito de tudo)
  - Fase 7.1 — C4P follow-ups (menores deferidos + fora de escopo rápido)
  - Camada 3 do sync de eventos (eliminar o GitHub-as-database)
  - Sprint 6 — hub unificado de eventos (UI/UX)
  - Hardening financeiro ⚠️
  - Atualização de dependências
  - Real Network — Sprint 0
  - Votação eletrônica formal (1.1)
  - Consolidação de frontend (onda 2)
  - Multisite — onboarding de comunidades
  - Pendências operacionais (não são fases de código)
  - Demandas brutas pós-1.0.0 (levantamento 2026-11-13)
  - Como propor uma nova fase
related-docs:
  - docs/plans/codaqui-1-0/README.md — plano-mãe 1.0.0 (Fase 7 = última fase)
  - docs/plans/PROXIMOS_PASSOS.md — snapshot histórico 2026-09-10 (arquivado; ⚠️ itens de lá precisam de revalidação)
  - docs/plans/events-sync-improvements/MAP.md — Camadas 1-2 do sync (Camada 3 aprovada, não executada)
  - docs/plans/event-uiux-improvements/README.md — Sprints 1-5 concluídas; Sprint 6 não executada
  - docs/plans/update/README.md — upgrades de dependências (⚠️ MUI 7→9 já foi feito nas fases; plano defasado)
  - docs/plans/real-network/README.md — RFC teórico (nada implementado)
  - docs/adrs/012-c4p.md — Fase 7; seção "Fora de escopo" lista os follow-ups do C4P
agent-protocol:
  - Nenhuma fase aqui está aprovada — a presidência escolhe e ratifica o escopo (mesmo ritual das fases 1a-7: spec → plano TDD → implementação → revisão independente).
  - ⚠️ = item do snapshot histórico de 2026-09-10 que pode ter sido resolvido pelas fases 2-7; CONFIRME NO CÓDIGO antes de propor tarefa.
  - O rollout da Fase 7 (release 1.0.0-backend) precede qualquer trabalho novo.
-->

# Fases pós-1.0.0 — consolidação para coordenação

## Contexto — por que este documento

O plano 1.0.0 (`docs/plans/codaqui-1-0/README.md`) fecha com a **Fase 7 (C4P)**: nenhuma "Fase 8" está planejada. O snapshot `PROXIMOS_PASSOS.md` (2026-09-10) está arquivado e envelheceu — boa parte foi absorvida pelas fases 2–7. Este documento consolida, com data de referência 2026-11-13, o que sobrou e o que nasceu desde então, para a presidência escolher o próximo marco. **Nada aqui está aprovado.**

## Gate 0 — rollout da Fase 7 (pré-requisito de tudo)

1. Merge da PR #639 (`develop` → `main`) + release **v1.0.0-backend** (workflow manual) + redeploy no Coolify.
2. Migration 049 em produção + sync inicial do snapshot C4P (`sync-c4p.yml` dispatch).
3. Deploy do frontend + **campanha piloto real** (submissão → curadoria → finalização → e-mails + PDF) — valida menores deferidos (ex.: vitrine fora da janela).
4. Pendências externas acumuladas de fases anteriores: **Discussion real da primeira assembleia** (Fase 3), **validação visual** do Experiência do Membro (Fase 6a) e **aviso real** de Announcements (Fase 6b).

## Fase 7.1 — C4P follow-ups (P — 1 PR)

Menores deferidos da revisão independente da Fase 7 (detalhes em `docs/adrs/012-c4p.md` e na PR #639):

1. Teste para "votos de avaliador removido continuam contando" no dashboard.
2. `accept` de convite sem checar `designation === 'evaluator'` (hardening, hoje inalcançável).
3. `ILike` sem escape de `%`/`_` no convite de avaliador.
4. Vitrine/snapshot listam campanha `open` fora da janela (CTA morto) — alinhar filtro.
5. Aba Finalização carrega no máximo 100 propostas (cap do DTO).
6. Severidade do `Alert` por heurística de string (`includes("Não")` quebra com mensagens em inglês do Nest).
7. `getEvaluatorCall` O(votes × talks).

**Fora de escopo da spec que virou candidato:** selo "C4P aberto" na página do evento (snapshot já carrega o vínculo); grade do evento alimentada pelas palestras aprovadas (pós-piloto); fila persistente para e-mails de resultado (se o volume do piloto justificar); avaliador sem conta GitHub (token de convidado, se a diretoria exigir).

## Camada 3 do sync de eventos (M — 2-3 PRs)

Eliminar o **GitHub-as-database**: hoje o force-sync manual abre PR via token OAuth do membro (`POST /events/internal/snapshot`). Design aprovado desde 2026-09 (`docs/plans/events-sync-improvements/`): dispatch `repository_dispatch` com debounce ao publicar/editar/cancelar eventos, novo endpoint no admin, remoção do fluxo de PR. **Blast radius conhecido:** `GitHubDBService` é compartilhado — o token OAuth criptografado do membro (`members.service.ts`) e `event-organizer.module.ts` também o usam; a remoção completa de `backend/src/github-db/` é follow-up **separado** (exige decidir o destino do token). Sequência: validar sync em produção → secret `GITHUB_DISPATCH_TOKEN` → backend dispatch → workflow → admin → remoção.

## Sprint 6 — hub unificado de eventos (M)

`docs/plans/event-uiux-improvements/README.md`: hub `/admin/eventos-hub` inexistente; `/admin/overrides` legado potencialmente conflitante; dores remanescentes (3.2.4 botão em rascunho, 3.3.4 `endAt > startAt`, 3.4.x checkout, 3.5.x check-in, 3.8.x listagem). **⚠️ Revalidar o escopo:** várias dores foram suplantadas pelas fases 1a–7 e pela Fase 6a (certificados por deep link, central de check-in com abas). O backlog arquitetural do item "Paginação × filtros client-side" no hub pode ter mudado.

## Hardening financeiro (M-G) ⚠️ REVALIDAR

Backlog do snapshot 2026-09-10 (`PROXIMOS_PASSOS.md` §Backlog): atomicidade do ledger (`recordTransaction` com transação própria), race de saldo em aprovação de reembolso (lock na linha, não na conta), rejeição × aprovação concorrentes, idempotência de refund de ingresso (`Date.now()` no `referenceId`), refund total após cancelamento, SortCoins congelado por cancelamento de 1 assinatura, `fetchActiveSubscriptions` truncado em 100, `amount` não inteiro no checkout de doação → 500, taxas Stripe de ingressos fora do ledger. **Várias dessas áreas foram tocadas pelas fases 2–7 (ledger, horas, eventos) — cada item precisa de revalidação no código atual antes de virar tarefa.** É o candidato de maior risco real do sistema.

## Atualização de dependências (P-M — PRs pequenos)

`docs/plans/update/README.md` (**⚠️ defasado**: MUI 7→9 e TS 5.7 já foram feitos nas fases 0-7; regerar o snapshot com `npm outdated` antes). Restam: Stripe SDK 21→22 (backend, validar webhooks em homologação), ESLint 9→10 + class-validator 0.14→0.15 (backend), TypeScript 5→6 (backend sozinho; frontend depende do Astro). Vulnerabilidades transitivas: monitorar, sem `npm audit fix --force`.

## Real Network — Sprint 0 (P — ~1 dia)

`docs/plans/real-network/README.md` (RFC teórico): o handle Mastodon no perfil público é independente e barato. O restante da RFC (rede social local federada) continua sem implementação.

## Votação eletrônica formal (G — candidata a 1.1)

`PROXIMOS_PASSOS.md` e o plano-mãe marcam "votação online" como candidata pós-1.0.0 (assembleias híbridas com Discussion manual permanecem). Só existe o desenho conceitual; exigiriam quorum eletrônico, auditabilidade e LGPD revisitados.

## Consolidação de frontend — "onda 2" (M)

Não é refatoração completa (essa foi a Fase 0, ADR 011, concluída) — é consolidação de débito acumulado nas fases 1a–7: boilerplate repetido nas ~15 ilhas admin (loading/erro/feedback/paginação — candidato a hook/componente compartilhado), `client:only` onipresente (SEO/no-JS), ilhas grandes (`/membro`, check-in/orders de eventos), system props MUI v9 remanescentes, validadores/tipos duplicados frontend↔backend. O corte (DX vs performance vs consistência) depende da prioridade da presidência.

## Multisite — onboarding de comunidades (P)

CamposTech e Cloud Native Maringá sem site (níveis/registro existem; `siteEnabled=false`). Pré-condição: medir tempo de build com 3 tenants antes da 4ª (gate do plano). Checklist: `docs/modules/community/COMMUNITY_SITES.md`. O plano `docs/plans/multisite/README.md` está defasado (Fase 0.5 o suplantou) — atualizar antes de coordenar.

## Demandas brutas pós-1.0.0 (levantamento 2026-11-13)

Levantamento do mantenedor, **investigado em 2026-11-13** (diagnóstico completo nesta seção; consolidação também registrada no doc e na conversa do mantenedor):

1. **Mentor ativo não aparece no frontend** — CONFIRMADO gap real: aprovação pelo módulo genérico de designations (`POST /designations/:id/confirm`) ativa a designation mas **nunca ativa o `mentor_profiles`** (o filtro de `/mentorship/public` é só `profile.active` + `members.isActive`); `apply()` não é transacional e quebra reaplicação (designation pending órfã → 404 no approve); revoke genérico não desativa o perfil (mentor continua no diretório). Teste de discriminação: se `GET /mentorship/public` já contém o mentor, é só latência de sync/deploy (página 100% estática).
2. **Sessões de mentoria (área do mentor)** — ilha renderiza ISO cru de data, status sem rótulo, sem paginação real e **não usa `menteeMemberId`/`menteeEmail`** (backend já devolve); vínculo a membro só nasce da reserva logada ou match de e-mail no OAuth — não há vínculo manual.
3. **`/sobre/equipe`** — 100% hardcoded (`team.ts`, 18 entradas, 13 com URL de GitHub); a infra de match por handle **já existe** (padrão embaixadores `community-devparana.ts` + vanity `/@handle`); placeholder estilo mentoria é reaproveitável em conceito (registro inativo + reatribuição preservando UUID).
4. **`/sobre/ong`** — NÃO conectada ao banco novo: comunidades e portais hardcoded; só o muro de doadores é dinâmico (`/members/donors`). Snapshot de comunidades (ADR 007) existe e não é consumido.
5. **`/eventos` texto estourando** — `EventCard.astro:85` renderiza `event.summary` cru: sem line-clamp, sem `overflow-wrap` (`truncateEventSummary` só serve SEO); fonte Discord do sync não trunca nem stripa markdown.
6. **Projetos de `/projetos` virarem extensão** — a página é híbrida (11 repos open source estáticos + seção de extensão que JÁ lê o snapshot, hoje vazio). Os 11 repos **não encaixam naturalmente** (falta entidade jurídica obrigatória, ODS, datas, mentor) — são vitrine de código, não extensão. A seção dinâmica está vazia porque não há `extension_projects` ativos públicos ainda.
7. **Patrocinador pessoal→empresarial** — `/patrocinadores` lê só `companies` (métricas por `companyId`); assinatura pessoal **nunca aparece** e não existe conversão/migração pessoal→empresa (metadata Stripe é fixa na criação). Dump pg disponível em `pg_dump/` (restaurado localmente em `codaqui_certificate_test` para análises).
8. **Blog prévia com imagem** — card é texto-only por construção (`plainExcerpt` remove imagens); ~10 posts têm imagem antes do `<!-- truncate -->` e o `image:` do frontmatter (existe no schema) é ignorado na listagem.
9. **`/membro` over-information** — confirmado: sub-aba "SortCoins e reembolsos" contém **apenas reembolsos** (rótulo errado); doações/assinaturas/reembolsos aparecem em 3 lugares cada; Tabs MUI aninhadas em 3 níveis com mesmo peso visual (Eventos→Futuros/Comprei/Histórico).
10. **Sub-menus do admin** — 9 grupos/25 itens; órfãos: "Mentoria" (Programas) aponta para área de membro, "Transferências" só existe no hub, Universitário (programa) fora de "Programas", critério role-vs-designation misto em Governança, C4P dentro de Eventos (questionável).
11. **`/admin/announcements`** — **implementada e em produção desde 12/11** (responde 200). O relato de "não implementado" coincide com o **crash-loop do backend 1.0.0** (502 em `/health`) — a ilha não carregava dados, não era 404 de rota. Resolvido pelo hotfix 1.0.1.
12. **Cadastro de projeto de extensão** — formulário admin: mentor/coMentors exigem **UUID digitado** (sem autocomplete — pattern de busca de membros já existe na ilha de mentoria), ODS só número sem nomes, orçamento/anexos/parceria/supportPartners existem no modelo mas **não renderizados na UI**, metodologia PjBL deveria vir pré-preenchida, sem campos de área CNPq (nem no plano).

**Agrupamento natural após investigação:** (1, 3, 4, 6, 7) = "páginas públicas e fluxos conectados ao banco"; (2, 9, 10, 12) = "UX dos painéis e cadastros"; (5, 8, 11) = correções pontuais (11 resolvido pelo hotfix).

**Lição operacional (hotfix 1.0.1, 2026-11-13):** falha de DI de guard em módulo novo (`TurnstileGuard` sem `TurnstileModule` importado na `C4pModule`) derrubou produção em crash-loop e **nenhum teste pegou** — specs de controller fazem override de guards, o E2E de C4P roda com guard mockado, e os E2E de boot real não rodam na CI. Follow-up: job de boot do app real no `pr-check.yml`.

## Como propor uma nova fase

Mesmo ritual das fases 1a–7: (1) investigar e consolidar achados; (2) spec executável em `docs/superpowers/specs/YYYY-MM-DD-<nome>-design.md` com pontos de revisão humana; (3) plano TDD em `docs/plans/`; (4) ratificação da presidência das decisões em conflito; (5) implementação em `develop` com PR de acompanhamento; (6) revisão independente; (7) ADR própria se introduzir contrato novo. Bump semver do backend segue o padrão (feat → minor).

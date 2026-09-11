<!-- AGENT-INDEX
purpose: Mapa de navegação do plano de melhorias do fluxo de eventos (banco → sync → Git → site). Ponto de entrada obrigatório antes de trabalhar em qualquer item.
audience: AI agents, maintainers
read-first: true
sections:
  - Contexto em 30 segundos (fluxo atual)
  - Achados da investigação (resumo)
  - Design docs por camada
  - Ordem de implementação e frentes
  - Status
  - Verificação
related-docs:
  - layer1-quick-wins-design.md — bugs em produção + limpeza
  - layer2-robustez-design.md — endurecimento do pipeline
  - layer3-sem-pr-design.md — design estratégico (repository_dispatch), NÃO implementar
  - ../../../AGENTS.md — convenções do monorepo
  - ../../adrs/001-event-platform.md — ADR da plataforma de eventos
agent-protocol:
  - Você foi enviado para implementar um item? Leia SOMENTE o design doc da sua camada + esta seção de Contexto. Não releia o codebase inteiro.
  - Cada design doc tem escopo de arquivos fechado. Não saia dele sem atualizar o MAP.md (seção Status).
  - Ao concluir uma frente, marque os itens no Status e rode os comandos de Verificação.
-->

# MAP — Melhorias do Fluxo de Eventos (sync banco → Git → site)

## Contexto em 30 segundos

Eventos próprios (`managed_events` no PostgreSQL) são expostos por `GET /events/public/managed` (backend NestJS), puxados pelo `scripts/sync-events.mjs` (workflow horário `.github/workflows/sync-event-snapshots.yml`, commit direto em `main`) e gravados em `static/events/`. O frontend lê esses JSONs estáticos. Overrides de metadados vivem na tabela `event_overrides` (edição direta via API — o fluxo antigo de PR/GitHub-as-Database morreu para overrides; o ÚNICO resquício vivo de PR é o force-sync manual de snapshot interno `POST /events/internal/snapshot`).

Fluxo ASCII:

```
managed_events (PG, status=published)
  │  GET /events/public/managed           ← backend/src/events/events.controller.ts:45
  ▼
scripts/sync-events.mjs                   ← fonte internal:codaqui resolvida em processInternalSource()
  │  (deveria aplicar GET /events/overrides/public — HOJE NÃO APLICA, ver bug L1-1)
  ▼
static/events/internal/codaqui/*.json + static/events/index.json
  │  commit direto em main (workflow horário 0 * * * *)
  ▼
GitHub Pages → src/pages/eventos.tsx (lista) e src/pages/eventos/detalhe.tsx (detalhe)
                ↑ frontend ainda faz fallback ao vivo p/ overrides (src/lib/events-api.ts)
```

## Achados da investigação (resumo executivo)

| # | Severidade | Achado | Onde |
|---|-----------|--------|------|
| 1 | 🔴 bug prod | Workflow não exporta `EVENT_OVERRIDES_API_URL` → sync sempre com 0 overrides; site depende de fallback ao vivo no cliente | `.github/workflows/sync-event-snapshots.yml:50-55`, `scripts/sync-events.mjs:20` |
| 2 | 🔴 bug prod | `readExternalWorkloadMinutes` lê `.override.json` apagados do repo → carga horária em certificado de evento externo sempre `null` | `backend/src/events/events.service.ts:2051-2074` |
| 3 | 🟠 UX | Detalhe de evento interno só lê JSON estático (sem fallback p/ API) → página de erro até 1h pós-publicação | `src/utils/event-override.ts:153-188` |
| 4 | 🟡 morto | `static/events/bevy/` órfã; funções mortas em `src/utils/event-override.ts` e `src/data/events.ts`; `events.service.ts:3081-3093` lê `.override.json` inexistentes; scripts legados; comentários/AGENTS.md desatualizados | vários |
| 5 | 🟡 frágil | `applyOverride` sem try/catch; `cleanSourceDir` apaga antes de gravar; push sem rebase | `scripts/sync-events.mjs` |
| 6 | 🟡 UX | Separação futuro/passado por `status`, não por data | `src/pages/eventos.tsx:354-368` |
| 7 | 🟡 validação | `imageUrl` sem `@IsUrl`; `capacity` com semântica dupla | `backend/src/events/dto/*` |
| 8 | 🟡 testes | Zero cobertura de `internal:codaqui`/overrides no sync | `scripts/sync-events.test.mjs` |

## Design docs por camada

- **[layer1-quick-wins-design.md](./layer1-quick-wins-design.md)** — conserta bugs 1–3 + limpeza (item 4). **Implementar agora.**
- **[layer2-robustez-design.md](./layer2-robustez-design.md)** — endurecimento (items 5–8). **Implementar agora.**
- **[layer3-sem-pr-design.md](./layer3-sem-pr-design.md)** — elimina o último PR via `repository_dispatch`. **Apenas design — não implementar nesta rodada.**

## Ordem de implementação e frentes

As frentes A/B/C são **independentes** (arquivos disjuntos) e podem rodar em paralelo:

| Frente | Escopo | Arquivos | Design |
|--------|--------|----------|--------|
| A — backend | L1-2, L1-4 (backend), L2-7 | `backend/src/events/**` | layer1 §L1-2, layer2 §L2-7 |
| B — sync/workflow | L1-1, L1-4 (bevy), L2-5, L2-8 | `.github/workflows/`, `scripts/`, `static/events/bevy/` | layer1 §L1-1/L1-4, layer2 §L2-5/L2-8 |
| C — frontend | L1-3, L1-4 (frontend), L2-6 | `src/utils/event-override.ts`, `src/pages/eventos*`, `src/data/events.ts`, `src/components/`, `AGENTS.md` | layer1 §L1-3/L1-4, layer2 §L2-6 |

Regra de ouro: cada agente implementa apenas os itens do seu design doc, apenas nos arquivos listados.

## Status

| Item | Descrição | Frente | Status |
|------|-----------|--------|--------|
| L1-1 | Exportar `EVENT_OVERRIDES_API_URL` no workflow | B | ✅ |
| L1-2 | `readExternalWorkloadMinutes` ler `event_overrides` do PG | A | ✅ |
| L1-3 | Fallback ao vivo no detalhe de evento interno | C | ✅ |
| L1-4 | Limpeza de código morto + docs | A/B/C | ✅ (incl. `bevy` no tipo `EventSourceType` e comentário no DTO do backend) |
| L2-5 | try/catch em `applyOverride` + escrita atômica | B | ✅ |
| L2-6 | Futuro/passado por `startAt` | C | ✅ (cancelados mantidos na agenda, comportamento pré-existente) |
| L2-7 | `@IsUrl` em `imageUrl` + validação condicional de `capacity` | A | ✅ |
| L2-8 | Testes de `processInternalSource`/overrides no sync | B | ✅ |
| L3-* | Repository dispatch (sem PR) | — | ⬜ design only |

**Rodada 1 concluída em 2026-09-04** — frentes A/B/C implementadas e verificadas (typecheck ✅, `npm run build` ✅, jest backend 605 testes ✅, testes .mjs 26/26 ✅). Pendente: validar em produção o próximo run do workflow (log deve mostrar `N override(s) carregado(s)` com N>0 quando houver overrides no banco).

## Verificação (rodar ao final de cada frente e no fim)

```bash
# Frontend (raiz)
npm run typecheck
npm run build        # completo, igual ao CI

# Sync script
node --check scripts/sync-events.mjs   # sintaxe
node scripts/sync-events.test.mjs      # ou: ver package.json como os testes .mjs rodam

# Backend
cd backend && npm run build && npx jest --silent
```

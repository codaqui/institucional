<!-- AGENT-INDEX
purpose: Design da Camada 1 — quick wins que consertam bugs em produção no fluxo de eventos (sync de snapshots e detalhe de evento interno) + limpeza de código morto.
audience: AI agents, maintainers
read-first: true
sections:
  - L1-1 — Workflow não exporta EVENT_OVERRIDES_API_URL (bug prod)
  - L1-2 — readExternalWorkloadMinutes lê .override.json apagados (bug prod)
  - L1-3 — Fallback ao vivo no detalhe de evento interno
  - L1-4 — Limpeza de código morto e docs desatualizadas
  - Critérios de aceite
related-docs:
  - ./MAP.md — mapa de navegação do plano
  - ./layer2-robustez-design.md — endurecimento do pipeline
  - ../../../AGENTS.md — convenções do monorepo
agent-protocol:
  - Escopo fechado: só mexa nos arquivos listados. Bugs 1–3 são alterações pequenas e cirúrgicas — não refatore ao redor.
  - L1-4 é destrutivo (deleções). Delete apenas o que está listado como morto/legado aqui; nada além.
-->

# Layer 1 — Quick Wins (bugs em produção + limpeza)

## L1-1 — Workflow não exporta `EVENT_OVERRIDES_API_URL` 🔴

**Arquivo:** `.github/workflows/sync-event-snapshots.yml` (env por volta da linha 50-55).

**Problema:** `scripts/sync-events.mjs:20` resolve a URL de overrides com
`process.env.EVENT_OVERRIDES_API_URL || "http://localhost:3000/events/overrides/public"`.
No CI não há backend em localhost → `fetch failed` → `0 override(s) carregado(s)` (confirmado em log de produção, run 33875677435). Os snapshots saem sempre **sem overrides aplicados**; o site só exibe metadados editados porque o frontend re-busca overrides ao vivo (`src/lib/events-api.ts:41-104`). Backend fora do ar = overrides somem do site.

**Mudança:** no step que roda `npm run sync:events`, adicionar ao `env`:

```yaml
EVENT_OVERRIDES_API_URL: https://api.codaqui.dev/events/overrides/public
```

(Usar o mesmo host já usado em `INTERNAL_EVENTS_API_URL`; se o workflow monta URL via variável, seguir o padrão existente do arquivo.)

**Critério de aceite:** um run do workflow passa a logar `N override(s) carregado(s)` com N>0 quando existirem overrides no banco. Nenhuma outra linha muda.

## L1-2 — `readExternalWorkloadMinutes` lê `.override.json` apagados 🔴

**Arquivo:** `backend/src/events/events.service.ts` (função `readExternalWorkloadMinutes`, ~linhas 2051-2074).

**Problema:** a função busca `extendData.workloadMinutes` lendo `static/events/<source>/<sourceId>/<eventId>.override.json` do repo via raw.githubusercontent. Desde a migração dos overrides para o PostgreSQL, o sync **apaga** esses arquivos (`scripts/sync-events.mjs:1499-1508`) → a função praticamente sempre retorna `null` → carga horária ausente em certificados de eventos externos.

**Mudança:** injetar `EventOverridesService` (já existe em `backend/src/events/event-overrides.service.ts`; método `findByKeys`/`findByKey` por volta da linha 54) em `EventsService` e substituir a leitura do arquivo por consulta à tabela `event_overrides` (`sourceKey`, `eventId` → `payload` JSON → `extendData.workloadMinutes`).

Detalhes:
- Manter a assinatura e o contrato da função (retorna `number | null`).
- `payload` é texto JSON: parsear com try/catch e retornar `null` em caso de erro (defensivo).
- Manter qualquer fallback/caching que já existir; o GitHubDBService continua sendo usado pelo force-sync (`syncInternalSnapshot`) — **não remova** a injeção dele neste item.
- Se houver testes unitários do `EventsService` cobrindo essa função, ajustá-los para mockar o `EventOverridesService`.

**Critério de aceite:** com um override contendo `extendData.workloadMinutes = 120` na tabela, a emissão de certificado de evento externo passa a incluir a carga horária, sem nenhuma chamada a raw.githubusercontent nesse caminho.

## L1-3 — Fallback ao vivo no detalhe de evento interno 🟠

**Arquivos:** `src/utils/event-override.ts` (`loadEventWithOverride`, ~linhas 153-188) e, se necessário para tipos, `src/data/events.ts`.

**Problema:** a página de detalhe lê apenas o arquivo estático `/events/{source}/{sourceId}/{id}.json` e **lança erro** se ele não existe (`event-override.ts:166`). Evento interno recém-publicado só ganha arquivo no próximo sync horário (ou force-sync via PR) → página de erro "Não foi possível carregar este evento" por até 1h.

**Mudança:** em `loadEventWithOverride`, quando o fetch do JSON estático falhar (404) **e** `source === "internal"`, fazer fallback para `GET {apiUrl}/events/public/managed/:id` (endpoint público já existente, `backend/src/events/events.controller.ts:54`) e mapear a resposta para o shape `EventItem` consumido pela página. Manter o fluxo atual para fontes externas (sem fallback).

Detalhes:
- Reaproveitar a lógica de montagem do `EventItem` interno que já existe no backend (`events.service.ts` `toEventItem`/`getPublicManagedEvents`, ~linhas 287-346) como referência de mapeamento: `href`, `platform: "Site Codaqui"`, `source: "internal"`, `sourceId: "codaqui"`, campos de data em ISO string.
- Se o fallback também falhar (backend fora), manter o erro atual.
- O tipo retornado deve continuar sendo o mesmo esperado por `src/pages/eventos/detalhe.tsx`.
- Se `loadEventWithOverride` não recebe `apiUrl` hoje, adotar o mesmo mecanismo de resolução de URL de API usado em `src/lib/events-api.ts` (variável de ambiente/constant) — verificar o padrão existente e segui-lo.

**Critério de aceite:** publicar um evento interno e abrir `/eventos/detalhe?source=internal&sourceId=codaqui&id=<uuid>` imediatamente renderiza a página (via API), sem depender do sync. Eventos externos continuam comportamento idêntico ao atual.

## L1-4 — Limpeza de código morto e docs 🟡

**Regra:** deletar/atualizar APENAS o listado. Verifique cada "zero chamadores" com Grep antes de deletar.

### Frontend (frente C)

1. `src/utils/event-override.ts`:
   - `getEventOverridePath` (~linhas 70-76) — morto, zero chamadores.
   - `fetchEventOverride` (~linhas 118-124) — stub `@deprecated` que sempre retorna `null`, zero chamadores.
   - `mergeEventWithOverride` (~linhas 89-94) — só usado pelo próprio teste (`src/utils/__tests__/event-override.test.ts`) → remover a função E os testes que só a cobrem.
   - Após remover, garantir que exports/imports do barrel e das páginas continuam compilando.
2. `src/data/events.ts`:
   - `EventSourceIndexFile` (~linha 85), `getEventSourceKey`/`getEventSourceIndexPath`/`getEventItemPath` (~linhas 99-109) — zero chamadores em produção → remover.
   - Corrigir comentário em `EventSummary.hasOverride` (~linha 69): hoje indica "existe um `<id>.override.json`" → atualizar para refletir que vem do merge do sync com o banco (`event_overrides`).
3. `src/components/EventOverrideBadge/index.tsx`: docstring (~linhas 12-13) ainda diz "versionado em static/events" → atualizar para "metadados editados via painel admin, persistidos no backend".

### Backend (frente A)

4. `backend/src/events/events.service.ts` `syncInternalSnapshot` (~linhas 3081-3093): trecho que lista `*.override.json` do diretório internal do repo para calcular `hasOverride` — arquivos não existem mais; overrides internos hoje viriam da tabela `event_overrides` com `sourceKey='internal:codaqui'`. Substituir pela consulta à tabela (se houver override para o evento → `hasOverride: true`); se a consulta complicar o fluxo, remover o cálculo e deixar `hasOverride` derivado de forma simples (ex.: consulta única de ids com override para a fonte interna antes do loop).
5. `AGENTS.md` (raiz): a seção "Events System" ainda diz que overrides são feitos via GitHub-as-Database/PR em alguns pontos e menciona `scripts/validate-overrides.mjs` como legado. Atualizar para o estado real: overrides em `event_overrides` (PostgreSQL) via API REST; snapshot via workflow horário (commit direto); force-sync via PR é legado ainda existente (será tratado na Camada 3).

### Sync/workflow (frente B)

6. Deletar `static/events/bevy/` inteira (2 arquivos órfãos; fonte removida de `events.config.json` em 2026-05; nenhum código referencia `bevy` — confirmar com Grep antes).
7. Scripts legados na raiz: `scripts/validate-overrides.mjs`, `scripts/verify-override-author.mjs` e seus testes (`*.test.mjs`) — nenhum workflow os referencia. **Antes de deletar**, verificar `package.json` (raiz) para não deixar script npm órfão; se houver `test`/`validate` apontando para eles, ajustar. Se houver dúvida, reportar ao invés de deletar.

**Critério de aceite:** `npm run typecheck`, `npm run build`, `cd backend && npm run build && npx jest --silent` passam; Grep por `getEventOverridePath|fetchEventOverride|mergeEventWithOverride|bevy` em `src/` e scripts não retorna mais chamadores vivos; nenhum workflow/package.json referencia os scripts deletados.

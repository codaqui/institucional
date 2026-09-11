<!-- AGENT-INDEX
purpose: Design estratégico da Camada 3 — eliminar o último PR do fluxo de eventos (force-sync via GitHubDBService) usando repository_dispatch do backend para o workflow de sync. NÃO IMPLEMENTAR nesta rodada.
audience: AI agents, maintainers
status: design-only
read-first: true
sections:
  - Problema (por que o PR ainda existe)
  - Abordagem recomendada — repository_dispatch
  - Alternativas consideradas e descartadas
  - Mudanças necessárias (por componente)
  - Riscos e mitigações
  - Critérios de aceite (quando implementar)
related-docs:
  - ./MAP.md — mapa de navegação do plano
  - ./layer1-quick-wins-design.md — L1-3 reduz a urgência (detalhe passa a funcionar sem snapshot)
  - ../../../docs/adrs/001-event-platform.md — ADR da plataforma de eventos
agent-protocol:
  - Este arquivo é DESIGN ONLY. Não escreva código com base nele sem aprovação explícita do mantenedor.
-->

# Layer 3 — Eliminar o último PR (repository_dispatch) — DESIGN ONLY

## Problema

O force-sync manual de snapshot interno (`POST /events/internal/snapshot`, `backend/src/events/events.service.ts:3068-3215`) ainda usa `GitHubDBService.createPRWithFiles` com o **token OAuth do próprio membro** (`requireUserToken` — falha 400 se o admin não tiver token GitHub cadastrado). Consequências:

- Publicar/editar um evento não reflete no site até o sync horário (até 1h) ou até o admin disparar o force-sync — que depende de token pessoal, abre PR, exige merge e rebuild.
- É o último resquício do GitHub-as-Database, mantido "por design" mas contradiz a direção atual (edição direta no banco).

A Camada 1 (L1-3) mitiga a dor aguda: o detalhe de evento interno passa a funcionar via fallback ao vivo na API. A Camada 3 remove a causa.

## Abordagem recomendada — `repository_dispatch`

O backend passa a **acionar o workflow de sync existente** em vez de abrir PR:

1. **Backend:** ao publicar/cancelar/editar um managed event relevante (e opcionalmente ao salvar override com `sourceKey = internal:codaqui`), chamar `POST https://api.github.com/repos/codaqui/institucional/dispatches` com `event_type: "sync-event-snapshots"` usando um **GitHub App token de máquina** (mesma App já usada pelo workflow — ou um PAT de bot/fine-grained token com escopo `actions`, armazenado como secret do backend, ex.: `GITHUB_DISPATCH_TOKEN`).
2. **Workflow (`.github/workflows/sync-event-snapshots.yml`):** adicionar gatilho `on: repository_dispatch` com `types: [sync-event-snapshots]`. O step de sync passa a ser idêntico ao do schedule — nenhuma mudança no script.
3. **Admin UI (`src/pages/admin/eventos.tsx` ~linhas 1532-1553):** o botão de force-sync passa a chamar o mesmo endpoint do backend (ou um novo `POST /events/internal/sync-trigger`) que dispara o dispatch e retorna sucesso/falha imediata — sem PR, sem token do usuário.
4. **Remoção (fase final, após estabilização):** `syncInternalSnapshot` + o uso de `GitHubDBService` em `EventsService` + rotas associadas + mensagens de PR no frontend. O Git volta a ser apenas o artefato estático do workflow.

**Latência resultante:** evento publicado → dispatch → workflow roda (minutos) → commit em main → Pages publica. Tipicamente < 10 min, sem ação humana.

## Alternativas consideradas e descartadas

| Alternativa | Por que descartada |
|---|---|
| Manter PR mas com token de máquina | Ainda exige merge humano e rebuild; não remove complexidade, só troca o token. |
| Frontend chama o workflow direto (dispatch do cliente) | Exporia um token GitHub no cliente — inaceitável. O dispatch fica no backend, onde o secret já vive. |
| Backend gravar snapshots no repo via Git Contents API direto | Reintroduz escrita direta no repo pelo backend (acoplamento GitHub-as-Database de novo) e precisa de commit em `main` fora do fluxo do workflow. |
| Poll mais frequente do workflow (ex.: 5 min) | Simples, mas desperdiça runners e ainda tem latência; pode ser alternativa barata se o dispatch for inviável. |

## Mudanças necessárias (por componente, quando implementar)

- **Backend:** novo método em `EventsService` (ou reuso de um service de dispatch) → `POST /dispatches`; hook em `publishEvent`/`cancelEvent`/`update` de managed events (cuidado com loops: o sync não chama o backend de escrita, então não há ciclo); guard para não disparar mais de 1 dispatch por janela curta (debounce, ex.: 60s).
- **Workflow:** `on.repository_dispatch` + talvez `workflow_run`/concurrency já existente protege de corrida com o schedule.
- **Infra/secret:** `GITHUB_DISPATCH_TOKEN` (fine-grained PAT ou app token) no `.env`/compose do backend; documentar em `DEVELOPMENT.md` e `.env.example`.
- **Frontend admin:** trocar o handler do botão force-sync; remover `prUrl`/`prNumber` da UI.
- **Docs:** atualizar AGENTS.md (remover menção ao force-sync via PR) e o ADR 001 com a decisão.

## Riscos e mitigações

- **Token vazado/abuso de dispatch:** usar token fine-grained com escopo mínimo (`actions:write` no repo apenas); rate limit do GitHub (500 dispatches/hora por repo) é folgado para o volume.
- **Evento em `main` enquanto outro push ocorre:** concurrency group do workflow já serializa runs; o sync é idempotente.
- **Backend em dev disparando dispatch:** gate por env var — só dispara se `GITHUB_DISPATCH_TOKEN` estiver configurado.

## Critérios de aceite (quando implementar)

1. Publicar um evento em produção reflete no site em < 10 min sem nenhuma ação manual e sem PR.
2. O botão de force-sync no admin funciona sem token OAuth do usuário.
3. `syncInternalSnapshot` (caminho de PR) removido; nenhuma referência a `createPRWithFiles` em `EventsService`.
4. Workflow continua passando no schedule horário (regressão zero).

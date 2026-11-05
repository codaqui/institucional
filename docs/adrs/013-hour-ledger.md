<!-- AGENT-INDEX
purpose: ADR da Fase 2 — ledger de horas, carga e crédito no check-in, ownership por designations, guests, declarações e visibilidade/badges.
audience: AI agents, mantenedores, diretoria e operadores de release.
status: Implementado na Fase 2 (migrations 033–035 e backend 0.14.0 preparado); publicação, redeploy e sync inicial de badges são gates externos pendentes.
sections:
  - Contexto
  - Decisão
  - Ledger de horas separada
  - Carga horária e check-in
  - Ownership por designations
  - Guests, vínculo e retenção
  - Declarações sem validade
  - Visibilidade pública e badges
  - Consequências e limites
related-docs:
  - 006-directorates-designations.md — fundação de designations e roles derivadas
  - 001-event-platform.md — plataforma de eventos e check-in
  - ../modules/events/CODE_MANUAL.md — APIs e operação corrente
  - ../modules/events/ROLES.md — autorização corrente
  - ../modules/privacy/treatments.md — dados, visibilidade e retenção
agent-protocol:
  - Nunca usar a ledger financeira para horas nem criar backfill retroativo de check-ins/guests.
  - event_organizer_ownership permanece sem drop nesta fase; leituras canônicas usam organizer @ event.
  - Fase 3 e demais fontes de horas não estão implementadas por esta ADR.
-->

# ADR 013 — Ledger de horas, ownership, guests e perfil público

- **Data da decisão:** 2026-11-05
- **Status:** Implementado (Fase 2; release/handoff externo pendente)
- **Escopo:** `backend/src/hours/`, eventos, ownership, guests, migrations 033–035, painéis de horas, perfil público e badges SVG

## Contexto

A associação precisava reconhecer contribuições em horas sem misturá-las com dinheiro, creditar presença uma única vez e permitir participação em eventos sem exigir conta prévia. Também era necessário migrar ownership de eventos para o modelo de designations sem uma parada destrutiva, oferecer uma declaração verificável e expor somente os dados que cada membro autoriza.

A Fase 2 não introduz assembleias, projetos de extensão, mentoria ou outras fontes operacionais de horas. Esses domínios permanecem em suas fases próprias.

## Decisão

Adotar uma `hour_ledger` independente, conectar o crédito automático à transição atômica do check-in, reconciliar ownership em `organizer @ event`, reutilizar `event_registrations` para guests e aplicar `profileVisibility` a todas as projeções novas. A implementação está no backend `0.14.0`; publicação a partir do HEAD correto de `main`, redeploy manual e o primeiro sync de badges continuam gates de release, não fatos já realizados por esta ADR.

## Ledger de horas separada

A migration 033 cria `hour_ledger` e `hour_statements`. Horas são valores decimais `numeric(8,2)` positivos; não existem contas, partida dobrada, moeda BRL ou chamadas a `LedgerService.recordTransaction`. A ledger financeira e suas convenções de `referenceId` permanecem inalteradas.

Cada entrada possui membro, fonte, ocorrência, descrição e estado `pending`, `approved` ou `rejected`. Nesta fase:

- `directorate_activity` é a única fonte manual aceita pela API. Admin ou diretor com designation ativa na diretoria correspondente lança para si, sempre como `pending`, com `idempotencyKey` obrigatória. A unicidade `(memberId,idempotencyKey)` torna retry seguro.
- Admin ou `finance-analyzer` aprova ou rejeita. A transição condicional exige que a entrada ainda esteja pendente; rejeição exige motivo. Criação e revisão gravam auditoria de governo.
- `event_checkin` é a fonte automática entregue. `extension_project` e `mentorship_session` existem apenas no contrato de dados para fases futuras; não há endpoints ou fluxos que os alimentem.
- Fontes automáticas de ocorrência única têm unicidade `(memberId,sourceType,sourceId)`. Não há edição nem exclusão pela API pública e não há backfill implícito.

O extrato autenticado mantém os 100 lançamentos mais recentes, enquanto `GET /hours/me/summary` agrega todas as entradas aprovadas do membro. A fila administrativa usa paginação server-side, default 50 e cap 100.

## Carga horária e check-in

A carga é resolvida antes do crédito:

1. `workloadMinutes` explícito e positivo tem precedência;
2. em managed events, na ausência dele, usa-se a duração positiva `endAt - startAt`, arredondada para minutos inteiros;
3. em eventos externos, a carga usada pelo check-in vem do override persistido (`workloadMinutes` ou `extendData.workloadMinutes`). Ativar check-in externo exige carga válida;
4. criar managed event exige `workloadMinutes` ou duração válida. Uma edição não pode remover a carga de um evento que já a possuía.

O valor em horas é `workloadMinutes / 60`, arredondado para duas casas. O crédito `event_checkin` nasce `approved`, somente quando a inscrição tem `memberId` e carga válida.

Os check-ins managed e externo executam update condicional de `checkedInAt IS NULL` e o crédito na mesma transação. Um segundo scan responde `already_checked_in` sem nova entrada; a unicidade da fonte é a segunda proteção contra duplicidade. Cancelamento posterior não desfaz check-in nem horas.

Eventos legados sem carga não interrompem o check-in: o backend registra warning e não credita horas. Não existe cálculo retroativo para check-ins anteriores nem para guests que depois criam conta. O inventário de eventos nessa condição faz parte do handoff operacional.

## Ownership por designations

A migration 034 reconcilia cada scope legado em uma designation ativa `organizer @ event`:

- quando existe `external_event_activations` para o `eventKey`, a designation referencia `targetId` da ativação;
- scopes sem ativação, inclusive wildcards, permanecem em `targetKey`;
- `appointedById` vem de `updatedByMemberId` e `ON CONFLICT DO NOTHING` preserva a idempotência.

`GET /events/organizers` e `getOwnedScopes()` leem as designations canônicas e mantêm o shape `OrganizersFile`. Upsert e remoção continuam usando a tabela `event_organizer_ownerships` **e** atualizam somente designations `organizer @ event` na mesma transação. Outras designations do membro não são tocadas.

`POST /events/organizers/reconcile`, restrito a admin, repete a reconciliação e retorna `{ inserted, alreadyPresent, orphanedActivations }`. A tabela legada não sofre drop nesta fase. O `down` da migration 034 é deliberadamente não destrutivo, pois não é possível distinguir com segurança registros semeados de escritas posteriores.

## Guests, vínculo e retenção

A migration 035 adiciona `pending_guest` e os campos de convite/consentimento a `event_registrations`; não cria uma tabela paralela de participantes.

- `POST /events/:id/guest-invites` exige actor autorizado a editar o evento, managed event publicado, gratuito e com lote gratuito ativo. A resposta contém token e `/eventos/convite?token=<uuid>`.
- `GET /events/public/guest-invites/:token` expõe apenas estado, título/início do evento e, depois do claim, nome, e-mail mascarado e token de check-in. O token de QR não é exposto enquanto o convite está pendente.
- `POST /events/public/guest-claim` exige nome, e-mail, consentimento e Turnstile. O throttler global continua aplicado. Lock do evento, verificação de capacidade, reserva de quota e update condicional `pending_guest → confirmed` ocorrem na mesma transação; claim repetido retorna conflito.
- Somente inscrição confirmada pode passar pelo check-in. Guest sem `memberId` não gera horas. Confirmação e lembrete usam a URL pública do convite para recuperar o QR.

No login OAuth, somente e-mails confirmados pela API do GitHub podem vincular guests. O e-mail de exibição não verificado não autoriza match. Se já houver inscrição confirmada do membro no mesmo evento, a duplicata guest vira `cancelled` na mesma transação, devolve uma unidade de quota uma única vez e grava audit; token e presença não são duplicados. O vínculo não cria horas retroativas nem transação financeira.

Um cron diário às 03:00 anonimiza nome e e-mail de guests ainda sem membro quando `event.startAt` é anterior a 365 dias. Token, consentimento, status e trilha de presença permanecem. O job não anonimiza registros já vinculados a uma conta.

## Declarações sem validade

`GET /hours/members/:memberId/statement` só pode ser chamado pelo próprio membro e materializa em `hour_statements` um snapshot das entradas aprovadas no período. O limite final inclui o dia inteiro. O código `HRS-<uuid>` identifica esse snapshot; lançamentos posteriores não alteram seu total.

A declaração é apresentada em `/membro/horas` com impressão nativa do navegador, sem biblioteca PDF nova. Não há `validUntil`, expiração nem renovação: a declaração **não tem prazo de validade**.

`GET /hours/verify/:code` consulta o snapshot e retorna período e total, sem nome do membro. Se o código não existir, o membro estiver inativo ou `profileVisibility.hours=false`, retorna somente `{ valid: false }`. Assim, a ausência de validade temporal não elimina o controle de privacidade atual.

## Visibilidade pública e badges

`profileVisibility` ganha `badge` com default `true`; `hours`, `memberSince` e os demais campos conservam suas chaves próprias. Campos ocultos são omitidos, não reconstruídos com valores default:

- `GET /hours/members/:memberId/summary` retorna zero e extrato vazio quando horas estão ocultas; o perfil não apresenta esse retorno como saldo autorizado.
- `GET /hours/public` inclui `totalHours` somente com `hours=true`, `joinedAt` somente com `memberSince=true` e membros apenas quando `hours` ou `badge` está habilitado. `badge=true&hours=false` permite selo sem horas.
- O perfil consulta a permissão antes do extrato. Sem `totalHours`, não renderiza horas nem timeline; com `badge=false`, não renderiza selo.
- A verificação pública de declarações também respeita `hours=false`.

`npm run sync:badges` valida toda a resposta antes de alterar `static/badges/`, escapa XML, escreve por arquivo temporário + rename e remove SVGs obsoletos somente após uma resposta completa. Falhas de escrita restauram os arquivos anteriores; falha da API preserva o diretório.

O workflow `Sync Member Badges` roda diariamente às 06:17 UTC e por dispatch. Mudanças de visibilidade/horas nos SVGs dependem do próximo sync e do build/publicação seguinte. Se o SVG ainda não existir, o perfil oculta somente a área do selo após o erro de carregamento, sem inventar nome, ano ou horas. O **sync inicial bem-sucedido antes da publicação do frontend** é gate de release e não deve ser substituído pela geração de SVGs reais neste branch.

## Consequências e limites

- Horas e finanças evoluem independentemente; nenhum saldo financeiro é afetado por aprovação, check-in, claim ou vínculo de guest.
- O recorte entrega duas fontes efetivas (`event_checkin` e `directorate_activity`), não as quatro previstas no desenho final.
- O rollback da migration 035 remove registros guest para restaurar a obrigatoriedade anterior de nome/e-mail; não deve ser executado em produção sem avaliação explícita de dados. O rollback da 034 não apaga designations.
- O inventário final de ownership e de eventos legados sem carga, a publicação `v0.14.0-backend`, o redeploy manual e a evidência do sync inicial de badges permanecem no handoff de release.
- Fase 3 permanece fora do escopo e começa somente por comando explícito.

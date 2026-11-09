<!-- AGENT-INDEX
purpose: ADR da fila assíncrona de convites de certificado, paginação e envio SMTP com ritmo e retries.
audience: AI agents, mantenedores e operadores de release.
status: Implementado e verificado em dump real; PR para develop, release 0.18.0 e validação controlada pendentes.
sections:
  - Contexto e evidências
  - Decisão
  - Fila e processamento
  - Rate limit e retries
  - APIs e frontend
  - Privacidade e operação
  - Verificação e pendências
related-docs:
  - 001-event-platform.md — plataforma de eventos e certificados
  - ../superpowers/specs/2026-11-09-certificate-invite-queue-design.md — design aprovado
  - ../superpowers/plans/2026-11-09-certificate-invite-queue.md — implementação e evidências
agent-protocol:
  - Não reprocessar falhas históricas automaticamente nem definir certificateInvitedAt sem envio confirmado.
  - Não adicionar BullMQ/Redis, campanha E3 ou open tracking.
  - Publicar backend/migration antes do frontend e começar com lote pequeno.
-->

# ADR 016 — Fila assíncrona de convites de certificado

- **Data da decisão:** 2026-11-09
- **Status:** Implementado e verificado; integração e publicação pendentes
- **Escopo:** Backend 0.18.0, migration 043, fila PostgreSQL, SMTP, listagens e Central de certificados

## Contexto e evidências

A Central selecionava todos os registros filtrados, mas o DTO limitava o lote a 100 IDs. `inviteCertificates()` enviava tudo em `Promise.all`, sem ritmo nem retry. O dump de produção continha 118 convites: **28 enviados e 90 falhas**. Houve 68 erros `421 Temporary System Problem` em cerca de 1,3 segundo e 22 erros `454 Too many login attempts`. Outras 130 inscrições permaneceram convidáveis porque somente `sent` define `certificateInvitedAt`.

Dividir o lote sem mudar o modelo manteria HTTP longo, perda em restart e ausência de progresso. BullMQ/Redis adicionaria infraestrutura desnecessária para o volume atual.

## Decisão

Criar `certificate_invite_jobs`, uma tabela por item de convite com `batchId` compartilhado. O endpoint enfileira e responde 202 imediatamente. Um worker PostgreSQL processa um job por ciclo de 10 segundos, reutilizando a lógica existente de convite e `email_logs`.

`CertificateInviteQueueService` é o único ponto de orquestração da fila. `EventsService` mantém a operação de envio unitário e a validação compartilhada, sem conhecer persistência de jobs. O controller chama o queue service.

## Fila e processamento

Cada job guarda `batchId`, `registrationId`, `requestedById`, `status`, `attempts`, `availableAt`, `lockedAt`, `lastError` e timestamps. Não contém nome, e-mail, token ou template.

- `UNIQUE (batchId,registrationId)` deduplica a requisição.
- Índice parcial único impede duas filas `queued/processing/retry` para a mesma inscrição.
- Claim usa `FOR UPDATE SKIP LOCKED`; SMTP ocorre fora do lock.
- Jobs `processing` há mais de 2 minutos voltam para `retry`.
- O ator é recarregado e a autorização é repetida no processamento.
- `sent` ou convite já existente → `completed`; SMTP ausente → `skipped`; falha final → `failed`.
- `certificateInvitedAt` só é definido após envio confirmado.

Não há exactly-once absoluto quando o SMTP aceita a mensagem e a conexão falha antes da confirmação. A deduplicação por inscrição ativa e `certificateInvitedAt` evita duplicidade no fluxo normal; a incerteza de entrega é aceita e documentada.

## Rate limit e retries

`EmailService` serializa todas as chamadas `provider.send` numa cadeia única, inclusive templates, projetos e reenvio. `EMAIL_SEND_INTERVAL_MS` define espera entre mensagens: default **2000 ms em produção**, **0 em desenvolvimento/testes**.

O worker processa no máximo um convite a cada 10 segundos. Falhas temporárias têm backoff de **1 e 5 minutos**; a terceira falha é definitiva. Erros 421/454 pausam jobs pendentes por **15 minutos**. Validação, autorização e payload inválido não são repetidos.

A migration não cria jobs nem reprocessa os 90 erros antigos. O operador escolhe quando reenviar os participantes pela nova fila.

## APIs e frontend

`POST /events/certificate-invites/batch` mantém o limite de 1–100 IDs e responde **202** com `{batchId,total,status,invalid}`. `GET /events/certificate-invites/batches/:batchId` retorna contadores e itens somente ao admin ou solicitante.

As listagens próprias e externas aceitam `page`, `limit`, `search` e `certificateFilter`. Com `page` e `limit`, retornam `{data,total,page,totalPages,limit}`; sem eles, mantêm o array legado. Os filtros são `all`, `eligible`, `granted`, `registration_pending`.

A Central usa **25 registros por página** e `PaginationControls`. Selecionar convidáveis vale somente para a página atual; mudar página, filtro, busca ou evento limpa a seleção. O botão informa enfileiramento, não envio concluído.

O acompanhamento usa `<progress>` com rótulo e região `role="status"`/`aria-live="polite"`. O polling ocorre a cada 5 segundos apenas com o documento visível. Ao ocultar, para; ao retomar, agenda o próximo ciclo sem disparar duas consultas simultâneas. Falhas de consulta oferecem retry manual.

## Privacidade e operação

Jobs são privados ao admin/solicitante. `email_logs` continua guardando cada tentativa e sua retenção atual. A fila não altera perfil público, guest claim, certificado, check-in, horas ou templates.

Publicação: merge autorizado → `v0.18.0-backend` → redeploy/migration 043 → frontend → lote pequeno controlado → observação de logs/progresso antes dos 130 pendentes. Não há envio automático na migration.

## Verificação e pendências

- Migration 043 down/up em dump real preservou os **28 `sent` e 90 `failed`** históricos.
- E2E PostgreSQL validou resposta 202, array legado, envelope, falha 421, retry, conclusão na segunda tentativa e progresso. Fixtures e banco descartável são removidos.
- Gates locais: **1.285 testes Jest**, **920 testes Vitest**, **84 testes de scripts**, build NestJS e `astro check`. `make astro-verify` passou com paridade de **646 URLs** e `make astro-verify-tenants` passou nos quatro projetos.
- Integração na `develop`, CI/Sonar/Copilot, release/redeploy e lote controlado em produção permanecem pendentes de comando explícito.
- Campanhas E3, open tracking e nova infraestrutura ficam fora desta ADR.

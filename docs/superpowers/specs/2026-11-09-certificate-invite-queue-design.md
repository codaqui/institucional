<!-- AGENT-INDEX
purpose: Design aprovado da fila assíncrona de convites de certificado, paginação e envio SMTP com ritmo e retries.
audience: Mantenedores, implementers e revisores da PR.
status: Aprovado em conversa; pronto para plano e implementação com TDD.
sections:
  - Contexto e evidências
  - Escopo e não escopo
  - Alternativas e decisão
  - Modelo da migration 043
  - Enfileiramento e processamento
  - Rate limit e retries
  - APIs e compatibilidade
  - Frontend e acessibilidade
  - Privacidade, auditoria e operação
  - Testes e rollout
related-docs:
  - docs/plans/codaqui-1-0/README.md — eventos, horas e certificação desacoplada
  - docs/modules/events/CODE_MANUAL.md — fluxo atual de convites
  - docs/modules/privacy/treatments.md — retenção e visibilidade
  - docs/superpowers/specs/2026-11-09-email-campaigns-design.md — campanhas E3, fora deste escopo
agent-protocol:
  - Não criar campanhas promocionais, open tracking, BullMQ/Redis ou dependência nova.
  - Não reprocessar automaticamente falhas históricas nem marcar certificateInvitedAt sem envio confirmado.
  - Preservar respostas legadas das listagens quando page/limit não forem informados.
-->

# Fila assíncrona de convites de certificado — Design

## Contexto e evidências

A Central de certificados permite selecionar todos os participantes filtrados, enquanto `BatchCertificateInviteDto` limita a requisição a 100 IDs. A seleção sem paginação pode exceder esse limite. `EventsService.inviteCertificates()` executa os envios em `Promise.all`, e o provider SMTP não possui serialização nem intervalo entre mensagens.

O dump de produção analisado contém 118 convites do template `certificate-pending-registration`: 28 `sent` e 90 `failed`. Houve 68 erros `421 Temporary System Problem` em aproximadamente 1,3 segundo e 22 erros `454 Too many login attempts`. Outras 130 inscrições continuam convidáveis porque somente `sent` define `certificateInvitedAt`.

O problema exige mudança arquitetural limitada ao fluxo transacional existente: retirar o envio da requisição HTTP, persistir progresso, controlar o ritmo e oferecer retry. Apenas reduzir o tamanho do lote não resolve reinícios, indisponibilidade temporária nem acompanhamento.

## Escopo e não escopo

### Incluído

- Fila persistente de convites de certificado em PostgreSQL, sem infraestrutura nova.
- Processamento assíncrono com lock, recuperação de jobs travados, ritmo e retries com backoff.
- Serialização e intervalo entre chamadas SMTP do `EmailService`.
- Paginação opcional e compatível nas listagens de inscrições próprias e externas.
- Seleção por página na Central, enfileiramento e acompanhamento de progresso com polling pausável.
- Migration 043 e backend 0.18.0, testes unitários, frontend e E2E no dump real.

### Fora

- Campanhas/malas diretas E3, opt-in promocional, descadastro e open tracking.
- BullMQ, Redis, fila em memória como solução final, nova biblioteca ou serviço externo.
- Reprocessamento automático de logs antigos, alteração deles ou backfill de `certificateInvitedAt`.
- Mudança no guest claim, certificado, check-in, horas ou conteúdo dos templates.
- Alteração da PR #618/Codaqui Universitário.

## Alternativas e decisão

1. **Fila PostgreSQL — escolhida.** Persiste jobs, progresso e retries com a infraestrutura existente e sem custo operacional novo.
2. Lotes menores com espera na requisição. Reduz a rajada, mas mantém HTTP longo, perde trabalho em restart e não possui retry/progresso durável.
3. BullMQ/Redis. Atende fila e retry, mas adiciona dependência e operação desproporcionais ao volume atual.

A decisão usa um job por inscrição, agrupados somente por `batchId`. Não há tabela paralela de participantes, e-mails ou certificados.

## Modelo da migration 043

Nova tabela `certificate_invite_jobs`:

| Campo | Tipo | Regra |
|---|---|---|
| `id` | UUID PK | `uuid_generate_v4()` |
| `batchId` | UUID | Agrupa a solicitação; indexado |
| `registrationId` | UUID FK → `event_registrations` | `ON DELETE RESTRICT` |
| `requestedById` | UUID FK → `members` | Ator que pediu o envio; `ON DELETE RESTRICT` |
| `status` | varchar(32) | `queued`, `processing`, `retry`, `completed`, `failed`, `skipped`; default `queued` |
| `attempts` | integer | Default 0; máximo 3 tentativas de SMTP |
| `availableAt` | timestamptz | Próxima execução permitida; default `now()` |
| `lockedAt` | timestamptz NULL | Marca do worker |
| `lastError` | text NULL | Último erro, sem destinatário ou conteúdo do e-mail |
| `createdAt` | timestamptz | Default `now()` |
| `updatedAt` | timestamptz | Default `now()` e atualização pelo service |

Restrições e índices:

- `UNIQUE (batchId, registrationId)` para idempotência dentro da solicitação.
- Índice parcial único em `registrationId` para `status IN ('queued','processing','retry')`, impedindo duas filas ativas para a mesma inscrição.
- Índice `(status, availableAt)` para seleção do próximo job.
- Índice `batchId` para o progresso agregado.

Não há backfill nem job automático na migration. O down remove apenas a tabela nova. A versão do backend passa a **0.18.0**.

## Enfileiramento e processamento

`POST /events/certificate-invites/batch` continua limitado a 1–100 IDs e passa a responder **202**:

```json
{
  "batchId": "uuid",
  "total": 25,
  "status": "queued",
  "invalid": ["registration-id-invalida"]
}
```

- O service valida existência, estado e escopo de cada inscrição antes de criar seus jobs. IDs inválidos são relatados em `invalid`, sem job.
- Duplicatas na requisição são deduplicadas. Uma inscrição com job ativo ou convite já enviado não cria outro.
- O ator e o batch são auditados; o batch não contém nome, e-mail, template renderizado ou token.
- O worker recarrega o membro/ator e repete a autorização atual antes de cada envio, evitando uso de permissão revogada entre enqueue e processamento.
- A cada 10 segundos, no máximo um job é selecionado em `queued`/`retry` com `availableAt <= now()`.
- A seleção usa transação e `FOR UPDATE SKIP LOCKED`; o job passa a `processing` e `lockedAt` antes do SMTP, que ocorre fora da transação de lock.
- Jobs `processing` há mais de 2 minutos são considerados abandonados e voltam para `retry`, respeitando `attempts`.
- O resultado reutiliza a lógica atual: atualização para `pending_guest`, guest, envio pelo template existente, `certificateInvitedAt` somente após `sent`, registro e auditoria por tentativa.
- `sent` → `completed`; SMTP ausente → `skipped`; falha definitiva ou terceira falha temporária → `failed`; falha temporária antes da terceira → `retry`.
- Um convite que já foi enviado por outro fluxo termina como `completed` sem reenvio.

O job não oferece garantia absoluta de exactly-once diante de uma falha ambígua depois de o SMTP aceitar a mensagem. A deduplicação por inscrição ativa e `certificateInvitedAt` evita duplicidade observável no fluxo normal; essa limitação permanece documentada.

## Rate limit e retries

`EmailService` passa a serializar todas as chamadas a `provider.send`, inclusive `sendTemplate` e `sendProjectEmail`, numa única cadeia compartilhada por suas instâncias no processo Node. Entre chamadas consecutivas aplica `EMAIL_SEND_INTERVAL_MS`:

- produção: default **2000 ms**;
- desenvolvimento/testes: default **0 ms**, salvo configuração explícita;
- valores negativos ou inválidos são tratados como 0; a configuração entra em `.env.example` e na documentação.

O worker de convites tem seu próprio intervalo de 10 segundos, que se soma ao limiter global dos demais envios.

- Falhas temporárias (421, 454, timeout e erros transitórios de conexão) usam backoff de **1 minuto**, **5 minutos** e falha após a terceira tentativa.
- Erros 421/454 também adiam por **15 minutos** os jobs ainda pendentes, evitando insistir enquanto o provider estiver limitando logins.
- Erros de validação, autorização ou payload não são repetidos.
- `skipped` não é `failed`; pode ser solicitado novamente depois da configuração SMTP, preservando o comportamento atual.

## APIs e compatibilidade

### Progresso

`GET /events/certificate-invites/batches/:batchId` exige admin ou o membro que criou o batch e retorna:

```json
{
  "batchId": "uuid",
  "status": "retry",
  "total": 25,
  "completed": 18,
  "queued": 2,
  "processing": 1,
  "retry": 2,
  "failed": 1,
  "skipped": 1,
  "items": [
    { "registrationId": "uuid", "status": "completed", "attempts": 1, "lastError": null }
  ]
}
```

O status agregado é `completed` somente quando não há itens pendentes. Erros são visíveis somente ao admin ou solicitante. Não há dados de contato adicionais.

### Listagens paginadas

`GET /events/:id/registrations` e `GET /events/external/:eventKey/participants` aceitam:

- `page` >= 1;
- `limit` 1–100, default 25 na Central;
- `search` por nome/e-mail;
- `certificateFilter`: `all`, `eligible`, `granted`, `registration_pending`.

Quando `page` e `limit` são informados, retornam `{data,total,page,totalPages,limit}`. Sem eles, mantêm o array legado e os filtros anteriores para não quebrar outros consumidores. `eligible` significa apto à concessão e sem concessão; `registration_pending` inclui `pending_match` e `pending_guest`.

## Frontend e acessibilidade

- A Central busca 25 registros por página e renderiza `PaginationControls` e o rótulo de intervalo compartilhado.
- Filtro e busca voltam à primeira página. A seleção é limpa ao trocar página, filtro, busca ou evento.
- “Selecionar convidáveis” seleciona somente os convidáveis da página atual; o texto deixa esse escopo explícito. Assim, um lote da UI não excede 25 IDs.
- O botão passa a informar enfileiramento, não envio concluído. Seleção é limpa ao criar o batch.
- O progresso usa elemento nativo `<progress>` com rótulo e uma região `role="status"`/`aria-live="polite"`, sem mover foco.
- O polling ocorre a cada 5 segundos somente enquanto o batch estiver ativo e `document.visibilityState === 'visible'`; é pausado quando a aba fica oculta e retoma sem disparar rajadas.
- Ao finalizar, a lista é recarregada para refletir convites e estados. Falhas de consulta são visíveis e possuem retry manual, sem apagar o batch.

## Privacidade, auditoria e operação

- A fila guarda somente IDs, estado, timestamps, tentativas e erro técnico; não duplica nome, e-mail ou conteúdo do template.
- `email_logs` continua sendo o histórico por tentativa e alimenta `/admin/emails`.
- Jobs e progresso não são públicos; somente admin ou o solicitante acessam o batch.
- Auditoria registra enqueue e cada tentativa com ator atual. Não se cria uma nova categoria de retenção nesta fase.
- Logs históricos e registros de produção permanecem inalterados. O operador pode selecionar novamente os participantes com falha quando quiser criar novos jobs.
- A publicação exige backend/migration antes do frontend. A migration nunca envia e-mail.

## Testes e rollout

- Migration: tabela, FKs, índices, unique ativa e down sem tocar nas tabelas atuais.
- Enfileiramento: dedupe, IDs inválidos, autorização, resposta 202 e conflito de job ativo.
- Worker: ordem, lock, recuperação de `processing`, resultado por estado e rechecagem de permissão.
- Retries: classificação temporária/permanente, backoff, pausa 421/454 e máximo de tentativas.
- Rate limiter: serialização e intervalo configurável sem atrasar a suíte por padrão.
- Listagens: envelope, filtros, limites e compatibilidade do array legado nas duas fontes.
- Frontend: seleção apenas da página, reset, 202, progresso, polling visível/pausado, erro e retry.
- E2E no dump real: preservar 28 `sent`/90 `failed`, criar jobs sintéticos, processar com provider mockado, verificar retry e ausência de duplicidade, e remover fixtures/banco descartável.
- Gates: build/Jest do backend, scripts, Vitest/astro check, `make astro-verify` e `make astro-verify-tenants` quando compartilhado.

Rollout: merge autorizado → `v0.18.0-backend` → redeploy/migration 043 → frontend → enfileirar um lote pequeno controlado e observar logs/progresso antes dos 130 pendentes. Nenhum release ou merge ocorre sem comando explícito.

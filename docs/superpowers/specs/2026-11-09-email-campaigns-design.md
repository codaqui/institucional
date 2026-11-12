<!-- AGENT-INDEX
purpose: Spec revisada de campanhas e malas diretas E3, com segmentação, consentimento, fila persistente e logs por destinatário.
audience: Presidência, mantenedores e o agente responsável pelo plano TDD, implementação e revisão.
status: Implementada e integrada em develop pela PR #637 (backend 0.27.0 / migration 048); PR #638 aberta para main.
sections:
  - Objetivo e recorte
  - Consentimento e privacidade
  - Modelo e migrations
  - Segmentos e destinatários
  - Fila e idempotência
  - APIs e frontend
  - Logs, retenção e erros
  - Verificação e rollout
related-docs:
  - ../plans/codaqui-1-0/eca-lgpd.md — consentimento e direitos dos titulares
  - ../plans/codaqui-1-0/transversais.md — retenção e auditoria
  - ../adrs/006-directorates-designations.md — segmentos por designations
  - ../adrs/016-certificate-invite-queue.md — fila, advisory lock e ritmo global de SMTP
  - ../adrs/017-announcements.md — avisos públicos, sem relação com campanhas
  - ../modules/privacy/treatments.md — inventário de dados pessoais
agent-protocol:
  - O outro agente deve escrever um plano TDD próprio antes de implementar e revisar a branch completa.
  - Comunicação promocional exige opt-in e descadastro; não reutilizar consentimento transacional.
  - Não incluir open/click tracking, pixels, anexos ou envio em massa sem preview/teste, confirmação e ritmo global.
-->

# Campanhas de E-mail E3 — especificação

## Objetivo e recorte

Adicionar à área `/admin/emails` uma seção **Campanhas** para divulgar ações e conversar com públicos segmentados, com prévia, teste, confirmação, envio persistente e histórico por destinatário. A implementação reutiliza SMTP, templates, `email_logs`, designations e a serialização global de envios já existentes; não introduz provedor, Redis ou BullMQ.

A base é `develop` com backend **0.26.0** e migration **047**. Esta fase propõe backend **0.27.0** e migration **048**. A versão **1.0.0 permanece reservada à Fase 7/C4P**.

Inclui campanhas manuais ou agendadas, segmentos determinísticos, Markdown, consentimento, descadastro, rate limit, retries, cancelamento e filtros de logs. Não inclui jornadas automáticas, A/B testing, open/click tracking, anexos, importação livre de CSV, SMS, bounce handling automático, editor HTML irrestrito, Announcements, C4P ou alterações de check-in/Stripe.

## Consentimento e privacidade

Toda campanha declara `purpose`:

- `transactional`: informação necessária sobre uma relação existente, sem conteúdo promocional. Não exige opt-in de marketing, mas continua sujeita a reclamação/bounce manual e à finalidade declarada.
- `promotional`: divulgação, novidades, captação ou marketing. Exige opt-in explícito e descadastro funcional.

Membros recebem em “Meus dados” a preferência independente `marketingEmailOptIn`, default `false` para registros existentes. Ela não reutiliza `eventCommsOptIn` nem o consentimento de doações, inscrições ou guests. Alterações são auditadas em governança.

`email_suppressions` antecede qualquer segmento. Descadastro promocional impede novas campanhas promocionais mesmo que o opt-in seja reativado depois; reativação exige nova ação explícita do titular, nunca do admin. Reclamação/bounce manual também pode bloquear transacional quando a finalidade exigir.

A página pública de privacidade e o inventário devem registrar finalidade, base legal, segmentos, operadores, retenção e canal de revogação. Não haverá pixel ou rastreamento de abertura/cliques. Métricas são apenas contagens operacionais: destinatários, enviados, falhas, ignorados e suprimidos.

## Modelo e migrations

### Migration 048

Cria as estruturas abaixo, com UUIDs, índices nas FKs e constraints para status/unicidade. Down remove somente os objetos da fase; não altera dados anteriores.

### `email_campaigns`

- `id`, `name`, `subject`, `bodyMarkdown`, `purpose`;
- `status`: `draft | preview | scheduled | sending | completed | completed_with_errors | failed | canceled`;
- `segmentType`, `segmentConfig` JSONB;
- `scheduledAt?`, `startedAt?`, `completedAt?`;
- `createdById`, `confirmedById?`, `confirmedAt?`;
- `idempotencyKey` único;
- `createdAt`, `updatedAt`.

### `email_campaign_recipients`

- `id`, `campaignId`, `memberId?`, `email`, `name?`, `emailNormalized`;
- `status`: `pending | sending | sent | failed | skipped | suppressed`;
- `attempts`, `nextAttemptAt?`, `lastError?`, `sentAt?`;
- `emailLogId?`, `unsubscribeTokenHash`;
- `createdAt`, `updatedAt`.

Único por `(campaignId,emailNormalized)`. O token cru aparece somente no link enviado; banco/logs guardam apenas hash.

### `email_suppressions`

- `id`, `emailNormalized` único;
- `reason`, `source`: `unsubscribe | admin | complaint | bounce_manual`;
- `createdById?`, `createdAt`.

### `members` e `email_logs`

- `members.marketingEmailOptIn`: boolean não nulo, default `false`.
- `email_logs.campaignId?` e `campaignRecipientId?`: vínculos opcionais com a campanha e o recipient.
- O log individual preserva destinatário, template, status, erro e data. Campanhas usam `campaign-transactional` ou `campaign-promotional`, exceto quando um template válido for explicitamente escolhido.

## Segmentos e destinatários

Segmentos são enums e consultas parametrizadas, nunca SQL livre:

- `all_opted_in_members`: ativos com e-mail verificado e opt-in promocional.
- `role`: uma role global escolhida, respeitando opt-in quando promocional.
- `designation`: `targetType + targetId + designation`, como responsáveis de comunidade ou mentores de projeto.
- `community_governance`: responsáveis, diretores e voluntários ligados à comunidade por designation ou `directorates.communityId`.
- `manual`: endereços verificados escolhidos por admin, com evidência de consentimento para promoção.

A migration 040 e as designations atuais são a fonte de vínculos; comunidade não seleciona todos os membros da plataforma, apenas vínculos explícitos. Contatos com papel inativo, e-mail inválido/não verificado, duplicidade ou supressão são excluídos e contados separadamente.

A prévia resolve e congela a lista, mostrando inclusões, exclusões e motivos. Nomes/handles/e-mails são visíveis somente a admin. Reprocessar a prévia não duplica recipients.

## Fila, envio e idempotência

1. Admin cria rascunho e segmento.
2. Sistema apresenta a prévia congelada e as exclusões.
3. Admin envia um teste apenas para si e revisa conteúdo/público.
4. Admin confirma explicitamente; `confirmedById` registra a decisão de governança.
5. Recipients são processados em pequenos lotes, com ritmo e atraso entre tentativas.
6. O worker marca `sending` condicionalmente com `FOR UPDATE SKIP LOCKED`, antes do SMTP, e libera a linha ao concluir. O SMTP ocorre fora do lock da linha.
7. `EmailService` continua serializando `provider.send` com advisory lock de sessão PostgreSQL compartilhado. O intervalo global usa `EMAIL_SEND_INTERVAL_MS` (default 2000 ms em produção), sem fila separada por página/admin.
8. Sucesso grava `emailLogId`; falha usa `attempts`/`nextAttemptAt`, com backoff de 1 e 5 minutos e no máximo 3 tentativas. Erros 421/454 pausam pendentes por 15 minutos. Validação/autorização/payload inválido não é repetido.
9. O resultado é `completed` ou `completed_with_errors`; nunca reenvia automaticamente quem já está `sent`.

`processing` antigo volta para retry após 2 minutos. A autorização do ator é recarregada no processamento. Reenvio manual de falha cria tentativa somente para o recipient escolhido. Criar com a mesma `idempotencyKey` retorna a campanha existente. Cancelamento impede novos envios sem alterar logs anteriores. SMTP ausente marca falha operacional sem apagar a campanha.

Não há exactly-once absoluto se o SMTP aceitar e a conexão falhar antes da confirmação; essa incerteza fica documentada. Não há rollback de mensagens enviadas.

## APIs e frontend

Rotas de gestão fora de `/admin/`:

- `GET/POST /campaigns` com paginação `{data,total,page,totalPages,limit}`;
- `GET/PATCH /campaigns/:id`;
- `POST /campaigns/:id/preview`;
- `POST /campaigns/:id/test`;
- `POST /campaigns/:id/confirm`;
- `POST /campaigns/:id/cancel`;
- `POST /campaigns/:id/recipients/:recipientId/retry`.

Somente admin cria, edita, testa, confirma, cancela e faz retry. `finance-analyzer` lê campanhas/logs. Endpoints públicos são apenas descadastro e preferência autenticada do próprio membro.

`GET /descadastro?token=...` valida token, aplica supressão e apresenta confirmação sem login, sem revelar e-mail ou outros dados. Token inválido/expirado usa resposta neutra. A página usa texto simples e HTTPS, sem formulário de dados adicionais.

`/admin/emails` passa a ter **Campanhas**, **Logs** e **Templates**. A jornada da campanha é conteúdo → público → prévia/teste → confirmação → acompanhamento, com estados, contagens, erros e progresso acessível. Polling somente com documento visível e sem requests concorrentes.

Logs ganham filtros por destinatário, período, status, template e campanha, com paginação padrão e exportação apenas de dados já autorizados. “Meus dados” recebe a preferência de marketing com explicação independente das transacionais.

## Logs, retenção e erros

Cada recipient aponta para o log individual; agregados são derivados para evitar divergência. Falhas mostram causa operacional sanitizada, sem stack trace, segredo SMTP ou token.

Logs seguem retenção atual de 365 dias. Após o mesmo período, recipients têm e-mail e hash removidos, preservando contagens e trilha mínima. Supressões permanecem enquanto necessárias para respeitar revogação.

Validação retorna 400; estado incompatível 409; escopo insuficiente 403; inexistente 404; token inválido/expirado não confirma nem revela dados. Ações administrativas de campanha, confirmação, cancelamento, retry e alterações de consentimento entram em auditoria de governança.

## Verificação e rollout

O agente implementador deve escrever plano TDD e obter revisão independente da branch, cobrindo no mínimo:

- Segmentos, opt-in independente, supressão, deduplicação, retenção e anonimização.
- `community_governance` sem membros sem vínculo explícito.
- Dois workers/DataSources concorrentes sem envio duplicado para o mesmo recipient.
- Advisory lock e intervalo global entre campanhas e demais fluxos.
- Retry sem reenviar `sent`; mesma chave sem duplicar campanha; cancelamento e agendamento.
- Descadastro impedindo campanha posterior, inclusive após tentativa de reativação indevida pelo admin.
- Filtros de logs, paginação, Markdown seguro, teclado, estados de erro e dark mode.
- Migration 048 down/up em dump real, sem reprocessar campanhas/logs históricos.
- SMTP sintético, sem destinatários reais; fixtures removidas.

Gates obrigatórios: backend build/Jest, E2E PostgreSQL real, frontend Vitest/Astro check, `make astro-verify`, `make astro-verify-tenants`, scripts afetados, CI e SonarCloud sem issues.

Rollout: backend/migration 048 → preview com campanha sintética → validação de descadastro/fila/logs → ativação admin → primeira campanha real pequena e explicitamente autorizada. Nenhuma campanha real é enviada durante implementação, testes automatizados ou rollout técnico.

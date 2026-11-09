<!-- AGENT-INDEX
purpose: Design de campanhas e malas diretas com segmentação, consentimento, envio idempotente e logs.
audience: Presidência, mantenedores, implementers e revisores de privacidade/backend/frontend.
status: Desenho inicial aprovado para detalhamento; aguardando revisão da spec antes do plano executável.
sections:
  - Objetivo e escopo
  - Consentimento e privacidade
  - Modelo de dados
  - Segmentos e destinatários
  - Envio e idempotência
  - APIs e frontend
  - Logs, retenção e erros
  - Verificação e rollout
related-docs:
  - docs/plans/codaqui-1-0/eca-lgpd.md — consentimento e direitos dos titulares
  - docs/plans/codaqui-1-0/transversais.md — retenção e auditoria
  - docs/adrs/006-directorates-designations.md — segmentos por designations
  - docs/modules/privacy/treatments.md — inventário de dados pessoais
agent-protocol:
  - Não implementar antes da revisão desta spec e da aprovação de um plano próprio.
  - Comunicação promocional exige opt-in e descadastro; não reutilizar o consentimento de transações.
  - Não incluir open tracking, pixels ou envio em massa sem confirmação e rate limit.
-->

# Campanhas de E-mail — design

## Objetivo e escopo

Adicionar ao painel `/admin/emails` uma área de **Campanhas** para divulgar ações e conversar com públicos segmentados, com preview, teste, confirmação, envio idempotente e histórico por destinatário. A funcionalidade usa o SMTP e os `email_logs` existentes, sem introduzir um novo provedor.

O recorte inicial inclui campanhas manuais ou agendadas, segmentos determinísticos, templates em Markdown, consentimento, descadastro, rate limit, retries e filtros de logs. Não inclui automações por jornada, A/B testing, open/click tracking, anexos, importação livre de CSV, SMS, bounce handling automático ou editor HTML irrestrito.

## Consentimento e privacidade

Toda campanha tem `purpose`:

- `transactional`: informação necessária sobre uma relação já existente. Não pode conter promoção.
- `promotional`: divulgação, novidades, captação ou marketing. Exige opt-in explícito e descadastro funcional.

Membros recebem em “Meus dados” uma preferência `marketingEmailOptIn`, default `false` para registros existentes. Ela é independente de e-mails transacionais. A política de privacidade e o inventário devem registrar finalidade, base legal, segmentos, retenção e canal de revogação.

`email_suppressions` é global e antecede qualquer segmento. Um titular suprimido nunca recebe nova campanha promocional, mesmo que um admin altere o segmento ou o opt-in manualmente. Alterações de consentimento ficam em auditoria.

Não haverá pixel, rastreamento de abertura ou de cliques. Métricas são somente contagens operacionais: destinatários, enviados, falhas, ignorados e suprimidos.

## Modelo de dados

A versão e as migrations serão definidas no plano próprio, sem reutilizar a versão da Fase 4.

### `email_campaigns`

- `id`, `name`, `subject`, `bodyMarkdown`, `purpose`;
- `status`: `draft | preview | scheduled | sending | completed | completed_with_errors | failed | canceled`;
- `segmentType`, `segmentConfig` JSONB;
- `scheduledAt?`, `startedAt?`, `completedAt?`;
- `createdById`, `confirmedById?`, `confirmedAt?`;
- `idempotencyKey` único;
- `createdAt`, `updatedAt`.

### `email_campaign_recipients`

- `id`, `campaignId`, `memberId?`, `email`, `name?`;
- `emailNormalized` para deduplicação;
- `status`: `pending | sending | sent | failed | skipped | suppressed`;
- `attempts`, `nextAttemptAt?`, `lastError?`, `sentAt?`;
- `emailLogId?`, `unsubscribeTokenHash`;
- `createdAt`, `updatedAt`.

Único por `(campaignId, emailNormalized)`. O token de descadastro aparece somente no link enviado; banco e logs guardam somente hash.

### `email_suppressions`

- `id`, `emailNormalized` único;
- `reason`, `source`: `unsubscribe | admin | complaint | bounce_manual`;
- `createdById?`, `createdAt`.

### `email_logs`

Adicionar `campaignId?` e `campaignRecipientId?`. O log individual continua indicando destinatário, template, status, erro e data. Campanhas usam templates próprios `campaign-<purpose>` ou um template específico selecionado na campanha.

## Segmentos e destinatários

Segmentos são enums e consultas parametrizadas, nunca SQL livre:

- `all_opted_in_members`: membros ativos com e-mail verificado e opt-in promocional.
- `role`: uma role global escolhida, respeitando opt-in quando promocional.
- `designation`: `targetType + targetId + designation`, como responsáveis de uma comunidade ou mentores de um projeto.
- `community_governance`: responsáveis, diretores e voluntários ligados a uma comunidade por designation ou por `directorates.communityId`.
- `manual`: e-mails verificados escolhidos explicitamente por um admin, com prova de consentimento quando promocional.

O segmento `community_governance` depende da migration 040 da Fase 4 para vínculos via diretoria; antes dela, somente designations diretas são usadas.

A prévia mostra total, nomes/handles e e-mails restritos a admin antes da confirmação. Também mostra quantos foram removidos por falta de consentimento, e-mail inválido, duplicidade ou supressão. Comunidade não é tratada como lista genérica de todos os membros da plataforma: somente os vínculos explícitos acima entram.

O opt-in não é exigido para transacional, mas supressões por reclamação/bounce continuam aplicáveis. Uma campanha transacional fora da finalidade declarada deve ser bloqueada na revisão.

## Envio e idempotência

1. Admin cria rascunho e segmento.
2. Sistema resolve e congela a lista na prévia, mostrando inclusões e exclusões.
3. Admin envia um teste para si e confirma conteúdo/público.
4. Outro admin ou o mesmo admin com uma segunda confirmação explícita aprova a campanha; `confirmedById` registra a decisão.
5. Workers processam recipients por lotes pequenos, com rate limit configurável e atraso entre tentativas.
6. Cada recipient é marcado `sending` condicionalmente antes da tentativa, evitando envio duplo em workers concorrentes.
7. Sucesso grava `emailLogId`; falha respeita `attempts` e `nextAttemptAt`, com backoff e máximo definido no plano.
8. O término produz `completed` ou `completed_with_errors`; nunca reenvia automaticamente para quem já tem `sent`.

Criar a mesma campanha com a mesma `idempotencyKey` retorna a campanha existente. Resolver a prévia novamente não duplica recipients. Reenvio manual de uma falha cria tentativa somente para o recipient escolhido.

Cancelamento impede novos envios, mas não altera logs anteriores. SMTP ausente marca falhas operacionais sem apagar a campanha. Não há rollback de e-mails já enviados.

## APIs e frontend

Rotas administrativas novas não usam `/admin/`:

- `GET/POST /campaigns`;
- `GET/PATCH /campaigns/:id`;
- `POST /campaigns/:id/preview`;
- `POST /campaigns/:id/test`;
- `POST /campaigns/:id/confirm`;
- `POST /campaigns/:id/cancel`;
- `POST /campaigns/:id/recipients/:recipientId/retry`.

Apenas admin cria, edita, testa, confirma e cancela. `finance-analyzer` pode ler campanhas/logs. A página pública `/descadastro?token=...` valida o token, aplica supressão e mostra confirmação sem exigir login nem expor outros dados.

`/admin/emails` passa a ter três áreas: **Campanhas**, **Logs** e **Templates**. Logs ganham filtros por destinatário, período, status, template e campanha. A tela de campanha tem etapas de conteúdo → público → prévia/teste → confirmação → acompanhamento, com contagens e erros visíveis.

## Logs, retenção e erros

Cada recipient aponta para o log individual; a campanha guarda somente agregados derivados, evitando divergência. Falhas são visíveis por destinatário, sem expor stack traces ou segredos SMTP.

Logs seguem a retenção atual de 365 dias. Recipients e tokens são anonimizados após o mesmo período: e-mail e hash são removidos, preservando contagens e trilha administrativa mínima. Supressões permanecem enquanto necessárias para respeitar a revogação.

Erros de validação retornam 400; estado incompatível retorna 409; escopo insuficiente retorna 403; token inválido/expirado não confirma nem revela o e-mail.

## Verificação e rollout

Antes de produção:

- Testes de segmentos, consentimento, supressão, deduplicação e retenção.
- Dois workers concorrentes não enviam duas vezes para o mesmo recipient.
- Retry não reenvia `sent`; campanha repetida com a mesma chave não duplica.
- Teste de descadastro impede campanha posterior, mesmo com opt-in reativado por admin.
- Teste comprovando que comunidade não seleciona membros sem vínculo explícito.
- Testes de filtros de logs e navegação por teclado no fluxo completo.
- SMTP sintético, sem destinatários reais; fixtures removidas.
- Backend build/Jest, frontend Vitest/Astro check, tenants e Sonar verdes.

Rollout: migration e backend → preview com campanha sintética → validação de descadastro e logs → ativação para admin. Nenhuma campanha real é enviada durante implementação ou testes automatizados.

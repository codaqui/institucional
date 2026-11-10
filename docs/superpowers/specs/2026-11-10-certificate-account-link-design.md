<!-- AGENT-INDEX
purpose: Design do vínculo obrigatório de convites de certificado a uma conta Codaqui via GitHub e e-mail verificado.
audience: Mantenedores, revisores e implementers da PR feat/certificate-account-link.
status: Aprovado em conversa após inspeção do dump do DevPR Conf 26; pronto para implementação TDD.
sections:
  - Contexto e evidências
  - Decisão e limites
  - Contratos e reconciliação
  - Claim autenticado
  - UI/UX
  - Segurança, privacidade e concorrência
  - Testes e rollout
related-docs:
  - docs/superpowers/specs/2026-11-09-checkin-certificate-decoupling-design.md — concessão e convite anteriores
  - docs/adrs/016-certificate-invite-queue.md — fila serializada de convites
  - docs/plans/codaqui-1-0/auth.md — OAuth, returnTo e e-mails verificados
agent-protocol:
  - Não vincular por e-mail apenas declarado; usar somente secondaryEmails verificados pelo GitHub.
  - Não alterar o guest claim de inscrições comuns nem emitir certificado automaticamente no claim.
  - Não reenviar os 84 convites já ativos do DevPR Conf 26 nem disparar e-mails nos testes.
-->

# Vínculo de certificados com conta GitHub — Design

## Contexto e evidências

A migração 041 e o envio assíncrono reutilizaram o guest claim de eventos para convites de certificado. Esse fluxo permite confirmar nome e e-mail sem autenticação, não atendendo ao objetivo de associar a participação e o certificado à conta da pessoa.

Inspeção do dump atual de produção para `doity:devpr:devpr-conf-26` encontrou:

- 23 inscrições confirmadas com conta, check-in e certificado;
- 20 `pending_match` ainda não convidadas;
- 84 `pending_guest` com `certificateInvitedAt` e nenhum guest claim concluído;
- 52 `pending_guest` apenas com falhas SMTP temporárias;
- um `pending_guest` com log `sent` e `certificateInvitedAt` nulo;
- nenhum certificado concedido a inscrições ainda pendentes;
- apenas duas das 84 pessoas convidadas já possuem conta ativa com e-mail verificado correspondente.

A API de produção confirma que o convite atual não expõe `requiresAccount`. Portanto, os 84 links continuam suscetíveis ao guest claim antigo até esta correção ser publicada.

## Decisão e limites

Convites de certificado passam a exigir autenticação GitHub e correspondência com e-mail verificado. O guest claim comum permanece disponível para inscrições de eventos que não sejam convites de certificado.

Incluído:

- `requiresAccount` no payload do convite;
- bloqueio do endpoint guest antigo para convites de certificado;
- endpoint autenticado para associar a inscrição ao membro logado;
- reconciliação de logs `sent` sem `certificateInvitedAt`;
- UI condicional com OAuth e retorno ao mesmo convite;
- testes unitários, frontend e E2E PostgreSQL com o caso DevPR.

Fora de escopo:

- reenvio dos 84 convites já ativos;
- reprocessamento dos 52 envios falhos ou dos 20 `pending_match`;
- concessão automática de certificado no claim;
- associação manual por admin ou por e-mail não verificado;
- alteração do guest claim comum, Turnstile, fila SMTP ou formato do certificado.

## Contratos e reconciliação

### `GET /events/public/guest-invites/:token`

O retorno passa a incluir `requiresAccount: boolean`. Ele é verdadeiro quando `certificateInvitedAt` não é nulo, inclusive depois da confirmação, permitindo que a UI apresente o estado de certificado/conta em vez do QR de check-in.

Antes de responder ou de validar um novo envio, o backend reconcilia registros pendentes com `certificateInvitedAt` nulo:

1. procura o primeiro `email_logs` com template `certificate-pending-registration`, `registrationId` correspondente e status `sent`;
2. se existir, grava `certificateInvitedAt = email_logs.createdAt` de forma idempotente;
3. passa a tratar o registro como já convidado, impedindo envio duplicado e exigindo conta no link.

Falhas e logs `skipped` não geram marcação. Não há migration nem atualização em massa nesta PR.

### Guest claim comum

`POST /events/public/guest-claim` executa a mesma reconciliação. Se o registro for um convite de certificado, responde `409 Conflict` com a mensagem “Este convite de certificado exige login com GitHub.” e não altera a inscrição. Inscrições comuns seguem o fluxo atual com Turnstile.

## Claim autenticado

### `POST /events/public/guest-claim/github`

Requer `JwtAuthGuard` e body:

```json
{
  "token": "<checkinToken>",
  "consent": true
}
```

O consentimento é exigido pelo backend. Não há Turnstile adicional porque a operação exige token de convite, sessão autenticada e e-mail verificado.

Regras:

1. localizar a inscrição pelo token com lock `pessimistic_write` em transação;
2. exigir `isGuest = true`, `certificateInvitedAt` preenchido e status `pending_guest` ou `confirmed`;
3. exigir membro ativo correspondente a `req.user.sub`;
4. comparar `attendeeEmail`, sem diferenciar maiúsculas, somente com `member.secondaryEmails`;
5. se já houver outro `memberId`, rejeitar com `409`; se for o mesmo membro, retornar o estado atual sem nova mutação;
6. preencher `memberId`, nome do membro e o e-mail verificado correspondente;
7. quando estiver `pending_guest`, mudar para `confirmed` e preencher `guestClaimedAt` e `guestConsentAt`;
8. preservar concessão, presença, evento, ativação externa e token;
9. registrar auditoria com o membro autenticado, sem gravar e-mail ou token nos detalhes;
10. responder com o mesmo payload público de `getGuestInvite`.

E-mail divergente retorna `403 Forbidden` e orienta a pessoa a adicionar/verificar o e-mail no GitHub. Token inválido retorna `404`; convite incompatível ou já reivindicado por outra conta retorna `409`.

Um registro `confirmed` legado ainda sem `memberId` pode ser associado se o e-mail verificado coincidir. Isso não reabre nem altera a concessão.

## UI/UX

`GuestClaimIsland` usa `useAuth` e `resolveApiUrl`:

- enquanto autenticação e convite carregam, apresenta progresso;
- se `requiresAccount` e não houver sessão, apresenta “Entrar com GitHub e associar certificado”;
- `login({ returnTo: pathname + search })` preserva o token em `sessionStorage` e retorna após `/auth/callback`;
- com sessão, uma ação explícita envia o claim autenticado com `credentials: include`;
- erros de divergência orientam atualizar os e-mails verificados e oferecem trocar de conta;
- após associar, apresenta confirmação e link para `/membro`, sem afirmar que o certificado foi concedido;
- guest comum mantém formulário, consentimento, Turnstile e QR existentes.

O template de e-mail passa a explicar que é necessário entrar ou criar conta via GitHub usando o e-mail verificado do convite. Nenhum e-mail é enviado nesta PR.

## Segurança, privacidade e concorrência

- `secondaryEmails` é populado exclusivamente por `/user/emails` do GitHub com `verified = true`.
- O e-mail público exibido após confirmação continua mascarado.
- O token não aparece em auditoria, logs de aplicação ou mensagens de erro.
- O lock serializa duas tentativas concorrentes de contas diferentes; a verificação de `memberId` ocorre dentro da transação.
- Não há mutação ao abrir o convite, exceto a reconciliação idempotente de um envio já comprovado.
- O claim não concede certificado, presença, horas ou papéis.

## Testes e rollout

Backend:

- `requiresAccount` falso/verdadeiro;
- reconciliação `sent`, não reconciliação `failed/skipped` e prevenção de reenvio;
- rejeição do guest antigo sem mutação;
- sucesso externo com `eventId = null`, evento próprio e registro legado confirmado;
- e-mail não verificado/divergente, membro inativo, token inválido e outra conta;
- replay idempotente e preservação de concessão/presença;
- controller com guard e DTO validado.

Frontend:

- guest comum inalterado;
- login com `returnTo` preservando query/token;
- claim autenticado e estado final;
- divergência de e-mail e troca de conta.

E2E em dump restaurado:

- usar uma inscrição sintética derivada do caso DevPR, sem enviar e-mails;
- comprovar bloqueio do guest antigo, OAuth mockado, vínculo com e-mail verificado e replay;
- reconciliar o registro real identificado no dump sem modificar produção;
- verificar que os 84 registros existentes passam a expor `requiresAccount = true`.

A implementação usa backend **0.20.0**, sem migration nova. Se Business tiers for integrado antes, a versão será reavaliada no rebase. O deploy exige publicação do backend e do frontend; após o deploy, os 84 links existentes passam automaticamente a exigir conta, sem reenvio.

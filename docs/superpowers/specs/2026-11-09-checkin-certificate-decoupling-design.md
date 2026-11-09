<!-- AGENT-INDEX
purpose: Design do adendo da Fase 4 — check-in em lote, concessão independente de certificado, CSV e convite para pending_match.
audience: Mantenedores, revisores e implementers da PR #617.
status: Aprovado para implementação na PR #617; backend 0.16.0 e migration 041.
sections:
  - Contexto e evidências
  - Decisão e limites
  - Modelo e contratos
  - Fluxos
  - UI/UX
  - Privacidade, logs e concorrência
  - Verificação e rollout
related-docs:
  - docs/adrs/001-event-platform.md — plataforma de eventos
  - docs/adrs/013-hour-ledger.md — horas e guests
  - docs/plans/codaqui-1-0/auth.md — guest claim e vínculo por e-mail verificado
agent-protocol:
  - Não criar autenticação por senha nem vincular histórico por e-mail não verificado.
  - Não usar a ledger financeira para horas nem re-creditar reuploads.
  - Não disparar convites automaticamente no upload CSV.
-->

# Check-in em lote e certificação desacoplada — Design

## Contexto e evidências

Hoje `checkedInAt` é pré-requisito para emitir e verificar certificados. A feature `certificates` acrescenta `checkin` automaticamente, exigindo carga horária. `pending_match` é rejeitado no check-in e impede a certificação. A importação CSV não registra presença nem elegibilidade, e a UI oferece apenas ações individuais.

A plataforma já possui um guest claim aprovado com token, Nome/E-mail, consentimento, Turnstile, vínculo posterior por e-mail verificado e anonimização. Essa infraestrutura deve ser reutilizada, sem nova autenticação ou tabela paralela de identidades.

## Decisão e limites

Adicionar elegibilidade própria ao certificado em `event_registrations`, preservando a integração atual check-in → certificado. Permitir também concessão explícita por organizer/host/admin sem check-in. External `certificates` deixa de implicar `checkin`.

Escopo da PR #617, backend 0.16.0 e migration 041:

- `certificateGrantedAt`, `certificateGrantedByMemberId` e `certificateInvitedAt`, todos anuláveis.
- Backfill: `certificateGrantedAt = checkedInAt` e `certificateGrantedByMemberId = checkedInByMemberId` quando já houver presença.
- Concessão e verificação exigem `certificateGrantedAt` e inscrição `CONFIRMED`; cancelada/reembolsada permanece bloqueada.
- Check-in preenche presença e, se ausente, a concessão. Não sobrescreve uma concessão existente.
- Múltiplas pessoas em lote; a mesma inscrição permanece idempotente. Presença em vários dias fica fora, pois exigiria sessões próprias.

## Modelo e contratos

### Certificado

`POST /events/registrations/:id/certificate/grant` permite admin ou quem já pode operar o check-in do evento. Registra concessão sem exigir presença. `GET /events/registrations/:id/certificate` e `GET /events/certificates/verify/:code` usam a concessão, não a presença. O código `CRT-<checkinToken>` continua estável.

`checkin` e `certificates` são features externas independentes. Carga horária é exigida somente pelo check-in/horas.

### Check-in em lote

`POST /events/:id/checkin/batch` e `POST /events/external/:eventKey/checkin/batch` aceitam `{ tokens: string[] }`, 1–100 itens. Cada inscrição tem resultado próprio (`checked_in`, `already_checked_in`, `invalid`), sem apagar sucessos quando outra falha. `pending_match` é inválida para o scanner.

### CSV

Duas colunas booleanas opcionais:

| `checkin` | `certificate` | Efeito |
|---|---|---|
| `true` | qualquer valor | Registra presença e concessão |
| `false` | `true` | Concede somente certificado |
| omitidas/false | omitidas/false | Mantém o comportamento anterior |

Com `checkin=true`, horas são registradas somente com membro vinculado e carga válida, usando a unicidade da `hour_ledger`. Sem membro não há horas. Reupload não recredita. `certificate=true` não gera horas. A importação aceita eventos com `checkin` ou `certificates`.

### Convite para pending_match

`POST /events/certificate-invites/batch` recebe `{ registrationIds: string[] }`, 1–100 IDs, e permite admin/organizer/host do evento. Cada convite é explícito, nunca automático no upload.

O fluxo converte `pending_match` para `PENDING_GUEST`, mantém presença/concessão e usa `/eventos/convite/<checkinToken>`. O template é “Certificado pendente de cadastro”. Ao aceitar, o guest fica `CONFIRMED`; a concessão já existente fica disponível. Conta existente faz match por e-mail verificado; criação posterior segue o vínculo automático atual.

`certificateInvitedAt` só é gravado quando SMTP efetivamente envia. Cada destinatário gera `email_logs` com `registrationId` e `sent/failed/skipped`; `skipped` permite retry. Auditoria registra a ação sem conteúdo sensível. O retorno separa resultados por inscrição.

## Fluxos principais

1. **Atual:** QR/manual individual → presença + concessão → certificado; horas exactly-once quando aplicável.
2. **Lote:** filtrar/selecionar participantes → confirmação individual idempotente → resumo de sucessos e falhas.
3. **CSV presença:** importar `checkin=true` → presença/concessão; horas somente com membro e carga.
4. **CSV certificado:** importar `certificate=true` → concessão sem presença/horas.
5. **Pendente:** organizer concede certificado se desejado → envia convite → aceite guest → inscrição confirmada → certificado disponível.
6. **Conta posterior:** vínculo automático somente por e-mail verificado; histórico permanece sujeito a `profileVisibility`.

## UI/UX

`/admin/eventos-checkin` ganha abas **Escanear**, **Participantes** e **Certificados**:

- filtros pendentes, presentes, cadastro pendente e elegíveis;
- seleção múltipla e “todos os filtrados”, com contagem e operação ocupada;
- cartões responsivos, não tabelas largas no mobile;
- estados presente, certificado concedido, convite enviado e cadastro pendente;
- ações de presença em lote, concessão e convite;
- relatório de importação mostra presença/concessão e “sem conta — convite pendente” em vez de bloqueio permanente.

O scanner individual continua inalterado. Erros parciais ficam por participante e são anunciados por `Alert`/regiões apropriadas.

## Privacidade, logs e concorrência

- Aceite `noindex`, dados mínimos, e-mail mascarado e consentimento/Turnstile no claim público.
- Convite é transacional do evento, não marketing nem open tracking.
- Não há vínculo por e-mail não verificado; anonimização anual de guests permanece.
- Concessão e convite exigem escopo no backend, nunca apenas botões ocultos no cliente.
- Concessão usa update condicional para não sobrescrever histórico; reenvio não duplica concessão.
- Reenvio de e-mail só ocorre por ação explícita ou `skipped`; `sent` não é repetido automaticamente.

## Verificação e rollout

- Testes unitários de concessão, features independentes, permissões e verificação pública.
- CSV nas combinações de flags, sem horas duplicadas.
- Lote com resultados parciais e idempotência.
- Convites idempotentes, `sent/failed/skipped` e claim até certificado.
- Testes de teclado/seleção/erros e migration 041 down/up preservando inscrições.
- E2E real: `pending_match → invite → accept → verify`.
- Gates de backend, frontend, scripts, Astro e Sonar antes de novo handoff.

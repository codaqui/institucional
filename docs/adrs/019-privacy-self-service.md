<!-- AGENT-INDEX
purpose: ADR do autosserviço de privacidade — prévia de visibilidade, exportação JSON do titular e solicitação revisada de exclusão de conta.
audience: Diretoria/canal de privacidade, mantenedores, AI agents e operadores de release.
status: Implementado e publicado em v1.2.0-backend/migration 051 (PR #654); evidência de revisão jurídica/da diretoria não localizada nesta consolidação.
sections:
  - Contexto e decisões
  - Exportação do titular
  - Solicitação revisada de exclusão
  - Frontend e acessibilidade
  - Verificação e rollout
related-docs:
  - ../superpowers/specs/2026-11-16-fase-9-paineis-design.md — design aprovado.
  - ../superpowers/plans/2026-11-16-fase-9-paineis.md — plano TDD.
  - ../modules/privacy/README.md — gates de privacidade.
  - ../modules/privacy/treatments.md — inventário de dados.
agent-protocol:
  - Solicitar exclusão nunca desativa ou anonimiza a conta automaticamente.
  - Exportação usa projeções explícitas; não adicionar dump genérico, tokens ou dados de terceiros.
  - Publicar backend/migration 051 antes do frontend e obter revisão jurídica/da diretoria antes de main.
-->

# ADR 019 — Autosserviço de privacidade, exportação e solicitação de exclusão

- **Data da decisão:** 2026-11-16
- **Status:** Implementado e publicado em `v1.2.0-backend`/migration 051 (PR #654); evidência de revisão jurídica/da diretoria não localizada nesta consolidação
- **Escopo:** Backend 1.2.0, migration 051, `/membro?section=account` e fila na página admin de Membros

## Contexto e decisões

O painel já permitia editar visibilidade e consentimento promocional, mas não oferecia prévia das escolhas, cópia dos dados ou fluxo rastreável de exclusão. A Fase 9 adiciona esses controles sem alterar o Design System, as regras financeiras ou a autenticação.

Decisões:

- a prévia usa o estado local, inclusive antes de salvar, e não promete refletir o HTML público antes do refresh/build;
- a exportação é síncrona, em JSON, sem armazenar arquivo ou criar fila;
- a exclusão começa como solicitação revisada pela diretoria; não é uma operação imediata;
- o histórico de solicitações é preservado, com uma única pendência por membro;
- concluir uma solicitação registra a revisão, mas não desativa nem anonimiza o membro automaticamente.

## Exportação do titular

`GET /members/me/export` exige JWT e tem limite de três exportações por hora **por membro**. `MemberExportThrottleGuard` executa após `JwtAuthGuard` e usa `req.user.sub` como tracker, evitando cota global por IP atrás do proxy. O backend retorna `application/json; charset=utf-8` e attachment `codaqui-dados-<handle>-<AAAA-MM-DD>.json`.

O schema `1` contém `generatedAt`, `subject`, `account`, `designations`, `events`, `mentorship`, `hours`, `projects`, `finance`, `c4p`, `communications`, `coverage` e `exclusions`.

`PrivacyExportService` usa repositories TypeORM via `DataSource` e projeções campo a campo. Não há dump genérico. Tokens OAuth/JWT, tokens guest/check-in, hashes de descadastro, credenciais Stripe e dados pessoais de terceiros são excluídos. Sessões exportadas pelo mentor omitem a identidade do mentorando; compras para terceiros omitem os dados do participante.

O frontend usa `authFetch`, `Blob`, URL temporária e revogação. Erro de API não cria arquivo vazio. O audit operacional `member.data_exported` registra somente ator, alvo e versão do schema, nunca o conteúdo.

## Solicitação revisada de exclusão

`account_deletion_requests` guarda UUID, membro, `pending/completed/canceled`, datas, revisor e nota opcional. Um índice único parcial impede duas pendências do mesmo membro; quem perde uma criação concorrente recupera a pendência existente.

API do titular:

- `GET /members/me/deletion-request` retorna a mais recente ou `null`;
- `POST /members/me/deletion-request` cria ou retorna a pendente;
- `POST /members/me/deletion-request/cancel` faz transição condicional somente da própria pendência.

API admin:

- `GET /admin/members/deletion-requests` pagina com default 50/cap 100 e filtro de status;
- `POST /admin/members/deletion-requests/:id/complete` exige admin e faz update condicional de `pending` para `completed`.

A fila fica em `/admin`, sem rota nova. A conclusão usa confirmação explícita do offboarding manual e nota opcional. Criar, cancelar e concluir gravam audit de governo com ator e antes/depois. Nenhuma dessas operações altera `members`.

## Frontend e acessibilidade

`MyDataTab` mantém visibilidade e consentimentos existentes e adiciona prévia responsiva, exportação e ciclo da solicitação. `ModalConfirm` aceita conteúdo rico em um `Box`, evitando forms/parágrafos aninhados. O texto distingue claramente solicitação pendente, cancelada e concluída, sem alegar exclusão imediata.

## Verificação e rollout

A implementação possui testes unitários de service/controller/migration/export, testes frontend de download e ciclo, e E2E PostgreSQL de concorrência, autorização, conclusão, attachment e rate limit. Os gates completos e a revisão independente são registrados no plano/PR da Fase 9.

Publicação técnica: PR #654, release `v1.2.0-backend` e migration 051 concluídas. A evidência de revisão jurídica/da diretoria não foi localizada nesta consolidação; validação controlada de exportação e solicitação permanece acompanhamento operacional. Não há sync ou novo workflow.

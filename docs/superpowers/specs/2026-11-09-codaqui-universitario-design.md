<!-- AGENT-INDEX
purpose: Design aprovado da Fase 4b — Codaqui Universitário, cidades, IES, embaixadores e eventos nas instituições.
audience: Mantenedores, implementers e revisores da próxima PR.
status: Implementado e publicado em v0.19.0-backend; administração de IES ampliada em 0.24.0.
sections:
  - Contexto e decisão
  - Escopo e não escopo
  - Modelo de dados e migration 042
  - Permissões e fluxos
  - APIs, eventos e snapshot
  - Frontend e privacidade
  - Testes, rollout e handoff
related-docs:
  - docs/plans/codaqui-1-0/README.md — subsistema H e sequência de fases
  - docs/adrs/008-entities-extension-projects.md — entities e projetos de extensão reutilizados
  - docs/adrs/006-directorates-designations.md — designations e roles derivadas
  - docs/adrs/013-hour-ledger.md — horas automáticas de eventos
agent-protocol:
  - Não duplicar IES, embaixadores ou eventos em tabelas paralelas.
  - Preservar guest claim, check-in, certificado, horas exactly-once e profileVisibility.
  - A spec precisa de revisão do usuário antes da escrita do plano de implementação.
-->

# Codaqui Universitário — Design da Fase 4b

## Contexto e decisão

O Codaqui Universitário organiza presença da associação em Instituições de Ensino Superior (IES): cidades, instituições, um embaixador ativo por IES e eventos realizados nelas. O desenho aprovado reutiliza `entities`, `member_designations`, `managed_events`, inscrições, check-in, certificados e `hour_ledger`.

A alternativa de criar instituições/embaixadores/eventos paralelos foi descartada por duplicar regras da Fase 4 e da plataforma de eventos. Controle apenas em JSON foi descartado porque não atende candidaturas, confirmação, permissões e ciclo operacional.

Backend publicado: **0.19.0**, com **migration 042**. A versão prevista 0.17.0 foi substituída pela minor final da PR #618; administração de IES foi ampliada em 0.24.0.

## Escopo e não escopo

### Incluído

- Cadastro e edição de cidades e IES por gestor do programa ou admin.
- Vínculo de IES a cidades por `entities.cityId`.
- Candidatura de membro a embaixador com motivação, avaliação pelo gestor e confirmação pelo admin.
- Um embaixador ativo por IES, com validade opcional e uma candidatura pendente por membro/IES.
- Managed events vinculados a uma IES, criados por embaixador ativo daquela IES, gestor ou organizer/admin já autorizado.
- Página pública `/universitario`, painel `/admin/universitario` e atalho do embaixador.
- Snapshot público `static/universities/index.json` e workflow de sincronização.
- ADR 015, E2E PostgreSQL e migration down/up em dump real.

### Fora

- Novo cadastro paralelo de IES, embaixadores ou eventos.
- Novo mecanismo de autenticação, inscrição, check-in, certificado ou horas.
- Múltiplos embaixadores ativos por IES ou presença multi-dia em eventos.
- Automação de parcerias/projetos de extensão: eles continuam sendo criados pelo fluxo da Fase 4 na mesma entity.
- Mentoria (Fase 5), Business (Fase 6), C4P (Fase 7) e campanhas de e-mail.

## Modelo de dados e migration 042

### Nova tabela `cities`

| Campo | Regra |
|---|---|
| `id` | UUID gerado pelo PostgreSQL |
| `name` | Obrigatório, até 120 caracteres, normalizado com trim |
| `uf` | Obrigatória, duas letras maiúsculas |
| `isActive` | Boolean, default `true` |
| `createdAt`, `updatedAt` | Timestamps padrão |

`name + uf` é único. O `down` remove a tabela somente depois de remover as dependências.

### Alterações em `entities`

- `cityId uuid NULL`, FK para `cities.id` com `ON DELETE RESTRICT`.
- IES continua sendo `entities.type = 'instituicao_ensino'`; nenhum tipo novo é criado.
- O vínculo é aceito apenas se a cidade existir e estiver ativa. Entidades de outros tipos podem receber cidade para reutilização futura, sem alterar seu comportamento.

### Alterações em `managed_events`

- `institutionId uuid NULL`, FK para `entities.id` com `ON DELETE RESTRICT`.
- O service exige entidade ativa do tipo `instituicao_ensino` quando o campo for informado.
- Índice por `institutionId` para a página pública e snapshot.

### Alterações em `member_designations`

- `validUntil timestamptz NULL` para encerrar a validade da posse sem apagar o histórico.
- `applicationNotes text NULL` para a motivação da candidatura, visível somente a gestor/admin.
- Índice parcial único para um `ambassador` `active` por IES (`targetType='ies'`, `targetId`, `designation='ambassador'`, `status='active'`). Antes de criá-lo, a migration valida duplicidades legadas e falha com relatório claro, sem apagar ou alterar o histórico.
- Índice parcial único para uma candidatura `pending` por membro/IES (`memberId`, `targetType`, `targetId`, `designation`, `status='pending'`).
- Consultas de permissão e projeções públicas consideram `validUntil IS NULL OR validUntil > now()`; demais designations, sem validade, não mudam.

O `down` remove índices e colunas adicionados, depois `cities`. Não remove entidades, eventos ou designations existentes.

## Permissões e fluxos

| Ator | Permissões |
|---|---|
| `admin` | Tudo no programa, inclusive confirmar posses |
| `manager @ program('universitario')` | Cidades, IES, visão do programa e avaliação de candidaturas |
| `ambassador @ ies` ativo e válido | Criar eventos somente na IES vinculada |
| `event_organizer` autorizado | Fluxo atual de eventos; vínculo a IES também é validado |
| Membro autenticado | Candidatar-se a embaixador e acompanhar a própria candidatura |
| Público | Cidades, IES ativas, embaixadores ativos e eventos públicos, sem dados de candidatura |

O service consulta a designation, não apenas a role derivada, evitando autorização por cache de role. Gestor avalia, mas **somente admin confirma** a posse.

### Jornada principal

1. Admin/designation competente concede `manager @ program('universitario')` com auditoria.
2. Gestor cadastra cidade e IES (`entities.type='instituicao_ensino'`) ou vincula uma entity existente à cidade.
3. Membro candidata-se à IES com motivação. A designation nasce `pending`.
4. Gestor avalia. Rejeição usa `removed` com `endedAt`; confirmação usa `active`, `confirmedById`, `confirmedAt` e `validUntil` opcional.
5. Embaixador ativo cria managed event com `institutionId` da própria IES.
6. Inscrição, check-in, concessão de certificado e `event_checkin` seguem o fluxo atual, inclusive certificação desacoplada da Fase 4.
7. Ação extensionista formal usa `extension_projects.entityId` da mesma IES, com mentor e horas da Fase 4, sem nova ponte.

Conflitos retornam 409; entidade/cidade inexistente, 404; escopo inválido, 403; payload inválido, 400. Uma candidatura duplicada não cria nova designation nem dispara e-mail.

## APIs, eventos e snapshot

APIs administrativas não usam `/admin/`:

| Método | Rota | Escopo |
|---|---|---|
| `GET` | `/universities/public` | Snapshot público completo |
| `GET` | `/universities/manage` | Visão do programa, gestor/admin |
| `POST` | `/universities/cities` | Criar cidade, gestor/admin |
| `PATCH` | `/universities/cities/:id` | Editar cidade, gestor/admin |
| `POST` | `/universities/institutions` | Criar/vincular IES, gestor/admin |
| `PATCH` | `/universities/institutions/:id` | Editar IES/cidade, gestor/admin |
| `POST` | `/universities/institutions/:id/ambassador-applications` | Candidatura do membro autenticado |
| `GET` | `/universities/ambassador-applications` | Fila, gestor/admin |
| `GET` | `/universities/ambassador-applications/my` | Minhas candidaturas |
| `POST` | `/universities/ambassador-applications/:id/reject` | Rejeitar, gestor/admin |
| `POST` | `/universities/ambassador-applications/:id/confirm` | Confirmar posse, somente admin |

`POST /events` e `PATCH /events/:id` aceitam `institutionId` opcional e reutilizam as validações atuais. A listagem/snapshot de managed events expõe um resumo da IES quando houver vínculo, sem campos privados.

O snapshot `static/universities/index.json` contém:

- `generatedAt`, `cities`, `institutions` e `events`;
- IES com `id`, `slug`, `name`, `website`, `city` e embaixador ativo válido;
- embaixador somente com `githubHandle`, `name`, `avatarUrl` e `validUntil`;
- eventos com `id`, `slug`, `title`, `startAt`, `status`, `location` e `institutionId`;
- nenhum e-mail, motivação, ID de ator, nota administrativa ou candidatura pendente.

`GET /universities/public` usa a mesma projeção. O proxy pode encaminhar `/universities/`, mas `/universities/index.json` é exceção estática exata, seguindo os demais snapshots.

## Frontend e privacidade

### `/universitario`

- Apresenta o programa, cidades/IES, embaixadores e eventos usando o snapshot.
- CTA de candidatura exige login e envia motivação à rota correspondente.
- Exibe estados vazios, erro com retry e fallback sem dados novos; não esconde falha como lista vazia.

### `/admin/universitario`

- `.astro` fino + ilha React com `useAuth`, `authFetch`, `parseAuthJson` e erros visíveis.
- CRUD de cidades/IES e fila de candidaturas com motivação, rejeição e confirmação por papel.
- Paginação usa `pagination.ts` e `PaginationControls`; cards responsivos, MUI 9/tokens e acessibilidade.
- Embaixador vê atalho para criar evento na própria IES, sem escolher outra instituição.

Privacidade: motivação e candidaturas ficam restritas a gestor/admin e ao próprio candidato. Nome/handle/avatar do embaixador são públicos pela natureza da posse; nenhum e-mail é publicado. Atualizar `docs/modules/privacy/treatments.md` e manter `profileVisibility` nos demais perfis.

## Testes, rollout e handoff

- Migration: colunas, FKs, índices únicos parciais e down/up preservando entities, eventos e designations.
- Services: escopo por papel, IES/cidade inválida, duplicidade, validade expirada, rejeição, confirmação e concorrência de posses.
- Eventos: embaixador só cria na própria IES; tipo errado e institutionId inexistente falham sem abrir transação de quota.
- Snapshot: projeção mínima, sem motivação/e-mail/candidaturas, falha preserva o arquivo anterior.
- Frontend: candidatura, fila, confirmação, erros parciais, teclado, responsividade e estado vazio.
- E2E PostgreSQL: cidade → IES → candidatura → confirmação → evento → inscrição → check-in → certificado/horas exactly-once.
- Gates: backend build/Jest, scripts, `make astro-verify`, `make astro-verify-tenants` e E2E em dump real.
- Handoff: ADR 015, `AGENTS.md`, `DEVELOPMENT.md`, manual de eventos e plano Codaqui 1.0 atualizados. Merge, release e deploy somente por comando explícito.

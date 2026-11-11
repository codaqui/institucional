<!-- AGENT-INDEX
purpose: ADR da Fase 4 — entidades jurídicas, parcerias, projetos de extensão, participantes, horas, comprovantes e escopos organizacionais.
audience: AI agents, mantenedores, diretoria e operadores de release.
status: Implementado e verificado em banco descartável; integração, release v0.16.0-backend, sync inicial e validação pública pendentes.
sections:
  - Contexto
  - Decisão
  - Modelo e lifecycle
  - Autorização e privacidade
  - APIs e frontend
  - Escopos organizacionais
  - Concorrência e comprovantes
  - Verificação e handoff
related-docs:
  - 006-directorates-designations.md — designations e roles derivadas
  - 013-hour-ledger.md — hour_ledger separada e aprovação
  - 014-assemblies.md — assembleias e Discussion manual
  - ../superpowers/specs/2026-11-06-entities-extension-design.md — design aprovado
  - ../superpowers/plans/2026-11-07-entities-extension.md — implementação e evidências
agent-protocol:
  - Não integrar orçamento com LedgerService; horas usam somente hour_ledger.
  - Não publicar IDs internos, e-mails, notas internas, aprovações ou idempotency keys.
  - Não declarar merge, release, deploy, sync inicial ou validação pública sem evidência externa.
-->

# ADR 008 — Entidades e Projetos de Extensão

- **Data da decisão:** 2026-11-06
- **Revisão:** 2026-11-09 — escopos de diretorias e assembleias
- **Status:** Implementado; integração e release pendentes
- **Escopo:** Fase 4, migrations 037–040, backend 0.16.0, API NestJS, snapshots e interfaces Astro/React

## Contexto

A Codaqui precisa gerir relações institucionais e a jornada entidade → parceria → projeto → mentor → participante → horas → aprovação → finalização → comprovante sem misturar dinheiro, carga horária ou narrativa de relatórios. A vitrine open source existente em `/projetos` deve permanecer intacta.

Ficam fora: cidades, IES, Codaqui Universitário, lista de espera, upload, votação/comitê, integração do orçamento com dinheiro, trilhas, métricas por ODS, mentoria da Fase 5, automação de Discussions e campanhas de e-mail.

## Decisão

Criar os módulos `entities` e `projects` em NestJS/TypeORM, reutilizando designations, `hour_ledger`, auditoria, notificações e validação de URLs. O backend fica preparado em **0.16.0**, com todas as migrations na mesma release futura.

- `entities`: entidades jurídicas com slug único, tipo, dados de contato privados e `isActive`.
- `partnerships`: termos ou vínculos pontuais pertencentes a uma entidade.
- `extension_projects`: rascunho mínimo `name + entityId`, dados completos, cronograma, ODS, público, orçamento descritivo e relatório externo.
- `project_participants`: vínculos `participant | mentor`, com saída lógica e unicidade ativa.
- `project_certificates`: documento idempotente com código único, tipo e horas congeladas na primeira emissão.

O mentor principal é exclusivamente `mentor @ extension_project`; não existe `mentorMemberId` persistido no projeto. Co-mentores têm vínculo de participante, mas não recebem a designation principal. O orçamento nunca chama `LedgerService`; horas usam exclusivamente `hour_ledger`.

## Modelo e lifecycle

O fluxo é `draft → proposed → active → finished`, com `canceled` possível antes do estado terminal. Rascunho exige somente nome e entidade. Completar exige todos os campos funcionais e mentor principal. Ativação/cancelamento exige admin ou diretor criador ativo. Finalização exige admin, diretor criador ativo ou mentor principal ativo e uma Discussion de relatório válida.

Inscrição exige projeto ativo, janela aberta e vaga. Mentores não ocupam vagas. O mentor principal lista participantes e horas, lança/edita entradas pendentes e finaliza somente com `status + reportDiscussionUrl`; não edita campos editoriais. Aprovação/rejeição continua com admin/finance-analyzer.

Declaração individual exige projeto finalizado e horas aprovadas positivas. O relatório de mentoria usa o total aprovado do projeto. Reemissão retorna o mesmo código e `hoursAtIssue`; PDF é impressão nativa do frontend.

## Autorização e privacidade

| Operação | Ator |
|---|---|
| Entidades, parcerias e projetos | Admin ou diretor com designation ativa |
| Ativar/cancelar projeto | Admin ou diretor criador ativo |
| Finalizar projeto | Admin, diretor criador ativo ou mentor principal |
| Inscrever-se/sair | Membro autenticado |
| Participantes e horas do projeto | Admin ou mentor principal |
| Lançar/editar horas pendentes | Mentor principal |
| Aprovar/rejeitar horas | Admin/finance-analyzer |
| Declaração individual | Titular autenticado |
| Comprovante de relatório | Mentor principal ou admin operacional |

Projeções públicas omitem `createdById`, `registeredById`, contatos, notas internas, orçamento detalhado, anexos, aprovações e idempotency keys. Participantes expõem somente ID funcional do membro, papel, nome e handle ao escopo autorizado. A listagem de horas do mentor projeta somente `id`, `memberId`, `hours`, `description`, `occurredAt`, `status` e `rejectReason`.

## APIs e frontend

- Entidades: `GET /entities/public`, `GET/POST /entities`, `PATCH /entities/:id`, `GET/POST /entities/:id/partnerships`, `PATCH /partnerships/:id`. O CRUD genérico preserva os demais tipos, mas não cria IES nem altera tipos de/para `instituicao_ensino`; o fluxo canônico de IES é `/admin/universitario` (ADR 015), sem `cityId` no DTO genérico.
- Projetos: `GET /projects/public`, `GET /projects/public/:slug`, `GET/POST /projects`, `PATCH /projects/:id`.
- Participação: `GET /projects/my`, `GET /projects/:id/participants`, `POST /projects/:id/join`, `POST /projects/:id/leave`, `DELETE /projects/:id/participants/:memberId`.
- Horas: `GET/POST /projects/:id/hours`, `PATCH /projects/:id/hours/:hourId`; revisão permanece em `/hours`.
- Comprovantes: `POST /project-certificates/projects/:projectId`, `GET /project-certificates/:code`, `GET /project-certificates/verify/:code`.

`/projects/my` inclui nome/slug, papel, status e relatório dos projetos do próprio membro. Listagens administrativas usam o envelope compartilhado. O proxy aceita `/entities/`, `/partnerships/`, `/projects/`, `/project-certificates/` e `/hours/`, sem novo prefixo `/admin/`.

`/projetos` preserva open source e acrescenta extensão; detalhes aceitam inscrição e `/projetos/comprovante` verifica códigos. Admin recebe `/admin/entidades` e `/admin/projetos`; `/membro` recebe horas/declarações e a área do mentor. Assembleias ganham seletor/filtro de entidade e diretorias seletor/filtro de comunidade.

## Escopos organizacionais

A migration 040 adiciona `directorates.communityId` opcional (`NULL` = global) e `assemblies.entityId` obrigatório após backfill da entidade `codaqui`. Numeração e advisory lock passam a ser por `entityId + type`.

As rotas públicas são `/assembleias/<entitySlug>/<type>-<number>`. Snapshots antigos sem entidade usam fallback Codaqui. O redirect legado `/assembleias/* → /assembleias/codaqui/*` vive em `dist/_redirects`; o gate de paridade resolve targets dinâmicos contra arquivos `.astro`, sem páginas-sombra. O sync valida `entity: {slug,name}` em toda resposta nova.

## Concorrência e comprovantes

Inscrição bloqueia o projeto antes de contar vagas. Lançamento e edição de horas verificam `pending + approved <= totalHours`, preservam idempotency key e rejeitam duplicidade explícita. Certificados usam unicidade `(projectId,memberId,kind)` e retornam o registro existente em emissões repetidas ou simultâneas. Assembleias mantêm lock transacional e números distintos por entidade/tipo.

## Verificação e handoff

Em um banco Podman isolado restaurado do dump real, as migrations 026–040 foram aplicadas, 037–040 revertidas até 036 e reaplicadas. Uma assembleia sintética inserida antes da 040 preservou número e recebeu a entidade Codaqui. Foram preservados 174 membros e 6 comunidades; tabelas e constraints foram verificadas e a fixture removida.

O E2E `backend/test/projects-phase4.e2e-spec.ts` executou o módulo completo com atores sintéticos e comprovou: draft/proposed/active, duas inscrições na última vaga com resultado 201/409, retry de horas sem duplicação, edição pendente, aprovação financeira, finalização pelo mentor, emissão repetida com o mesmo código e duas assembleias concorrentes numeradas 1 e 2. A execução também revelou e corrigiu wiring de Storage/Hours, injeção de repositórios opcionais, transição `draft → proposed`, validação de `kind` e projeção da entidade.

Gates: 1.220 testes backend, 894 frontend, 80 scripts, `make astro-verify` e `make astro-verify-tenants` verdes. Fixtures E2E ficaram zeradas.

Restam, em ordem e com autorização explícita: merge local em `develop`, PR para `main`, CI/Sonar/review, merge autorizado, publicação `v0.16.0-backend`, redeploy no Coolify, confirmação das migrations 037–040, sync inicial de projetos, publicação do frontend e validação real da jornada. Nenhuma dessas etapas externas é declarada concluída por esta ADR.

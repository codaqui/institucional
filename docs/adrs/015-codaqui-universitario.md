<!-- AGENT-INDEX
purpose: ADR da Fase 4b — Codaqui Universitário com cidades, IES, embaixadores e eventos vinculados.
audience: AI agents, mantenedores, gestores do programa e operadores de release.
status: Implementado e publicado em v0.19.0-backend; administração de IES ampliada em 0.24.0.
sections:
  - Contexto
  - Decisão
  - Modelo e migration 042
  - Permissões e ciclo das candidaturas
  - APIs, eventos e snapshot
  - Frontend e privacidade
  - Verificação e operação
  - Consequências e pendências
related-docs:
  - 008-entities-extension-projects.md — entities e projetos de extensão reutilizados
  - 006-directorates-designations.md — designations e roles derivadas
  - 013-hour-ledger.md — horas exactly-once no check-in
  - ../superpowers/specs/2026-11-09-codaqui-universitario-design.md — design aprovado
  - ../superpowers/plans/2026-11-09-codaqui-universitario.md — plano e evidências
agent-protocol:
  - Não criar tabelas paralelas de IES, embaixadores ou eventos.
  - Não publicar motivação, e-mail, candidaturas ou IDs de atores no snapshot.
  - Publicar na ordem backend/migration → sync inicial → frontend; não declarar essas ações externas antes da evidência.
-->

# ADR 015 — Codaqui Universitário

- **Data da decisão:** 2026-11-09
- **Status:** Implementado e verificado; integração e publicação pendentes
- **Escopo:** Fase 4b, backend 0.17.0, migration 042, API NestJS, snapshots e páginas Astro/React

## Contexto

A Codaqui precisa organizar presença em Instituições de Ensino Superior (IES) sem criar um sistema paralelo de cadastro, eventos, certificados ou horas. O programa tem gestores, cidades, IES, um embaixador ativo por instituição e eventos realizados nelas.

A alternativa de criar tabelas próprias para instituições, embaixadores e eventos foi descartada por duplicar regras já verificadas nas fases anteriores. Um registro apenas em JSON não atenderia candidaturas, confirmação, escopo, auditoria e concorrência.

## Decisão

Reutilizar `entities` para IES, `member_designations` para gestores e embaixadores e `managed_events` para eventos. Somente `cities` é uma tabela nova. Inscrição, guest claim, check-in, concessão de certificado, verificação e `hour_ledger` permanecem nos fluxos existentes.

O backend é versionado como **0.17.0** e a migration **042** adiciona somente os vínculos necessários. Uma ação extensionista formal continua sendo um `extension_project` na mesma entity da IES, sem relação paralela com o evento.

## Modelo e migration 042

- `cities`: `id`, `name`, `uf`, `isActive`, `createdAt`, `updatedAt`; `(name,uf)` é único.
- `entities.cityId`: FK opcional para `cities`, `ON DELETE RESTRICT`.
- `managed_events.institutionId`: FK opcional para `entities`, `ON DELETE RESTRICT`, com índice.
- `member_designations.validUntil`: validade opcional da posse; consultas de autorização e projeções exigem `NULL` ou data futura.
- `member_designations.applicationNotes`: motivação da candidatura, restrita a gestor/admin e ao próprio candidato.

Um índice parcial garante um `ambassador` `active` por IES. Outro garante uma candidatura `pending` por membro/IES. Antes de criar esses índices, a migration consulta duplicidades e falha com os IDs envolvidos, sem apagar histórico. O down remove apenas os objetos da 042; deve ser ensaiado em banco descartável porque elimina os vínculos e as cidades criados por esta fase.

## Permissões e ciclo das candidaturas

| Ator | Permissões |
|---|---|
| `admin` | Todas as operações, inclusive confirmar posse |
| `manager @ program('universitario')` | Cidades, IES, visão administrativa e avaliação/rejeição |
| `ambassador @ ies` ativo e válido | Criar evento somente na própria IES |
| `event_organizer` autorizado | Fluxo atual de eventos, com validação da IES quando houver vínculo |
| Membro autenticado | Candidatar-se e acompanhar as próprias candidaturas |
| Público | Cidades, IES ativas, embaixadores ativos e eventos publicados |

O membro se candidata com motivação de 10–2000 caracteres. A candidatura nasce `pending`; gestor pode rejeitar, mas somente admin confirma. A confirmação grava `confirmedById`, `confirmedAt` e validade opcional. Duplicidade e conflito de posse retornam 409.

`POST /events` deixa a autorização no service: sem `institutionId`, vale a regra organizer/admin; com vínculo, admin/organizer, gestor ou embaixador daquela IES ativa é validado pela designation. O controller não impõe uma role global que impeça o embaixador antes dessa verificação.

As transições de candidatura invalidam o cache de designations. Sem essa invalidação, a consulta negativa feita antes da candidatura poderia permanecer por até 60 segundos e bloquear o primeiro evento após a posse. O E2E real detectou e passou a cobrir esse caso.

## APIs, eventos e snapshot

| Método | Rota | Escopo |
|---|---|---|
| `GET` | `/universities/public` | Projeção pública completa |
| `GET` | `/universities/manage` | Gestor/admin |
| `POST/PATCH` | `/universities/cities[/:id]` | Gestor/admin |
| `POST/PATCH` | `/universities/institutions[/:id]` | Gestor/admin |
| `POST` | `/universities/institutions/:id/ambassador-applications` | Próprio membro |
| `GET` | `/universities/ambassador-applications` | Fila de gestor/admin |
| `GET` | `/universities/ambassador-applications/my` | Próprio membro |
| `POST` | `/universities/ambassador-applications/:id/reject` | Gestor/admin |
| `POST` | `/universities/ambassador-applications/:id/confirm` | Somente admin |

`GET /universities/manage` lista também cidades e IES inativas e acrescenta `isActive`, `contactEmail` e `cityId` às IES para edição; a projeção pública permanece restrita a registros ativos e sem contato. O CRUD genérico `/entities` não cria IES nem converte tipos de/para `instituicao_ensino`, orientando o operador a usar `/admin/universitario`. Novas IES e novos vínculos exigem cidade ativa; atualizar uma IES sem trocar sua cidade histórica inativa é permitido para manutenção e reativação.

`CreateEventDto` e `UpdateEventDto` aceitam `institutionId` opcional. A projeção pública de eventos inclui o resumo da IES sem `registeredById` ou contato.

`GET /universities/public` e `static/universities/index.json` contêm `{generatedAt,cities,institutions,events}`. IES expõe `id`, `slug`, `name`, `website`, `city` e embaixador com `githubHandle`, `name`, `avatarUrl`, `validUntil`. Eventos expõem somente `id`, `slug`, `title`, `startAt`, `status`, `location`, `institutionId`. Não há e-mail, motivação, candidaturas ou IDs de atores.

`npm run sync:universities` usa `UNIVERSITIES_API_URL` (default `http://localhost:3001`), valida o payload completo e grava por arquivo temporário + rename. Falha de HTTP, contrato ou escrita preserva o snapshot anterior. O workflow `sync-universities.yml` roda diariamente às 06:26 UTC e por dispatch; o agregador `npm run sync` não inclui o programa. O proxy aceita `/universities/`, mas `/universities/index.json` é exceção estática exata.

## Frontend e privacidade

`/universitario` apresenta cidades, IES, embaixadores e eventos pelo snapshot e oferece candidatura autenticada. O formulário usa labels nativos associados aos controles, validação de motivação e erros visíveis. Snapshot ausente ou inválido produz aviso e fallback vazio, sem confundir falha com ausência de registros.

`/admin/universitario` reúne CRUD de cidades/IES, fila paginada com `PaginationControls`, motivação, rejeição e confirmação por papel. O membro vê somente suas candidaturas; gestor/admin chamam também as APIs administrativas. O embaixador recebe `/admin/eventos?institutionId=<iesId>` e o formulário mantém esse vínculo fora dos controles editáveis e no payload.

Nome, handle e avatar do embaixador são públicos pela natureza da posse. Motivação e candidaturas ficam restritas ao próprio candidato e a gestor/admin. `profileVisibility` continua controlando os demais perfis e históricos, sem alteração nesta fase.

## Verificação e operação

A migration 042 foi aplicada, revertida e reaplicada em dump real isolado. As contagens foram preservadas: **1 entity, 1 managed event e 3 designations**. Não havia duplicidades ativas ou pendentes que impedissem os índices.

`backend/test/universities.e2e-spec.ts` executou em PostgreSQL real a jornada gestor → cidade → IES → candidatura → recusa pelo gestor → confirmação admin → evento do embaixador → publicação/inscrição → dois check-ins → certificado de 120 minutos → uma única entrada de 2 horas. O teste também verifica a projeção pública sem motivação e remove todas as fixtures. Os bancos descartáveis foram removidos.

Na entrega, os gates locais verificaram **1.270 testes Jest**, **919 testes Vitest**, **84 testes de scripts**, build NestJS e `astro check`. `make astro-verify` passou com paridade de **646 URLs** e `make astro-verify-tenants` passou nos builds codaqui, tisocial, elasnocodigo e devparana. Os workflows de PR são registrados no handoff da PR.

Sequência de publicação:

1. integrar a PR autorizada e publicar `v0.17.0-backend`;
2. fazer redeploy no Coolify e confirmar a migration 042;
3. executar `npm run sync:universities` ou o workflow com sucesso;
4. publicar o frontend e validar `/universitario`, candidatura, confirmação e criação do primeiro evento pelo embaixador;
5. conferir snapshot, inscrição, check-in, certificado e horas em uma jornada operacional controlada.

A publicação pendente de backend 0.16.x permanece um handoff independente e não deve ser substituída ou marcada como concluída por esta fase.

## Consequências e pendências

- O desenho evita duplicação, mas exige que qualquer novo fluxo de evento preserve a validação de IES e a invalidação de cache nas transições de designation.
- O snapshot introduz defasagem entre API e site e exige sync + build após mudanças públicas.
- Integração na `main`, release/redeploy, sync inicial e validação pública continuam pendentes até comando explícito e evidência externa.
- Múltiplos embaixadores ativos por IES, presença multi-dia, mentoria, Business, C4P e campanhas de e-mail ficam fora desta ADR.

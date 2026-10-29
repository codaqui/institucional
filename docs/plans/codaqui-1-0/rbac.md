<!-- AGENT-INDEX
purpose: Consolidação do RBAC do Codaqui 1.0.0 — modelo de 3 camadas (roles globais + designations escopadas + guards derivados), matriz de permissões A–H, concessões auditáveis, derivação de roles, migração e impactos no frontend.
audience: Presidência, mantenedores, AI agents implementando as fases 1a–7.
status: design proposto em 2026-10-29 (decisão da presidência de concentrar o RBAC e estruturar tudo que depende dele); aplica-se a partir da Fase 1a — substitui/estrutura a seção "Papéis e permissões" do README.md do plano (que permanece como visão de fase).
sections:
  - Contexto e decisão
  - Camada 1 — Roles globais (lista final)
  - Camada 2 — member_designations (a tabela única de vínculos)
  - Camada 3 — Guards derivados
  - Matriz de permissões consolidada (A–H + transversais)
  - Quem aprova o quê (concessões auditáveis)
  - Derivação de roles a partir de designations
  - Migração e rollout por fase
  - Impactos no frontend
  - Riscos e pontos abertos do design
  - Critérios de pronto (Fase 1a)
related-docs:
  - ./README.md — plano 1.0.0 (subsistemas A–H, fases, decisões de concessão)
  - ../../modules/events/ROLES.md — papéis atuais de eventos
  - ./c4p.md — subsistema G (auth por vínculo por campanha)
  - backend/src/auth/guards/roles.guard.ts — guard atual de roles globais
  - backend/src/event-organizer/ — ownership pattern atual de eventos externos
agent-protocol:
  - Este documento é o contrato RBAC do 1.0.0: ao implementar qualquer fase, consulte a matriz de permissões e o mapeamento de migração antes de criar coluna/tabela de vínculo novo.
  - Toda concessão (selo, embaixador, mentor, tier, horas) passa por designation + audit — nunca por coluna solta.
  - Roles derivadas NUNCA são escritas à mão: só pelo sync job (seção "Derivação").
-->

# RBAC Consolidado — Codaqui 1.0.0

> **Decisão da presidência (2026-10-29):** concentrar o RBAC em um modelo único de 3 camadas e estruturar tudo que depende dele. Hoje o modelo está espalhado: roles globais em `members.roles[]`, vínculos escopados por subsistema (`event_organizer_ownerships`, `event_staff`, `companies.responsibleMemberId`, e os planejados `communities.responsibleMemberId`, `institution_ambassadors`, `c4p_evaluators`, `extension_projects.mentorMemberId`, `directorates.directorMemberId`, `partnerships.directorMemberId`), e permissões descritas fase a fase no README. Este documento é o desenho definitivo.

## Contexto e decisão

O problema de hoje é **dupla fonte de verdade**: um mentor de projeto de extensão é ao mesmo tempo uma linha em `extension_projects.mentorMemberId` e (a partir da Fase 4) uma role `mentor` em `members.roles`; um diretor é uma linha em `directorates.directorMemberId` e uma role `diretor`. Nada garante que as duas fontes estejam em sync — esse é o gap apontado pela presidência na consolidação. A decisão:

1. **Roles globais ficam** em `members.roles[]`, mas só para o que é **global por natureza** (admin, finance, eventos). Papéis organizacionais (`diretor`, `voluntario`, `mentor`, `gestor_universitario`) viram **derivados** de designations ativas — escritos só por sync job.
2. **Toda designação escopada** (responsável, embaixador, mentor de projeto, avaliador, diretor…) vive numa **tabela única `member_designations`**, substituindo uma a uma as colunas/tabelas de vínculo — novas tabelas nascem **sem** coluna de vínculo.
3. **Concessões auditáveis** padronizadas: quem propõe, quem confirma, registro em designation (`appointedById`, `since`) + `audit_logs`.
4. **API pública inalterada na Fase 1a** — `members.roles` continua exposto (agora incluindo derivadas); rollout por fase, cada subsistema migra ao tocar sua fase.

---

## Camada 1 — Roles globais (`members.roles[]`)

Enum final de `MemberRole`, dividido em **duas classes**:

| Classe | Roles | Concedida por |
|---|---|---|
| **Manual** (escrita por admin via `PATCH /members/:id/roles`, audit `member.role_change`) | `membro` (default), `admin`, `finance-analyzer`, `event_organizer`, `event_finance`, `event_host`, `event_checker` | Admin (bootstrap admin continua via env) |
| **Derivada** (escrita **exclusivamente** pelo sync job de designations — seção "Derivação"; rejeitada em PATCH manual) | `diretor`, `voluntario`, `mentor`, `gestor_universitario` | Designation ativa correspondente |

Regras:

- O conjunto derivado é **fechado**: a API de roles valida que PATCH nunca inclui nem remove role derivada (erro 409 com mensagem "role derivada — gerida pelo sync de designations"). Isso mata a dupla fonte de verdade por construção.
- `RolesGuard` + decorator `@Roles()` continuam como estão (`backend/src/auth/guards/roles.guard.ts`) — nenhuma mudança de contrato. Checagens de designation vão por guard paralelo (Camada 3).
- O JWT continua carregando `roles` (rápido, sem query). Designations **não** entram no JWT — são checadas no banco com cache curto (Camada 3).
- Nenhuma role nova por subsistema: os papéis de eventos (`event_*`) permanecem globais por decisão histórica (ROLES.md); papéis organizacionais novos só entram como designation, não como role.

> **Por que manter `event_organizer`/`event_finance`/`event_host`/`event_checker` globais:** são credenciais operacionais de plataforma (quem pode operar a máquina de eventos), não nomeações da organização — o escopo fino já é dado por `event_staff` e, para externos, pela designation `organizer`. Reescrevê-las agora quebraria ROLES.md e o check-in 0.11.x sem ganho.

---

## Camada 2 — `member_designations` (a tabela única)

### DDL

```sql
CREATE TABLE member_designations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memberId      uuid NOT NULL REFERENCES members(id),
  targetType    varchar(24) NOT NULL,   -- enum abaixo
  targetId      uuid,                   -- FK lógica conforme targetType; NULL p/ program + wildcards
  targetKey     varchar(64),            -- slug de program ('mentoria','universitario') ou scope legado
  designation   varchar(24) NOT NULL,   -- enum abaixo
  since         timestamptz NOT NULL DEFAULT now(),
  validUntil    timestamptz,            -- selos/nomeações com validade (renovação = nova linha)
  appointedById uuid NOT NULL REFERENCES members(id),
  status        varchar(16) NOT NULL DEFAULT 'active',
  createdAt     timestamptz NOT NULL DEFAULT now(),
  updatedAt     timestamptz NOT NULL DEFAULT now()
);
-- índices: (memberId,status), (targetType,targetId,designation,status), (targetType,targetKey,designation,status)
```

**Enums:**

- `targetType` (base prescrito pela presidência + 2 acréscimos propostos — ver nota):
  `community` · `event` · `ies` · `c4p_campaign` · `extension_project` · `directorate` · `company` · **`entity`** · **`program`**
- `designation`:
  `responsible` · `ambassador` · `organizer` · `evaluator` · `mentor` · `director` · `maintainer` · `manager` · **`volunteer`**
- `status`: `pending` (candidatura aguardando confirmação) · `active` · `ended` (finalizado/validade esgotada) · `removed` (revogado)

> **Acréscimos propostos pelo design (não estavam no prescrito, justificativa):**
> - `targetType='entity'` — casa `entities.responsibleMemberId` e `partnerships.directorMemberId` (o alvo é uma entity; `ies` é o caso tipado `instituicao_ensino`).
> - `targetType='program'` + `targetKey` — designações sem alvo material: mentor do programa de mentoria (`targetKey='mentoria'`), gestor do Universitário (`targetKey='universitario'`). `targetId` fica NULL.
> - `designation='volunteer'` — vínculo genérico de voluntariado em diretoria (`directorate_members`); sem ele a role `voluntario` não teria designation de origem.
>
> Se a presidência preferir não ampliar os enums, as alternativas são: mentor/gestor como roles manuais (reabre o gap de dupla fonte) e `directorate_members` permanecendo tabela própria (exceção). Recomendação do design: aceitar os acréscimos — custo zero em relação ao prescrito.

### Resolução do alvo por `targetType`

| targetType | targetId aponta para | Observação |
|---|---|---|
| `community` | `communities.id` | |
| `event` | `managed_events.id` **ou** `external_event_activations.id` | Externo não ativado: `targetId=NULL` + `targetKey='source:sourceId[:eventId]'` (compat. com scopes legados) |
| `ies` | `entities.id` (com `type='instituicao_ensino'`) | Constraint validada no service |
| `entity` | `entities.id` | |
| `extension_project` | `extension_projects.id` | |
| `directorate` | `directorates.id` | |
| `company` | `companies.id` | |
| `c4p_campaign` | `c4p_calls.id` | |
| `program` | NULL + `targetKey` | `'mentoria'`, `'universitario'` |

### Guards de unicidade (partial, por regra de negócio)

Implementados como índices únicos parciais + validação no service (o service valida antes para mensagem amigável; o índice é a garantia):

1. **1 `responsible` active por `community`** (pré-requisito do Selo Codaqui).
2. **1 `ambassador` active por `ies`** (regra do subsistema H).
3. **1 `director` active por `directorate`**.
4. **1 `mentor` active por `extension_project`**.
5. **1 `responsible` active por `company`** (equivale ao `UNIQUE` atual de `companies.responsibleMemberId`).
6. `program`/`mentoria`: **1 designation `mentor` active por member** (equivale ao unique de `mentor_profiles.memberId`).
7. `event`/`organizer`: sem unicidade — um evento pode ter vários organizers (já é assim em `event_organizer_ownerships`).

Nomeações com validade (selo, aliada, embaixador) renovam criando **nova linha** (`since` novo, anterior vai a `ended`) — histórico preservado na própria tabela, independente do TTL de 90 dias do `audit_logs`.

### Exceção justificada: `event_staff` NÃO migra

`event_staff` (host/checker/finance por evento) **permanece como está**, fora de `member_designations`, por três diferenças estruturais:

- **Natureza:** designations são *nomeações da organização* (presidência/diretoria nomeia, com `appointedById` + trilha); staff é *delegação operacional* feita pelo organizer do evento, sem valor organizacional fora do evento.
- **Forma:** staff não tem `since`/`validUntil`/`appointedBy` — o ciclo de vida é o próprio evento; carregar essas colunas nulas poluiria a tabela única.
- **Custo/benefício:** o pattern está estável e testado (0.11.x); reescrevê-lo toca check-in atômico, ROLES.md e os constants `CHECKIN_ROLES`/`LIST_ROLES` sem ganho de consolidação.

Critério para futuras exceções: um vínculo só vira designation se for nomeação auditável da organização; vínculos operacionais efêmeros continuam por tabela do subsistema. Se um dia se quiser unificar, staff entra como designation adicional (`host`/`checker`/`finance` em `@event`) sem mudar a forma da tabela.

### Mapeamento de migração — uma a uma

| Origem (hoje ou planejada) | vira | designation @ targetType | Fase de cutover |
|---|---|---|---|
| `event_organizer_ownerships.scope[]` (existe) | 1 linha por scope entry; `organizer` @ `event` (`targetId` p/ ativações, `targetKey` p/ wildcards) | `organizer` @ `event` | **1a** (seed) · tabela legada drop na Fase 2 |
| `communities.responsibleMemberId` (planejada 1a) | não nasce — tabela `communities` **sem a coluna** | `responsible` @ `community` | 1a (greenfield) |
| `directorates.directorMemberId` (planejada 1a) | não nasce — sem a coluna | `director` @ `directorate` | 1a (greenfield) |
| `directorate_members` (planejada 1a) | não nasce — histórico vira linhas `volunteer` | `volunteer` @ `directorate` | 1a (greenfield) |
| `companies.responsibleMemberId` (existe) | designation espelha a coluna; coluna drop na Fase 6 | `responsible` @ `company` | 6 |
| `entities.responsibleMemberId` (planejada 4) | não nasce — sem a coluna | `responsible` @ `entity` | 4 |
| `partnerships.directorMemberId` (planejada 4) | não nasce — sem a coluna | `manager` @ `entity` | 4 |
| `extension_projects.mentorMemberId` + `designatedById` (planejada 4) | não nasce — `appointedById` = antigo `designatedById` | `mentor` @ `extension_project` | 4 |
| `institution_ambassadors` (planejada 4b) | candidatura entra `pending` (gestor propõe) → admin confirma `active` | `ambassador` @ `ies` | 4b |
| gestor do Universitário (role planejada 4b) | designation, não flag manual | `manager` @ `program('universitario')` | 4b |
| `mentor_profiles.memberId` + `approvedById` (planejada 5) | designation é a fonte; `mentor_profiles` referencia ou é a view | `mentor` @ `program('mentoria')` | 5 |
| `c4p_evaluators` (planejada 7) | status de convite/aceite vira `pending`/`active`/`removed` | `evaluator` @ `c4p_campaign` | 7 |

Detalhe do seed 1a (ownership de eventos): para cada `EventOrganizerOwnership`, uma designation por scope — `source:sourceId:eventId` com ativação existente resolve `targetId` via `external_event_activations.eventKey`; wildcard `source:sourceId:*` e evento não ativado viram `targetId=NULL, targetKey=scope`. `appointedById = createdByMemberId`, `since = createdAt`. `GET /events/internal/organizers` (formato `OrganizersFile`) passa a ser montado pela `DesignationsService` a partir de designations `organizer @ event` — contrato externo preservado.

---

## Camada 3 — Guards derivados

**`DesignationsService`** (módulo novo `designations/` no backend):

```ts
// assinaturas centrais
hasDesignation(memberId: string, q: {
  targetType: TargetType;
  targetId?: string;
  designation?: Designation | Designation[];  // default: qualquer
  activeOnly?: boolean;                          // default: true
}): Promise<boolean>

requireDesignation(memberId: string, q: {...}): Promise<void>  // 403 padronizado

listActive(memberId: string): Promise<MemberDesignation[]>      // p/ /members/me/designations
grant(dto, actor): Promise<MemberDesignation>                    // appointment auditado
revoke(id, actor, reason?): Promise<void>                        // status='removed' + audit
confirm(id, actor): Promise<MemberDesignation>                   // pending → active + audit
```

**Guard declarativo** — decorator `@Designations(...)` + `DesignationsGuard` (guard assíncrono que injeta `DesignationsService`; lê `req.user.sub`). Uso típico:

```ts
@Patch('communities/:id/seal')
@Designations({ targetType: 'community', targetIdParam: 'id', designation: 'responsible' })
```

**Cache:** leituras por member com TTL curto (~60s, cache em memória por instância — o backend é single-instance em produção; se escalar, trocar por cache compartilhado sem mudar a interface). Writes fazem invalidate imediato do member afetado. Checagens de designation são fora do caminho quente (check-in atômico continua usando `event_staff`/roles — sem query extra).

**Nunca duplicar regra:** guards de designation respondem "este membro é X deste alvo"; guards de role respondem "este membro tem credencial global Y". Se uma checagem puder ser expressa nas duas camadas, a designation é a fonte e a role derivada é só atalho de leitura.

---

## Matriz de permissões consolidada (subsistemas A–H + transversais)

Convenção: **L** = leitura · **E** = escrita/Operação · **A** = aprovação/concessão. "escopo" = designation ativa no alvo. Admin tem L/E/A em tudo (implícito, omitido das células).

### A. Assembleias

| Ação | Público | Membro | Diretoria/escopo | Aprovação |
|---|---|---|---|---|
| Ver assembleias/atas (Discussion) | L | L | L | — |
| Criar/editar assembleia | — | — | E (`diretor` derivado) | admin |
| Anexar registro cartorário | — | — | E | admin |

### B. Diretorias, voluntários e horas

| Ação | Público | Membro | Escopo | Aprovação |
|---|---|---|---|---|
| Ver diretorias ativas/voluntários | L | L | L | — |
| Lançar horas (atividade de diretoria) | — | — | E: `director` @ diretoria | admin / `finance-analyzer` |
| Lançar horas (projeto de extensão) | — | — | E: `mentor` @ projeto | admin / `finance-analyzer` |
| Horas por check-in em evento | — | (automático, `event_checkin` approved) | — | — |
| Horas por sessão de mentoria | — | — | E: `mentor` @ program mentoria | admin / `finance-analyzer` |
| Aprovar/rejeitar horas pendentes | — | — | — | admin / `finance-analyzer` |
| Emitir declaração de horas | — | próprio | — | — |

### C. Entidades, parcerias e projetos de extensão

| Ação | Público | Membro | Escopo | Aprovação |
|---|---|---|---|---|
| Ver entidades/projetos públicos | L | L | L | — |
| Cadastrar entidade/parceria/projeto | — | — | E: `diretor` | — |
| Designar mentor do projeto | — | — | E: `diretor` | designation `mentor` @ projeto (com `appointedById`) |
| Inscrever-se em projeto público | — | E | — | — |
| Lançar horas do projeto | — | — | E: `mentor` @ projeto | ver B |

### D. Comunidades — níveis + Selo

| Ação | Público | Membro | Escopo | Aprovação |
|---|---|---|---|---|
| Ver comunidades/níveis/selo | L | L | L | — |
| Solicitar selo / editar perfil da comunidade | — | — | E: `responsible` @ community | — |
| Conceder/renovar selo (validade 1 ano) | — | — | — | admin (diretoria avalia checklist) |
| Mudar nível (parceira ↔ integrada) | — | — | — | admin |
| Painel da comunidade (eventos, caixa, atas) | — | — | L/E: `responsible` @ community | — |

### E/F. Business — Empresa Amiga/Aliada (e mentorias, F)

| Ação | Público | Membro | Escopo | Aprovação |
|---|---|---|---|---|
| Ver vitrine de empresas | L | L | L | — |
| Gerenciar própria empresa (PJ) | — | L/E: `responsible` @ company | — | — |
| Validar Empresa Aliada (due diligence) | — | — | — | admin (`validatedById` + designation de responsável permanece) |
| Candidatar-se a mentor | — | E | — | admin (designation `mentor` @ program) |
| Disponibilidade/sessões de mentoria | — | — | L/E: `mentor` | — |

### G. C4P

| Ação | Público | Membro | Escopo | Aprovação |
|---|---|---|---|---|
| Ver campanha/resultado público | L | L | L | — |
| Submeter proposta (form público) | E (guest, com consentimento LGPD) | E | — | — |
| Gerir campanha | — | — | E: `event_organizer`/`diretor` | admin |
| Avaliar/votar propostas | — | — | E: `evaluator` @ c4p_campaign (convite `pending` → `active`) | quem abre a campanha |
| Finalizar campanha + PDF | — | — | — | admin |

### H. Codaqui Universitário

| Ação | Público | Membro | Escopo | Aprovação |
|---|---|---|---|---|
| Ver cidades/IES/embaixadores/eventos | L | L | L | — |
| Candidatar-se a embaixador | — | E | — | gestor propõe → **admin confirma** |
| Cadastrar cidade/IES | — | — | E: `manager` @ program universitario | — |
| Criar evento na IES | — | — | E: `ambassador` @ ies, `manager` @ universitario, `event_organizer` | — |
| Operar evento na IES (check-in etc.) | — | — | escopo de eventos (staff/ownership) | — |

### Transversais

| Ação | Quem |
|---|---|
| Relatórios financeiros + export CSV (R1/R2) | `finance-analyzer`, admin |
| Aprovação de horas (transversal a B/C/F/H) | admin, `finance-analyzer` |
| Templates/e-mails transacionais | admin (edição), `finance-analyzer` (leitura) |
| Members admin (roles manuais, deactivation) | admin |
| Concessões organizacionais (selo, embaixador, mentor, aliada, tier) | admin — **sempre via designation + audit** |
| `/docs-json`, snapshots públicos | público |

---

## Quem aprova o quê — concessões auditáveis padronizadas

Toda concessão segue o mesmo molde: **proposta (opcional, com designation `pending`) → confirmação (admin/presidência) → designation `active` + `audit_logs`**. Campos legados de concessão (`sealGrantedById`, `validatedById`, `approvedById`, `designatedById`) permanecem nas entidades de domínio **como cache de exibição**; a fonte é a designation.

| Concessão | Quem propõe | Quem confirma | Registro |
|---|---|---|---|
| Selo Codaqui (comunidade) | responsável da comunidade (`responsible` @ community) solicita | admin (diretoria avalia checklist) | designation mantida; `sealGrantedAt/ById` na `communities` + audit |
| Nível Integrada | diretoria | admin | audit + nível na tabela |
| Empresa Aliada (tier) | empresa declara critério + evidência | admin (due diligence) | `validatedAt/ById` na `companies` + audit |
| Mentor (programa) | candidatura do membro | admin | designation `mentor` @ program + `mentor_profiles` |
| Gestor Universitário | diretoria | admin | designation `manager` @ program |
| Diretor de diretoria | presidência | admin | designation `director` @ directorate |
| Embaixador de IES | membro candidata | gestor avalia → **admin confirma** | designation `ambassador` @ ies |
| Mentor de projeto de extensão | diretor designa | (designação já é ato da diretoria) | designation `mentor` @ extension_project |
| Avaliador C4P | quem abre a campanha convida | aceite do membro | designation `evaluator` @ c4p_campaign |
| Voluntariado em diretoria | membro solicita | diretor da diretoria aceita | designation `volunteer` @ directorate |
| Horas (pendentes de B/C/F) | diretor/mentor lança | admin / `finance-analyzer` | `hour_ledger` + audit (padrão do plano) |
| Roles manuais (`event_*`, `finance-analyzer`) | — | admin | `member.role_change` (existente) |

Regra dura: **não existe concessão sem designation ativa correspondente** — a UI do admin e o guard de backend assumem isso; um dado "granted" sem designation é inconsistência a reconciliar (o sync job reporta, não inventa).

---

## Derivação de roles a partir de designations

**Fonte única de verdade = designations.** As roles organizacionais são projeção:

| Role derivada | Regra (designation ativa) |
|---|---|
| `diretor` | ∃ `director` @ qualquer diretoria |
| `voluntario` | ∃ `volunteer` @ qualquer diretoria **ou** `director` (diretor também é voluntário da própria diretoria — regra de inclusão, não exige designation dupla) |
| `mentor` | ∃ `mentor` @ `program('mentoria')` **ou** `mentor` @ qualquer `extension_project` |
| `gestor_universitario` | ∃ `manager` @ `program('universitario')` |

**Sync job — `DesignationSyncService`:**

1. **Event-driven:** todo `grant`/`confirm`/`revoke`/`end` chama `syncMember(memberId)` ao final da transação (mesma transação do write — atomicidade). Idempotente: calcula o conjunto derivado esperado, compara com `members.roles`, aplica diferença.
2. **Cron de reconciliação:** agendado (mesmo padrão dos crons de `notifications` — diário ou a cada 6h) varre todos os membros com designation ativa e reconcilia — self-healing após restauração de backup, edits manuais em banco ou falhas no event-driven.
3. **Audit:** cada ajuste derivado grava `member.role_derived` com `details: { added: [...], removed: [...], source: 'designation_sync' }` (novo valor em `AuditAction`, distinto de `member.role_change` manual).
4. **PATCH `/members/:id/roles` rejeita** (409) qualquer tentativa de tocar role derivada — na API e no DTO.

**Latência e JWT:** a role derivada reflete no próximo sync após a mudança de designation; o JWT em mãos do usuário pode até expirar com a role antiga — aceito e documentado (mudanças organizacionais não são hot-path; logout/login ou refresh de token resolve). O frontend de admin deve invalidar sessão/refresh após concessões (hook já existente em fluxos de role).

---

## Migração e rollout por fase

**Princípios:** backward-compat total na 1a; API pública inalterada (`members.roles` continua, agora com derivadas incluídas); subsistemas migram ao tocar suas fases; nada de big-bang.

| Fase | Entrega RBAC |
|---|---|
| **1a** | Migration `member_designations` (nº conforme sequência ≥026 — primeira da fase) + `designations/` module (service, guard, controller `/members/me/designations` + admin CRUD) + **seed** a partir de `event_organizer_ownerships` + sync job (event-driven; cron) + rejeição de PATCH em role derivada. `communities` e `directorates` nascem **sem coluna de vínculo** (greenfield). Roles `diretor`/`voluntario` entram no enum como derivadas. |
| **1b** | Frontend: `useMyDesignations()`, guards no AppNavIsland, cards de representação no menu de perfil (base do PR #601). |
| **2** | Cutover de `event_organizer_ownerships` (drop da tabela; `GET /events/internal/organizers` lê de designations). Horas e redesign do `/@handle` já nascem designation-aware (badge de diretor/mentor vêm das designations ativas). Selo embeddável de membro usa designations públicas. |
| **3** | Assembleias: sem vínculo novo (`createdById` é trilha, não permissão). `diretor` derivado já vale para criar/editar. |
| **4** | entities/partnerships/projects nascem sem `responsibleMemberId`/`directorMemberId`/`mentorMemberId`; designations `responsible`/`manager`/`mentor` @ entity/extension_project com `appointedById`. |
| **4b** | `institution_ambassadors` vira designation (`pending` na candidatura, gestor propõe, admin confirma); gestor = `manager` @ program; embaixador cria evento via designation @ ies. |
| **5** | Mentor: designation `mentor` @ program('mentoria') é a fonte; `mentor_profiles` referencia (ou vira view). |
| **6** | `companies`: designation `responsible` @ company espelha a coluna; cutover drop da coluna na mesma fase (a Fase 6 já reescreve o fluxo PJ para tiers). |
| **7** | `c4p_evaluators` vira designation `evaluator` @ c4p_campaign (convite `pending` → aceite `active`). |

**Backward-compat explícita:**
- `GET /members` (público e admin) segue expondo `roles` — agora contendo derivadas. Nenhum consumidor externo quebra na 1a.
- Durante o dual-run (ex.: `companies.responsibleMemberId` até a Fase 6), writes vão nas duas fontes numa transação (`persistWithLedger`-style: entidade + designation); leitura de guard prioriza designation, com fallback à coluna até o cutover declarado.
- API de organizers externos: o formato `OrganizersFile` é preservado lendo de designations — nenhum cliente do snapshot quebra.

---

## Impactos no frontend

1. **`useAuth()` inalterado** — `isAdmin`, `isEventOrganizer` etc. continuam derivados de `user.roles` (as derivadas passam a vir no `/auth/me`). Adiciona-se `isDirector`, `isMentor`, `isVolunteer`, `isUniversityManager` como conveniência (mesmo pattern, mesmo arquivo).
2. **Hook novo `useMyDesignations()`** (`src/lib/use-designations.ts`): fetch de `GET /members/me/designations` (somente `active`), com cache e refresh pós-ação; retorna agrupado por `targetType` para os guards de UI.
3. **AppNavIsland** (`frontend/src/components/islands/AppNavIsland.tsx`): itens de menu deixam de ser só `roles: [...]` — ganham campo opcional `designations: [{ targetType, designation? }]`. Ex.: "Minha comunidade" (`responsible` @ community), "Universitário" (`manager` @ program universitario), "Mentorias" (`mentor`). A regra de filtro atual (linha ~170: `isAdmin || item.roles.some(...)`) vira `isAdmin || roleMatch || designationMatch`. Constants `CHECKIN_ROLES`/`LIST_ROLES` do check-in **não mudam** (staff permanece).
4. **Perfil público `/@handle` (Fase 2) — seção "Representações":** as designations ativas viram cards/badges agregados: "Diretor(a) — Diretoria X", "Embaixador(a) — IES Y", "Mentor(a) — Projeto Z", "Responsável — Comunidade W". Respeitam `profileVisibility` (nova chave `designations`, default on para as públicas — diretor/mentor/responsável são institucionais; embaixador segue o opt-in da IES). O snapshot por membro (workflow) já emite as designations filtradas — ótimo para SEO e para a Fase 2, que redesenha o perfil.
5. **Menu de perfil (NavbarAuth):** bloco "Minhas representações" com os vínculos ativos + atalhos (ex.: "Painel da comunidade", "Criar evento na minha IES").
6. **Páginas admin novas** seguem o padrão atual (decisão 11 do AGENTS.md): ilha + `authFetch` + `parseAuthJson`/`extractErrorMessage`; guards de designation no backend são a fonte — o frontend só esconde UI.

---

## Riscos e pontos abertos do design

1. **Enum alargado** (`entity`, `program`, `volunteer`): fora do prescrito da presidência — validar na revisão deste documento (alternativas na nota da Camada 2).
2. **Latência do JWT** para roles derivadas (documentada na Derivação); aceita pela presidência?
3. **`event_staff` fora da tabela única**: exceção consciente (critérios na Camada 2); reavaliar pós-1.0.0 se surgir demanda de trilha de nomeação de staff.
4. **Wildcards legados de ownership** (`source:sourceId:*`) vivem em `targetKey` com `targetId=NULL` — migrá-los para alvos reais depende das ativações existirem; script de seed reporta scopes órfãos em vez de descartá-los.
5. **Índices únicos parciais** exigem migração com `WHERE status='active'` — validar na revisão da migration da 1a (TypeORM não gera partial index nativamente; SQL manual no `migrations/`, padrão já usado no repo).
6. **Regra de inclusão `diretor` ⇒ `voluntario`** é proposta do design (simplifica o histórico); confirmar com a diretoria.
7. **Snapshot público de designations**: só designations de membros com visibilade pública e categories institucionais — inventário de tratamentos (P1/P2) deve listar essa nova saída.
8. **Perfis de mentoria (Fase 5)** viram referência à designation — decidir na implementação se `mentor_profiles` é tabela própria com FK de designation ou view; não trava a 1a.

---

## Critérios de pronto (Fase 1a — recorte RBAC)

- [ ] Migration `member_designations` com índices (incl. únicos parciais das regras 1–6 da Camada 2) e seed auditável a partir de `event_organizer_ownerships`.
- [ ] Módulo `designations/` (service + `DesignationsGuard` + `/members/me/designations` + admin CRUD) com testes jest.
- [ ] Sync job event-driven + cron de reconciliação, com `member.role_derived` em `AuditAction`.
- [ ] Enum `MemberRole` com as 4 derivadas; PATCH de roles rejeita escrita manual nelas (409).
- [ ] Roles derivadas refletidas em `/auth/me` e no `GET /members`.
- [ ] `communities` + `directorates` criados **sem** colunas de vínculo; guards usam designations.
- [ ] Frontend: `useMyDesignations()` + filtro de itens do AppNavIsland por designation (sem quebrar os existentes).
- [ ] `npx jest` verde + bump 0.12.0; ADRs 006/007 (B e D) atualizadas para referenciar designations.

<!-- AGENT-INDEX
purpose: Plano Codaqui 1.0.0 — reestruturação da gestão da ONG no site (assembleias, diretorias, voluntários, horas, entidades, projetos de extensão, mentoria, comunidades com selo, business tiers).
audience: Presidência, mantenedores, AI agents implementando as fases.
status: design aprovado em 2026-09-21 (mentoria adicionada em 2026-09-21) — aguardando review do documento antes do plano de implementação da Fase 1.
sections:
  - Visão e princípios
  - Estado atual revisado
  - Decisões de design (alinhadas com a presidência em 2026-09-21)
  - Subsistemas (A–F)
  - Modelo de dados consolidado
  - Papéis e permissões
  - Frontend e snapshots
  - Fases e critérios de pronto
  - Versionamento 1.0.0
  - ADRs a produzir
  - Riscos e pontos abertos
  - Fora de escopo
related-docs:
  - AGENTS.md — padrões do monorepo, ledger, roles, convenções
  - docs/adrs/001-event-platform.md — plataforma de eventos (será estendida)
  - docs/adrs/002-club-sortcoins.md — Clube individual
  - docs/adrs/003-club-business-pj.md — CLUB Business PJ (vira tier "Empresa Amiga")
  - docs/adrs/004-multisite-communities.md — whitelabel de comunidades
  - docs/modules/events/ROLES.md — papéis atuais
agent-protocol:
  - Cada fase é independente: migration + módulo backend com testes → páginas/admin → ADR própria.
  - Respeite o princípio "menos banco possível": conteúdo narrativo vive no GitHub (Discussions), o banco guarda só registro estruturado.
  - Novas tabelas seguem os padrões de backend existentes (TypeORM, uuid, audit, ledger onde couber).
-->

# Codaqui 1.0.0 — Plano de Estruturação da Gestão da ONG

> **Origem:** briefing da presidência (2026-09-21) + alinhamento de 4 decisões arquiteturais. Baseado no que a associação já opera hoje: eventos, ledger financeiro, certificados, membros multi-papel, CLUB Business PJ, sites whitelabel de comunidades.

## Visão e princípios

Transformar o site de vitrine institucional em **plataforma de gestão da associação**, cobrindo: governança (assembleias), pessoas (diretorias, voluntários, horas), relações institucionais (entidades, parcerias, projetos de extensão), mentoria (#QueroMentoria com agendamento e sessões), ecossistema de comunidades (níveis + selo) e apoio empresarial (tiers).

Princípios:

1. **Menos banco possível** — conteúdo narrativo (atas, quórum, votos, pautas detalhadas) vive em **GitHub Discussions**; o banco guarda apenas registro fino e consultável.
2. **Tudo auditável** — toda concessão (selo, horas, tier) tem trilha (módulo `audit` + campos `grantedBy`/`approvedBy`).
3. **Reaproveitar antes de criar** — roles guard, ledger, snapshots estáticos, Giscus, Stripe, certificate verification, multisite.
4. **Uma fase = um conjunto de PRs entregável e reversível.**

## Estado atual revisado (o que 1.0.0 estende)

| Existe hoje | Uso no 1.0.0 |
|---|---|
| `members` com `roles text[]` (membro, admin, finance-analyzer, event_*) | + papéis `diretor`, `voluntario`; vínculos a diretorias/comunidades |
| Eventos (managed + externos, check-in, certificado por presença) | Fonte de horas automática (`event_checkin`); comunidades integradas mantêm eventos próprios |
| Ledger financeiro double-entry | Comunidades integradas já têm caixa própria; espelha o pattern no `hour_ledger` |
| `companies` (ADR 003) | Ganha `tier` (amiga/aliada) + due diligence |
| Multisite whitelabel (ADR 004, piloto T.I. Social) | Vira privilégio do nível **Integrada** |
| Giscus (comentários do blog) | Embute a Discussion de cada assembleia |
| Snapshots estáticos (`static/events/`) | Mesmo pattern para `static/assemblies/` e migração de `communities.ts` |
| `src/data/communities.ts` (5 parceiras, frontend-only) | Migra para tabela `communities` + snapshot |
| `/participe/mentoria` (estática, Google Calendar externo, mentores hardcoded) | Vira módulo de mentoria: perfis, disponibilidade, agendamento, sessões, insights (subsistema F) |
| Roles events (ROLES.md) | Base para permissões escopadas (diretor→diretoria, mentor→projeto, responsável→comunidade) |

## Decisões de design (alinhadas com a presidência em 2026-09-21)

1. **Assembleias:** híbrido — Discussion é a ata viva; banco guarda registro fino (tipo, número, data, status, PDF do cartório, metadados de registro).
2. **Comunidades:** 2 níveis — **Parceira** (listada, apoio pontual) e **Integrada** (site + eventos + caixa) — mais o **Selo Codaqui** (processo formal da diretoria, validade de 1 ano, responsável obrigatório).
3. **Business:** tiers **Empresa Amiga** (só financeiro = CLUB Business PJ atual) e **Empresa Aliada** (Codaqui valida de forma consultiva; selo próprio com validade).
4. **Horas:** **ledger único** com aprovação — diretor/mentor lança (pending), presidência/finance-analyzer aprova; check-in em eventos entra automaticamente como approved.

## Subsistemas

### A. Assembleias

**Entidade `assemblies`:** `id`, `type` ('ordinaria' | 'oficial'), `number` (sequencial por tipo), `title`, `scheduledAt`, `heldAt?`, `status` ('scheduled' | 'held' | 'canceled'), `agendaSummary` (texto curto), `discussionUrl`, `ataPdfUrl?`, `notaryRegistry?` (jsonb: `{ book, page, registeredAt }`), `createdById`.

**Fluxo:**
1. Diretoria cria a assembleia (admin) e abre a Discussion vinculada (categoria "Assembleias" no repo — ver Riscos).
2. Antes: pauta no registro + detalhes na Discussion. Durante/depois: quórum, votos e ata narrativa **só na Discussion**.
3. Oficial: após realização, anexa-se o PDF do cartório (URL externa validada — mesmo pattern de comprovantes do `StorageModule`) + metadados de registro.

**Frontend:** `/assembleias` (lista, snapshot estático), `/assembleias/:slug` (detalhe com **Giscus embutindo a Discussion** + PDF oficial quando houver). Admin: CRUD + marcação de realizada + registro cartorário.

### B. Diretorias, diretores, voluntários e horas

**Entidades:**
- `directorates`: `id`, `slug`, `name`, `description`, `directorMemberId`, `isActive`.
- `directorate_members`: `id`, `directorateId`, `memberId`, `joinedAt`, `leftAt?` (histórico de voluntariado).
- `hour_ledger`: `id`, `memberId`, `sourceType` ('event_checkin' | 'directorate_activity' | 'extension_project'), `sourceId`, `sourceLabel`, `hours` (numeric), `description`, `occurredAt`, `status` ('pending' | 'approved' | 'rejected'), `reportedById`, `approvedById?`, `approvedAt?`, `rejectReason?`. Guarda de unicidade: 1 entrada approved por (`memberId`, `sourceType`, `sourceId`).

**Fluxos:**
- Evento: check-in aprovado → entrada `event_checkin` **approved** automática (reportedBy = sistema).
- Atividade de diretoria: diretor lança (`directorate_activity`) → pending → presidência/finance-analyzer aprova → saldo.
- Projeto de extensão: mentor lança (`extension_project`) → mesmo fluxo.
- Rejeição exige motivo; tudo vai para o `audit`.

**Certificado de horas:** endpoint de dados + PDF (frontend) com total de horas **approved** no período + código de verificação; página pública de verificação (mesmo pattern do certificado de evento).

**Frontend:** `/diretorias` (pública: diretorias ativas + diretores + voluntários — tipo MembersWall), perfil do membro com saldo de horas e botão de declaração. Admin: CRUD de diretorias, gestão de voluntários, fila de aprovação de horas.

### C. Entidades, parcerias e Projetos de Extensão

**Entidades:**
- `entities`: `id`, `name`, `type` ('empresa' | 'instituicao_ensino' | 'ong' | 'governo' | 'outro'), `cnpj?`, `website?`, `contactEmail?`, `registeredById`, `responsibleMemberId`, `isActive`.
- `partnerships`: `id`, `entityId`, `directorMemberId` (diretor responsável), `kind` ('termo' | 'pontual'), `startedAt`, `endsAt?`, `status` ('active' | 'ended' | 'canceled'), `notes?`.
- `extension_projects`: `id`, `entityId`, `partnershipId?`, `name`, `slug`, `summary`, `description?`, `mentorMemberId` (designado pela diretoria), `designatedById`, `status` ('proposed' | 'active' | 'finished' | 'canceled'), `startsAt?`, `endsAt?`, `isPublic`.
- `project_participants`: `id`, `projectId`, `memberId`, `role` ('participant' | 'mentor'), `joinedAt`, `leftAt?`.

**Fluxo:** diretor cadastra entidade → cria parceria → cadastra projeto de extensão → **designa mentor** → projeto público (`isPublic`) recebe inscrições de membros → mentor lança horas (vai ao ledger, subsistema B) → projeto encerra com relatório-resumo.

**Frontend:** `/projetos` (vitrine pública com entidade, mentor, status — ótimo para transparência e captação), `/projetos/:slug` (detalhe + inscrever-se), admin: CRUD de entidades/parcerias/projetos + designação de mentor.

### D. ONG e Comunidades — níveis + Selo Codaqui

**Entidade `communities`** (migra `src/data/communities.ts`): `id`, `slug`, `name`, `level` ('parceira' | 'integrada'), `responsibleMemberId` (obrigatório para selo), `sealStatus` ('none' | 'applied' | 'sealed'), `sealGrantedAt?`, `sealGrantedById?`, `sealValidUntil?`, `sealNotes?`, `logoUrl?`, `website?`, `donationSlug?`, `isActive`.

**Níveis:**
- **Parceira** (default): listada no site, acompanhamento pontual (jurídico/fiscal/eventual), sem caixa própria.
- **Integrada:** site whitelabel (ADR 004), eventos próprios (fonte `internal`/config), caixa separada no ledger, responsável com painel.

**Selo Codaqui:** a comunidade (via responsável logado) solicita → diretoria avalia checklist → concede (`sealed`, validade **1 ano**) → renovação por reavaliação. Selo exibido publicamente (página `/comunidades`, cards, OG).

**Painel do responsável:** CRUD de eventos da comunidade, transparência (saldo da caixa integrada), atas da própria comunidade, gestão de voluntários da comunidade.

**Frontend:** `/comunidades` (rework: vem do snapshot do backend, badges de nível + selo), `/comunidades/:slug` (estrutura da comunidade: responsável, eventos, caixa se integrada), admin `/admin/comunidades` (fila de solicitações de selo, mudança de nível).

### E. Business — Empresa Amiga + Empresa Aliada

**Evolução do ADR 003:** `companies.tier` ('amiga' | 'aliada'), migração com default 'amiga'.

- **Empresa Amiga:** fluxo atual inalterado (CNPJ, R$ 200/mês, ativação manual, visibilidade).
- **Empresa Aliada (novo):** apoio financeiro + **due diligence consultiva**: formulário (área de atuação, atendimento à comunidade, interesse em projetos) → reunião de alinhamento → validação da diretoria (`validatedAt`, `validatedById`) → selo "Empresa Aliada Codaqui" com validade. Benefícios: vitrine pública em `/empresas`, ponte com parcerias/projetos de extensão, marca validada por período.

**Frontend:** `/empresas` vira vitrine pública (duas seções: Amigas, Aliadas — com selo e validade), admin: gestão de tier + due diligence.

### F. Mentoria (#QueroMentoria)

Traz o programa de mentoria (hoje página estática com Google Calendar externo) para dentro do sistema: disponibilidade estruturada, agendamento completo, realização registrada e insights.

**Decisões alinhadas (2026-09-21):** agendamento 100% no sistema; mentorando pode ser convidado sem login (nome + e-mail); sessão gera horas para o mentor no ledger + registro de participação para o mentorando; insights agregados públicos, detalhes só no admin.

**Entidades:**
- `mentor_profiles`: `id`, `memberId` (unique — role `mentor`), `areas` (text[] — tags: "DevOps", "Frontend", ".NET", "Eventos", "Empreendedorismo"), `focus?` (descrição curta), `active`, `approvedById`, `since`. Substitui o array hardcoded `MENTORS` na página e `mentores[]` de `team.ts` (migração dos 5 mentores atuais).
- `mentor_availability`: `id`, `mentorId`, `weekday` (0–6), `startTime`, `endTime` — padrão semanal editável pelo mentor no painel (substitui o texto livre e o Google Calendar).
- `mentorship_sessions`: `id`, `mentorId`, `menteeName`, `menteeEmail`, `menteeMemberId?` (vínculo quando o e-mail casa com um membro), `topicTags` (text[]), `scheduledAt`, `durationMin`, `status` ('requested' | 'confirmed' | 'completed' | 'canceled' | 'no_show'), `meetLink?`, `notes?`, `completedAt?`, `rating?` (1–5 do mentorando), `feedback?`, `cancelReason?`, `token` (página do mentorando convidado).

**Fluxo:**
1. Membro candidata-se a mentor ("Quero ser mentor" → login → candidatura) → diretoria aprova → perfil + disponibilidade.
2. Mentorando (guest ou membro) escolhe slot na página → informa nome/e-mail/tema → sessão `requested`.
3. Mentor confirma (`confirmed`) + preenche o link da sessão (Meet/Discord).
4. E-mails transacionais (pedido, confirmação, lembrete D-1) via módulo `notifications` (mesmo pattern de `email_logs`).
5. Após o horário: mentor marca `completed` (com notas) ou `no_show`; mentorando avalia.
6. `completed` gera entrada no `hour_ledger` do mentor — nova fonte `mentorship_session`, horas = duração — seguindo para aprovação da diretoria como as demais.
7. Mentorando convidado acompanha/cancela pela página com token; ao criar conta com o mesmo e-mail, o histórico vincula via `menteeMemberId`.

**Insights:** agregados públicos (sessões realizadas, mentores ativos, áreas mais demandadas por `topicTags`, taxa de realização e no-show) na `/participe/mentoria` e em `/sobre/insights`; detalhes (nomes, avaliações, históricos) restritos ao admin da diretoria.

**Frontend:** `/participe/mentoria` reescrita (mentores com chips de área + disponibilidade semanal real + "Agendar" por mentor, passo a passo, números públicos do programa, CTA de candidatura); painel do mentor (disponibilidade, solicitações, próximas sessões, histórico, marcar realizada/no-show); página do mentorando por token; admin (aprovação de mentores, visão detalhada, insights). Lista pública de mentores também em snapshot estático (`static/mentors/`), como eventos.

## Modelo de dados consolidado

Novas tabelas: `communities`, `directorates`, `directorate_members`, `hour_ledger`, `assemblies`, `entities`, `partnerships`, `extension_projects`, `project_participants`, `mentor_profiles`, `mentor_availability`, `mentorship_sessions`.
Alterações: `members.roles` (+`diretor`, `voluntario`, `mentor`), `hour_ledger.sourceType` (+`mentorship_session`), `companies` (+tier e campos aliada).
Migrations numeradas a partir da 024. Padrões: uuid PK, createdAt/updatedAt, índices em foreign keys, soft semantics por `isActive`/`status` (sem deletes físicos em registros de governo).

## Papéis e permissões

| Papel | Escopo |
|---|---|
| `admin` | global |
| `diretor` | global leitura + escrita na própria diretoria (voluntários, horas, entidades, parcerias, projetos) |
| `voluntario` | membro com vínculo a diretoria — sem permissões administrativas |
| `mentor` | programa #QueroMentoria: própria disponibilidade, confirmação e realização de sessões |
| `finance-analyzer` | aprovação de horas + visão financeira |
| mentor de extensão (não é role; é vínculo) | lança horas nos próprios projetos |
| responsável de comunidade (vínculo) | painel da própria comunidade |

Decisões de concessão (selo, tier aliada, aprovação de mentores, aprovação de horas) ficam com admin/presidência; `finance-analyzer` aprova horas.

## Frontend e snapshots

- **Snapshots:** `static/assemblies/index.json`, `static/mentors/` (lista pública de mentores) e migração de comunidades para snapshot gerado (workflow estendido ou novo, seguindo `sync-event-snapshots.yml`).
- **Giscus:** categoria "Assembleias" por pathname (configuração por página, igual ao blog).
- **Admin:** páginas novas seguem o padrão `/admin/*` (guarda de login, authFetch, Alert de erro).
- **Dados públicos:** páginas leem snapshots; dados privados (filas de aprovação) vão direto à API.

## Fases e critérios de pronto

| Fase | Entrega | Critério de pronto |
|---|---|---|
| **1. Fundações** | `communities` + níveis/selo + roles `diretor`/`voluntario` + `directorates` + migração de `communities.ts` | CRUD admin + snapshot público com níveis/selo; roles aplicados no guard; seed das 5 comunidades atuais |
| **2. Pessoas e horas** | `hour_ledger` + aprovações + declaração de horas com verificação | 3 fontes alimentando; fila de aprovação; PDF emitindo só horas approved; audit completo |
| **3. Assembleias** | `assemblies` + páginas + Giscus + snapshot | CRUD + registro cartorário em oficiais; detalhe embute Discussion; lista pública gerada |
| **4. Entidades e extensão** | entities/partnerships/projects + inscrição + vitrine | Fluxo ponta a ponta: entidade→parceria→projeto→mentor→inscrição→horas→aprovação |
| **5. Mentoria** | mentor_profiles + availability + sessions + e-mails + insights + página reescrita | Agendamento ponta a ponta no sistema (pedir→confirmar→realizar); sessão completada gera horas do mentor no ledger; agregados públicos e painel do mentor |
| **6. Business tiers** | tier amiga/aliada + due diligence + vitrine | Migração para 'amiga'; fluxo aliada completo com validação e selo; `/empresas` público |

Backend: 0.8.1 → **0.9.0** (fases 1–2) → **0.10.0** (fases 3–4) → **0.11.0** (fase 5, mentoria) → **1.0.0** (fase 6, business). Cada fase com `npm run build && npx jest` verde no backend e `typecheck && build && test:frontend` no frontend, além de bump de versão por fase (feat → minor).

## ADRs a produzir (uma por fase, status "implementado" ao merge)

- **005 — Assembleias híbridas (Discussion + registro fino)**
- **006 — Diretorias e ledger de horas**
- **007 — Registro de comunidades, níveis e Selo Codaqui**
- **008 — Entidades, parcerias e Projetos de Extensão**
- **009 — Mentoria no sistema (disponibilidade, agendamento, sessões, insights)**
- **010 — Business tiers (Empresa Amiga / Empresa Aliada)**

## Riscos e pontos abertos

1. **Categoria Giscus "Assembleias"** precisa ser criada no repo (`codaqui/institucional` discussions) — config do giscus é por categoria.
2. **Critérios objetivos** do Selo Comunitário e da Empresa Aliada (checklists) — definir com a diretoria antes da Fase 6 (proposta inicial no plano de implementação).
3. **Nomenclatura final** "Empresa Aliada Codaqui" e arte do selo — validar marca antes da vitrine pública.
4. **Validade de 1 ano** (selo comunitário e aliada) é proposta; confirmar periodicidade.
5. Migração de `communities.ts` → tabela deve manter os campos usados por insights/transparência/doações (script de seed auditável).
6. Discussion 573 mostra comunidades com "representantes" não cadastrados (ex.: Josi) — o modelo exigirá responsável **membro** do site para selo/painel.
7. **Mentoria:** política de cancelamento/no-show (tolerância, reagendamento) e LGPD básica para mentorandos convidados (e-mail + nome em sessões — consentimento no pedido e remoção sob solicitação).

## Fora de escopo (1.0.0)

- Emissão de nota fiscal para empresas (mantido comprovante apenas).
- Votação eletrônica formal (quórum/votos seguem na Discussion; votação online é candidata a 1.1).
- App mobile / PWA.
- Automação cartorária (o registro é manual: PDF + metadados).
- Revisão do estatuto/alumni (processo social, registrado nas assembleias mas não automatizado).

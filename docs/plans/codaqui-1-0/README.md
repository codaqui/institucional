<!-- AGENT-INDEX
purpose: Plano Codaqui 1.0.0 — reestruturação da gestão da ONG no site (assembleias, diretorias, voluntários, horas, entidades, projetos de extensão, mentoria, comunidades com selo, business tiers, C4P).
audience: Presidência, mantenedores, AI agents implementando as fases.
status: Fases 0–3 concluídas e publicadas, restando Discussion real de assembleia; Fase 4 ampliada e aprovada com diretorias comunitárias e assembleias por entidade jurídica; Fases 4b–7 em design.
sections:
  - Visão e princípios
  - Estado atual revisado
  - Decisões de design (alinhadas com a presidência em 2026-09-21)
  - Subsistemas (A–H)
  - Sistema de e-mail (melhorias transversais E1/E2)
  - Arquitetura de menus e navegação (UX)
  - Relatórios & exportações (R1–R3)
  - Painel do membro, privacidade e perfil público (UX)
  - Privacidade, LGPD e Conduta
  - Modelo de dados consolidado
  - Papéis e permissões
  - Frontend e snapshots
  - Fases e critérios de pronto (Fase 0 → 7)
  - Versionamento 1.0.0
  - ADRs a produzir
  - Riscos e pontos abertos
  - Fora de escopo
related-docs:
  - AGENTS.md — padrões do monorepo, ledger, roles, convenções
  - docs/adrs/001-event-platform.md — plataforma de eventos (será estendida)
  - docs/adrs/002-club-sortcoins.md — Clube individual
  - docs/adrs/003-club-business-pj.md — CLUB Business PJ (vira tier "Empresa Amiga")
  - docs/adrs/004-multisite-communities.md — whitelabel de comunidades (supersedida parcialmente pela Fase 0.5)
  - docs/modules/events/ROLES.md — papéis atuais
  - docs/plans/codaqui-1-0/cadastro-projeto-extensao.md — detalhamento do Cadastro de Projeto de Extensão + comprovantes (subsistema C)
  - docs/plans/codaqui-1-0/refatoracao-frontend-astro.md — ⭐ Fase 0: refatoração do frontend para Astro + multi-tenant por build matrix (anexo oficial)
  - docs/plans/codaqui-1-0/design-system.md — ⭐ Design System Codaqui: tokens canônicos, correção de contraste WCAG e página pública /design-system (integrado à Fase 0; anexo oficial, 2026-10-20)
  - docs/plans/codaqui-1-0/c4p.md — ⭐ C4P (Chamada de Trabalhos): subsistema G, Fase 7 — porte do sistema externo validado + submissão pública (anexo oficial, 2026-10-20)
  - docs/plans/codaqui-1-0/eca-lgpd.md — ⭐ ECA/LGPD: flag adultOnly + warning reutilizável + venueType (anexo de design, 2026-10-29)
  - docs/plans/codaqui-1-0/auth.md — ⭐ Autenticação: login centralizado (GitHub) + guest token para eventos (anexo de design, 2026-10-29)
  - docs/plans/codaqui-1-0/rbac.md — ⭐ RBAC consolidado: roles × designations × derivação (anexo de design, 2026-10-29)
  - docs/plans/codaqui-1-0/comunidades-plataforma.md — ⭐ Plataforma de comunidades: níveis + criação por membros + split Stripe para Autônomas (anexo de design, 2026-10-29)
  - docs/plans/codaqui-1-0/transversais.md — ⭐ Transversais: Turnstile, busca (Pagefind), certificados sem validade, retenção de auditoria (anexo de design, 2026-10-29)
  - docs/plans/codaqui-1-0/fase-1a.md — Plano executável da Fase 1a: tasks, migrations 026–031, testes e gates concluídos
  - docs/plans/codaqui-1-0/fase-1b.md — Plano executável da Fase 1b concluída: navegação, profileVisibility, P1–P3 e Pagefind
  - docs/plans/codaqui-1-0/fase-2.md — Plano executável da Fase 2 concluída e publicada com backend 0.14.0
  - docs/adrs/013-hour-ledger.md — comportamento implementado de horas, ownership, guests, declarações e badges
  - docs/adrs/014-assemblies.md — comportamento integrado de assembleias, Discussion manual, snapshot, Giscus e cartório
  - docs/superpowers/plans/2026-11-05-assembleias.md — plano e handoff da Fase 3; merge/release concluídos e pendências externas explícitas
agent-protocol:
  - Cada fase é independente: migration + módulo backend com testes → páginas/admin → ADR própria.
  - Fase 3 foi integrada e o backend publicado; redeploy, sync inicial e Giscus real permanecem no handoff. A Fase 4 foi autorizada pelo usuário em 2026-11-06.
  - Respeite o princípio "menos banco possível": conteúdo narrativo vive no GitHub (Discussions), o banco guarda só registro estruturado.
  - Novas tabelas seguem os padrões de backend existentes (TypeORM, uuid, audit, ledger onde couber).
-->

# Codaqui 1.0.0 — Plano de Estruturação da Gestão da ONG

> **Origem:** briefing da presidência (2026-09-21) + alinhamento de 4 decisões arquiteturais. Baseado no que a associação já opera hoje: eventos, ledger financeiro, certificados, membros multi-papel, CLUB Business PJ, sites whitelabel de comunidades.

## Visão e princípios

Transformar o site de vitrine institucional em **plataforma de gestão da associação**, cobrindo: governança (assembleias), pessoas (diretorias, voluntários, horas), relações institucionais (entidades, parcerias, projetos de extensão), **presença universitária (Codaqui Universitário: cidades, IES, embaixadores, eventos nas instituições)**, mentoria (#QueroMentoria com agendamento e sessões), ecossistema de comunidades (níveis + selo), apoio empresarial (tiers) e **chamadas de trabalhos (C4P)** com submissão pública e curadoria.

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
| `managed_events.workloadMinutes` (0.10.0, Migration025 — carga horária explícita do certificado, fallback = duração do evento) | Fonte canônica das horas da entrada `event_checkin` (regra de derivação no subsistema B) |
| Check-in atômico (0.11.x — update condicional `checkedInAt IS NULL`, rejeição de inscrição inválida, QR/câmera, `EVENT_CHECKER` em eventos externos) | Ponto único e transacional onde o hook exactly-once da `hour_ledger` deve se conectar |
| Ledger financeiro double-entry | **Inalterada** — dinheiro apenas, incluindo a caixa das comunidades integradas |
| Ledger de horas (novo) | `hour_ledger` **tabela separada** (unidade = horas); copia só o *pattern* de auditoria/aprovação da ledger financeira, sem compartilhar dados ou contas |
| `companies` (ADR 003) | Ganha `tier` (amiga/aliada) + due diligence |
| Multisite whitelabel (ADR 004, piloto T.I. Social) | Vira privilégio do nível **Integrada** |
| Giscus (comentários do blog) | Embute a Discussion de cada assembleia |
| Snapshots estáticos (`static/events/`) | Mesmo pattern para `static/assemblies/` e migração de `communities.ts` |
| `frontend/src/data/communities.ts` (6 comunidades, frontend-only) | Migra integralmente para tabela `communities` + snapshot, preservando descrição, links, perfis sociais e tags |
| `/participe/mentoria` (estática, Google Calendar externo, mentores hardcoded) | Vira módulo de mentoria: perfis, disponibilidade, agendamento, sessões, insights (subsistema F) |
| Sistema externo de C4P (validado em produção no DevPR Conf 2026 — curadoria com importação CSV, avaliadores, votação por critérios, PDF) | Portado como subsistema G (Fase 7): módulo NestJS + PostgreSQL, auth por roles, + submissão pública — ver [c4p.md](c4p.md) |
| Tema MUI/CSS atual (`#57B593` reprova contraste AA como cor acionável) | Design System Codaqui adotado na Fase 0: tokens `--cq-*` + correção de contraste + página pública `/design-system` — ver [design-system.md](design-system.md) |
| Perfil público `/@handle` (snapshot em build, campos fixos, sem privacidade) | Controles de visibilidade por campo + redesign com badges, timeline e horas |
| Menu de perfil (navbar, desktop/mobile) | Reagrupado com identidade e seções (UX — ver seção de menus). **Base já entregue na Fase 0/PR #601**: dropdown do avatar com os itens originais (Perfil/Clube/Empresa/Painel por role/Doar/Trocar conta/Sair) — o redesign da 1b (chips de roles, rótulos de seção) parte dessa base |
| Política de Privacidade (**inexistente**) | Criar `/sobre/privacidade` + inventário de tratamentos (`docs/modules/privacy/`) |
| Código de Conduta (`sobre/conduta.md`, markdown puro) | UI/UX renovada sem alterar o texto (TOC, cards, "como reportar" em destaque) |
| Roles events (ROLES.md) | Base para permissões escopadas (diretor→diretoria, mentor→projeto, responsável→comunidade) |

## Decisões de design (alinhadas com a presidência em 2026-09-21)

1. **Assembleias:** híbrido — Discussion é a ata viva; banco guarda registro fino (tipo, número, data, status, PDF do cartório, metadados de registro).
2. **Comunidades:** 2 níveis — **Parceira** (listada, apoio pontual) e **Integrada** (site + eventos + caixa) — mais o **Selo Codaqui** (processo formal da diretoria, validade de 1 ano, responsável obrigatório).
3. **Business:** tiers **Empresa Amiga** (só financeiro = CLUB Business PJ atual) e **Empresa Aliada** (Codaqui valida de forma consultiva; selo próprio com validade).
4. **Horas:** **uma única ledger de horas** (`hour_ledger`, **separada da ledger financeira**) com aprovação — diretor/mentor lança (pending), presidência/finance-analyzer aprova; check-in em eventos (internos **e** externos ativados) entra automaticamente como approved. Derivação das horas de evento (decisão 2026-10-05): `workloadMinutes` do evento; se ausente, a duração (`endAt − startAt`); se nenhuma das duas estiver disponível, a carga horária torna-se **obrigatória** no cadastro/ativação do evento.
5. **Design System (2026-10-20):** o frontend novo (Fase 0) já nasce com os tokens do **Design System Codaqui** — correção de acessibilidade incluída (`#57B593` vira cor de marca; cor acionável `#378369`) — e o DS ganha uma **versão pública** em `/design-system`. Detalhes: [design-system.md](design-system.md).
6. **C4P (2026-10-20):** a Chamada de Trabalhos entra como **subsistema G / Fase 7**, fechando o 1.0.0 — porte do sistema externo validado (curadoria) **+ submissão pública** substituindo o Google Forms. Detalhes: [c4p.md](c4p.md).

## Subsistemas

### A. Assembleias

> **Estado da Fase 3:** implementação e rollout publicados; categoria Reuniões configurada e hidratação validada em produção. Discussion real continua pendente. Na Fase 4, `assemblies.entityId` passa a vincular cada assembleia a uma entidade jurídica guarda-chuva. Contratos atuais: [ADR 014](../../adrs/014-assemblies.md) e [spec da Fase 4](../../superpowers/specs/2026-11-06-entities-extension-design.md).

**Entidade `assemblies`:** `id`, `entityId` (na migration 040), `type` ('ordinaria' | 'oficial'), `number` (sequencial por entidade e tipo), `title`, `scheduledAt`, `heldAt?`, `status` ('scheduled' | 'held' | 'canceled'), `agendaSummary` (texto curto), `discussionUrl`, `ataPdfUrl?`, `notaryRegistry?` (jsonb: `{ book, page, registeredAt }`), `createdById`.

**Fluxo:**
1. Um operador coordena o próximo número por entidade e tipo, abre manualmente a Discussion na categoria "Reuniões" com o pathname exato e cadastra a assembleia. Codaqui preserva admin/diretor ativo; outras entidades exigem admin ou `manager @ entity`.
2. Antes: resumo da pauta no registro + detalhes na Discussion. Durante/depois: quórum, votos e ata narrativa **só na Discussion**.
3. Oficial: para realizar, admin informa PDF externo validado pelo `StorageService` e metadados completos de registro. Não há upload nem automação cartorária.

**Frontend:** `/assembleias` (lista, snapshot estático), `/assembleias/:entitySlug/:slug` (detalhe com Giscus por `pathname` após configuração + PDF oficial quando houver). URLs antigas redirecionam para a entidade Codaqui. Admin: CRUD + marcação de realizada + registro cartorário somente admin + seletor de entidade.

### B. Diretorias, diretores, voluntários e horas

> **Estado da Fase 2:** `event_checkin` e `directorate_activity` estão implementados; as demais fontes continuam futuras. O comportamento corrente de APIs, declaração, guests, ownership e privacidade está na [ADR 013](../../adrs/013-hour-ledger.md) e no [manual de eventos](../../modules/events/CODE_MANUAL.md).

**Entidades:**
- `directorates`: `id`, `slug`, `name`, `description`, `isActive`, `communityId?` (migration 040; `NULL` = diretoria global da Codaqui). Diretor e voluntários são `member_designations` (`director`/`volunteer` @ `directorate`); não existe `directorate_members`.
- `hour_ledger`: `id`, `memberId`, `sourceType` ('event_checkin' | 'directorate_activity' | 'extension_project' | 'mentorship_session'), `sourceId`, `sourceLabel`, `hours` (numeric), `description`, `occurredAt`, `status` ('pending' | 'approved' | 'rejected'), `reportedById`, `approvedById?`, `approvedAt?`, `rejectReason?`, `idempotencyKey?`. A unicidade por (`memberId`, `sourceType`, `sourceId`) vale apenas para fontes automáticas de ocorrência única (check-in/sessão); atividades manuais de diretoria e projetos admitem múltiplos lançamentos e usam `idempotencyKey` para retry seguro.

**Fluxos:**
- Evento (interno **ou externo com check-in ativado**): check-in aprovado → entrada `event_checkin` **approved** automática (reportedBy = sistema). `workloadMinutes` tem precedência; managed events usam duração positiva como fallback e externos usam a carga persistida no override. Novos managed events e novas ativações de check-in externo não ficam sem carga. O hook é **exactly-once**: dispara somente na transição atômica `checkedInAt` null→valor, e a unicidade da fonte elimina duplicidade residual. Legados sem carga seguem o check-in com warning, sem crédito ou backfill.
- Atividade de diretoria: diretor lança (`directorate_activity`) → pending → presidência/finance-analyzer aprova → saldo.
- Projeto de extensão: mentor lança (`extension_project`) → mesmo fluxo (fase futura).
- Rejeição exige motivo; tudo vai para o `audit`.

**Declaração de horas:** endpoint de dados + impressão/PDF nativa do navegador com total de horas **approved** no período + código de verificação. O snapshot não tem prazo de validade e sua verificação pública respeita `hours=false`, sem revelar nome.

**Frontend:** `/diretorias` (pública: diretorias ativas + diretores + voluntários — tipo MembersWall), `/membro/horas` com saldo/extrato/declaração e `/admin/horas` com fila de aprovação. Perfil público exibe somente horas, timeline e selo permitidos por `profileVisibility`.

### C. Entidades, parcerias e Projetos de Extensão

**Entidades:**
- `entities`: `id`, `slug`, `name`, `type` ('empresa' | 'instituicao_ensino' | 'ong' | 'governo' | 'outro'), `cnpj?`, `website?`, `contactEmail?`, `registeredById`, `isActive`. Responsável e gestor são designations @ `entity`; entidades com CNPJ também são os guarda-chuvas assembleares.
- `partnerships`: `id`, `entityId`, `kind` ('termo' | 'pontual'), `startedAt`, `endsAt?`, `status` ('active' | 'ended' | 'canceled'), `notes?`. O diretor responsável é designation `manager` @ `entity`.
- `extension_projects`: `id`, `entityId`, `partnershipId?`, `name`, `slug`, `summary`, `description?`, `status` ('draft' | 'proposed' | 'active' | 'finished' | 'canceled'), `startsAt?`, `endsAt?`, `isPublic` + campos do anexo. Mentor e quem designou são designation `mentor` @ `extension_project` com `appointedById`.
- `project_participants`: `id`, `projectId`, `memberId`, `role` ('participant' | 'mentor'), `joinedAt`, `leftAt?`.

**Fluxo:** diretor cadastra entidade → cria parceria → cadastra projeto de extensão → **designa mentor** → projeto público (`isPublic`) recebe inscrições de membros → mentor lança horas (vai ao ledger, subsistema B) → projeto encerra com relatório-resumo.

**Frontend:** `/projetos` (vitrine pública com entidade, mentor, status — ótimo para transparência e captação), `/projetos/:slug` (detalhe + inscrever-se), admin: CRUD de entidades/parcerias/projetos + designação de mentor.

> **Detalhamento do cadastro de projeto:** formulário (adaptado do modelo acadêmico de "Atividade Extensionista" ao contexto da ONG), validações e restrições de negócio, máquina de estados (com `draft`), inscrição de voluntários, horas e comprovantes com verificação — ver [cadastro-projeto-extensao.md](cadastro-projeto-extensao.md). Extensões ao modelo acima (status `draft`, campos do formulário, tabela `project_certificates`) são consolidadas na ADR 008.

### D. ONG e Comunidades — níveis + Selo Codaqui

**Entidade `communities`** (migra `frontend/src/data/communities.ts`): `id`, `slug`, `name`, `description`, `emoji`, `logoUrl`, `location?`, `founded?`, `links`, `socialProfiles`, `tags`, `level` ('parceira' | 'integrada'), `status` ('proposed' | 'active' | 'suspended' | 'exited'), `sealStatus` ('none' | 'applied' | 'sealed'), `sealGrantedAt?`, `sealGrantedById?`, `sealValidUntil?`, `sealNotes?`, `siteEnabled`, `siteDomain?`. O responsável é designation `responsible` @ `community`, obrigatória para selo/painel. O seed tem quatro Integradas: os três tenants (`siteEnabled=true`) e CamposTech (`siteEnabled=false`, preservando doações/transparência no portal), todas sem responsável fabricado.

**Níveis:**
- **Parceira** (default): listada no site, acompanhamento pontual (jurídico/fiscal/eventual), sem caixa própria.
- **Integrada:** site whitelabel (ADR 004), eventos próprios (fonte `internal`/config), caixa separada no ledger, responsável com painel.

**Selo Codaqui:** a comunidade (via responsável logado) solicita → diretoria avalia checklist → concede (`sealed`, validade **1 ano**) → renovação por reavaliação. Selo exibido publicamente (página `/comunidades`, cards, OG).

**Painel do responsável:** CRUD de eventos da comunidade, transparência (saldo da caixa integrada), atas da própria comunidade, gestão de voluntários da comunidade.

**Frontend:** `/comunidades` (rework: vem do snapshot do backend, badges de nível + selo), `/comunidades/:slug` (estrutura da comunidade: responsável, eventos, caixa se integrada), admin `/admin/comunidades` (fila de solicitações de selo, mudança de nível).

### E. Business — Empresa Amiga + Empresa Aliada

**Evolução do ADR 003:** `companies.tier` ('amiga' | 'aliada'), migração com default 'amiga'.

- **Empresa Amiga:** colaboração **puramente financeira** — fluxo atual inalterado (CNPJ, R$ 200/mês, ativação manual, visibilidade).
- **Empresa Aliada:** apoio financeiro **+ comprovação de pelo menos um** dos critérios de engajamento (decisão da presidência, 2026-09-21):
  1. **Apoio a workshops** da Codaqui/comunidades;
  2. **Contratação de membros** da comunidade;
  3. **Participação em eventos destinados a empresários** (Codaqui Business Events).
  - Verificação: a empresa declara o critério no formulário + anexa evidência (registro de apoio, declaração de contratação, presença em evento) → due diligence da diretoria (reunião de alinhamento) → validação (`validatedAt`, `validatedById`) → selo "Empresa Aliada Codaqui" com validade. Benefícios: vitrine pública, ponte com parcerias/projetos de extensão, marca validada por período, selo embeddável (README/site).

**Codaqui Business Events:** eventos fechados para empresários apoiadores (networking, conteúdo, reconhecimento). **Sem sistema próprio nesta versão** (gestão manual/por eventos existentes) — mas é um benefício divulgado e um dos critérios que qualifica Aliada.

**Hotpage Business (`/empresas`, pública):** página de captação que endereça em sequência:
1. **Proposta de valor** — o que a Codaqui oferece às empresas (visibilidade, acesso a talentos, ESG/comunidade);
2. **Os dois níveis** — tabela comparativa Amiga × Aliada (contribuição, critérios, benefícios);
3. **Benefícios** — vitrine pública, selo com validade, acesso a Business Events, ponte com projetos de extensão, certificado/comprovante de apoio;
4. **Captação financeira** — fluxo Stripe (assinatura recorrente a partir de R$ 200/mês, como PJ) com CNPJ;
5. **Jornada para Aliada** — como evoluir do nível financeiro ao selo validado (formulário + reunião);
6. **Vitrine** — empresas Amigas e Aliadas atuais (selo + validade).

**Admin:** gestão de tier + due diligence + conferência das evidências dos critérios.

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

### G. C4P — Chamada de Trabalhos

Feature muito solicitada pelas comunidades, validada como sistema externo em produção real (C4P do DevPR Conf 2026) e integrada à base na **Fase 7**, fechando o 1.0.0. Escopo: **curadoria portada** (importação CSV, avaliadores por campanha, votação por critérios, dashboard, finalização com PDF) **+ submissão pública** de propostas, substituindo o Google Forms.

**Entidades:** `c4p_calls` (campanha; vínculo opcional a `managed_events` e a `communities`), `c4p_talks` (propostas, com `origin` e consentimento LGPD), `c4p_votes` (scores por critério configurável, upsert, referência à designation do avaliador). O vínculo membro↔campanha é `member_designations` (`evaluator` @ `c4p_campaign`), sem `c4p_evaluators`.

**Fluxo:** abertura da campanha → submissão pública (`/c4p/<slug>/submeter`, com consentimento) ou importação CSV → convite/aceite de avaliadores → votação → finalização (selecionadas + PDF + e-mails de resultado) → resultado público opt-in (`/c4p/<slug>/resultado`, sem notas).

> **Detalhamento completo** — modelo de dados, rotas, papéis, integração com eventos, LGPD e o que descartar do sistema externo: [c4p.md](c4p.md).

### H. Codaqui Universitário (adicionado 2026-10-29)

Programa de presença em Instituições de Ensino Superior (IES): membro da comunidade **gestiona o programa**, cadastra-se **cidades** e **IES**, seleciona-se um **embaixador por IES** e o foco é **organizar eventos dentro da instituição** — reaproveitando a plataforma de eventos existente (inscrição, check-in, certificado e **horas automáticas**) e as bases do **subsistema C** (entidades/projetos de extensão).

**Gestão:** designation `manager` @ `program('universitario')`, da qual deriva a role global `gestor_universitario`; concessão e revogação passam por `audit`.

**Entidades (reaproveitamento explícito do subsistema C):**
- **`cities`** (nova — **base compartilhada**): `id`, `name`, `uf`, `isActive`. Usada por IES (`entities.cityId`) e candidata a uso futuro por comunidades/entidades em geral.
- **`entities`** (JÁ EXISTE no subsistema C): o cadastro de IES **é uma entity de type `'instituicao_ensino'`** — o Universitário NÃO duplica cadastro. Acréscimo mínimo ao modelo do subsistema C: `entities.cityId?` (FK → `cities`).
- **Embaixadores:** designations `ambassador` @ `ies` (`pending` na candidatura, `active` após confirmação admin), com `appointedById`, `since`, `validUntil?` e unique parcial de 1 active por IES. Não existe tabela `institution_ambassadors`; o pattern manual de `ambassadors.json` do DevParaná é migrável para designations.
- **`managed_events`** (JÁ EXISTE): acréscimo de `institutionId?` (FK → `entities`, somente type IES) — um evento "do Universitário" é um managed event comum **com vínculo à IES**; inscrição, check-in atômico, certificado e o hook de horas (`event_checkin`) funcionam sem mudança.

**Fluxo:**
1. Diretoria designa o(s) gestor(es) do programa (role `gestor_universitario`).
2. Gestor cadastra cidades e as IES (entity `instituicao_ensino` + cidade; se a entidade já existir pelo fluxo do subsistema C, apenas vincula).
3. **Seleção de embaixador:** membro candidata-se pela página do programa ("Quero ser embaixador" na IES, com motivação) → gestor avalia → **admin confirma** (padrão de concessões auditáveis) → embaixador active. Empossado, o embaixador ganha o atalho de criar eventos na sua IES.
4. **Eventos na IES:** embaixador/gestor cria o managed event com `institutionId` (organizer via `event_organizer_ownership` existente) → divulgação, inscrição, check-in e certificado pelo fluxo atual; horas entram no `hour_ledger` como `event_checkin` (Fase 2).
5. **Casa com Projeto de Extensão (subsistema C):** quando o evento/ação na IES tem enquadramento extensionista formal, cria-se um `extension_project` vinculado à **mesma entity** (a IES) → horas por `extension_project`, mentor designado, participantes e relatório — sem tabela nova: a ponte é `extension_projects.entityId` (já existente) + o vínculo conceitual gestor↔diretor responsável.

**Frontend:** `/universitario` (pública: o programa, vitrine de cidades/IES com embaixadores, eventos nas IES via filtro de `institutionId`, CTA de candidatura); painel do gestor (`/admin/universitario`: CRUD cidades/IES, fila de candidaturas, visão do programa); atalho do embaixador (criar evento na minha IES, meus eventos). Snapshot público `static/universities/index.json` (cidades + IES + embaixadores ativos), seguindo o padrão dos syncs.

> **Base compartilhada com o subsistema C (revisão solicitada):** `entities` (IES = entity), `cities` (nova, compartilhada), `extension_projects` (ponte via entityId), `hour_ledger` (fontes `event_checkin`/`extension_project` já previstas), eventos (`managed_events.institutionId`). O subsistema C absorve `entities.cityId` sem quebra — migração aditiva.

## Sistema de e-mail (melhorias transversais)

Revisão do módulo `notifications` (2026-09-21) originou ajustes que devem entrar **antes** das fases que dependem de e-mail transacional (Fase 5 mentoria, sobretudo). Duas entregas:

### E1 — Correções (PR próprio no início da Fase 1)

1. **Dashboard com NaN em produção** — contrato quebrado: o frontend (`admin/emails.tsx`) espera `summary.byTemplate[tpl] = { sent, failed }`, mas o backend (`email.service.ts`) envia um total único por template. Correção: backend volta a agrupar por template+status (o frontend já foi construído para o shape dividido).
2. **Módulo desligado sem credenciais** — hoje, sem `SMTP_USER/PASS`, o provider lança `SMTP_NOT_CONFIGURED` que é gravado como **failed**, gerando falhas em massa nos crons e poluindo métricas. Correção: `EmailService`/crons/`resend` consultam `provider.isConfigured()`; desligado = não tenta SMTP nem cria log de falha — registra com status próprio `skipped` (visível no admin, fora da métrica de falhas) e endpoint de status para banner no dashboard.
3. **`resend` respeita configuração** e retorna erro amigável quando o módulo está desligado.
4. **Índice em `email_logs(template, registrationId)`** — a query de dedupe dos crons cresce sem controle; adicionar migration com índice composto.
5. **E-mail transacional de reembolso/cancelamento** de inscrição (o refund Stripe já existe sem notificação ao participante).
6. **Retenção de `email_logs`** — política de limpeza (proposta: manter 12 meses) via cron.

### E2 — Templates ✅ entregue (2026-09-25, antecipado antes da Fase 5)

1. **Registry de templates** — ✅ entregue: os 3 templates padrão migraram para `default-templates.ts` (Markdown com variáveis documentadas e contexto de exemplo); `GET /notifications/templates` lista com flag de override; `POST /notifications/templates/:id/preview` renderiza com dados de exemplo.
2. **Visualização no admin** — ✅ entregue: aba "Templates" em `/admin/emails` com chips Padrão/Personalizado, editor Markdown, preview renderizado lado a lado, variáveis disponíveis e envio de teste.
3. **Edição com override em banco + fallback em código** — ✅ entregue (supere o "fora de escopo" original após a demanda surgir): tabela `email_templates` (um registro por template); PUT/DELETE em `/notifications/templates/:id`; pipeline único de render (interpolação `{{var}}` → Markdown → HTML sanitizado → texto) com **fallback garantido para o padrão em código** — ausência de registro, erro de BD ou erro de render nunca derruba o envio; e-mails saem multipart (text + html).

### E3 — Campanhas e malas diretas (spec própria, aguardando revisão)

Campanhas com segmentos por papel/designation/comunidade, prévia/teste, confirmação, envio idempotente, rate limit, retries e logs por destinatário. Comunicação promocional exige opt-in e descadastro; não há open tracking. A implementação não pertence à Fase 4 e seguirá a [spec de campanhas](../../superpowers/specs/2026-11-09-email-campaigns-design.md).

## Arquitetura de menus e navegação (UX)

**Problema restante:** o app-shell entregue na Fase 0.4 já tem sidebar e navegação por papel, mas os grupos ainda são rasos para as ~25 páginas previstas; a 1b refina agrupamento, busca e dashboard sem criar outro layout.

**Admin — refinamento do `AppLayout`/`AppNavIsland` existente:**
- Manter sidebar 240px, drawer mobile e topbar atuais. A 1b adiciona seções agrupadas por sistema de valor, submenus expansíveis, busca no topo, item ativo por prefixo e hub `/admin` como dashboard — não um `AdminLayout` paralelo.
- Sidebar com seções agrupadas por **sistema de valor** (submenus expansíveis, item ativo por prefixo de rota, busca no topo, seção some se o usuário não vê nenhum item):
  - **Visão geral** (dashboard) · **Pessoas** (Membros, Diretorias, Voluntários, Horas ▸ Aprovações/Saldos/Declarações) · **Financeiro (R$)** (Lançamento, Transferências, Reembolsos, Fornecedores, Pagamentos, Recebimentos, Relatórios) · **Clube & SortCoins** (Carteiras, Sorteios) · **Empresas** (PJ, tiers F6) · **Eventos** (Visão geral, Overrides, Check-in) · **Governança** (Comunidades & Selo, Assembleias, Entidades, Projetos de Extensão, Mentoria) · **Comunicação** (E-mails, Templates)
- Regras de nome: "SortCoins" é o único nome da moeda virtual (nunca "VirtualCoins"/"Carteira" soltos); "saldo" sempre qualificado (R$, SortCoins, horas); `hour_ledger` nunca chamada de "ledger" na UI.
- Hub `/admin` vira dashboard (stats + atalhos), eliminando os cards de navegação duplicados.

**Menu de perfil (NavbarAuth, desktop + mobile):**
- Cabeçalho de identidade no menu: avatar, nome, `@handle`, chips de roles.
- Agrupado com rótulos: **Conta** (Perfil · Clube · Empresa) · **Gestão** (Painel Admin) · **Sessão** (Trocar conta · Sair) — doação sai do menu de conta.
- Mobile: mesmo conteúdo com bloco de identidade e rótulos de seção no drawer atual; item ativo conforme a página.

## Relatórios & exportações (R1–R3)

**Problema:** hoje não há exportação por faixa de datas. O único CSV existente é *importação* de participantes; o `TransactionTable` exporta só a página atual (≤50 linhas) com presets de 30/90/365 dias; a API não tem `from`/`to`.

**R1 — Faixa de datas + exportação server-side (início da Fase 1, junto com E1):**
- DTO de transações ganha `from`/`to` (ISO, validado); presets mantidos por compat.
- `GET /ledger/transactions/export` (admin/finance-analyzer): **todas** as linhas do range, `Content-Disposition` + BOM UTF-8 (Excel pt-BR). Utilitário CSV em `src/common/csv.ts`.
- Visão consolidada "todas as contas" no admin Financeiro (hoje só por carteira).
- **Variante pública por comunidade** em `/transparencia` (dados já públicos; facilita prestação de contas a parceiros/cartório).

**R2 — Central de relatórios (`/admin/relatorios`):** cards por domínio (Financeiro, Eventos, E-mails, Membros, SortCoins, Horas) → faixa de datas → pré-visualizar + Exportar CSV. Inclui: export no relatório de evento existente, filtro de data + export nos e-mails, export de membros (admin), extrato de horas por membro (Fase 2).

**R3 — `DateRangePicker` compartilhado** (de/até) reusado em todos os admins.

## Painel do membro, privacidade e perfil público (UX)

**Painel `/membro` (monólito de 1.6k linhas, tabs com nomes ambíguos):**
- Tabs renomeadas pela unidade de valor: **Dashboard** (StatCards clicáveis que navegam: SortCoins, Horas, Próximos eventos, Certificados) · **Financeiro (R$)** (doações + assinaturas unificadas) · **SortCoins** ("moeda virtual do Clube") · **Eventos e certificados** · **Minhas horas** (Fase 2: saldo, extrato, declaração).
- `maxWidth` md → lg; componentes extraídos para `src/features/member/`.

**"Meus dados" — transparência e consentimento (LGPD):**
- Nova aba **Meus dados**: inventário de tudo que o sistema coleta (e-mail de login, GitHub handle/nome/avatar, bio, LinkedIn, e-mails secundários, roles, opt-ins, históricos), com fonte e finalidade.
- **Visibilidade por campo:** `members.profileVisibility` (jsonb) controla o que aparece no perfil público (bio, linkedin, roles, "membro desde", históricos por categoria: eventos, certificados, horas totais, doações). E-mail **nunca** público (dado de autenticação). `PATCH /members/me/visibility` com audit.
- Endpoint público `/@handle` passa a filtrar por visibilidade (snapshot por membro, gerado por workflow).

**Perfil público `/@handle` — redesign "bem interessante":**
- Header: avatar, nome, `@handle`, bio, linha de badges (roles, Membro desde, Responsável de comunidade, Mentor).
- **Faixa de estatísticas**: total de horas (se público), eventos participados, certificados emitidos, comunidades.
- **Mural de badges** agrupado: Participação (eventos), Formação (certificados/trilhas), Contribuição (marcos de horas: 10h/50h/100h…), Papéis (diretor, mentor, organizador).
- **Timeline de histórico** (vertical): eventos com certificado (data, carga horária), marcos de horas, entrada na associação, papéis conquistados, doações públicas (opt-in — `/members/donors` já é público).
- OG/JSON-LD (schema.org/Person) preservados; dados 100% do snapshot estático (SEO + "menos banco").

**Interligação de dados públicos (links entre páginas) — Fase 1 (itens 1, 2, 4) e Fase 2 (item 3, junto ao opt-in de visibilidade):**
Diagnóstico (2026-09-21): no `/@handle`, inscrições em eventos já linkam para a página do evento e certificados para `/certificado/verificar`, mas **doações e SortCoins não linkam para lugar nenhum**; nas transparências (global e whitelabel), o `TransactionTable` abre só um dialog local, sem saída para a página do evento/comunidade relacionados.
1. `TransactionDetailDialog` (usado nas 3 transparências) ganha links contextuais: transação de ingresso → página do evento (`buildEventPath`, via metadata); transação de carteira comunitária → transparência da comunidade.
2. `DonationTable` do `/@handle`: cada doação → transparência da comunidade beneficiada (mapa `projectKey` → página pública, com fallback para `/transparencia`).
3. Seção SortCoins do `/@handle`: respeita visibilidade e ganha link "Ver no Clube" → `/clube`. Na Fase 1b, o default permanece público por compatibilidade; a ocultação exige opt-out explícito.
4. Transparência global: cards/saldos de comunidades → transparência da comunidade correspondente (mesmo mapa `projectKey`).

## Privacidade, LGPD e Conduta

**Diagnóstico (2026-09-21):** não existe Política de Privacidade no site; as coletas cresceram (OAuth GitHub, Stripe, analytics, e-mails transacionais, dados PJ, e o proposto: mentorandos convidados, snapshots públicos, ledger de horas) sem inventário nem bases formais. A página de Código de Conduta é um markdown longo sem navegação nem destaque para "como reportar".

**P1 — Política de Privacidade (nova página `/sobre/privacidade`, Fase 1):**
- Cobertura por perfil: **visitante** (Google Analytics, cookies), **membro** (OAuth GitHub: id/handle/nome/e-mail/avatar/e-mails secundários; bio/LinkedIn; roles; opt-ins; carteira SortCoins; inscrições/certificados; e-mails transacionais), **mentorando convidado** (nome/e-mail, F5), **empresa PJ** (CNPJ, responsável, assinatura).
- Para cada grupo: finalidade, base legal (LGPD), armazenamento, compartilhamento (GitHub, Stripe, Google, SMTP), retenção e direitos do titular (acesso/correção/exclusão/revogação) com canal **contato@codaqui.dev**.
- A aba **"Meus dados"** do `/membro` (já no plano) vira o self-service de acesso e visibilidade; exclusão sob solicitação via canal.
- Links no footer e no menu de perfil ("Privacidade e dados").
- **Inventário de tratamentos** mantido em `docs/modules/privacy/` (dado → fonte → finalidade → quem acessa → retenção), alimentando a política e futuras audits.

**P2 — Revisão das coletas propostas (Fase 1, gates por fase):**
- Mentoria: consentimento explícito no pedido de sessão (nome/e-mail) + política de retenção de `mentorship_sessions`.
- Snapshots públicos: só campos/históricos com visibilidade habilitada (risco 8 já registra a latência).
- `email_logs`: retenção 12 meses (E1) declarada na política.

**P3 — UI/UX do Código de Conduta (Fase 1, sem alterar o conteúdo):**
- Converter `/sobre/conduta` em página com: hero, resumo em cards, **TOC lateral fixo** das seções numeradas, seção "Como reportar" em destaque com card de contato, design responsivo/print-friendly e link cruzado com a Política de Privacidade. Texto preservado integralmente; URL mantida.

**Selo embeddável para README/website (membro e empresa) — Fase 2 (membro) / Fase 6 (empresa):**
- Estilo "selo OSC": badge em SVG servido estaticamente (`static/badges/<handle>.svg`, gerado pelo workflow de snapshots) com link para o perfil público — para colar no README do GitHub, site ou blog.
- Conteúdo: **membro** → "Membro Codaqui" + ano de entrada + (opt-in) total de horas; **empresa** → "Empresa Amiga/Aliada Codaqui" + validade do selo. Só dados públicos (respeita `profileVisibility`); membro pode desligar o selo.
- Card "Selo para README" no `/membro` (e na página da empresa): preview do badge + botões copiar Markdown/HTML/link.
- Mesma regra de latência dos snapshots: mudança de visibilidade reflete no próximo run do workflow.

## Modelo de dados consolidado

Novas tabelas: `member_designations`, `communities`, `directorates`, `hour_ledger`, `assemblies`, `entities`, `partnerships`, `extension_projects`, `project_participants`, `mentor_profiles`, `mentor_availability`, `mentorship_sessions`, `cities`, `c4p_calls`, `c4p_talks`, `c4p_votes`, `app_settings`. Vínculos de embaixador, avaliador C4P, diretor, mentor e responsável vivem em `member_designations`, não em tabelas/colunas paralelas.
Alterações: `members.roles` (+`diretor`, `voluntario`, `mentor`, `gestor_universitario`, sempre derivadas), `members.profileVisibility` (jsonb — Fase 1b), `hour_ledger.sourceType` (+`mentorship_session`), `companies` (+tier e campos aliada), `email_logs` (status +`skipped`, índice), `audit_logs` (+`category`), `entities` (+`cityId`), `managed_events` (+`adultOnly`, `venueType`, `institutionId`).
Migrations numeradas a partir da **026**; a Fase 1a usa **026–031**, mapeadas em [fase-1a.md](fase-1a.md). Padrões: uuid PK, createdAt/updatedAt, índices em foreign keys, soft semantics por `isActive`/`status` (sem deletes físicos em registros de governo).

> **Nota — duas ledgers, zero mistura:** a `hour_ledger` é independente da ledger financeira (`Account`/`Transaction`): unidade horas vs. BRL, sem double-entry, sem contas compartilhadas. O que ela herda é apenas o *padrão* (trilha de auditoria, status de aprovação, convenção de referências). Dinheiro — incluindo a caixa das comunidades integradas — segue exclusivamente na ledger financeira.

## Papéis e permissões

| Papel | Escopo |
|---|---|
| `admin` | global |
| `diretor` | global leitura + escrita na própria diretoria (voluntários, horas, entidades, parcerias, projetos) |
| `voluntario` | membro com vínculo a diretoria — sem permissões administrativas |
| `mentor` | programa #QueroMentoria: própria disponibilidade, confirmação e realização de sessões |
| `gestor_universitario` | programa Codaqui Universitário: cidades, IES, candidaturas de embaixador, visão do programa (Fase 4b) |
| `finance-analyzer` | aprovação de horas + visão financeira |
| mentor de extensão (não é role; é vínculo) | lança horas nos próprios projetos |
| responsável de comunidade (vínculo) | painel da própria comunidade |
| avaliador C4P (não é role global; designation `evaluator` @ `c4p_campaign`) | votação nas campanhas em que está vinculado (Fase 7) |

Decisões de concessão (selo, tier aliada, aprovação de mentores, aprovação de horas) ficam com admin/presidência; `finance-analyzer` aprova horas.

## Frontend e snapshots

- **Snapshots:** `static/assemblies/index.json`, `static/mentors/` (lista pública de mentores), `static/universities/index.json` (cidades + IES + embaixadores ativos do Universitário), snapshot por membro para o perfil público `/@handle` (campos e históricos **já filtrados por visibilidade**) e migração de comunidades para snapshot gerado (workflow estendido ou novo, seguindo `sync-event-snapshots.yml`).
- **Giscus:** categoria "Reuniões" por pathname (configuração por página, igual ao blog).
- **Admin:** páginas novas seguem o padrão `/admin/*` (guarda de login, authFetch, Alert de erro).
- **Dados públicos:** páginas leem snapshots; dados privados (filas de aprovação) vão direto à API.

## Fases e critérios de pronto

| Fase | Entrega | Critério de pronto |
|---|---|---|
| **0. Refatoração de frontend** ✅ **CONCLUÍDA (2026-10-29)** (anexada 2026-10-05; DS integrado 2026-10-20) | Docusaurus → **Astro 7 + ilhas React (MUI v9 + Tailwind v4)**; **tokens do Design System Codaqui já no esqueleto (0.1) + página pública `/design-system` (0.3)**; multi-tenant por build matrix no Cloudflare Pages; fim da pasta `workers/` (proxy vira Pages Function) — detalhes e subfases 0.1–0.6: [refatoracao-frontend-astro.md](refatoracao-frontend-astro.md) + [design-system.md](design-system.md) | ✅ Paridade de URLs públicas; tokens novos com contraste AA aplicados; `/design-system` publicada; tisocial.org.br com rotas limpas e login cross-domain; cutover de codaqui.dev com rollback ensaiado; Docusaurus removido — **todos os critérios atendidos; ADR 011 implementada; releases v1.0.0 (site) e v0.11.x-backend; produção servida por CI a partir de `main` (develop = sandbox/preview)** |
| **1a. Fundações de dados** ✅ **CONCLUÍDA (2026-11-03)** — [plano detalhado](fase-1a.md) | `member_designations` + roles derivadas + `communities` + níveis/selo + `directorates` + seed das 6 comunidades + **E1 + R1 + G3/G6 + ECA** | ✅ CRUD admin + snapshot público; roles e guards de designation; seed sem perda de dados; e-mail `skipped` e summary corrigida; CSV por datas; retenção de auditoria; Turnstile testado; eventos 18+ sinalizados; backend `0.12.3` e todos os gates verdes |
| **1b. UX e transversal** ✅ **CONCLUÍDA (2026-11)** — [plano detalhado](fase-1b.md) | Refinamento do AppLayout/sidebar + menu de perfil + aba "Meus dados" (`profileVisibility`) + P1–P3 + Pagefind | Sidebar agrupada; visibilidade por campo nos endpoints públicos; política e conduta publicadas; busca local no portal; backend 0.13.x e gates da fase verdes |
| **2. Pessoas e horas** ✅ **CONCLUÍDA E PUBLICADA (2026-11-05)** — [plano](fase-2.md) · [ADR 013](../../adrs/013-hour-ledger.md) | `hour_ledger` + aprovações + declaração de horas com verificação + **redesign do perfil público `/@handle` (badges, timeline, stats) + aba "Minhas horas" no `/membro` + selo embeddável para README (membro)** | Duas fontes efetivas (`event_checkin` e `directorate_activity`); fila e impressão/PDF nativa só com approved; audit e privacidade; check-in exactly-once e carga explícita/fallback por tipo de evento; migrations 033–035 e jornadas validadas. Backend `v0.14.0-backend` publicado; sync inicial no run `42098199373`; frontend no run `42098283935`. Reconcile em produção concluído com `{inserted: 0, alreadyPresent: 3, orphanedActivations: 0}`; claim real em produção é acompanhamento operacional com sessão admin |
| **3. Assembleias** ✅ **PUBLICADA (2026-11-07); DISCUSSION REAL PENDENTE** — [plano/handoff](../../superpowers/plans/2026-11-05-assembleias.md) · [ADR 014](../../adrs/014-assemblies.md) | `assemblies` + páginas + integração Giscus + snapshot + admin | Migration 036, CRUD/autorização, numeração concorrente, registro cartorário, páginas e gates validados. PR #613 e release `v0.15.0-backend` publicados; sync inicial no run `42336485122`; frontend no run `42336580942`. Categoria Reuniões configurada e hidratação corrigida pela PR #615; validação com Discussion real continua pendente |
| **4. Entidades e extensão** **EM IMPLEMENTAÇÃO** — [spec](../../superpowers/specs/2026-11-06-entities-extension-design.md) · [plano](../../superpowers/plans/2026-11-07-entities-extension.md) | entities/partnerships/projects + inscrição + vitrine + diretorias comunitárias + assembleias por entidade jurídica | Fluxo entidade→parceria→projeto→mentor→inscrição→horas→aprovação; `directorates.communityId` opcional; `assemblies.entityId` com numeração/URL por guarda-chuva; migrations 037–040 e backend 0.16.0 |
| **4b. Codaqui Universitário** (adicionado 2026-10-29) | `cities` + `entities.cityId` + designations `ambassador` @ `ies` e `manager` @ `program('universitario')` + `managed_events.institutionId` + página `/universitario` + painel do gestor — **bases compartilhadas com o subsistema C** | Cidade→IES→embaixador (1 active/IES, gestor propõe+admin confirma)→evento na IES com inscrição/check-in/certificado/horas reais; ação extensionista vira projeto de extensão na mesma entity; snapshot público `static/universities/` |
| **5. Mentoria** | mentor_profiles + availability + sessions + e-mails + insights + página reescrita | Agendamento ponta a ponta no sistema (pedir→confirmar→realizar); sessão completada gera horas do mentor no ledger; agregados públicos e painel do mentor |
| **6. Business tiers** | tier amiga/aliada (com critérios e evidências) + due diligence + **hotpage `/empresas`** + selo embeddável (empresa) | Migração para 'amiga'; validação Aliada com 1+ critério comprovado; hotpage com captação/níveis/benefícios/Business Events; badge SVG para README/site |
| **7. C4P** (anexada 2026-10-20) | Porte do sistema externo de C4P (curadoria: importação CSV, avaliadores, votação por critérios, dashboard, PDF) **+ submissão pública** + resultado público opt-in — detalhes: [c4p.md](c4p.md) | Submissão pública ponta a ponta com consentimento LGPD; curadoria completa (convite→votação→finalização→e-mails); importação CSV compatível com o Google Forms atual; notas nunca públicas; ADR 012 implementada |

> **Nota de execução — a ordem 1a → 7 MANTÉM-SE:**
> - **1b concluída**: sidebar, "Meus dados" + `profileVisibility`, P1–P3 e Pagefind foram entregues antes da Fase 2.
> - **Recorte ratificado da 1a**: somente os dois níveis aprovados de comunidade, sem Autônoma/D2/split. Os acréscimos `entity`, `program`, `volunteer` e `founder` do RBAC foram aprovados; diretor implica voluntário. Os três tenants e CamposTech migram como Integradas sem responsável inventado.
> - **Premissas preservadas**: fases 1a+ em Astro; snapshots, Giscus, roles guard e ledger válidos; novas listagens seguem a decisão 12 do AGENTS.md. APIs novas de gestão não usam o prefixo `/admin/`, preservando a allow-list estreita do proxy.
> - **Dependências críticas**: F5 precisa de E1 + P1/P2 + `hour_ledger`; F2 precisa de directorates e check-in atômico; a jornada externa da F3 depende da categoria Giscus "Reuniões". O primeiro formulário público novo com coleta de dados é o guest token da Fase 2, portanto Turnstile é gate da Fase 2, não da 4b.
> - **C4P (F7)** continua independente das fases 1–6 e pode ser antecipado por decisão da presidência.
> - **Anexos**: [eca-lgpd.md](eca-lgpd.md), [auth.md](auth.md), [rbac.md](rbac.md), [comunidades-plataforma.md](comunidades-plataforma.md) e [transversais.md](transversais.md). O handoff da Fase 3 está no [plano de Assembleias](../../superpowers/plans/2026-11-05-assembleias.md); a Fase 4 foi autorizada para início em 2026-11-06.

Backend: **0.9.0–0.11.5 já foram consumidas**. A Fase 1a publicou **0.12.3**, a 1b consumiu **0.13.x**, a Fase 2 publicou **0.14.0** e a Fase 3 publicou **0.15.0**. Cada release posterior com mudança em `backend/` recebe a próxima minor própria, sem reutilizar versão entre fases ou PRs. **1.0.0** permanece reservada à Fase 7/C4P. Todos os releases seguem `npm run build && npx jest` no backend, `make astro-verify`, `make astro-verify-tenants` quando houver impacto compartilhado e `npm run test:scripts` quando houver scripts.

## ADRs a produzir (uma por fase, status "implementado" ao merge)

- **011 — Refatoração de frontend para Astro + multi-tenant por build matrix** (Fase 0; supersede parcialmente a ADR 004; inclui as decisões de tokens do Design System — ver [design-system.md](design-system.md)) — ✅ **implementada (2026-10-28, merge da 0.6)**
- **006 — Diretorias e designations** (Fase 1a) — ✅ implementada
- **007 — Registro de comunidades, níveis e Selo Codaqui** — ✅ implementada
- **008 — Entidades, parcerias e Projetos de Extensão**
- **009 — Mentoria no sistema (disponibilidade, agendamento, sessões, insights)**
- **010 — Business tiers (Empresa Amiga / Empresa Aliada)**
- **012 — C4P integrado (submissão pública + curadoria)** (Fase 7 — ver [c4p.md](c4p.md))
- **013 — Ledger de horas, ownership, guests e perfil público** (Fase 2) — ✅ [implementada e publicada](../../adrs/013-hour-ledger.md) com backend 0.14.0
- **014 — Assembleias híbridas (Discussion manual + registro fino)** (Fase 3) — ✅ [implementada e publicada](../../adrs/014-assemblies.md); Discussion real pendente; escopo por entidade jurídica ampliado pela Fase 4
- **015 — Codaqui Universitário (cidades, IES, embaixadores, eventos nas instituições)** (Fase 4b — bases compartilhadas com a ADR 008; número reservado após a ADR 014 da Fase 3)

## Riscos e pontos abertos

1. **Discussion real da Fase 3:** categoria Reuniões, variável pública e hidratação já estão configurados e validados em produção. Falta criar uma assembleia e sua Discussion real, conferindo categoria e `pathname` no Giscus.
2. **Critérios objetivos:** o Selo Comunitário usa avaliação manual registrada em `sealNotes` na 1a, sem checklist automatizado; a checklist da Empresa Aliada será definida antes da Fase 6.
3. **Nomenclatura final** "Empresa Aliada Codaqui" e arte do selo — validar marca antes da vitrine pública da Fase 6.
4. **Validade inicial de 1 ano** para selo comunitário e aliada, registrada explicitamente em `sealValidUntil`; mudança futura de política exige decisão da diretoria.
5. **Migração de comunidades:** o seed da 1a preserva todos os campos usados por insights/transparência/doações e tem teste de contagem/shape.
6. **Responsáveis legados:** as quatro Integradas migram sem responsável fabricado; apenas membro pode receber designation de responsável, obrigatória para selo/painel novo.
7. **Mentoria:** política de cancelamento/no-show (tolerância, reagendamento) e LGPD básica para mentorandos convidados (e-mail + nome em sessões — consentimento no pedido e remoção sob solicitação).
8. **Visibilidade do perfil público:** o snapshot por membro é gerado pelo workflow — uma mudança de privacidade leva até o próximo run para refletir em `/@handle` (documentar no painel: "alterações levam até X minutos").
9. **Horas pós-cancelamento:** não existe fluxo de desfazer check-in (0.11.x); uma entrada `event_checkin` gerada permanece approved mesmo se a inscrição for cancelada/reembolsada depois — definir com a diretoria se cabe reversão manual na fila de aprovação ou política de "hora registrada não se desfaz".
10. **Carga horária de eventos externos legados:** ativações externas anteriores à Fase 2 podem não ter duração confiável no snapshot nem `workloadMinutes` — a regra de obrigatoriedade vale para novas ativações; o tratamento de retroativos (backfill manual vs. ignorar) fica para o plano de implementação da Fase 2.
11. **PII no protótipo do C4P:** o seed do sistema externo contém dados pessoais reais (e-mails/telefones de palestrantes) e uma senha em texto claro — `code-to-analyze/` permanece gitignored e nada disso é portado; o anexo [c4p.md](c4p.md) registra a proibição.
12. **Avaliador C4P sem conta GitHub:** o design exige membro com OAuth; se a diretoria precisar de avaliadores externos sem cadastro, a alternativa é o pattern de convidado por token (como o mentorando da Fase 5) — decidir no plano de implementação da Fase 7.

## Fora de escopo (1.0.0)

- Emissão de nota fiscal para empresas (mantido comprovante apenas).
- Votação eletrônica formal (quórum/votos seguem na Discussion; votação online é candidata a 1.1).
- App mobile / PWA.
- Automação cartorária (o registro é manual: PDF + metadados).
- Revisão do estatuto/alumni (processo social, registrado nas assembleias mas não automatizado).
- **Sistema próprio para Codaqui Business Events** (eventos fechados a empresários): nesta versão a gestão é manual/eventos existentes; o módulo é candidato a pós-1.0.0 se o volume justificar.

<!-- AGENT-INDEX
purpose: Plano Codaqui 1.0.0 — reestruturação da gestão da ONG no site (assembleias, diretorias, voluntários, horas, entidades, projetos de extensão, mentoria, comunidades com selo, business tiers).
audience: Presidência, mantenedores, AI agents implementando as fases.
status: design aprovado em 2026-09-21 (mentoria, e-mail, menus, relatórios e UX do membro/perfil público adicionados em 2026-09-21) — aguardando review do documento antes do plano de implementação da Fase 1.
sections:
  - Visão e princípios
  - Estado atual revisado
  - Decisões de design (alinhadas com a presidência em 2026-09-21)
  - Subsistemas (A–F)
  - Sistema de e-mail (melhorias transversais E1/E2)
  - Arquitetura de menus e navegação (UX)
  - Relatórios & exportações (R1–R3)
  - Painel do membro, privacidade e perfil público (UX)
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
| Ledger financeiro double-entry | **Inalterada** — dinheiro apenas, incluindo a caixa das comunidades integradas |
| Ledger de horas (novo) | `hour_ledger` **tabela separada** (unidade = horas); copia só o *pattern* de auditoria/aprovação da ledger financeira, sem compartilhar dados ou contas |
| `companies` (ADR 003) | Ganha `tier` (amiga/aliada) + due diligence |
| Multisite whitelabel (ADR 004, piloto T.I. Social) | Vira privilégio do nível **Integrada** |
| Giscus (comentários do blog) | Embute a Discussion de cada assembleia |
| Snapshots estáticos (`static/events/`) | Mesmo pattern para `static/assemblies/` e migração de `communities.ts` |
| `src/data/communities.ts` (5 parceiras, frontend-only) | Migra para tabela `communities` + snapshot |
| `/participe/mentoria` (estática, Google Calendar externo, mentores hardcoded) | Vira módulo de mentoria: perfis, disponibilidade, agendamento, sessões, insights (subsistema F) |
| Perfil público `/@handle` (snapshot em build, campos fixos, sem privacidade) | Controles de visibilidade por campo + redesign com badges, timeline e horas |
| Menu de perfil (navbar, desktop/mobile) | Reagrupado com identidade e seções (UX — ver seção de menus) |
| Roles events (ROLES.md) | Base para permissões escopadas (diretor→diretoria, mentor→projeto, responsável→comunidade) |

## Decisões de design (alinhadas com a presidência em 2026-09-21)

1. **Assembleias:** híbrido — Discussion é a ata viva; banco guarda registro fino (tipo, número, data, status, PDF do cartório, metadados de registro).
2. **Comunidades:** 2 níveis — **Parceira** (listada, apoio pontual) e **Integrada** (site + eventos + caixa) — mais o **Selo Codaqui** (processo formal da diretoria, validade de 1 ano, responsável obrigatório).
3. **Business:** tiers **Empresa Amiga** (só financeiro = CLUB Business PJ atual) e **Empresa Aliada** (Codaqui valida de forma consultiva; selo próprio com validade).
4. **Horas:** **uma única ledger de horas** (`hour_ledger`, **separada da ledger financeira**) com aprovação — diretor/mentor lança (pending), presidência/finance-analyzer aprova; check-in em eventos entra automaticamente como approved.

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

## Sistema de e-mail (melhorias transversais)

Revisão do módulo `notifications` (2026-09-21) originou ajustes que devem entrar **antes** das fases que dependem de e-mail transacional (Fase 5 mentoria, sobretudo). Duas entregas:

### E1 — Correções (PR próprio no início da Fase 1)

1. **Dashboard com NaN em produção** — contrato quebrado: o frontend (`admin/emails.tsx`) espera `summary.byTemplate[tpl] = { sent, failed }`, mas o backend (`email.service.ts`) envia um total único por template. Correção: backend volta a agrupar por template+status (o frontend já foi construído para o shape dividido).
2. **Módulo desligado sem credenciais** — hoje, sem `SMTP_USER/PASS`, o provider lança `SMTP_NOT_CONFIGURED` que é gravado como **failed**, gerando falhas em massa nos crons e poluindo métricas. Correção: `EmailService`/crons/`resend` consultam `provider.isConfigured()`; desligado = não tenta SMTP nem cria log de falha — registra com status próprio `skipped` (visível no admin, fora da métrica de falhas) e endpoint de status para banner no dashboard.
3. **`resend` respeita configuração** e retorna erro amigável quando o módulo está desligado.
4. **Índice em `email_logs(template, registrationId)`** — a query de dedupe dos crons cresce sem controle; adicionar migration com índice composto.
5. **E-mail transacional de reembolso/cancelamento** de inscrição (o refund Stripe já existe sem notificação ao participante).
6. **Retenção de `email_logs`** — política de limpeza (proposta: manter 12 meses) via cron.

### E2 — Templates (antes da Fase 5, mentoria)

1. **Registry de templates** — hoje 3 templates hardcoded em switch; criar registro com metadados (key, nome, descrição, quando dispara, contexto esperado) e endpoint `GET /notifications/templates` + `GET /notifications/templates/:key/preview` (render com dados de exemplo).
2. **Visualização no admin** — aba "Templates" em `/admin/emails`: lista com descrição, gatilho e preview renderizado.
3. **Edição de textos segue versionada em código** (PR) — override em banco fica fora de escopo até haver demanda.

## Arquitetura de menus e navegação (UX)

**Problema:** o painel admin navega por uma fileira de botões que quebra linha, com um único grupo (Eventos) em dropdown que some ao clicar e estado ativo fraco; com 1.0.0 serão ~25 páginas. O menu de perfil (foto, desktop/mobile) é uma lista plana sem identidade.

**Admin — app-shell com sidebar esquerda persistente:**
- Novo `AdminLayout` (sidebar 240px, colapsável; drawer hambúrguer no mobile; topbar com breadcrumb seção › página) substitui o `AdminNavbar` nas ~15 páginas existentes.
- Sidebar com seções agrupadas por **sistema de valor** (submenus expansíveis, item ativo por prefixo de rota, busca no topo, seção some se o usuário não vê nenhum item):
  - **Visão geral** (dashboard) · **Pessoas** (Membros, Diretorias, Voluntários, Horas ▸ Aprovações/Saldos/Declarações) · **Financeiro (R$)** (Lançamento, Transferências, Reembolsos, Fornecedores, Pagamentos, Recebimentos, Relatórios) · **Clube & SortCoins** (Carteiras, Sorteios) · **Empresas** (PJ, tiers F6) · **Eventos** (Visão geral, Overrides, Check-in) · **Governança** (Comunidades & Selo, Assembleias, Entidades, Projetos de Extensão, Mentoria) · **Comunicação** (E-mails, Templates)
- Regras de nome: "SortCoins" é o único nome da moeda virtual (nunca "VirtualCoins"/"Carteira" soltos); "saldo" sempre qualificado (R$, SortCoins, horas); `hour_ledger` nunca chamada de "ledger" na UI.
- Hub `/admin` vira dashboard (stats + atalhos), eliminando os cards de navegação duplicados.

**Menu de perfil (NavbarAuth, desktop + mobile):**
- Cabeçalho de identidade no menu: avatar, nome, `@handle`, chips de roles.
- Agrupado com rótulos: **Conta** (Perfil · Clube · Empresa) · **Gestão** (Painel Admin) · **Sessão** (Trocar conta · Sair) — doação sai do menu de conta.
- Mobile: mesmo conteúdo com bloco de identidade e rótulos de seção (mantendo as classes do sidebar Docusaurus); item ativo conforme a página.

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
3. Seção SortCoins do `/@handle`: respeita visibilidade (opt-in) e ganha link "Ver no Clube" → `/clube`.
4. Transparência global: cards/saldos de comunidades → transparência da comunidade correspondente (mesmo mapa `projectKey`).

## Modelo de dados consolidado

Novas tabelas: `communities`, `directorates`, `directorate_members`, `hour_ledger`, `assemblies`, `entities`, `partnerships`, `extension_projects`, `project_participants`, `mentor_profiles`, `mentor_availability`, `mentorship_sessions`.
Alterações: `members.roles` (+`diretor`, `voluntario`, `mentor`), `members.profileVisibility` (jsonb — visibilidade por campo no perfil público), `hour_ledger.sourceType` (+`mentorship_session`), `companies` (+tier e campos aliada), `email_logs` (status +`skipped`, índice — ver seção de e-mail).
Migrations numeradas a partir da 024. Padrões: uuid PK, createdAt/updatedAt, índices em foreign keys, soft semantics por `isActive`/`status` (sem deletes físicos em registros de governo).

> **Nota — duas ledgers, zero mistura:** a `hour_ledger` é independente da ledger financeira (`Account`/`Transaction`): unidade horas vs. BRL, sem double-entry, sem contas compartilhadas. O que ela herda é apenas o *padrão* (trilha de auditoria, status de aprovação, convenção de referências). Dinheiro — incluindo a caixa das comunidades integradas — segue exclusivamente na ledger financeira.

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

- **Snapshots:** `static/assemblies/index.json`, `static/mentors/` (lista pública de mentores), snapshot por membro para o perfil público `/@handle` (campos e históricos **já filtrados por visibilidade**) e migração de comunidades para snapshot gerado (workflow estendido ou novo, seguindo `sync-event-snapshots.yml`).
- **Giscus:** categoria "Assembleias" por pathname (configuração por página, igual ao blog).
- **Admin:** páginas novas seguem o padrão `/admin/*` (guarda de login, authFetch, Alert de erro).
- **Dados públicos:** páginas leem snapshots; dados privados (filas de aprovação) vão direto à API.

## Fases e critérios de pronto

| Fase | Entrega | Critério de pronto |
|---|---|---|
| **1. Fundações** | `communities` + níveis/selo + roles `diretor`/`voluntario` + `directorates` + migração de `communities.ts` + **E1 (e-mail) + R1 (relatórios) + AdminLayout/sidebar + menu de perfil + aba "Meus dados" (`profileVisibility`)** | CRUD admin + snapshot público com níveis/selo; roles aplicados no guard; seed das 5 comunidades; NaN do dashboard corrigido; export CSV por datas; sidebar ativa; visibilidade por campo no endpoint público |
| **2. Pessoas e horas** | `hour_ledger` + aprovações + declaração de horas com verificação + **redesign do perfil público `/@handle` (badges, timeline, stats) + aba "Minhas horas" no `/membro`** | 3 fontes alimentando; fila de aprovação; PDF emitindo só horas approved; audit completo; perfil público com snapshot por membro respeitando visibilidade |
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
8. **Visibilidade do perfil público:** o snapshot por membro é gerado pelo workflow — uma mudança de privacidade leva até o próximo run para refletir em `/@handle` (documentar no painel: "alterações levam até X minutos").

## Fora de escopo (1.0.0)

- Emissão de nota fiscal para empresas (mantido comprovante apenas).
- Votação eletrônica formal (quórum/votos seguem na Discussion; votação online é candidata a 1.1).
- App mobile / PWA.
- Automação cartorária (o registro é manual: PDF + metadados).
- Revisão do estatuto/alumni (processo social, registrado nas assembleias mas não automatizado).

<!-- AGENT-INDEX
purpose: Anexo do plano Codaqui 1.0.0 — integração do sistema de C4P (Call for Papers / Chamada de Trabalhos) como subsistema G, Fase 7, fechando o 1.0.0. Porte do sistema externo validado em produção (curadoria) + nova submissão pública de propostas.
audience: Presidência, mantenedores, AI agents implementando a Fase 7.
status: implementada em develop (backend 1.0.0, migration 049, PR #639); release, sync inicial do snapshot e campanha piloto pendentes. Origem: sistema externo "Kimi_Agent_C4P - Codaqui" analisado em 2026-10-20 — operou de fato o C4P do DevPR Conf 2026. Spec e plano: docs/superpowers/specs|plans/2026-11-12-c4p*.
sections:
  - Origem e análise do sistema externo
  - Decisões de design (2026-10-20)
  - Arquitetura alvo
  - Modelo de dados
  - Fluxos
  - Papéis e permissões
  - Frontend e rotas
  - Integração com a plataforma de eventos
  - Segurança e LGPD
  - O que descartar do sistema externo
  - Critérios de pronto
related-docs:
  - docs/plans/codaqui-1-0/README.md — plano-mãe 1.0.0 (Fase 7, subsistema G)
  - docs/adrs/001-event-platform.md — plataforma de eventos (vínculo managed_events)
  - docs/plans/codaqui-1-0/rbac.md — designations evaluator @ c4p_campaign e guards
  - docs/plans/codaqui-1-0/refatoracao-frontend-astro.md — Fase 0 (as telas do C4P nascem no Astro)
agent-protocol:
  - O sistema externo vive em code-to-analyze/ (gitignored) e contém PII real e uma senha em texto claro no seed — NUNCA portar dados, apenas a lógica.
  - Backend segue os padrões do monorepo: NestJS REST + TypeORM/PostgreSQL, class-validator, audit, migrations numeradas na sequência do plano-mãe.
-->

# C4P — Chamada de Trabalhos integrada (subsistema G, Fase 7 do plano 1.0.0)

> **Origem:** feature muito solicitada pelas comunidades; um sistema externo foi criado, **funcionou em produção real** (C4P do DevPR Conf 2026, com palestras reais importadas de Google Forms e avaliadores votando) e agora precisa ser integrado à nossa base. Este anexo consolida a análise do sistema externo e o design da integração. Decisões alinhadas em 2026-10-20.

## Origem e análise do sistema externo

O que o sistema externo faz hoje (validado em produção):

1. **Admin** (login com senha mestra) cria campanhas de C4P, **importa propostas via CSV de Google Forms** (parse no browser, mapeamento de cabeçalhos pt-BR), cadastra avaliadores com senha gerada (exibida uma única vez) e os vincula a campanhas (N-N).
2. **Avaliador** faz login e vota palestra a palestra com **5 sliders 0–10** (relevância prática, viabilidade em palco único, clareza do resumo, inovação/domínio, diversidade de grade) + comentário opcional. Um voto por avaliador por palestra (upsert); edição permitida enquanto a campanha está `open`.
3. **Gestão:** dashboard por campanha com progresso por avaliador, ranking por média simples, médias por critério, distribuição por trilha/nível.
4. **Finalização:** admin marca selecionadas → fecha a campanha (`selectedTalkIds`) → pode reabrir. Relatório **PDF** gerado no cliente.
5. **Resultado:** página de ranking/aprovadas — hoje exige login e só mostra notas com a campanha fechada.

Limitações do externo que a integração corrige: **não há submissão pública** (depende de Google Forms + CSV); auth caseira por senha (admin mestre + senhas geradas); stack divergente (tRPC + Hono + MySQL/Drizzle); zero testes; sem rate limiting nem audit; dados de evento soltos (`eventDate` varchar livre).

## Decisões de design (2026-10-20)

1. **Fase 7 do 1.0.0** — o C4P fecha a versão 1.0.0; as fases anteriores recebem minors próprias, sem versões históricas reutilizadas. Todas as telas nascem no Astro.
2. **Escopo: curadoria portada + submissão pública.** O formulário público substitui o Google Forms; importação CSV permanece como fallback.
3. **Auth nativa, sem senha caseira:** admin = roles existentes; avaliador = designation `evaluator` @ `c4p_campaign` (`pending` no convite, `active` no aceite), com GitHub OAuth. Não existe tabela `c4p_evaluators`.
4. **Critérios configuráveis por campanha**, com os 5 atuais como default — comunidades integradas podem ajustar nomes/pesos sem fork de código.
5. **Resultado público opt-in:** a página pública de resultado (aprovadas, sem notas individuais) só existe se a campanha habilitar; notas e comentários **nunca** são públicos.

## Arquitetura alvo

- **Backend:** módulo NestJS `c4p/` (REST + TypeORM/PostgreSQL). Validação em DTOs. Para cada voto, `score = Σ(scoreDoCritério × peso) / Σ(pesos)`; a nota da palestra é a média simples dos scores dos avaliadores que votaram. Pesos devem ser positivos e somar > 0; critérios sem voto não entram no cálculo individual.
- **Frontend:** páginas Astro novas (ver "Frontend e rotas") — admin no `AppLayout`, avaliador e submissão pública com `PublicLayout`.
- **E-mails:** notificações de convite de avaliador, confirmação de submissão e resultado (aprovada/não aprovada) via módulo `notifications` (mesmo pattern de `email_logs` + templates editáveis de E2).
- **Audit:** criação/fechamento de campanha, importação CSV, seleção final e mudanças de vínculo de avaliador vão ao módulo `audit`.

## Modelo de dados

Novas tabelas (PostgreSQL/TypeORM, uuid PK, createdAt/updatedAt, migrations na sequência do plano-mãe):

- **`c4p_calls`**: `id`, `slug`, `name`, `description?`, `managedEventId?` (vínculo opcional a `managed_events`), `communityId?` (null = Codaqui; preenchido = comunidade integrada), `status` ('draft' | 'open' | 'closed'), `submissionOpenAt?`, `submissionCloseAt?`, `criteria` (jsonb — default: os 5 critérios atuais com pesos iguais), `selectedTalkIds` (jsonb), `publicResults` (bool), `finalizedAt?`, `createdById`.
- **`c4p_talks`**: `id`, `callId`, `speakerName`, `speakerEmail`, `speakerPhone?`, `speakerRole?`, `linkedin?`, `spokeBefore?`, `title`, `summary`, `level`, `track`, `bio?`, `photoUrl?`, `extraNotes?`, `origin` ('public_form' | 'csv_import'), `consentAt` (timestamp do consentimento LGPD — obrigatório em `public_form`).
- **Avaliadores:** `member_designations` com `targetType='c4p_campaign'`, `targetId=callId`, `designation='evaluator'`, `appointedById` e status `pending/active/removed`; único active por (`callId`, `memberId`).
- **`c4p_votes`**: `id`, `talkId`, `evaluatorDesignationId` (→ `member_designations`), `scores` (jsonb `{ criterionKey: 0–10 }`), `comment?`, `updatedAt` — único por (`talkId`, `evaluatorDesignationId`), upsert enquanto `open` e designation `active`.

> A tabela `sessions`/auth do externo não é portada; `users` vira `members` + designations.

## Fluxos

1. **Abertura:** organizador cria a campanha (opcionalmente vinculada a um `managed_event`), configura critérios e janela de submissão → `open`.
2. **Submissão pública:** `/c4p/<slug>/submeter` + consentimento LGPD + **Turnstile obrigatório** + throttler → `origin='public_form'` → confirmação por e-mail. Importação CSV permanece no admin (`origin='csv_import'`, com origem do consentimento registrada na política).
3. **Avaliação:** organizador convida avaliadores (membros) → avaliador aceita → vota palestra a palestra (upsert) → dashboard acompanha progresso, ranking, médias por critério, distribuição por trilha/nível.
4. **Finalização:** organizador marca selecionadas → `closed` + `selectedTalkIds` + `finalizedAt` (pode reabrir) → relatório PDF no cliente (portar `src/lib/pdf.ts` — jspdf + autotable) → e-mails de resultado aos palestrantes.
5. **Resultado público:** se `publicResults`, `/c4p/<slug>/resultado` lista aprovadas (título, palestrante, trilha — **sem notas**) — candidata a snapshot estático no pattern `static/events/`.

## Papéis e permissões

| Papel | Escopo |
|---|---|
| `admin` | global |
| `event_organizer` | CRUD das próprias campanhas, convite de avaliadores, importação CSV, finalização |
| designation `evaluator` @ `c4p_campaign` | votação nas campanhas com designation `active`; não é role global |
| responsável de comunidade (vínculo) | campanhas da própria comunidade integrada (`communityId`) |

## Frontend e rotas

| Rota | Tipo | Descrição |
|---|---|---|
| `/c4p` | `.astro` pública | Lista de campanhas abertas (vitrine de submissão) |
| `/c4p/<slug>/submeter` | ilha React | Formulário público de submissão + consentimento |
| `/c4p/<slug>/resultado` | `.astro`/snapshot | Aprovadas, se `publicResults` e `closed` |
| `/c4p/avaliar` | ilha `client:only` | Home do avaliador (minhas campanhas) |
| `/c4p/avaliar/<callId>` | ilha `client:only` | Votação palestra a palestra (sliders) |
| `/admin/c4p` | ilha `client:only` | Lista/gestão de campanhas |
| `/admin/c4p/<id>` | ilha `client:only` | Tabs: Propostas (import CSV), Avaliadores, Dashboard, Finalização |

Entrada na sidebar do `AppLayout`/`AppNavIsland` existente, na seção definida pelo plano da Fase 7.

## Integração com a plataforma de eventos

- `c4p_calls.managedEventId` vincula a campanha a um evento próprio: a página do evento pode exibir "C4P aberto" com link para a submissão (metadado no snapshot, mesmo pattern de `hasOverride`).
- Campanhas de comunidades integradas (`communityId`) aparecem no build do tenant correspondente.
- Pós-1.0.0 (fora deste escopo): palestras aprovadas alimentarem a grade pública do evento.

## Segurança e LGPD

- ⚠️ **O seed do sistema externo contém PII real** (e-mails e telefones de palestrantes do DevPR Conf 2026) **e uma senha de admin em texto claro**. A pasta `code-to-analyze/` é gitignored e assim permanece; **é proibido portar esses dados** para seeds, fixtures ou testes. Testes usam dados sintéticos.
- Submissão pública coleta nome/e-mail/telefone/LinkedIn de não-membros: checkbox de consentimento (`consentAt`), finalidade declarada na Política de Privacidade (Fase 1b/P1 — adicionar o perfil "palestrante C4P" ao inventário de tratamentos), remoção sob solicitação via contato@codaqui.dev.
- Notas e comentários de avaliação são restritos (admin/organizador) e nunca expostos em snapshot ou página pública.
- Rate limiting na submissão pública; validação de URLs (LinkedIn/foto) seguindo o pattern do `StorageModule`.

## O que descartar do sistema externo

- **Auth caseira** (scrypt + sessão em tabela + senha mestra) — substituída por OAuth/roles.
- **tRPC + Hono** — viram controllers REST NestJS.
- **MySQL/Drizzle** — vira TypeORM/PostgreSQL (atenção a `serial`, `onDuplicateKeyUpdate` e enums MySQL no porte).
- **Deps e env mortas** do scaffold (`ai`, `@ai-sdk/openai-compatible`, `APP_ID`/`APP_SECRET`).
- **UI shadcn/Tailwind das telas app** — as ilhas React seguem o padrão MUI do AppLayout (Tailwind só em layout/`.astro`, conforme a regra da Fase 0).
- Os 11 scripts one-off de manutenção (`migrate-evaluators`, `cleanup-*`, `fix-db`) — eram cicatrizes do banco MySQL; o TypeORM + migrations os tornam desnecessários.

## Critérios de pronto (Fase 7)

- Submissão pública ponta a ponta (form → banco → e-mail de confirmação) com consentimento LGPD registrado.
- Fluxo de curadoria completo: convite de avaliador (membro) → aceite → votação com upsert → dashboard → finalização com PDF → e-mails de resultado.
- Importação CSV compatível com o cabeçalho do Google Forms atual (não quebra o fluxo das comunidades que ainda usam Forms).
- Resultado público opt-in sem vazar notas/comentários.
- `npm run build && npx jest` verdes no backend (testes de scoring, guards e upsert de voto); bump para **1.0.0** + ADR 012 ("C4P integrado") com status implementado.

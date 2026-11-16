<!-- AGENT-INDEX
purpose: Design aprovado da Fase 7.2 — sincronizar designation/perfil de mentoria, tornar candidaturas atômicas e melhorar a apresentação e o vínculo de sessões.
audience: Mantenedores, revisor de arquitetura e AI agents implementando a fase.
status: Aprovado pelo mantenedor em 2026-11-16, incluindo recandidatura, vigência e vínculo no mentor/admin; pronto para plano TDD.
sections:
  - Intenção e escopo
  - Abordagens consideradas
  - Ciclo de vida e atomicidade
  - Reconciliação de dados
  - APIs e apresentação das sessões
  - Segurança, compatibilidade e verificação
related-docs:
  - ../../plans/pos-1-0/README.md — Fase 7.2 (P1/P2)
  - ../../adrs/009-mentorship.md — contrato atual de mentoria
  - ../../adrs/006-directorates-designations.md — designations e roles derivadas
agent-protocol:
  - Não criar papéis/tabelas paralelas; `mentor @ program('mentoria')` continua sendo a autorização.
  - Toda mudança de designation/perfil ocorre na mesma transação PostgreSQL quando toca as duas entidades.
  - Não expor e-mails novos nem dados de atores; opções de membros contêm somente dados públicos.
-->

# Fase 7.2 — Ciclo de vida e sessões de mentoria

## Intenção e escopo

Corrigir a desconexão que permite uma designation de mentor ativa sem o perfil correspondente aparecer no diretório público, evitar candidaturas parcialmente gravadas e tornar a lista de sessões legível e útil para associar participantes a contas da plataforma.

**Inclui:** sincronização de `member_designations`/`mentor_profiles`, candidatura atômica, migration de reconciliação, opções de busca de membros, vínculo manual de `menteeMemberId`, dashboard do mentor e rótulo de mentor no perfil público.

**Não inclui:** nova designation/tabela/role paralela, alteração do sistema de reservas, mudança de status/horas, alteração de nome/e-mail históricos das sessões, edição do Design System ou mudança de rotas públicas existentes.

## Abordagens consideradas

1. **Aprovada — sincronizar na transação de designations:** `DesignationsModule` conhece a entidade `MentorProfile`; `syncMemberWithRunner` ajusta/cria o perfil na mesma transação da designation. Candidatura usa um `QueryRunner` compartilhado entre `grant()` e o save do perfil.
2. **Bloquear o endpoint genérico para mentoria:** menor mudança, mas exige duas rotas operacionais e correção manual do estado existente.
3. **Somente derivar o diretório pela designation:** esconde o sintoma e preserva a divergência de `profile.active`.

## Ciclo de vida e atomicidade

- `DesignationsModule` registra `MentorProfile` em `TypeOrmModule.forFeature`, sem importar `MentorshipModule` ou criar dependência circular.
- `syncMemberWithRunner` verifica a existência de `mentor @ program('mentoria')` no conjunto de designations ativas **e vigentes** (`validUntil` nulo ou futuro):
  - com designation vigente, garante perfil ativo; se ausente, cria com `areas: []`, `focus: null` e `approvedById` do ator;
  - sem designation vigente, desativa um perfil existente sem criar um novo;
  - não altera `approvedById` na desativação;
  - a sincronização ocorre mesmo quando as roles derivadas não mudam (antes do early return de roles).
- `DesignationsService.grant()` aceita um `QueryRunner` opcional como terceiro argumento. Sem ele, mantém o comportamento/transação atuais; com ele, executa a escrita e `syncMemberWithRunner` no runner do chamador.
- `MentorshipService.apply()` injeta `DataSource` e usa uma única transação: verifica duplicidade, concede a designation pendente e cria o perfil inativo. Erro de unique ou de qualquer save faz rollback das duas escritas.
- Na recandidatura de um mentor revogado, o perfil existente é reutilizado (preservando UUID e histórico), com `areas` e `focus` atualizados pela nova candidatura e `active: false` até a confirmação do admin.
- `confirmApplication()` e `updateMentor()` continuam nos fluxos existentes, agora beneficiados pela sincronização compartilhada; cache é invalidado como hoje.
- O snapshot público também verifica designations vigentes em lote: perfil ativo sem designation vigente não aparece, inclusive quando `validUntil` expira sem uma nova escrita. Não é necessário cron.

## Reconciliação de dados — migration 050

Criar `1795300000000-Migration050_MentorshipLifecycle.ts`:

- `up`: cria `mentor_profile_active_backup(id uuid PK, active boolean)` e copia o estado atual; atualiza cada `mentor_profiles.active` para o resultado de `EXISTS` de uma designation `mentor @ program('mentoria')` ativa e dentro da validade (`validUntil` nulo ou futuro).
- `down`: restaura `active` a partir do backup e remove a tabela de backup.
- Não altera áreas, foco, aprovadores, sessões ou designations históricas.

## APIs de apoio e vínculo

### Opções de membros

`GET /mentorship/member-options?search=<texto>` com `JwtAuthGuard`:

- `search` opcional, máximo 100 caracteres; busca case-insensitive por nome ou handle com parâmetros SQL e escape de `%`, `_` e `\`.
- Retorna no máximo 10 membros ativos ordenados por nome: `{ id, name, githubHandle, avatarUrl }`.
- Não expõe e-mail, roles, designations ou dados de ator.

### Vínculo de participante

`POST /mentorship/sessions/:id/mentee` com `JwtAuthGuard` e body `{ memberId: uuid }`:

- Autoriza somente admin ou o mentor ativo dono da sessão (`assertMentor` existente).
- Exige membro ativo; 404 para sessão/membro inexistente ou inativo.
- Altera somente `menteeMemberId`, preservando nome, e-mail, consentimento, status, horas e demais campos históricos.
- Retorna a sessão enriquecida com `menteeMember: { id, name, githubHandle, avatarUrl } | null`.
- `listForMentor()` e `listForAdmin()` passam a enriquecer as sessões com o mesmo `menteeMember`, sem consulta individual por sessão (uma consulta em lote em cada listagem).

## Dashboard e perfil público

- Datas usam `Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short', timeZone: session.timeZone })`.
- Status visíveis: `requested → Solicitada`, `confirmed → Confirmada`, `completed → Concluída`, `canceled → Cancelada`, `no_show → No-show`.
- Participante mostra nome, avatar/inicial, handle/link `/@<handle>` quando vinculado e e-mail histórico como texto secundário; sem vínculo, mostra “Não vinculado à plataforma”.
- Ação “Vincular participante” abre Dialog com Autocomplete. A busca usa `/mentorship/member-options` (inclusive `?search=`), sem `/admin/members`. Ao salvar, envia `{ memberId }`, mostra sucesso/erro com Alert e recarrega as sessões.
- A apresentação e o vínculo ficam disponíveis tanto no dashboard do mentor quanto em `/admin/mentoria`, permitindo associar também as sessões históricas dos placeholders. Componentes e contratos são compartilhados, sem duplicar o fluxo.
- `getRoleLabel()` em `[...handle].astro` ganha `case 'mentor': return 'Mentor(a)'` para a role derivada existente.

## Segurança e compatibilidade

- Não há mudança no cálculo de horas, reservas, notificações, anonimização ou projeções públicas já existentes.
- Nome/e-mail originais do contato não são sobrescritos pelo cadastro da conta vinculada.
- Não haverá consulta N+1 na listagem de sessões nem dados privados adicionais na resposta.
- Backend segue semver de feature: **1.1.0** (de 1.0.2), migration **050**. ADR 009 e `AGENTS.md` devem registrar a sincronização e os novos contratos.

## Verificação

- Unitários: sync confirm/revoke/sem perfil/roles inalteradas; apply com rollback; opções com escape e whitelist; vínculo com escopo e preservação.
- Migration 050: down/up com estados divergentes sintéticos e restauração exata do backup.
- Frontend: data/fuso, status, participante vinculado/não vinculado, busca, POST correto e feedback.
- Gates completos de backend, scripts, frontend, `astro-verify` e tenants; revisão independente antes do PR.
- Rollout: merge → publicação `v1.1.0-backend` e migration → sync de mentores → frontend → confirmar que o mentor ativo aparece no diretório e uma sessão de teste pode ser vinculada.

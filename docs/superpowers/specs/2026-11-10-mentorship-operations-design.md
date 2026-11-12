<!-- AGENT-INDEX
purpose: Design da importação histórica de mentoria e administração operacional de mentores.
audience: Mantenedores, implementers e revisores da branch feat/mentorship-operations.
status: Concluído e publicado em v0.22.0-backend (PR #626); vinculação manual dos placeholders é acompanhamento operacional.
sections:
  - Evidências e decisão
  - Migration 046
  - Placeholders e identidade
  - Admin de mentores
  - Rollback, privacidade e testes
related-docs:
  - docs/adrs/009-mentorship.md — ciclo de mentoria da Fase 5
  - docs/adrs/006-directorates-designations.md — designation como autorização
  - docs/plans/codaqui-1-0/auth.md — vínculo por e-mails verificados
agent-protocol:
  - Não commitar Dashboard - Mentoria - Schedules.csv nem dados de ambiente.
  - Não gerar hour_ledger, consentimentos ou links Meet retroativos.
  - Não associar mentorandos ou mentores por e-mail não verificado.
-->

# Mentoria Operations — Design

## Evidências e decisão

O CSV `Dashboard - Mentoria - Schedules.csv` contém 185 sessões históricas com `id,scheduled_at,mentor,mentee,start_at,end_at,title,is_confirmed,channel,duration_hour`. Ele não será commitado nem usado em runtime; a migration 046 conterá o seed versionado derivado dele.

Regras medidas no CSV:

- 177 linhas têm mentor, mentorando e duração válida entre 15 e 240 minutos;
- 8 linhas são inválidas: 6 sem mentor, 1 sem mentorando e 1 com duração zero;
- 1 ID aparece duplicado;
- 4 horários conflitam com a unicidade `(mentorId, scheduledAt)`;
- após deduplicar ID e conflitos, **173 sessões** serão importadas e **4 duplicidades** serão ignoradas;
- conflitos são resolvidos mantendo a linha com menor `scheduled_at` (data de criação do registro);
- os mentores são Matheus, Enderson, Ivo, Renan, Rebecca e Guilherme. Somente Enderson possui conta correspondente verificada no dump analisado.

Backend **0.22.0**, migration **046**, em branch independente de announcements.

## Migration 046

A migration usa seed estático gerado do CSV e funções idempotentes de upsert:

- perfil de cada mentor com `areas`, `focus` e `since` derivados do histórico;
- sessões com nome/e-mail do mentorando, tema, início, duração, status, canal e ID original;
- `Confirmado` vira `completed` com `completedAt = end_at`; `Cancelado` vira `canceled`;
- duração usa `duration_hour` com vírgula e, quando vazio, `end_at - start_at`;
- `notes` recebe o marcador `legacy-import:<id>` e o canal original, permitindo deduplicação;
- inserção usa `WHERE NOT EXISTS` pelo marcador e `ON CONFLICT (mentorId, scheduledAt) DO NOTHING`;
- nenhum `hour_ledger`, `guestConsentAt`, `meetLink`, avaliação ou motivo de cancelamento é inventado.

A migration pode ser executada mais de uma vez sem duplicar perfis, designations ou sessões.

## Placeholders e identidade

A associação usa apenas e-mails verificados pelo GitHub (`secondaryEmails`). Não há correspondência por display name ou e-mail apenas declarado.

- Enderson: perfil e designation ativos, sem alterar a conta existente;
- Matheus, Ivo, Renan, Rebecca e Guilherme: membros placeholder com `isActive = false`, e-mail `seed-<slug>@anon.invalid`, perfil inativo e designation `pending`;
- perfis usam UUIDs determinísticos para referenciar sessões e permitir reatribuição futura sem trocar o ID do perfil;
- se uma correspondência real já existir, o placeholder não é criado;
- perfis existentes são reutilizados; dados posteriores não são sobrescritos.

Mentorandos só são vinculados a `menteeMemberId` quando o e-mail da sessão estiver em `secondaryEmails` de um membro ativo. Os demais permanecem históricos externos, sem conta inventada.

Placeholders não aparecem no diretório público porque o membro e o perfil estão inativos.

## Admin de mentores

`GET /mentorship/admin/mentors` exige admin e retorna o envelope `{data,total,page,totalPages,limit}` com:

- `id`, `memberId`, `name`, `githubHandle`, `avatarUrl`, `areas`, `focus`, `active`, `isPlaceholder`.

`PATCH /mentorship/admin/mentors/:id` recebe `{memberId, areas, focus?, active}` e permite:

- editar áreas/foco;
- ativar ou desativar o perfil;
- reatribuir um placeholder ou perfil a um membro ativo;
- manter `mentor @ program('mentoria')` coerente com o perfil.

A atualização é transacional: reatribuição revoga a designation antiga, cria/reativa a designation correta quando `active = true`, revoga quando `active = false`, invalida o cache e registra auditoria com antes/depois. Não altera outras designations do membro.

O admin em `/membro/mentoria` é redirecionado para `/admin/mentoria` antes de qualquer request, evitando o 403 causado por `requireActiveProfile` sem fingir que o admin é mentor.

## Rollback e privacidade

`down` remove somente sessões com marcador `legacy-import:` e placeholders que continuem inativos e sem sessões/disponibilidade. Contas reais, designations, perfis ativados e dados posteriores são preservados. Não há remoção em massa de membros ou designations.

O seed contém os mesmos dados pessoais do CSV autorizado, mas o snapshot público continua expondo apenas perfis ativos de membros ativos, sem mentorandos ou e-mails administrativos.

## Testes

- migration unitária: seed com 173 sessões, 6 perfis, 1 ativo e 5 placeholders;
- idempotência e deduplicação por ID/horário;
- execução real em dump: contagens, status, duração, placeholders, ausência de horas e down seguro;
- admin: paginação, ativação, desativação, edição e reatribuição com designation/auditoria;
- frontend: edição, seleção de membro, placeholder, redirect e feedback de erros;
- E2E do fluxo existente de candidatura, aprovação, disponibilidade, reserva e conclusão, sem regressão;
- gates backend/frontend/scripts/tenants e SonarCloud antes da PR para `main`.

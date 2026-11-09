<!-- AGENT-INDEX
purpose: Design executável da Fase 4 — entidades, parcerias, projetos de extensão, participantes, horas e comprovantes.
audience: Mantenedores, revisores, implementers e operadores de release da Fase 4.
status: Spec ampliada e aprovada em 2026-11-09, incluindo diretorias comunitárias e assembleias por entidade jurídica; plano executável em docs/superpowers/plans/2026-11-07-entities-extension.md.
sections:
  - Decisão e escopo
  - Arquitetura e módulos
  - Modelo de dados e migrations
  - Autorização e auditoria
  - Regras de negócio
  - APIs e contratos
  - Horas e comprovantes
  - Frontend, snapshot e notificações
  - Erros, concorrência e privacidade
  - Verificação e release
related-docs:
  - docs/plans/codaqui-1-0/cadastro-projeto-extensao.md — catálogo aprovado de campos e regras funcionais
  - docs/plans/codaqui-1-0/README.md — plano-mãe, subsistemas B/C e sequência de fases
  - docs/plans/codaqui-1-0/rbac.md — matriz de permissões
  - docs/adrs/006-directorates-designations.md — designations e roles derivadas
  - docs/adrs/013-hour-ledger.md — hour_ledger, aprovação e idempotência
  - docs/adrs/014-assemblies.md — Discussion manual e snapshot público
agent-protocol:
  - Não implementar antes da revisão desta spec e da escrita/aprovação do plano executável.
  - Preservar a vitrine open source existente em /projetos; não criar cities, IES ou recursos da Fase 4b.
  - Orçamento é descritivo e nunca toca a ledger financeira; horas usam exclusivamente hour_ledger.
-->

# Fase 4 — Entidades e Projetos de Extensão: design executável

## Decisão e escopo

A Fase 4 entrega a jornada **entidade → parceria → projeto → mentor → inscrição → horas → aprovação → finalização → comprovante**, com uma release de backend **0.16.0**. O catálogo funcional de campos e as restrições de negócio de `docs/plans/codaqui-1-0/cadastro-projeto-extensao.md` permanecem aprovados. Esta spec consolida os limites técnicos e resolve as ambiguidades de implementação.

A arquitetura usa dois módulos novos, `entities` e `projects`, mais integrações pontuais com `designations`, `hours`, `notifications`, `storage`, `audit` e os snapshots Astro. Não haverá módulo único acumulando todas as responsabilidades nem três releases independentes.

Ficam fora desta fase: `cities`, embaixadores, Codaqui Universitário, lista de espera, upload de arquivos, votação ou comitê, integração do orçamento com dinheiro, trilhas, métricas agregadas por ODS, mentoria da Fase 5, automação de GitHub Discussions e campanhas/malas diretas de e-mail (spec própria).

## Arquitetura e módulos

### `backend/src/entities`

Responsável por:

- cadastro e manutenção de `entities`;
- cadastro e encerramento/cancelamento de `partnerships`;
- consultas administrativas paginadas e projeções públicas mínimas;
- validação de vínculo entre projeto, entidade e parceria.

### `backend/src/projects`

Responsável por:

- cadastro completo e rascunhos de `extension_projects`;
- máquina de estados e designação do mentor principal;
- co-mentores e participantes em `project_participants`;
- inscrição, saída e remoção administrativa;
- emissão e verificação de `project_certificates`;
- projeções públicas para snapshot e vitrine.

### Integrações existentes

- `DesignationsService`: mentor principal em `mentor @ extension_project`, com `appointedById`; não há `mentorMemberId` persistido no projeto.
- `HoursService`: novo método específico para lançamentos de projeto e reutilização das aprovações já existentes.
- `StorageService`: valida todos os URLs de anexos e relatórios/documentos externos, sem upload.
- `EmailService`: recebe operações genéricas de templates de projeto, sem consultar o módulo `projects` nem introduzir dependência circular.
- `AuditService`: registra mutações e concessões, sem substituir as trilhas `createdById`/`appointedById`.
- Helper compartilhado de Discussion: a validação exata de URLs de `codaqui/institucional/discussions/<número>` é extraída para uso comum, com testes de regressão nas assembleias.

## Modelo de dados e migrations

A versão do backend passa para **0.16.0**. As migrations são aditivas e agrupadas na mesma release.

### Migration 037 — entidades e parcerias

`entities`:

- `id` UUID;
- `slug` único, usado em rotas públicas;
- `name`, `type` (`empresa | instituicao_ensino | ong | governo | outro`);
- `cnpj?`, `website?`, `contactEmail?`;
- `registeredById` FK para `members`;
- `isActive`, `createdAt`, `updatedAt`.

`partnerships`:

- `id` UUID e `entityId` FK;
- `kind` (`termo | pontual`);
- `startedAt`, `endsAt?`;
- `status` (`active | ended | canceled`);
- `notes?`, `createdAt`, `updatedAt`.

Não existem colunas `responsibleMemberId`, `directorMemberId` ou `maintainerEntityId`. Responsáveis e gestores, quando atribuídos por uma jornada, usam designations. A Fase 4 não faz seed nem inventa responsáveis para entidades.

### Migration 038 — projetos e participantes

`extension_projects` contém os campos aprovados no catálogo funcional:

- identidade: `id`, `kind`, `name`, `normalizedName`, `slug`, `entityId`, `partnershipId?`, `createdById`;
- apresentação: `summary`, `isPublic`, `status`;
- períodos: `startsAt`, `endsAt`, `registrationStartsAt`, `registrationEndsAt`;
- estratégia: `odsPrimary`, `odsSecondary`, `targetCommunity`;
- dimensão pedagógica: `justification`, `objective`, `skillsDeveloped`, `methodology`;
- execução: `totalHours`, `schedule`, `maxParticipants`;
- apoio: `supportPartners`, `budget`, `attachments`, `internalNotes`;
- encerramento: `reportDiscussionUrl`, `createdAt`, `updatedAt`.

`normalizedName` e `slug` são únicos. Datas de projeto e inscrição são datas civis (`date`), não instantes `timestamptz`. `totalHours` usa `numeric(8,2)`. Não há coluna para mentor principal nem para co-mentores. Somente `name`, `entityId`, `createdById`, `status` e os campos com default são obrigatórios ao criar um rascunho; os demais campos de formulário são anuláveis no banco e passam a ser exigidos pela regra de salvamento completo/ativação.

`project_participants`:

- `id`, `projectId`, `memberId`;
- `role` (`participant | mentor`);
- `joinedAt`, `leftAt?`;
- `createdAt`, `updatedAt`.

Um índice único parcial em `(projectId, memberId) WHERE leftAt IS NULL` impede dois vínculos ativos da mesma pessoa e permite nova inscrição após saída. Outro índice único parcial em `member_designations(targetType, targetId, designation) WHERE targetType = 'extension_project' AND designation = 'mentor' AND status = 'active'` garante um único mentor principal por projeto. O mentor principal e os co-mentores recebem vínculo `mentor`; somente o principal recebe designation e permissão de lançar horas. Esse vínculo permite ao principal lançar as próprias horas de mentoria.

### Migration 039 — comprovantes

`project_certificates`:

- `id`, `projectId`, `memberId`;
- `kind` (`participant | mentor_report`);
- `code` único;
- `hoursAtIssue` `numeric(8,2)`;
- `issuedAt`, `createdById`.

A unicidade `(projectId, memberId, kind)` torna a emissão idempotente. Reemitir retorna o registro e o código já existentes.

### Migration 040 — diretorias comunitárias e assembleias por guarda-chuva

`directorates` recebe `communityId` FK opcional para `communities`. `NULL` representa uma diretoria global da Codaqui; cada diretoria pertence a no máximo uma comunidade e cada comunidade pode ter várias diretorias. Registros existentes permanecem globais.

`assemblies` recebe `entityId` FK obrigatória para `entities`, após backfill. A migration registra ou reutiliza a entidade `codaqui` (`Associação Codaqui`, tipo `ong`, CNPJ `44.593.429/0001-05`), usando um admin existente somente como autor da trilha técnica, não como responsável organizacional inventado. Todas as assembleias atuais recebem essa entidade.

A unicidade anterior `(type, number)` é substituída por `(entityId, type, number)`. A criação passa a usar advisory lock por `entityId + type`; numeração e slug são independentes por guarda-chuva. A URL pública passa a ser `/assembleias/<entitySlug>/<type>-<number>`, e a Discussion usa exatamente esse pathname. O redirect `/assembleias/* → /assembleias/codaqui/*` preserva os endereços anteriores.

Comunidade e entidade jurídica não são intercambiáveis: comunidades organizam pessoas/projetos; entidades com CNPJ possuem obrigações assembleares. Novas entidades guarda-chuva podem ter assembleias sem possuir site tenant ou comunidade integrada.

## Autorização e auditoria

- Criar/editar entidade, parceria ou projeto: `admin` ou diretor com designation `director @ directorate` ativa.
- Criar/editar assembleia da entidade Codaqui: regra atual de admin/diretor ativo. Em outras entidades guarda-chuva: admin ou `manager @ entity` ativo. Cartório continua somente admin e `entityId` é imutável após a criação.
- Ativar ou cancelar projeto: `admin` ou diretor ativo que seja `createdById` do projeto.
- Finalizar projeto: `admin`, diretor criador ativo ou mentor principal ativo. Isso consolida o painel do mentor aprovado; cancelar continua restrito ao diretor criador/admin.
- Designar/substituir mentor: diretor/admin; somente um mentor principal ativo por projeto. A substituição bloqueia o projeto, encerra a designation anterior e concede a nova na mesma transação, mantendo os vínculos de co-mentor separados.
- Inscrever-se/sair: membro autenticado, sem exigir `voluntario`.
- Remover participante: diretor/admin, com audit.
- Lançar/editar horas pendentes: somente mentor principal ativo no projeto.
- Aprovar/rejeitar horas: fluxo existente de `admin`/`finance-analyzer`.
- Emitir declaração individual: o próprio titular autenticado.
- Emitir comprovante de relatório: mentor principal ativo ou `admin` agindo em nome operacional, sempre para o `memberId` do mentor principal.
- Ver `internalNotes`, participantes completos e observações administrativas: diretor/admin e mentor no que for estritamente necessário à sua operação; nunca o público.

Ações novas usam prefixos `entity.*`, `partnership.*` e `project.*`. Lançamentos/aprovações de horas continuam usando as ações `hour.*` existentes. Nenhuma autorização depende apenas de `createdById`: a pessoa também precisa conservar a designation de diretor quando essa condição for exigida.

## Regras de negócio

### Entidade e parceria

- Entidade inativa não aparece na vitrine e não aceita novos projetos/parcerias.
- Parceria opcional precisa pertencer à mesma entidade do projeto e estar `active` na ativação.
- `endsAt`, quando presente, é posterior a `startedAt`.

### Projeto e formulário

- Rascunho exige somente `name` e `entityId`; os demais campos podem permanecer incompletos até o salvamento completo.
- Salvamento completo produz `proposed`; ativação exige formulário completo, mentor principal e entidade ativa.
- Nome é normalizado com trim, espaços colapsados, minúsculas e remoção de diacríticos. Duplicidade de nome normalizado ou slug retorna conflito.
- `startsAt < endsAt` e `registrationStartsAt < registrationEndsAt`; inscrições podem começar antes do projeto, mas `registrationEndsAt <= startsAt`, impedindo inscrições após o início da execução.
- ODS principal está entre 1 e 17; secundárias são únicas e não incluem a principal.
- Cronograma e horas usam centésimos inteiros na validação, evitando erro de ponto flutuante. Cada encontro tem descrição e carga positiva; a soma é exatamente `totalHours`.
- `maxParticipants = 0` significa sem limite; valores negativos são inválidos.
- Orçamento valida totais por item e total geral em centavos. É somente descritivo e nunca chama `LedgerService` nem módulos financeiros.
- Anexos e `reportDiscussionUrl` são validados no backend. Relatório final é uma Discussion manual, sem nova categoria obrigatória e sem incorporar Giscus nesta fase.
- `finished` exige `reportDiscussionUrl`; `canceled` e `finished` não recebem inscrições nem novas horas. Expirar a janela não altera automaticamente o status.

### Participantes

Inscrição exige projeto `active`, data dentro da janela e membro autenticado. Mentor principal/co-mentores não podem ocupar vaga de participante. A saída usa `leftAt`; nova inscrição posterior recria vínculo ativo somente se ainda houver janela e vaga.

## APIs e contratos

Todas as listagens administrativas seguem `{data,total,page,totalPages,limit}`, com DTOs e limites compartilhados. Nenhuma rota nova usa o prefixo `/admin/`.

### Entidades e parcerias

- `GET /entities/public`: entidades ativas com campos públicos mínimos.
- `GET /entities`: listagem administrativa paginada.
- `POST /entities`, `PATCH /entities/:id`: gestão.
- `GET /entities/:id/partnerships`: vínculos da entidade.
- `POST /entities/:id/partnerships`: cria parceria.
- `PATCH /partnerships/:id`: edita/encerra/cancela parceria.

As rotas existentes de assembleias aceitam filtro administrativo por `entityId`. `GET /assemblies/public/:entitySlug/:slug` passa a resolver entidade e tipo/número; a coleção pública inclui somente `entity: {slug,name}` além dos campos já permitidos. `entityId` é obrigatório no POST e imutável no PATCH.

### Projetos e participação

- `GET /projects/public`: coleção completa para o snapshot, somente `active + isPublic + entidade ativa`.
- `GET /projects/public/:slug`: detalhe público equivalente.
- `GET /projects`: listagem administrativa paginada por status/entidade.
- `POST /projects`, `PATCH /projects/:id`: rascunho, edição e transições sob lock.
- `GET /projects/my`: inscrições e vínculos do membro autenticado, com status e relatório do projeto.
- `GET /projects/:id/participants`: participantes com nome/handle para admin ou mentor principal.
- `GET /projects/:id/hours`: lançamentos do projeto para admin ou mentor principal, sem IDs internos ou idempotency keys.
- `POST /projects/:id/join`: inscrição atômica.
- `POST /projects/:id/leave`: saída idempotente do próprio membro.
- `DELETE /projects/:id/participants/:memberId`: remoção administrativa.
- `POST /projects/:id/hours`: mentor lança horas para participante ou para si.
- `PATCH /projects/:id/hours/:hourId`: mentor edita somente entrada `pending`, preservando `idempotencyKey`.

As respostas públicas omitem `createdById`, `registeredById`, `internalNotes`, orçamento detalhado, anexos internos, e-mails e dados de aprovação. O mentor público é projetado apenas com nome e handle; nunca com e-mail.

### Comprovantes

Um controller próprio em `/project-certificates` evita colisão com `/projects/public/:slug`:

- `POST /project-certificates/projects/:projectId` com `kind`: emissão autenticada e idempotente.
- `GET /project-certificates/verify/:code`: verificação pública mínima.
- `GET /project-certificates/:code`: dados do documento para o titular autenticado.

O proxy recebe `/entities/`, `/partnerships/`, `/projects/`, `/project-certificates/` e `/hours/`, com exceções estáticas somente para snapshots. As rotas em português `/projetos` não colidem com `/projects/`.

## Horas e comprovantes

`HoursService.recordExtensionProjectEntry` recebe o projeto, o titular e os dados validados pelo módulo de projetos. Em uma única transação:

1. bloqueia o projeto com `pessimistic_write`;
2. confirma status `active`, mentor principal e vínculo do titular;
3. verifica a chave de idempotência do titular;
4. soma `pending + approved` do titular no projeto;
5. rejeita excedente a `totalHours`;
6. grava `sourceType=extension_project`, `sourceId=projectId`, `reportedById=mentorId` e `status=pending`.

Entradas para encontros diferentes coexistem. Repetir a mesma chave não duplica e produz conflito explícito. Edição de `pending` mantém a mesma chave e repete o limite; entradas revisadas são imutáveis. Rejeitadas não contam no limite. A aprovação existente continua alterando o saldo somente para `approved`.

Declaração individual exige projeto `finished` e horas aprovadas positivas do titular. O comprovante `mentor_report` exige projeto `finished` e mentor principal. `hoursAtIssue` congela o total exibido na primeira emissão; reemissões não mudam código nem valor histórico.

Verificação pública retorna somente validade, tipo, nome do titular, projeto, horas e emissão. PDF é impressão nativa no frontend; o backend fornece dados, não arquivos.

## Frontend, snapshot e notificações

### Público e membro

- `/projetos` preserva integralmente a seção open source atual e acrescenta a vitrine de extensão.
- `/projetos/:slug` mostra entidade, mentor, período, ODS, resumo, vagas e inscrição por ilha autenticada. A quantidade exibida no snapshot é informativa; a API continua autoritativa na inscrição.
- `/projetos/comprovante` recebe `?code=<código>` e consulta a verificação pública, sem gerar uma página estática por código.
- `/membro` recebe projetos, estado das horas e links para declarações.
- O painel do mentor permite participantes, lançamento/edição de horas e finalização com relatório.
- `/admin/entidades` e `/admin/projetos` seguem páginas `.astro` finas, ilhas MUI, `useAuth`, `authFetch`, erros visíveis e paginação compartilhada.
- `/assembleias/:entitySlug/:slug` apresenta o guarda-chuva e mantém Giscus por `pathname`; `/admin/assembleias` ganha seletor/filtro de entidade, e `/admin/diretorias` ganha seletor de comunidade global ou específica.

### Snapshot

`scripts/sync-projects.mjs` consulta `GET /projects/public`, valida toda a resposta e grava `static/projects/index.json` por arquivo temporário + rename, preservando o snapshot anterior em falha. O build copia o snapshot, gera as páginas e mantém a seção open source. Workflow diário às **06:29 UTC** e dispatch manual executam o sync; o agregador `npm run sync` não é alterado nesta fase.

### Notificações

Templates novos cobrem mentor designado/ativo, inscrição confirmada, horas aprovadas/rejeitadas e projeto finalizado. O módulo de projetos envia dados simples ao `EmailService`; a revisão de horas usa `sourceLabel` e o membro já carregado pelo `HoursService`, evitando dependência circular. Logs usam `email_logs`; SMTP ausente ou indisponível registra falha sem desfazer a operação principal já confirmada.

## Erros, concorrência e privacidade

- Ativação, inscrição, lançamento de horas e emissão usam transações e locks adequados.
- Inscrição bloqueia o projeto antes de contar participantes, impedindo excesso de vagas em requisições simultâneas.
- Conflitos de nome, slug, vínculo, vaga, idempotência, estado ou limite retornam HTTP 409 com mensagem específica.
- DTO inválido, URL não permitida, datas incoerentes e soma de cronograma retornam HTTP 400 sem escrita parcial.
- Ausência de recurso retorna 404; falta de escopo retorna 403 sem revelar dados administrativos.
- E-mails falhos não revertem gravações; falhas de banco revertem toda a transação.
- `internalNotes`, aprovações, chaves de idempotência, `createdById`, e-mails e observações internas nunca entram no snapshot.
- Horas no perfil continuam sujeitas a `profileVisibility`; a verificação do comprovante expõe somente o conteúdo aprovado para o documento.

## Verificação e release

A implementação deve incluir:

- testes de migrations 037–040 em `up/down` e restauração real de dump descartável;
- criações concorrentes da mesma assembleia por entidade recebendo números distintos, preservação do backfill Codaqui e redirects das URLs antigas;
- testes unitários de validações, autorização, projeções e máquina de estados;
- testes PostgreSQL reais para duas inscrições concorrentes na última vaga, retry de horas, edição de pendente e emissão repetida;
- E2E da jornada completa, incluindo diretor não-admin, mentor, participante e `finance-analyzer`;
- testes de snapshot preservando arquivo anterior em HTTP/contrato/escrita inválidos;
- testes de ilhas para permissões, erros, estados vazios e navegação por teclado;
- `cd backend && npm run build && npx jest --silent`;
- `make astro-verify`, `make astro-verify-tenants` e `npm run test:scripts`;
- ADR 008, runbook, AGENTS e plano-mãe atualizados antes do handoff;
- release `v0.16.0-backend` somente após merge autorizado, seguida de redeploy, confirmação das migrations, sync inicial e validação real da jornada pública.

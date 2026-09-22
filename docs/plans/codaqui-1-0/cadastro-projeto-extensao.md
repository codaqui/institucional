<!-- AGENT-INDEX
purpose: Plano detalhado (sem código) do Cadastro de Projeto de Extensão + comprovantes — formulário adaptado do modelo de "Atividade Extensionista" (AdminLTE) ao contexto da Codaqui, com restrições de negócio, máquina de estados, horas no ledger e declarações verificáveis.
audience: Presidência, diretoria, mantenedores, AI agents implementando a Fase 4.
status: proposta aprovada em 2026-09-21 — detalha o subsistema C do plano 1.0.0; aguardando plano de implementação.
sections:
  - Contexto e vínculo com o 1.0.0
  - Papéis e permissões
  - Fluxo ponta a ponto
  - Modelo de dados do formulário
  - Máquina de estados
  - Regras de negócio e validações
  - Inscrição de voluntários
  - Lançamento e aprovação de horas
  - Comprovantes e verificação
  - E-mails transacionais
  - Frontend
  - LGPD e privacidade
  - Critérios de pronto
  - Fora de escopo
related-docs:
  - docs/plans/codaqui-1-0/README.md — plano-mãe (subsistemas B e C, Fase 4)
  - docs/adrs/001-event-platform.md — pattern de certificado/verificação reutilizado
  - AGENTS.md — convenções do monorepo (ledger, roles, StorageModule sem upload)
agent-protocol:
  - Documento de especificação: descreve O QUÊ e as restrições, não o código.
  - Toda decisão de dados aqui é extensão do modelo consolidado do README (ADR 008 na implementação).
  - Orçamento é descritivo e NUNCA toca a ledger financeira — restrição de negócio inegociável.
-->

# Cadastro de Projeto de Extensão — Plano Detalhado

> Origem: necessidade da diretoria de estruturar o cadastro de projetos de extensão da associação com o mesmo rigor de um formulário acadêmico de atividade extensionista (campos, validações, cronograma, orçamento descritivo e comprovantes), adaptado ao contexto de uma ONG de tecnologia. Alinhado com o plano Codaqui 1.0.0 (subsistemas B e C, Fase 4).

## Contexto e vínculo com o 1.0.0

Este documento detalha o **subsistema C — Entidades, parcerias e Projetos de Extensão** do plano-mãe (`docs/plans/codaqui-1-0/README.md`), cruzado com o **subsistema B — ledger de horas**. O formulário de referência analisado é o "Cadastro de Atividade Extensionista" (AdminLTE, módulo de extensão universitária), cujas boas práticas de estrutura e validação são preservadas, com os campos estritamente acadêmicos descartados.

Princípios herdados do plano-mãe:

1. **Menos banco possível** — o registro estruturado fica no banco; relatório-resumo narrativo final do projeto vive em **GitHub Discussion** vinculada (mesmo padrão das assembleias), o banco guarda só `reportDiscussionUrl?`.
2. **Tudo auditável** — criação, transições de status, designação de mentor, lançamentos e aprovações de horas vão para o módulo `audit`.
3. **Duas ledgers, zero mistura** — horas vivem exclusivamente na `hour_ledger`; dinheiro, exclusivamente na ledger financeira. O orçamento do projeto é **descritivo** e jamais gera movimentação financeira.
4. **Reaproveitar** — verificação de comprovante segue o pattern do certificado de evento (`GET .../certificates/verify/:code`); anexos seguem o pattern do `StorageModule` (URLs externas validadas, sem upload).

## Papéis e permissões

| Ação | Quem |
|---|---|
| Cadastrar/editar entidade, parceria e projeto | `diretor` (global) ou `admin` |
| Salvar rascunho | diretor/admin |
| Publicar (proposed → active), finalizar, cancelar | diretor dono do cadastro ou `admin` |
| Designar mentor | diretoria, no próprio cadastro |
| Inscrever-se como participante | qualquer membro logado (`voluntario` ou não) |
| Lançar horas do projeto | mentor designado do projeto |
| Aprovar/rejeitar horas | presidência (`admin`) ou `finance-analyzer` |
| Emitir/baixar comprovante | o próprio titular (autenticado) |
| Ver observação interna | somente diretoria/admin |

O mentor de extensão **não é role** — é vínculo (`mentorMemberId` no projeto), conforme o plano-mãe.

## Fluxo ponta a ponta

1. Diretor cadastra a **entidade** (`entities`) — se ainda não existir — e a **parceria** (`partnerships`).
2. Diretor abre o **Cadastro de Projeto** (`/admin/projetos/novo`), preenche as seções e salva como **rascunho** ou **projeto**.
3. No cadastro, a diretoria **designa o mentor** (membro ativo). O mentor é notificado por e-mail.
4. Projeto ativado (`active`) e público (`isPublic`) aparece na vitrine `/projetos` e passa a receber inscrições de membros.
5. Mentor lança horas dos participantes (`hour_ledger`, `sourceType: extension_project`) → entram `pending`.
6. Presidência/`finance-analyzer` aprova ou rejeita (rejeição exige motivo).
7. Ao fim, diretor/mentor finaliza o projeto (`finished`) com **relatório-resumo** (Discussion vinculada).
8. Sistema disponibiliza **declarações individuais** (participantes e mentor) e o **comprovante do mentor**, com código de verificação público.

## Modelo de dados do formulário

Extende a entidade `extension_projects` do plano-mãe. Campos novos em relação ao README são extensão aprovada por este documento (consolidar na ADR 008).

### Identificação e classificação

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `kind` | enum | sim | `programa` \| `projeto` \| `oficina` \| `evento` \| `prestacao_servicos`. Linguagem da ONG: nunca "curso"/"alunos". |
| `name` | texto (120) | sim | Único normalizado (case-insensitive, espaços colapsados, sem acento). Duplicidade **bloqueia o salvamento** (mesmo comportamento do formulário de referência). |
| `slug` | texto | automático | Gerado de `name`; único. |
| `entityId` | FK → entities | sim | Entidade principal do projeto. |
| `partnershipId` | FK → partnerships | não | Vínculo formal, quando houver. |
| `summary` | texto (curto) | sim | Resumo para a vitrine pública. |
| `isPublic` | boolean | sim (default true) | Exibe em `/projetos`. |

### Períodos

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `startsAt` / `endsAt` | data | sim | `startsAt < endsAt`. |
| `registrationStartsAt` / `registrationEndsAt` | data | sim | `registrationStartsAt < registrationEndsAt`; janela de inscrição **contida** no período do projeto. |

### Alinhamento estratégico (preservados do formulário de referência)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `odsPrimary` | int (1–17) | sim | ODS principal (ONU). |
| `odsSecondary` | int[] | não | ODS secundárias; não pode conter o principal. |
| `targetCommunity` | texto | sim | Público beneficiado: nº aproximado de pessoas, faixa etária, comunidade. |

### Dimensão pedagógica

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `justification` | texto | sim | Justificativa do projeto. |
| `objective` | texto | sim | Objetivo na comunidade. |
| `skillsDeveloped` | texto | sim | Conhecimentos, habilidades e atitudes desenvolvidos no participante. |
| `methodology` | texto | sim | **Pré-preenchido** com o texto padrão PjBL (Aprendizagem Baseada em Projetos), **editável** — diferente do formulário de referência, que o trava. |

### Detalhamento e carga horária

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `totalHours` | numérico | sim | > 0. |
| `schedule` | jsonb | sim | Lista de encontros: `{ numero, descricao, carga }[]`. A carga é **distribuída automaticamente** ao informar `totalHours` e a quantidade de encontros; edição livre por encontro; **a soma das cargas deve ser exatamente igual a `totalHours` para salvar** (validação herdada do formulário de referência). Nº de encontros livre (sem trava semestral/anual — isso é regra de graduação). |
| `maxParticipants` | int | sim | ≥ 0. `0` = sem limite declarado (ver regra de vagas). |

### Pessoas e parceiros

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `mentorMemberId` | FK → members | sim | Designado pela diretoria no cadastro. Membro ativo. |
| `coMentors` | FK[] → members | não | "Colaboradores extensionistas": busca de membros por nome/handle; viram vínculos em `project_participants` com role `mentor`. |
| `supportPartners` | jsonb | não | `[{ nome, cnpj? }]` — parceiros de apoio descritivos. Hint no formulário: parceiro estratégico recorrente deve ser cadastrado como `entity`. Sem CNPJ obrigatório. |

### Orçamento e anexos

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `budget` | jsonb | não | `{ itens: [{ descricao, quantidade, unidadeMedida, valorUnitario, valorTotalItem }], totalGeral }`. **Caráter exclusivamente descritivo** (ver restrição R3). |
| `attachments` | jsonb | não | URLs externas HTTPS validadas pela allowlist do `StorageModule` (Google Drive/Docs, Dropbox, OneDrive `1drv.ms`, Imgur). **Sem upload** — o backend não possui armazenamento de arquivos. |
| `internalNotes` | texto | não | Destinado à diretoria ("Comitê"); **nunca exposto** em endpoint público nem na vitrine. |

### Campos descartados do formulário de referência

`competência`, `eixo`, `ciclo`, `semestre do aluno`, `curso propositor`, `cursos vinculados`, `unidade`, tipo de arquivo "Ata de NDE" — todos específicos de instituição de ensino. A trava de quantidade de encontros (15/30) também foi descartada.

### Entidade de emissão (nova tabela)

`project_certificates`: `id`, `projectId`, `memberId`, `kind` (`participant` \| `mentor_report`), `code` (único, verificação pública), `hoursAtIssue`, `issuedAt`, `createdById`. Registro fino e auditável de cada comprovante emitido; emissão **idempotente** (reemissão reutiliza o mesmo `code`).

## Máquina de estados

```
draft → proposed → active → finished
                  ↘ canceled
```

| Status | Significado | Quem transiciona |
|---|---|---|
| `draft` | Rascunho incompleto. Mínimo para salvar: `name` + `entityId`. Não aparece na vitrine, não recebe inscrições. | diretor/admin |
| `proposed` | Cadastro completo e válido; aguardando ativação. Visível no admin. | automático ao salvar completo |
| `active` | Publicado; recebe inscrições; aparece na vitrine se `isPublic`. | diretor dono/admin |
| `finished` | Encerrado com relatório-resumo (`reportDiscussionUrl` obrigatória). Dispara disponibilização dos comprovantes. | diretor dono/admin |
| `canceled` | Cancelado; inscrições encerradas, sem comprovantes. Prazo de inscrição expirado **não** cancela automaticamente. | diretor dono/admin |

> `draft` é um **novo valor no enum de status** do plano-mãe (que tinha `proposed | active | finished | canceled`) — alteração mínima, consolidada na ADR 008. A publicação não exige "aprovação de comitê": a diretoria que cadastra também ativa (a ONG não tem comitê de extensão).

## Regras de negócio e validações

1. **RBAC** — criação/edição exclusiva de `diretor`/`admin`; transições restritas ao diretor dono ou `admin`.
2. **Título único** — normalização (trim, colapsar espaços, case/acento-insensitivo) antes da checagem; duplicidade bloqueia salvar e informa o título existente.
3. **Datas coerentes** — `startsAt < endsAt`; inscrição contida no período do projeto; nenhuma data de inscrição após o início da execução.
4. **Vagas** — inteiro ≥ 0 (o formulário de referência ajusta negativo para 0 e avisa; aqui apenas bloqueia a digitação de negativo).
5. **Cronograma** — soma das cargas dos encontros **exatamente igual** a `totalHours` para submeter; descrição de cada encontro obrigatória (limite sugerido: 500 caracteres, como o original).
6. **Designação de mentor** — só membro ativo; notificado por e-mail ao ativação.
7. **Orçamento descritivo (R3 — restrição inegociável)** — `budget` jamais gera lançamento, previsão ou reserva na ledger financeira. Dinheiro real do projeto entra exclusivamente pelos módulos financeiros existentes (despesas, fornecedores, transferências). Texto de ajuda do campo deve deixar isso explícito.
8. **Anexos sem upload** — apenas URLs da allowlist HTTPS do `StorageModule`; validação no backend, mensagem clara no formulário.
9. **Observação interna** — campo `internalNotes` fora de qualquer DTO público.
10. **Vitrine** — somente `active` + `isPublic` + entidade ativa aparecem em `/projetos`.
11. **Auditoria** — toda transição de status, designação de mentor, inscrição removida pela diretoria e lançamento/aprovação de horas registra entrada no `audit`.
12. **Múltiplas inscrições** — um membro não se inscreve duas vezes no mesmo projeto; mentor e co-mentores não se inscrevem como participantes.

## Inscrição de voluntários

- Endpoint autenticado; membro logado, projeto `active`, dentro da janela de inscrição.
- Vagas: `maxParticipants > 0` → inscrições limitadas; ao atingir o limite, novas inscrições são **bloqueadas** (sem lista de espera nesta versão — ver Fora de escopo).
- `maxParticipants = 0` → interpretado como "sem limite declarado" (equivalente ao comportamento do formulário de referência que ajusta para 0).
- Resultado: vínculo em `project_participants` com role `participant`, `joinedAt` = agora.
- Participante pode sair do projeto (self-service) enquanto `active`; a diretoria pode remover participante (com audit).
- **Prazo de inscrição expirado não muda o status do projeto** — o projeto segue `active` até ser finalizado/cancelado.

## Lançamento e aprovação de horas

1. Mentor lança horas por participante (`hours`, `occurredAt`, `description`, `sourceLabel`) → `hour_ledger` com `sourceType: extension_project`, `sourceId = projectId`, `status: pending`, `reportedById = mentor`.
2. **Unicidade**: no máximo 1 entrada `approved` por (`memberId`, `extension_project`, `projectId`) — reenvio/edição enquanto `pending` é permitido.
3. Aprovação por presidência/`finance-analyzer` → `approved` (`approvedById`, `approvedAt`) entra no saldo; rejeição exige `rejectReason` e gera audit.
4. Mentor pode lançar também para si (horas de mentoria), mesmo fluxo.
5. Horas do mentor têm teto natural = `totalHours` do projeto; horas por participante não devem exceder `totalHours` (alerta de consistência no momento do lançamento).

## Comprovantes e verificação

Mesmo pattern do certificado de evento (dono autenticado baixa; verificação pública por código):

| Aspecto | Declaração individual (participante e mentor) | Comprovante ao mentor (relatório-resumo) |
|---|---|---|
| **Quando** | Projeto `finished` **e** horas `approved` > 0 do titular | Projeto `finished` |
| **Conteúdo** | Nome do titular, projeto, entidade, período, carga horária total do projeto, **horas aprovadas do titular**, data de emissão, código | Dados do projeto, participantes e horas aprovadas agregadas, link do relatório-resumo, data, código |
| **Emissão** | Registro em `project_certificates` (`kind: participant`), idempotente | Registro único (`kind: mentor_report`) |
| **Acesso** | Endpoint autenticado (dono) → dados; PDF renderizado no frontend | Idem |
| **Verificação** | Endpoint **público** por `code` retorna dados mínimos (titular, projeto, horas, emissão) | Idem |

Regras:

- A declaração reflete **horas aprovadas** — nunca `pending`/`rejected`; as horas congelam no documento no momento da emissão (`hoursAtIssue`).
- Reemissão (ex.: perda do PDF) reutiliza o mesmo `code`.
- Sem horas aprovadas → sem declaração (o membro vê o extrato normal de horas no painel).
- Verificação pública expõe apenas o que consta no comprovante — nenhum dado pessoal além do nome do titular.

## E-mails transacionais

Reutilizam o módulo `notifications` (mesmo pattern de `email_logs`):

| Gatilho | Destinatário |
|---|---|
| Mentor designado / projeto ativado | mentor |
| Inscrição confirmada | participante |
| Horas aprovadas (ou rejeitadas, com motivo) | participante |
| Projeto finalizado + comprovante disponível | participantes e mentor |

## Frontend

- **Admin** — `/admin/projetos` (lista com filtros por status/entidade) e `/admin/projetos/novo` (e `/editar/:id`): formulário em **seções com cards**, na anatomia do formulário de referência: Informações Gerais → Pessoas e Parceiros → Dimensão Pedagógica → Detalhamento (encontros) → Orçamento → Anexos → Observação interna. Ações "Salvar rascunho" e "Salvar projeto" (este só valida o formulário completo). Padrão das páginas admin existentes: guarda de login, `authFetch`, `Alert` de erro.
- **Público** — `/projetos` (vitrine: cards com entidade, mentor, período, ODS, vagas restantes) e `/projetos/:slug` (detalhe + botão "Inscrever-se" para membro logado; fora da janela, mostra período de inscrição).
- **Mentor** — painel "Meus projetos": lançar horas por participante, ver status das aprovações, finalizar com relatório-resumo.
- **Membro** — `/membro`, aba de projetos: inscrições, status de horas e download da declaração.

## LGPD e privacidade

- Comprovante em nome do participante **menor de idade** segue exatamente as regras já praticadas nos certificados de evento da plataforma (mesma base legal e canal de solicitação `contato@codaqui.dev`); nada de novo é coletado além do já inventariado no plano-mãe (P1/P2).
- `internalNotes` e dados de aprovação nunca saem em endpoints públicos; snapshot da vitrine contém apenas campos públicos.
- Horas do membro respeitam a visibilidade configurável do perfil (`profileVisibility`) no perfil público `/@handle`.

## Critérios de pronto

- [ ] Diretor cadastra entidade → parceria → projeto completo com todas as validações (título duplicado, datas, soma de cargas, vagas).
- [ ] Rascunho salva com mínimo e não aparece publicamente; projeto ativo público aparece na vitrine.
- [ ] Membro se inscreve; limite de vagas e janela de inscrição respeitados; esgotado bloqueia.
- [ ] Mentor lança horas → aprovação/rejeição com motivo → saldo reflete apenas `approved`.
- [ ] Finalização exige relatório-resumo (Discussion) e disponibiliza declarações individuais + comprovante do mentor.
- [ ] Verificação pública por código retorna os dados mínimos do comprovante.
- [ ] E-mails transacionais disparando e registrados em `email_logs`.
- [ ] `audit` completo nas transições, designações e decisões de horas.
- [ ] `npm run build && npx jest` verde no backend; `typecheck && build` no frontend; bump de versão (Fase 4 → backend 0.10.0).
- [ ] ADR 008 atualizada com o status `draft` e os campos novos de `extension_projects`.

## Fora de escopo (nesta versão)

- Lista de espera de inscrições.
- Integração do orçamento descritivo com a ledger financeira (proposital — restrição R3).
- Upload de arquivos (backend não possui storage; anexos são URLs externas).
- Aprovação de projeto por terceiros ("comitê") — a diretoria cadastra e ativa.
- Trilhas/conteúdo educacional do projeto (pertence ao módulo de trilhas, se um dia houver demanda).
- Nota fiscal e gestão de caixa do projeto (ledger financeira já cobre, via módulos existentes).
- Métricas de impacto agregadas por ODS na vitrine (candidato a evolução futura).

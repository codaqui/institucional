<!-- AGENT-INDEX
purpose: ADR da Fase 3 — assembleias com registro fino, Discussion manual, snapshot público, Giscus e cartório.
audience: AI agents, mantenedores, diretoria e operadores de release.
status: Implementado no branch da Fase 3 (migration 036 e backend 0.15.0); integração, release/publicação e validação real de Giscus pendentes.
sections:
  - Contexto
  - Decisão
  - Modelo fino e invariantes
  - Numeração, autorização e auditoria
  - API e contratos públicos
  - Discussion manual, Giscus e retenção
  - Snapshot, páginas e admin
  - Operação e release
  - Consequências, limites e pendências
related-docs:
  - 006-directorates-designations.md — diretor ativo e roles derivadas
  - 013-hour-ledger.md — separação entre governança, horas e ledger financeira
  - ../plans/codaqui-1-0/README.md — plano-mãe e fases seguintes
  - ../superpowers/plans/2026-11-05-assembleias.md — implementação e evidências
  - ../superpowers/specs/2026-11-05-assembleias-design.md — design aprovado
agent-protocol:
  - Não mover narrativa, quórum, votos ou ata para o PostgreSQL; esses dados permanecem na Discussion.
  - Não automatizar criação de Discussion nem declarar a categoria Assembleias/Giscus como configurados antes da ação externa.
  - Não publicar release, redeploy, sync inicial ou validação de produção como concluídos a partir desta ADR.
-->

# ADR 014 — Assembleias híbridas com Discussion manual e registro fino

- **Data da decisão:** 2026-11-05
- **Status:** Implementado no branch; release externo e Giscus real pendentes
- **Escopo:** Fase 3, migration 036, backend 0.15.0, API NestJS, snapshot, páginas públicas, admin e integração Giscus

## Contexto

A associação precisa publicar assembleias, preservar pautas e decisões e apresentar atas e registros cartorários sem criar um segundo repositório de narrativa no PostgreSQL. O registro precisa ser consultável e numerado, enquanto a discussão pública já pode ser hospedada pelo GitHub Discussions e embutida pelo Giscus existente.

A Fase 3 não inclui votação eletrônica, automação cartorária, upload de arquivos, GitHub App para criar Discussions nem mudanças nas ledgers financeira ou de horas. Fases 4–7 permanecem fora deste escopo.

## Decisão

Adotar um modelo híbrido: a tabela `assemblies` guarda somente metadados estruturados e o GitHub Discussions guarda pauta detalhada, quórum, votos, ata narrativa e comentários. O vínculo é cadastrado manualmente por uma URL estável; não há criação automática de Discussion.

O backend foi preparado na versão **0.15.0** e a migration **036** cria o modelo. A implementação e as validações locais estão concluídas no branch, mas isso não representa merge, release `v0.15.0-backend`, redeploy, configuração da categoria ou publicação em produção.

## Modelo fino e invariantes

A migration 036 cria `assemblies` com:

- `id` UUID e `createdById` com foreign key para `members`, usado somente como trilha;
- `type` (`ordinaria | oficial`) e `number` inteiro positivo;
- `title`, `scheduledAt`, `heldAt` e `status` (`scheduled | held | canceled`);
- `agendaSummary`, limitado a um resumo curto, não à pauta narrativa;
- `discussionUrl`, `ataPdfUrl` e `notaryRegistry` (`book`, `page`, `registeredAt`);
- `createdAt` e `updatedAt`.

O slug público é derivado como `<type>-<number>` e não é uma coluna editável. Tipo, número e Discussion são imutáveis após a criação; o título da assembleia pode mudar sem alterar o endereço ou o mapeamento dos comentários.

Somente `scheduled` pode transicionar para `held` ou `canceled`. Realizar exige `heldAt` igual ou posterior a `scheduledAt`. Assembleia `oficial` realizada exige PDF e cartório completo; para `ordinaria`, esses documentos são opcionais. Cancelamento não remove o registro, o resumo nem a Discussion pública.

A Discussion precisa usar exatamente `https://github.com/codaqui/institucional/discussions/<número>`. O PDF permanece em serviço externo e passa pela validação HTTPS e allowlist do `StorageService`; o backend não recebe nem armazena upload.

## Numeração, autorização e auditoria

A unicidade `(type, number)` é garantida pelo índice `UQ_assemblies_type_number`. A criação executa `pg_advisory_xact_lock(hashtext(type))`, calcula `MAX(number)+1` e salva na mesma transação. Uma violação específica desse índice pode ser repetida de forma limitada; outros erros não são convertidos em retry. Assim, criações simultâneas do mesmo tipo recebem números distintos e slugs estáveis.

A atualização lê a assembleia com `pessimistic_write` (`FOR UPDATE`), valida a transição, aplica o PATCH e salva na mesma transação. Os estados `before` e `after` usados na auditoria são capturados sob esse lock. Realização e cancelamento concorrentes ficam serializados: somente a primeira transição válida é persistida e a outra é recusada, sem transição a partir de estado terminal. Edições simultâneas de campos diferentes leem o estado mais recente antes de salvar.

A autorização não depende de `createdById`:

- `GET /assemblies`, `POST /assemblies` e `PATCH /assemblies/:id` exigem JWT e role `admin` ou `diretor`;
- criação e edição também consultam `DesignationsService.hasAnyDesignation` para exigir qualquer designation `director @ directorate` ativa quando o ator não é admin, sem impor `targetId` ou `targetKey` nulos;
- alterar `ataPdfUrl` ou `notaryRegistry` exige admin, inclusive quando esses dados acompanham a realização;
- leituras públicas não exigem autenticação.

Criação, edição, mudança de status e registro cartorário gravam ações `assembly.*` na auditoria de governo. A projeção pública e administrativa omite `createdById` e não inclui dados do membro, cookies ou tokens.

## API e contratos públicos

| Rota | Acesso | Contrato |
|------|--------|----------|
| `GET /assemblies/public` | Público | Array completo, ordenado por `scheduledAt DESC`, para o snapshot |
| `GET /assemblies/public/:slug` | Público | Registro derivado de `<type>-<number>`; slug inválido ou inexistente retorna 404 |
| `GET /assemblies` | Admin ou diretor | Paginação `{data,total,page,totalPages,limit}`, default 50, cap 100, com filtros `type` e `status` |
| `POST /assemblies` | Admin ou diretor ativo | Cria como `scheduled`, atribui número e devolve o slug derivado |
| `PATCH /assemblies/:id` | Admin ou diretor ativo; cartório somente admin | Edita campos permitidos e executa transições, sem alterar tipo, número ou Discussion |

No PATCH, campos não anuláveis enviados como `null` são recusados pelo DTO com HTTP 400; `null` permanece válido somente em `heldAt`, `ataPdfUrl` e `notaryRegistry`. PDF fora da allowlist também retorna HTTP 400 na fronteira de assembleias, sem alterar a allowlist do `StorageService`.

O proxy aceita o prefixo `/assemblies/` sem interceptar as páginas `/assembleias`. `/assemblies/index.json` é exceção explícita para continuar servindo o snapshot estático. Não foram criadas rotas de gestão sob `/admin/`.

## Discussion manual, Giscus e retenção

A operação cria manualmente a Discussion na categoria **Assembleias**, com título exatamente igual ao pathname `/assembleias/<type>-<number>`, e informa sua URL no cadastro. A API valida repositório e formato da URL, mas não consulta o GitHub para comprovar categoria, título ou existência: essa conferência é humana.

A numeração é atribuída somente no `POST`, enquanto a Discussion precisa existir antes dele. Por isso, a reserva do próximo número e a criação do registro devem ser coordenadas por um único operador, sem criações simultâneas do mesmo tipo durante esse passo. O lock do banco protege a numeração, não reserva recursos externos no GitHub.

`getAssembliesGiscusConfig()` separa a configuração do blog e usa `mapping="pathname"`, `strict="0"` e a categoria Assembleias. O blog continua em `mapping="og:title"` e na categoria Blog. O ID vem de `PUBLIC_GISCUS_ASSEMBLIES_CATEGORY_ID`, variável pública de build, não de um segredo. Sem ID, a página mostra o link estático para a Discussion e um aviso de configuração pendente, sem inventar categoria ou substituí-la por Reuniões.

Comentários, reações e metadados do Giscus permanecem no GitHub. Eles não são copiados para PostgreSQL nem para `static/assemblies/index.json`, e a retenção operacional do backend não os apaga. Moderação, exportação, exclusão e retenção seguem as permissões e políticas do GitHub; remover ou renomear uma Discussion pode quebrar o vínculo e o histórico apresentado no site.

## Snapshot, páginas e admin

`npm run sync:assemblies` consulta `GET /assemblies/public` usando `ASSEMBLIES_API_URL` (default `http://localhost:3001`). O script valida a coleção inteira, inclusive invariantes de realização, ausência de `createdById`, URL exata da Discussion e PDF HTTPS na mesma allowlist do armazenamento. Ele preserva `generatedAt` quando os dados não mudam e grava por arquivo temporário + rename. Falha de HTTP, contrato ou escrita não substitui o snapshot anterior.

O arquivo canônico é `static/assemblies/index.json`, copiado no build para `frontend/public/assemblies/index.json`. O workflow `sync-assemblies.yml` está configurado para 06:23 UTC diariamente e dispatch manual; ele ainda não representa um sync inicial executado em produção. O agregador `npm run sync` não inclui assembleias.

O build Astro gera `/assembleias` e `/assembleias/<slug>` a partir do snapshot, ordenando da data prevista mais recente para a mais antiga. Canceladas permanecem visíveis. O loader repete a validação estrita das URLs e descarta um snapshot inválido. Detalhes incluem resumo, Discussion, data efetiva e, quando existentes, PDF e metadados cartorários, além de OG/JSON-LD. `notaryRegistry.registeredAt` é exibido como data civil em UTC, enquanto `scheduledAt` e `heldAt` continuam formatados em `America/Sao_Paulo`. Snapshot ausente ou inválido produz fallback vazio; dados novos exigem sync e novo build.

`/admin/assembleias` usa ilha React/MUI, `useAuth`, `authFetch`, erros visíveis e paginação compartilhada. Diretores não veem nem enviam campos de cartório; a API continua sendo a fronteira de autorização. Filtros, transições, estados de erro e navegação por teclado dos diálogos têm testes.

## Operação e release

A sequência operacional segura é:

1. criar a categoria **Assembleias** em `codaqui/institucional`, obter seu ID por GraphQL e configurar `PUBLIC_GISCUS_ASSEMBLIES_CATEGORY_ID` como Variable do GitHub Actions e nos ambientes locais necessários;
2. coordenar o próximo número por tipo, criar a Discussion com o pathname exato e cadastrar a assembleia imediatamente, conferindo o slug retornado;
3. manter narrativa e comentários na Discussion e somente o resumo no registro;
4. para oficial realizada, um admin informa `heldAt`, PDF externo válido e cartório completo;
5. após publicação do backend e migration 036, executar o sync inicial e publicar o frontend; alterações posteriores dependem do próximo sync e build;
6. criar Discussions reais das fixtures de validação e verificar no HTML/navegador o Giscus carregado com `pathname` e a categoria correta antes de marcar a jornada externa como concluída.

O rollback da migration 036 remove a tabela `assemblies` e seus dados. Só deve ser ensaiado em banco descartável; não é uma operação neutra em produção.

## Consequências e limites

- O banco permanece fino e auditável, mas a disponibilidade e retenção da narrativa/comentários passam a depender também do GitHub.
- A conferência de categoria/título e a coordenação entre número e Discussion são manuais; não há GitHub App nem reconciliação automática.
- O snapshot introduz defasagem entre API e site e exige publicação na ordem backend → sync → frontend.
- A categoria Assembleias, seu ID e qualquer Discussion real não foram criados durante a implementação. O fallback estático foi validado; o carregamento real do Giscus não foi.
- Migration 036 down/up, concorrência de criação, API, snapshot, páginas estáticas e limpeza de fixtures foram validados localmente na Task 6. Os quatro gates passaram nesse HEAD de implementação.
- Release/publicação, PR/CI externo, relatório Sonar, sync inicial e validação real em produção permanecem pendentes. Nenhum desses itens é declarado concluído por esta ADR.

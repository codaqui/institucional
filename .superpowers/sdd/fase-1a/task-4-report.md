<!-- AGENT-INDEX
purpose: Relatório de implementação, evidências RED/GREEN, verificação e auto-revisão da Task 4 da Fase 1a.
audience: Mantenedores e agentes revisando comunidades, seed histórico, selo e validação de checkout.
status: implementação e testes concluídos.
sections:
  - Implementação
  - Arquivos
  - Evidências RED/GREEN
  - Testes completos
  - Auto-revisão
  - Preocupações
related-docs:
  - .superpowers/sdd/fase-1a/task-4-brief.md — requisitos e comandos da task.
  - docs/plans/codaqui-1-0/fase-1a.md — plano com os passos da Task 4 marcados.
agent-protocol:
  - Comunidades usam somente Parceira/Integrada; responsible @ community permanece em member_designations.
  - Não antecipar Autônoma, D2, split, maintainer, payout, platformFeePct, isActive ou responsibleMemberId.
-->

# Task 4 — Comunidades, seed completo e checkout validado

## Implementação

- Criado `scripts/export-community-seed.mjs` para transformar os seis registros canônicos de `frontend/src/data/communities.ts` no seed JSON do backend.
- Seed gerado pelo script com seis comunidades e preservação de `name`, `description`, `emoji`, `logo`, `location`, `founded`, `links`, `socialProfiles` e `tags`.
- `devparana`, `elasnocodigo`, `tisocial` e `campostechpg` nascem Integradas; `cloudnativemaringa` e `cumbucadev` nascem Parceiras.
- Somente DevParaná, Elas no Código e TI Social têm `siteEnabled=true` e seus domínios históricos. CamposTech permanece Integrada com `siteEnabled=false` e `siteDomain=null`.
- Criada a migration `028` com colunas explícitas para os dados centrais, `jsonb` para `links`/`socialProfiles`, `text[]` para `tags`, constraints para lifecycle/níveis/selo e seed idempotente via `ON CONFLICT ("slug") DO NOTHING`.
- A migration só inclui `sealGrantedAt`, `sealGrantedById`, `sealValidUntil` e `sealNotes` no insert quando o dado existe. Após o seed, consulta e reporta por `Logger.warn` as Integradas sem responsible ativo, sem fabricar vínculos e sem falhar.
- O build Nest copia o seed para `dist/communities/seed/communities.json`, permitindo que a migration compilada o leia também na imagem de produção.
- Criados entidade, módulo, controller, service e DTOs de create/update/listagem/selo. Não existem colunas ou campos `responsibleMemberId`, `maintainer*`, `payout*`, `platformFeePct` ou `isActive`; o nível Autônoma não foi introduzido.
- `GET /communities/public` lista somente comunidades ativas, preserva o shape legado (`id` igual ao slug e `logo` derivado de `logoUrl`) e acrescenta nível, lifecycle, selo, site e responsible público resolvido por designation.
- `GET /communities/manage` é admin, aceita busca server-side e retorna o envelope paginado padrão com default 50 e cap 100.
- `POST /communities` é admin e usa slug único. `PATCH /communities/:id` e `POST /communities/:id/seal/request` usam `JwtAuthGuard` + `DesignationsGuard` com `responsible @ community`; admin continua permitido pelo guard existente.
- `POST /communities/:id/seal` é admin e exige uma designation responsible ativa para a comunidade. O service usa `DesignationsService.hasDesignation` e não depende da leitura do perfil público para validar o vínculo.
- A concessão registra avaliação manual em `sealNotes`, ator/data do selo, validade explícita somente se futura ou default de um ano, e audit `community.seal_granted`.
- O checkout valida todo `communityId` direcionado com `findActiveForDonations`, que só encontra `status=active` + `level=integrada`. Parceira, desconhecida, suspensa ou inativa é recusada antes de chamar Stripe.
- O destino legado `tesouro-geral` preserva doações gerais sem consulta ao registro. A obrigatoriedade anterior de `communityId` permanece inalterada. CamposTech continua aceito por ser Integrada ativa, independentemente de `siteEnabled=false`.
- Proxy recebeu somente `/communities/`; `/admin/comunidades`, `/comunidades/*` e falsos positivos como `/communitiesxyz` continuam fora da allow-list.

## Arquivos

### Seed, testes de seed e build

- `scripts/export-community-seed.mjs` — gerador do seed histórico.
- `scripts/export-community-seed.test.mjs` — três testes de contagem, fidelidade, níveis, tenants e campos proibidos.
- `backend/src/communities/seed/communities.json` — seed gerado pelo script.
- `backend/nest-cli.json` — cópia do JSON como asset do build.

### Backend

- `backend/src/migrations/1793289602000-Migration028_Communities.ts` — schema, seed idempotente e pendências de governança.
- `backend/src/communities/entities/community.entity.ts` — entidade restrita ao escopo da fase.
- `backend/src/communities/dto/create-community.dto.ts` — validação de criação e níveis/lifecycle permitidos.
- `backend/src/communities/dto/update-community.dto.ts` — update parcial.
- `backend/src/communities/dto/list-communities.dto.ts` — busca e paginação validada.
- `backend/src/communities/dto/seal-community.dto.ts` — validade opcional e avaliação manual obrigatória.
- `backend/src/communities/communities.service.ts` — listagens, CRUD, responsible, selo e destinos de doação.
- `backend/src/communities/communities.controller.ts` — APIs públicas/gestão fora de `/admin/`.
- `backend/src/communities/communities.module.ts` — wiring TypeORM, DesignationsModule e AuditModule.
- `backend/src/communities/communities.service.spec.ts` — 12 testes de comportamento.
- `backend/src/stripe/stripe.controller.ts` — validação do destino antes do checkout.
- `backend/src/stripe/stripe.controller.spec.ts` — testes de Parceira, destino inválido, CamposTech e tesouro geral.
- `backend/src/stripe/stripe.module.ts` — injeção do CommunitiesModule.
- `backend/src/audit/entities/audit-log.entity.ts` — ação `community.seal_granted`.
- `backend/src/app.module.ts` — registro do CommunitiesModule.

### Frontend, planejamento e relatório

- `frontend/src/lib/api-proxy-paths.ts` — prefixo estreito `/communities/`.
- `frontend/src/lib/api-proxy-paths.test.ts` — cobertura do prefixo e não colisão com páginas.
- `docs/plans/codaqui-1-0/fase-1a.md` — somente os passos 1–5 da Task 4 marcados.
- `.superpowers/sdd/fase-1a/task-4-report.md` — este relatório.

## Evidências RED/GREEN

### RED — backend de selo e checkout

Comando:

```bash
cd backend && npx jest src/communities src/stripe/stripe.controller.spec.ts --runInBand
```

Resultado inicial: **FAIL**, 2 suites e 0 testes executados, pelos motivos esperados:

```text
Cannot find module './entities/community.entity' from 'communities/communities.service.spec.ts'
Cannot find module '../communities/communities.service' from 'stripe/stripe.controller.spec.ts'
Test Suites: 2 failed, 2 total
Tests:       0 total
```

### RED — seed

Comando:

```bash
node --test scripts/export-community-seed.test.mjs
```

Resultado inicial: **FAIL**, 0/3, com `ENOENT` para `backend/src/communities/seed/communities.json`, confirmando que os testes exigem o artefato ainda inexistente.

### GREEN — seed

Comandos:

```bash
node scripts/export-community-seed.mjs
node --test scripts/export-community-seed.test.mjs
```

Resultado:

```text
✔ preserves all six historical communities and their public data
✔ marks four integrated communities and preserves tenant enablement
✔ does not introduce future community fields
tests 3
pass 3
fail 0
```

### RED/GREEN — proxy

Antes de adicionar `/communities/`:

```bash
cd frontend && npx vitest run src/lib/api-proxy-paths.test.ts
```

```text
FAIL src/lib/api-proxy-paths.test.ts
expected false to be true // isApiProxyPath("/communities")
Tests: 1 failed | 13 passed
```

Depois da alteração:

```text
Test Files  1 passed (1)
Tests       14 passed (14)
```

### Primeiro GREEN parcial e correção orientada por teste

A primeira execução após a implementação obteve PASS no checkout e nas designations, mas dois testes de selo falharam:

```text
BadRequestException: A comunidade precisa de um responsável ativo para receber o selo.
Test Suites: 1 failed, 3 passed, 4 total
Tests:       2 failed, 55 passed, 57 total
```

Causa confirmada: `grantSeal` usava o método que também resolve o perfil público do membro; sem esse retorno no mock, a designation ativa era descartada. Correção mínima: separar `findActiveResponsibleDesignation` da serialização pública e usar somente o vínculo ativo na concessão. Os testes não foram enfraquecidos.

### GREEN — focado final

Comando do brief:

```bash
cd backend && npx jest src/communities src/stripe/stripe.controller.spec.ts src/designations --runInBand
```

Resultado:

```text
PASS src/communities/communities.service.spec.ts
PASS src/stripe/stripe.controller.spec.ts
PASS src/designations/designations.controller.spec.ts
PASS src/designations/designations.service.spec.ts
Test Suites: 4 passed, 4 total
Tests:       57 passed, 57 total
Snapshots:   0 total
```

A cobertura inclui slug duplicado, defaults sem campos futuros, paginação, update, shape público/responsible, solicitação e concessão de selo, validade default/explícita/passada, ausência de responsible, Parceira/destino inválido, CamposTech e tesouro geral.

## Testes completos

### Backend

Comando final, repetido após a formatação:

```bash
cd backend && npm run build && npx jest --silent
```

Resultado: **PASS**.

```text
Test Suites: 44 passed, 44 total
Tests:       821 passed, 821 total
Snapshots:   0 total
```

O `nest build` passou e o seed foi confirmado em `backend/dist/communities/seed/communities.json`. Os logs de erro durante o Jest pertencem aos cenários de falha simulados já existentes; nenhuma suite falhou.

### Scripts

```bash
npm run test:scripts
```

Resultado: **PASS**, **46/46 testes**, incluindo os três novos testes do seed.

### Frontend focado

```bash
cd frontend && npx vitest run src/lib/api-proxy-paths.test.ts
```

Resultado: **PASS**, 1 arquivo e **14/14 testes**.

### Formatação e diff

```bash
cd backend && npx prettier --check src/communities/*.ts src/communities/dto/*.ts src/communities/entities/*.ts src/migrations/1793289602000-Migration028_Communities.ts src/stripe/stripe.controller.ts src/stripe/stripe.controller.spec.ts src/stripe/stripe.module.ts src/app.module.ts src/audit/entities/audit-log.entity.ts
```

Resultado: **PASS**, todos os arquivos TypeScript verificados seguem o Prettier. O JSON gerado permanece no formato determinístico do script, sem formatação manual divergente.

`git diff --check` também passou sem erros de whitespace.

## Auto-revisão

- Os seis registros históricos foram preservados e comparados campo a campo com a fonte canônica nos testes.
- Há exatamente quatro Integradas e duas Parceiras; os três tenants e CamposTech seguem os valores exigidos.
- A tabela e a entidade não têm vínculo paralelo de responsible nem campos de mantenedor, payout, taxa ou `isActive`.
- Responsible é validado pela designation existente; o guard e o service são reutilizados sem nova fonte de vínculo.
- O selo tem avaliação manual, validade futura/default anual e audit de governo.
- O checkout geral preserva `tesouro-geral`; doações direcionadas só passam para Integrada ativa; CamposTech está coberto por teste específico.
- As APIs usam `/communities`, fora de `/admin/`; o proxy não intercepta páginas administrativas ou públicas do site.
- A listagem de gestão usa DTO validado e envelope padrão.
- Não foram alterados snapshots, dados gerados fora do seed solicitado, conteúdo canônico, versão do backend ou workflows.
- Nenhum segredo foi adicionado; os testes usam apenas valores fictícios.
- `.ui-sweep.tmp.mjs` é arquivo pré-existente e não faz parte do trabalho nem do commit.

## Preocupações

- A migration não foi executada contra PostgreSQL nesta task; a validação foi por testes unitários, compilação e conferência do asset no build. O aviso real das quatro pendências será emitido na execução da migration.
- Não houve chamada externa à Stripe nem exercício HTTP end-to-end com banco/edge local; a compatibilidade do checkout foi verificada nos testes reais do controller com StripeService mockado, sem efeitos externos.
- Doações legadas que usem outro identificador especial além de `tesouro-geral` passarão a ser recusadas, como exige a validação de destino; nenhum outro identificador especial foi encontrado no fluxo atual de doações.

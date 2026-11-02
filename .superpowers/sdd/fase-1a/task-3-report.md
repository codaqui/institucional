<!-- AGENT-INDEX
purpose: Relatório de implementação, evidências RED/GREEN, verificação e auto-revisão da Task 3 da Fase 1a.
audience: Mantenedores e agentes revisando diretorias com escopo por designation.
status: implementação e testes concluídos.
sections:
  - Implementação
  - Arquivos
  - Evidências RED/GREEN
  - Testes completos
  - Auto-revisão
  - Preocupações
related-docs:
  - .superpowers/sdd/fase-1a/task-3-brief.md — requisitos e comandos da task.
  - docs/plans/codaqui-1-0/fase-1a.md — plano com os passos da Task 3 marcados.
agent-protocol:
  - Não criar directorMemberId nem directorate_members; vínculos continuam em member_designations.
-->

# Task 3 — Diretorias sem colunas de vínculo

## Implementação

- Criada a migration `027` com a tabela `directorates` contendo somente `id`, `slug`, `name`, `description`, `isActive`, `createdAt` e `updatedAt`; `slug` é único.
- Criados entidade, módulo, controller, service e DTOs de create/update/listagem.
- `GET /directorates/public` retorna somente diretorias ativas.
- `GET /directorates/manage` exige `admin` ou `diretor`, aceita busca server-side e usa paginação padrão com `limit=50`, cap de 100 e envelope `{data,total,page,totalPages,limit}`.
- `POST /directorates` é restrito a admin.
- `PATCH /directorates/:id` usa `DesignationsGuard` e repete a verificação no service: admin pode editar; diretor somente com designation `director` ativa para a mesma diretoria. Fora de escopo, lança `ForbiddenException`.
- Não foram criados `directorMemberId`, `directorate_members` ou qualquer vínculo paralelo. Diretor e voluntário são concedidos pelo `POST /designations` da Task 2.
- Criada a página fina `/admin/diretorias` com `AppLayout`, `noindex` e ilha `client:only="react"`.
- A ilha MUI implementa listagem, busca, paginação compartilhada, criação, edição, ativação/desativação e concessão de diretor/voluntário. Todas as escritas pedem confirmação e, após sucesso, executam `refresh()` das designations.
- Formulários possuem labels, campos obrigatórios identificados, validação somente após blur/submit, limpeza do erro ao corrigir e foco no primeiro campo inválido. Erros de API usam `Alert` e `extractErrorMessage`.
- Proxy recebeu somente o prefixo `/directorates/`; `/admin/diretorias` continua fora da allow-list.
- Corrigida a tipagem da verificação de admin para usar `MemberRole.ADMIN`, compatível com `JwtPayload.roles`.

## Arquivos

### Backend

- `backend/src/migrations/1793289601000-Migration027_Directorates.ts` — nova migration.
- `backend/src/directorates/entities/directorate.entity.ts` — entidade sem colunas de vínculo.
- `backend/src/directorates/dto/create-directorate.dto.ts` — validação de criação.
- `backend/src/directorates/dto/update-directorate.dto.ts` — update parcial.
- `backend/src/directorates/dto/list-directorates.dto.ts` — paginação e busca.
- `backend/src/directorates/directorates.service.ts` — listagens, create/update, slug único e escopo por designation.
- `backend/src/directorates/directorates.controller.ts` — endpoints e guards.
- `backend/src/directorates/directorates.module.ts` — wiring TypeORM e DesignationsModule.
- `backend/src/directorates/directorates.service.spec.ts` — 9 testes de comportamento.
- `backend/src/app.module.ts` — registro do módulo.

### Frontend

- `frontend/src/pages/admin/diretorias.astro` — página administrativa fina.
- `frontend/src/components/islands/admin/directorates/DirectoratesAdminApp.tsx` — ilha administrativa.
- `frontend/src/components/islands/admin/directorates/DirectoratesAdminApp.test.tsx` — 7 testes da ilha.
- `frontend/src/lib/api-proxy-paths.ts` — prefixo estreito da API.
- `frontend/src/lib/api-proxy-paths.test.ts` — cobertura de `/directorates` e exclusão da página admin.

### Planejamento e relatório

- `docs/plans/codaqui-1-0/fase-1a.md` — somente os passos 1–5 da Task 3 marcados.
- `.superpowers/sdd/fase-1a/task-3-report.md` — este relatório.

## Evidências RED/GREEN

### RED — service

Comando:

```bash
cd backend && npx jest src/directorates --runInBand
```

Resultado inicial: **FAIL**, 1 suite, 0 testes executados, com o motivo esperado:

```text
Cannot find module './directorates.service' from 'directorates/directorates.service.spec.ts'
```

### GREEN — service

Após implementar entidade, DTOs e service:

```bash
cd backend && npx jest src/directorates --runInBand
```

Resultado: **PASS**, 1 suite, **9/9 testes**. Cobriu listagem pública ativa, busca e envelope, cap de 100, slug duplicado, admin, diretor na própria diretoria, 403 fora de escopo e recurso inexistente.

### RED — ilha

Comando:

```bash
cd frontend && npx vitest run src/components/islands/admin/directorates/DirectoratesAdminApp.test.tsx
```

Resultado inicial: **FAIL**, sem coleta dos testes, pelo motivo esperado:

```text
Failed to resolve import "./DirectoratesAdminApp"
```

### GREEN — ilha

Após implementar a ilha, a primeira execução obteve 6/7; a consulta do campo obrigatório foi ajustada para aceitar o indicador `*` e os atributos MUI foram migrados de `inputProps` para `slotProps.htmlInput`. Resultado posterior:

```text
Test Files  1 passed (1)
Tests       7 passed (7)
```

Os testes cobrem limit 50, busca server-side, paginação, validação após interação/submit, confirmação e refresh, erro via Alert e concessão por `/designations`.

### RED/GREEN — proxy

O novo caso de proxy falhou antes da alteração:

```text
FAIL src/lib/api-proxy-paths.test.ts
expected false to be true // isApiProxyPath("/directorates")
Tests: 1 failed | 12 passed
```

Depois de adicionar somente `/directorates/`:

```text
Test Files  1 passed (1)
Tests       13 passed (13)
```

### Testes focados combinados

```bash
cd backend && npx jest src/directorates src/designations --runInBand
```

Resultado: **PASS**, 3 suites, **35/35 testes**.

```bash
cd frontend && npx vitest run src/components/islands/admin/directorates
```

A ilha chegou a 7/7, mas repetições do arquivo completo apresentaram timeout intermitente no teste de criação; o mesmo teste passou isolado e em execução com o teste de validação. Nenhuma falha de asserção ou comportamento foi encontrada. A suíte frontend completa posterior passou, conforme registrado abaixo.

## Erro de build e correção

O primeiro build completo encontrou:

```text
backend/src/directorates/directorates.service.ts:74
TS2345: Argument of type '"admin"' is not assignable to parameter of type 'MemberRole'
```

Correção mínima: importar `MemberRole` da entidade existente e usar `user.roles.includes(MemberRole.ADMIN)`. Não houve alteração de comportamento nem mudança adicional de escopo.

## Testes completos

### Backend

Comando final:

```bash
cd backend && npm run build && npx jest --silent
```

Resultado: **PASS**.

```text
Test Suites: 43 passed, 43 total
Tests:       805 passed, 805 total
Snapshots:   0 total
```

O `nest build` também passou após a correção de `MemberRole.ADMIN`. Os logs de erros simulados durante os testes pertencem aos cenários de falha já existentes e não representam suites quebradas.

### Frontend

Comando:

```bash
cd frontend && npm run test
```

Resultado da execução final: **PASS**, **67 arquivos e 633 testes**.

## Auto-revisão

- As APIs usam `/directorates`, fora de `/admin/`.
- O proxy não intercepta `/admin/diretorias` nem aceita `/directoratesxyz`.
- A tabela e a entidade não possuem vínculo de diretor/voluntário; `member_designations` permanece como fonte única.
- A autorização de edição existe no controller/guard e no service, evitando depender apenas da camada HTTP.
- A listagem segue DTO com transformação/validação, envelope padrão, constante frontend e `PaginationControls`.
- A página usa `AppLayout` e a ilha segue o padrão `client:only="react"`.
- Escritas têm confirmação, tratamento de erro e refresh das designations.
- Não foram alterados dados, snapshots, conteúdo gerado ou versão do backend.
- `.ui-sweep.tmp.mjs` é arquivo pré-existente e não faz parte do trabalho nem do commit.

## Preocupações

- O teste de criação da ilha mostrou timeout intermitente em execuções focadas repetidas, embora passasse isoladamente e a suíte completa tenha passado com 633/633. Vale observar recorrência em CI; não foi aplicado aumento de timeout nem alteração fora do escopo.
- A migration não foi executada contra PostgreSQL nesta task; a validação realizada foi por testes unitários e compilação. Não houve exercício end-to-end com banco ou edge local.

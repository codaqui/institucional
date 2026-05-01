<!-- AGENT-INDEX
purpose: Plano de upgrades majors de dependências do monorepo Codaqui.
audience: Mantenedores e AI agents executando upgrades de libs.
status: planning — atualizar status conforme cada item for executado.
sections:
  - Estado atual (versões instaladas vs latest)
  - Vulnerabilities pendentes (transitivas)
  - Plano de execução (ordem sugerida)
  - Stripe SDK 21 → 22
  - ESLint 9 → 10 + class-validator 0.14 → 0.15
  - MUI 7 → 9 (skipped v8)
  - TypeScript 5.x → 6
  - Critérios de pronto
related-docs:
  - AGENTS.md — patterns + anti-patterns
  - DEVELOPMENT.md — comandos npm/typecheck/build
  - backend/README.md — módulos backend
agent-protocol:
  - Cada bloco abaixo é um upgrade independente. Execute em ordem; não bundle dois majors no mesmo PR.
  - Atualize "Status" no topo de cada seção quando começar/terminar.
  - Após qualquer upgrade, RODE típecheck + build + jest em ambos repos antes de commitar.
-->

# UPDATE_PLAN.md — Major Dependency Upgrades

Plano consolidado de upgrades majors pendentes no monorepo. Patches semver-minor (ex: 3.10.0 → 3.10.1, 11.1.17 → 11.1.19) já foram aplicados via `npm update` em ambos workspaces — este plano cobre apenas as **mudanças com breaking changes**.

> **Princípio**: 1 major por PR. Janela dedicada para validação manual em ambiente de homologação antes de produção.

---

## Estado Atual

Snapshot do `npm outdated` (referência — verificar antes de cada execução):

### Frontend (`/`)

| Pacote | Instalado | Latest | Diff |
|--------|-----------|--------|------|
| `@mui/material` | 7.3.10 | 9.0.0 | **major** (v8 pulado) |
| `@mui/icons-material` | 7.3.10 | 9.0.0 | **major** |
| `@mui/lab` | 7.0.1-beta.24 | 9.0.0-beta.2 | **major** |
| `typescript` | 5.6.3 | 6.0.3 | **major** |
| (Docusaurus, React, Stripe-JS) | — | — | em dia ✅ |

### Backend (`/backend`)

| Pacote | Instalado | Latest | Diff |
|--------|-----------|--------|------|
| `stripe` | 21.0.1 | 22.1.0 | **major** |
| `typescript` | 5.9.3 | 6.0.3 | **major** |
| `eslint` | 9.39.4 | 10.3.0 | **major** |
| `@eslint/js` | 9.39.4 | 10.0.1 | **major** |
| `class-validator` | 0.14.4 | 0.15.1 | **major** (semver pré-1.0) |
| (NestJS, swagger, schematics) | — | — | em dia ✅ |

---

## Vulnerabilities Pendentes (não acionar agora)

| Pacote | Severity | Origem | Estratégia |
|--------|----------|--------|-----------|
| `DOMPurify` (4 advisories) | moderate | transitivo via `@docusaurus/theme-common` | aguardar release Docusaurus |
| `uuid <14` (frontend) | moderate | transitivo via `@docusaurus/core` | aguardar release Docusaurus |
| `uuid <14` (backend) | moderate | transitivo via `typeorm 0.3.x` | aguardar release TypeORM |

> ⚠️ `npm audit fix --force` força downgrade de Docusaurus/TypeORM e quebra o build. **Não execute.**

---

## Ordem de Execução Sugerida

| # | Upgrade | Risco | Esforço | Bloqueio |
|---|---------|-------|---------|----------|
| 1 | Stripe SDK 21 → 22 | 🟢 baixo (escopo isolado) | 2-4h | nenhum |
| 2 | ESLint 9 → 10 + class-validator 0.15 (juntos) | 🟢 baixo | 1-2h | nenhum |
| 3 | MUI 7 → 9 (skipped v8) | 🟡 médio | 1-2 dias | janela dedicada |
| 4 | TypeScript 5.x → 6 (frontend + backend) | 🟡 médio | 2-4h | aguardar Docusaurus declarar suporte oficial a TS 6 |

---

## 1. Stripe SDK 21 → 22

**Status:** pendente

### Motivação
Continuar recebendo updates de segurança e novas features da API Stripe. v22 mantém a mesma API version (`2026-03-25.dahlia`), então **não há mudança de payload no webhook nem no Checkout** — é só upgrade de SDK.

### Escopo de arquivos afetados
- `backend/src/stripe/stripe.service.ts` — `createCheckoutSession`, `handleWebhookEvent`, refund flow
- `backend/src/stripe/stripe.controller.ts` — handlers
- `backend/src/stripe/stripe.service.spec.ts` — mocks Stripe

### Breaking changes que nos atingem

1. **Argumentos extras lançam erro em runtime** (antes eram silenciosamente ignorados)
   - Auditar todas chamadas: `stripe.checkout.sessions.create(...)`, `stripe.refunds.create(...)`, `stripe.customers.retrieve(...)`, `stripe.subscriptions.cancel(...)`, `stripe.webhooks.constructEvent(...)`.
   - Garantir que cada chamada passa **só** os argumentos previstos pela assinatura tipada.

2. **Tipos**
   - `Stripe.StripeContext` → `Stripe.StripeContextType` (verificar uso — provavelmente não usamos diretamente).
   - `Stripe.errors.StripeError` agora é o **construtor**, não a instância. Para tipar instância: `InstanceType<typeof Stripe.errors.StripeError>` ou `Stripe.ErrorType`.
   - Diretório `types/` removido — remover qualquer `/// <reference types="stripe/types" />`.

3. **Node ≥18** — já temos ≥24 ✅

### Passo-a-passo

```bash
cd backend
npm install stripe@22
npm run build
npx jest src/stripe --silent
```

- Se TS reclamar de tipos `StripeError`, refatorar usando `Stripe.ErrorType`.
- Se runtime reclamar de "extra argument", remover argumento extra ou colocar dentro do options object correto.
- Testar webhook localmente com Stripe CLI (ver `DEVELOPMENT.md#backend-nestjs`).

### Critério de pronto
- [ ] `npm run build` passa.
- [ ] `npx jest src/stripe --silent` 100% verde.
- [ ] Teste manual end-to-end em homologação: doação one-shot, doação recorrente, refund.
- [ ] Atualizar **AGENTS.md** § Backend Tech Stack: "Stripe SDK 21" → "Stripe SDK 22".
- [ ] Atualizar **backend/README.md** mesma linha.

---

## 2. ESLint 9 → 10 + class-validator 0.14 → 0.15 (juntos)

**Status:** pendente

### Motivação
Mudanças triviais; juntar num PR pequeno. Nem ESLint 10 nem class-validator 0.15 introduzem breaking changes que afetem nossas regras/DTOs.

### Escopo
- `backend/eslint.config.mjs` (já flat config em ESLint 9)
- `backend/src/**/*.dto.ts` — possíveis mensagens/decorators

### Passo-a-passo

```bash
cd backend
npm install --save-dev eslint@10 @eslint/js@10
npm install class-validator@0.15
npm run lint && npm run build && npx jest --silent
```

### Pontos de atenção
- ESLint 10 mantém flat config (não há mudança estrutural).
- class-validator 0.15: nenhum decorator que usamos foi removido. As mensagens default mudaram em alguns; só impacta se você tem teste assertando mensagem exata (não temos).

### Critério de pronto
- [ ] `npm run lint` sem erros novos.
- [ ] `npm run build` + `npx jest --silent` verde.

---

## 3. MUI 7 → 9 (skipped v8)

**Status:** pendente — janela dedicada

### Motivação
v9 alinha versionamento com MUI X (Data Grid, Pickers). v7 ainda recebe patches mas a evolução de DX e perf está em v9 (sx prop ~30% mais rápido, Color-mix theming, novos componentes `NumberField` / `Menubar`).

### Browser baseline (importante)
v9 sobe baseline para: **Chrome 117+ · Firefox 121+ · Safari 17+ · Edge 121+**. Verificar se há restrição de público (jovens em equipamentos antigos).

### Escopo de arquivos afetados (mais relevantes)
- `src/theme/Root.tsx` + `src/theme/muiTheme.ts` (provider)
- Todas páginas em `src/pages/admin/*` (uso pesado de Autocomplete)
- `src/components/TransactionDetailDialog/*`
- `src/components/TransactionTable/*`
- Páginas e cards em `src/pages/**` (Grid, Card, Chip)

### Plano de execução

```bash
# 1. Codemod automatizado (resolve ~80%)
npx @mui/codemod@latest v9.0.0/preset-safe src/

# 2. Upgrade dos pacotes
npm install @mui/material@^9 @mui/icons-material@^9 @mui/lab@^9.0.0-beta

# 3. Validar
npm run typecheck
npm run build
npx jest --silent
```

### Breaking changes que provavelmente nos atingem

| Componente | Mudança | Onde olhar |
|-----------|---------|------------|
| `Autocomplete` | tipagem `freeSolo` mudou; right-click não toggle mais | `/admin/pagamentos`, `/admin/recebimentos`, `/admin/lancamento` |
| `ButtonBase` | Enter/Space → `MouseEvent` em vez de `KeyboardEvent` | qualquer `onKeyDown` custom em IconButton |
| `Backdrop` | sem `aria-hidden=true` por padrão | revisar testes a11y |
| `ListItemIcon` | spacing usa theme spacing (antes hardcoded) | menus/listas |
| `TablePagination` | locale formatting diferente | `TransactionTable` |
| Props deprecated em v7 | **removidas em v9** | rodar codemod resolve a maioria |

### Critério de pronto
- [ ] Codemod aplicado e commit isolado ("chore: apply MUI v9 codemod").
- [ ] Upgrade dos pacotes em commit separado ("chore: upgrade MUI 7 → 9").
- [ ] `npm run typecheck` + `npm run build` passam.
- [ ] Teste manual em **todas** páginas admin (autocompletes especialmente).
- [ ] Teste manual em mobile (Chrome 117+, Safari 17+).
- [ ] Atualizar **AGENTS.md** § Frontend Tech Stack: "MUI v7" → "MUI v9".
- [ ] Atualizar exemplos no **AGENTS.md** se houver mudança em padrões (Grid `size={...}` continua igual ✅).
- [ ] Verificar se `MUI v9 Grid API` mantém o ant-pattern atual ou precisa atualizar a tabela.

### Notas
- Grid `size={{ xs, sm, md }}` introduzido em MUI v7 **continua válido em v9** — não vira anti-pattern.
- O nome `Grid` (sem `Grid2`) já é o unificado, mantém em v9.

---

## 4. TypeScript 5.x → 6 (frontend e backend)

**Status:** ⏸️ **bloqueado** — aguardar Docusaurus declarar suporte oficial a TS 6

### Motivação
TS 6 traz melhorias de performance no compiler e novos lints, mas a quebra principal está em alinhamento com `lib.dom.d.ts` mais estrito.

### Bloqueio
- `@docusaurus/tsconfig` 3.10.1 ainda foi compilado com TS 5.x. Subir o frontend para TS 6 sem suporte do Docusaurus pode gerar incompatibilidades silenciosas.
- Acompanhar: https://github.com/facebook/docusaurus/issues (filtrar por "typescript 6").

### Quando desbloquear
- Backend: pode subir TS 6 antes do frontend (não depende de Docusaurus). Avaliar quando os outros majors estiverem estabilizados.
- Frontend: subir só quando Docusaurus 3.x ou 4.x declarar suporte explícito.

### Critério de pronto (quando desbloquear)
- [ ] `npm run typecheck` passa em ambos workspaces.
- [ ] `npm run build` passa em ambos.
- [ ] Atualizar **AGENTS.md** e **backend/README.md** com nova versão.

---

## Critérios de Pronto Globais (após cada item)

Toda conclusão de major exige:

1. ✅ `npm run typecheck` (frontend) sem erros.
2. ✅ `npm run build` (frontend) sem erros.
3. ✅ `cd backend && npm run build && npx jest --silent` 100% verde.
4. ✅ `npm run lint` (backend) sem novos erros.
5. ✅ Teste manual em homologação cobrindo o módulo afetado.
6. ✅ Documentação atualizada (AGENTS.md, backend/README.md, este UPDATE_PLAN.md com status).
7. ✅ PR isolado com mensagem `chore(deps): upgrade <pkg> <de> → <para>`.
8. ✅ Cross-check no SonarCloud Quality Gate.

---

## Histórico de Execução

| Data | Item | Quem | Notas |
|------|------|------|-------|
| _(preencher conforme executar)_ | | | |

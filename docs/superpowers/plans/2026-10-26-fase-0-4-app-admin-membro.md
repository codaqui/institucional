# Fase 0.4 — App (admin/membro) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar todas as páginas app autenticadas do Docusaurus para o Astro — `/admin/*` (~14 páginas), `/membro/*` (monólito + subpáginas), `/membros/empresa`, `/eventos/comprovante` e o check-in — como ilhas React `client:only="react"` dentro de um `AppLayout` real, com testes Vitest + Testing Library e fluxos authFetch/401 cobertos.

**Architecture:** Páginas `.astro` mínimas (shell + SEO noindex) que montam uma ilha React por página via `client:only="react"` — SSR não se aplica a apps que dependem de `window`/auth. `AppLayout` novo: app-shell autenticado com sidebar de navegação (desktop) / drawer (mobile) replicando a estrutura de hubs do Docusaurus, topbar com identidade do usuário. Componentes compartilhados não portados (`ModalConfirm`, `SelectableCard` etc.) viram módulos em `frontend/src/components/islands/`. Lib de auth consumida pelas ilhas: `frontend/src/lib/auth-client.ts` + `use-auth.ts` (portados na 0.3) — mesmo contrato de cookie httpOnly, 401 → logout automático.

**Tech Stack:** Astro 7.4, React 19 (ilhas `client:only`), MUI v9 (componentes app), Tailwind v4 (shell `.astro`), tokens `--cq-*` do Design System, Vitest + Testing Library (novo — testes de ilhas), `qrcode.react` (já presente).

**Spec:** `docs/plans/codaqui-1-0/refatoracao-frontend-astro.md` (linha 0.4 da tabela de fases: "AppLayout + todas as `/admin/*` + `/membro/*` + check-in como ilhas `client:only` — Paridade funcional; testes das ilhas (Vitest + Testing Library) verdes; fluxos authFetch/401 cobertos"; mapa de rotas: "`/membro/*`, `/admin/*` → idem, com `AppLayout` real — ilhas `client:only=\"react\"`"; tabela de hidratação).

## Global Constraints

- Trabalho na branch `develop`, direto na raiz do repo (sem worktree) — ruling das fases 0.1–0.3.
- **Não modificar** nada do Docusaurus fora de `frontend/` — exceções permitidas: `Makefile`, `DEVELOPMENT.md`, `AGENTS.md`, `docs/`.
- Commits em pt-BR, conventional commits, um commit ou mais por task.
- Páginas app replicam o SEO do Docusaurus: title tag (`Admin — Eventos | CODAQUI.dev`, `Área do Membro | CODAQUI.dev`, `Comprovante de compra | CODAQUI.dev` — verificados em `build/`), sem meta robots — **exceto** `/membros/empresa`, que tem `noindex` no original (replicar). O sitemap (`SITEMAP_EXCLUDE` em `astro.config.mjs`) já exclui `/admin/*`, `/membro/*`, `/auth/*`.
- Páginas app: ilha única `client:only="react"` por página; o `.astro` só renderiza shell + `<slot>` de loading/skeleton se houver.
- Nunca hardcode de hex — tokens `--cq-*` / utilities do tema Tailwind / tema MUI nas ilhas.
- Linguagem inclusiva: "participantes", "programa", "Associação"; "SortCoins" é o único nome da moeda; "saldo" sempre qualificado (R$, SortCoins, horas).
- TDD em `frontend/src/lib/`; para ilhas: testes Vitest + Testing Library cobrindo estados de loading/erro/sucesso e o fluxo 401 (authFetch stubado).
- Port de página = ler o fonte Docusaurus e reproduzir comportamento + visual; o arquivo-fonte é o spec. Adaptações obrigatórias: MUI dentro da ilha; componentes puramente apresentacionais podem virar subcomponentes da própria ilha.
- Paridade funcional é o juiz: mesmos endpoints, mesmos estados, mesmos textos. URLs preservadas 1:1 (`/admin/*`, `/membro/*`, `/membros/empresa`, `/eventos/comprovante`).
- O gate `diff-urls.mjs` ganha as seções `/admin`, `/membro` + top-level `membros/empresa`, `eventos/comprovante` no fim da fase (remoção das exclusões correspondentes).

---

## Inventário validado (2026-10-26) — fonte de verdade deste plano

**URLs a migrar** (excluídas hoje do gate, verificadas contra `build/` — todas presentes na referência):

| URL | Fonte Docusaurus | Linhas | Tipo |
|---|---|---|---|
| `/admin` | `src/pages/admin/index.tsx` | 617 | Hub: membros + CRUD papéis |
| `/admin/lancamento` | `lancamento.tsx` | 712 | Lançamento direto + transferências (tabs) |
| `/admin/transferencias` | `transferencias.tsx` | 6 | Redirect → `/admin/lancamento?tab=transferencias` |
| `/admin/reembolsos` | `reembolsos.tsx` | 568 | Fila de aprovação |
| `/admin/fornecedores` | `fornecedores.tsx` | 336 | CRUD vendors |
| `/admin/pagamentos` | `pagamentos.tsx` | 500 | Pagamentos + templates |
| `/admin/recebimentos` | `recebimentos.tsx` | 220 | Recebimentos |
| `/admin/empresas` | `empresas.tsx` | 400 | CLUB Business PJ (ativação) |
| `/admin/sorteios` | `sorteios.tsx` | 445 | CRUD sorteios + sortear |
| `/admin/carteiras` | `carteiras.tsx` | 267 | Histórico SortCoins paginado |
| `/admin/eventos` | `eventos.tsx` | 2.576 | Gestão completa de eventos (substitui a POC read-only) |
| `/admin/overrides` | `overrides.tsx` | 2.202 | Overrides / organizers / ativação externa |
| `/admin/eventos-checkin` | `eventos-checkin.tsx` | 815 | Check-in QR/câmera + manual |
| `/admin/emails` | `emails.tsx` | 384 | Logs + templates de e-mail |
| `/membro` | `membro/index.tsx` | 1.663 | Dashboard (5 tabs) |
| `/membro/editar` | `membro/editar.tsx` | 114 | Form bio + LinkedIn |
| `/membros/empresa` | `membros/empresa.tsx` + `MyCompanySection` | 46 + 1.006 | Conta PJ (noindex) |
| `/eventos/comprovante` | `eventos/comprovante.tsx` | 261 | Recibo autenticado `?order=` |
| `/auth/callback` | — | — | **Upgrade** (não é porte): default return `/` → `/membro`, limpar `COMMUNITY_KEY` |

**Componentes compartilhados a portar** (de `src/components/`; usados pelas páginas acima):

| Componente | Linhas | Usado por |
|---|---|---|
| `AdminNavbar` | 178 | todas as admin (vira `AppNavIsland`, Task 2) |
| `AdminPageContainer` | 19 | maioria das admin (wrapper trivial) |
| `AdminDataTable` | 42 | admin/index, carteiras |
| `ModalConfirm` | 135 | ~10 páginas + membro |
| `TabPanel` | 26 | lancamento, overrides, emails, membro |
| `StatCard` (React) | 75 | emails (Astro só tem `StatCard.astro`) |
| `EmailsTemplatesTab` | 288 | emails |
| `MarkdownLite` | 114 | eventos |
| `EventOrdersDialog` | 712 | eventos, overrides |
| `EventReimbursementDialog` | 234 | eventos, overrides |
| `EventOverrideHistory` | 140 | overrides |
| `VendorTransactionForm` | 292 | pagamentos, recebimentos |
| `VendorTransactionCard` | 122 | pagamentos, recebimentos |
| `MyCompanySection` | 1.006 | membros/empresa |

NÃO precisa portar: `SelectableCard` (só usado pela doação pública, substituído na 0.3), `ApiHealthBanner` (não usado em páginas).

**Deltas de lib já mapeados:**
- `frontend/src/lib/auth-client.ts`/`use-auth.ts`: faltam 4 helpers de role (`isFinanceAnalyzer`, `isEventFinance`, `isEventHost`, `isEventChecker`) — usados por lancamento/reembolsos/empresas.
- Não existe `authFetchHelpers` no Astro — portar `parseAuthJson<T>`/`extractErrorMessage` (`src/hooks/authFetchHelpers.ts`, 61 linhas).
- `qr-scanner ^1.4.2` precisa entrar no `frontend/package.json` (check-in); existe mock de teste em `src/__mocks__/qr-scanner.ts` a migrar.
- Testes existentes (jest, root): `src/pages/admin/__tests__/{emails,empresas,eventos-checkin,eventos,index,lancamento,reembolsos,sorteios}.test.tsx` + `membro/__tests__/index.test.tsx` — serão convertidos para Vitest task a task (deps de teste do root: jest+ts-jest+RTL; no Astro: Vitest+RTL da Task 1).

**Arquitetura de destino das ilhas:**
- Ilhas admin em `frontend/src/components/islands/admin/<nome>/index.tsx`; ilhas do membro em `frontend/src/components/islands/member/`.
- Cada página `.astro` = shell mínimo (`AppLayout` + título) montando UMA ilha `client:only="react"`.
- Guard de auth dentro da ilha (padrão `AdminEventsApp`: `ready && !isLoggedIn` → `location.replace("/")`), 401 → `setUser(null)` via `useAuth` (já automático).
- Decomposição das páginas gigantes em subcomponentes co-localizados na pasta da ilha (`eventos/` terá `EventOrdersDialog.tsx` etc. como arquivos irmãos, não ilhas separadas).

---

## Task 1: Infra de testes de componentes (Vitest + Testing Library)

**Files:**
- Modify: `frontend/package.json` (devDeps: `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`)
- Modify: `frontend/vitest.config.ts` (environment por arquivo: `*.test.tsx` → jsdom)
- Create: `frontend/src/test/setup.ts` (matchers do Testing Library)
- Create: `frontend/src/components/islands/__smoke__/AuthSmoke.test.tsx` (teste canário de renderização + interação)

**Interfaces:**
- Produces: `npm run test` roda `.test.ts` (node) E `.test.tsx` (jsdom); `@testing-library/react` disponível para todas as tasks seguintes; helper `renderWithMui(ui)` em `frontend/src/test/render-mui.tsx` (wrapper `MuiIslandProvider` + `createCodaquiTheme("light")`) — usado pelos testes das ilhas das Tasks 3+.

- [ ] **Step 1: Instalar deps**

Run: `cd frontend && npm install -D jsdom @testing-library/react @testing-library/dom @testing-library/user-event`
Expected: package.json atualizado.

- [ ] **Step 2: Configurar vitest para `.test.tsx` em jsdom**

`frontend/vitest.config.ts` hoje é `environment: "node"`, `include: ["src/**/*.test.ts"]`. Novo conteúdo:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    environmentMatchGlobs: [["src/**/*.test.tsx", "jsdom"]],
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

`frontend/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

(Se `@testing-library/jest-dom` não for instalado no Step 1 por omissão, adicioná-lo: `npm install -D @testing-library/jest-dom`.)

- [ ] **Step 3: Teste canário TDD**

`frontend/src/components/islands/__smoke__/AuthSmoke.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "../ThemeToggle"; // componente sem fetch/MUI — ideal p/ canário

vi.mock("../../../lib/config", () => ({ API_URL: "http://localhost:3001" }));

describe("infra de testes de ilhas (canário)", () => {
  it("renderiza e interage em jsdom", async () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button");
    await userEvent.click(btn);
    expect(document.documentElement.dataset.theme).toBeDefined();
  });
});
```

(Verificar o nome real do export de `ThemeToggle.tsx` — default ou named — e ajustar o import. Se o toggle depender de estado pré-existente em `localStorage`, limpar no `beforeEach`.)

- [ ] **Step 4: Helper compartilhado `render-mui.tsx`**

```tsx
// frontend/src/test/render-mui.tsx
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import MuiIslandProvider from "../components/islands/MuiIslandProvider";

export function renderWithMui(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: ({ children }: { children: ReactNode }) => <MuiIslandProvider>{children}</MuiIslandProvider>, ...options });
}
```

(Confirmar o export default de `MuiIslandProvider` e ajustar.)

- [ ] **Step 5: Verificar**

Run: `cd frontend && npx vitest run`
Expected: suíte completa verde (18 arquivos `.test.ts` existentes + canário novo), sem regressão.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts frontend/src/test/
git commit -m "feat(fase-0.4): infra de testes de ilhas — vitest jsdom + Testing Library + helper render-mui"
```

---

## Task 2: AppLayout real (sidebar app + guard compartilhado)

**Files:**
- Modify: `frontend/src/layouts/AppLayout.astro` (sidebar/topbar com nav de hubs admin+membro)
- Create: `frontend/src/components/islands/AppNavIsland.tsx` (nav interativa: identidade do usuário, logout, item ativo — `client:load`)
- Test: `frontend/src/components/islands/__tests__/AppNavIsland.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`frontend/src/lib/use-auth.ts`: `{ user, ready, isLoggedIn, isAdmin, login, logout }`), rotas fixas da nav.
- Produces: `<AppLayout title noindex?>` com slots `header`/`default`; `AppNavIsland` com props `{ currentPath: string }` (item ativo por prefixo); guard: ilha redireciona `window.location` para `/` quando `ready && !isLoggedIn` (mesmo padrão do `AdminEventsApp`).

- [ ] **Step 1: Teste TDD do AppNavIsland**

Cobrir: (a) `!ready` → skeleton; (b) `!isLoggedIn` → efeito de redirect (mock `window.location.replace` via `vi.stubGlobal`); (c) logado admin → nome/handle + item ativo conforme `currentPath`; (d) logout chama `startLogout`.

Stub de `use-auth`: `vi.mock("../../lib/use-auth")` com fábrica retornando o estado desejado por caso.

- [ ] **Step 2: Implementar AppNavIsland**

Portar a estrutura do `AdminNavbar` Docusaurus (ler `src/components/` — NavbarAdmin ou equivalente usado pelas páginas admin; se não houver componente compartilhado, replicar a fileira de botões/links do topo das páginas admin como lista vertical): grupos **Gestão** (`/admin` hubs) e **Conta** (`/membro`), identidade no topo (avatar, nome, `@handle`, chips de roles conforme roles do usuário), botão Sair. Item ativo por prefixo de rota. Mobile: drawer (MUI `Drawer` com hambúrguer).

- [ ] **Step 3: Reescrever AppLayout.astro**

Manter a prop `title`/`noindex`; adicionar `<div class="flex">` com sidebar (`<aside>` fixa 240px, `hidden md:flex`) + conteúdo; `<AppNavIsland client:load currentPath={Astro.url.pathname} />` dentro da sidebar E no drawer mobile (mesma ilha montada uma vez — usar uma única montagem com `client:load` na sidebar e um botão hambúrguer estático que alterna um `<details>`/drawer CSS para mobile, evitando dupla hidratação; julgar na implementação e anotar).

- [ ] **Step 4: Migrar `admin/eventos.astro` para o AppLayout novo**

Trocar o header antigo pelo AppLayout; `AdminEventsApp` continua `client:only` no slot.

- [ ] **Step 5: Verificar**

Run: `cd frontend && npx vitest run && npm run build && npm run check`
Expected: verde; `/admin/eventos` renderiza com sidebar no dist.

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat(fase-0.4): AppLayout com sidebar e AppNavIsland (guard + identidade + item ativo)"
```

---


## Task 3: Lib de auth — role helpers, authFetchHelpers, qr-scanner

**Files:**
- Modify: `frontend/src/lib/use-auth.ts` (adicionar 4 helpers de role)
- Create: `frontend/src/lib/auth-fetch-helpers.ts` (port de `src/hooks/authFetchHelpers.ts`)
- Modify: `frontend/package.json` (`qr-scanner ^1.4.2`)
- Test: `frontend/src/lib/auth-fetch-helpers.test.ts`, `frontend/src/lib/use-auth-roles.test.ts`

**Interfaces:**
- Produces: `useAuth()` ganha `isFinanceAnalyzer`, `isEventFinance`, `isEventHost`, `isEventChecker` (booleanos derivados de `user.roles`); `parseAuthJson<T>(res: Response, onError?: (msg: string) => void): Promise<T | null>` e `extractErrorMessage(res: Response, fallback: string): Promise<string>` — assinaturas idênticas ao Docusaurus (`src/hooks/authFetchHelpers.ts` é o spec).

- [ ] **Step 1: Testes falhando**

`frontend/src/lib/auth-fetch-helpers.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { parseAuthJson, extractErrorMessage } from "./auth-fetch-helpers";

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("parseAuthJson", () => {
  it("retorna o payload em 2xx", async () => {
    expect(await parseAuthJson<{ a: number }>(jsonRes({ a: 1 }))).toEqual({ a: 1 });
  });
  it("chama onError com a mensagem do body e retorna null em erro", async () => {
    const onError = vi.fn();
    expect(await parseAuthJson(jsonRes({ message: "falhou" }, 400), onError)).toBeNull();
    expect(onError).toHaveBeenCalledWith("falhou");
  });
  it("usa fallback de mensagem quando body não tem message", async () => {
    const onError = vi.fn();
    await parseAuthJson(jsonRes({}, 500), onError);
    expect(onError).toHaveBeenCalledWith("Erro inesperado");
  });
});

describe("extractErrorMessage", () => {
  it("extrai message do JSON de erro", async () => {
    expect(await extractErrorMessage(jsonRes({ message: "nope" }, 422), "fallback")).toBe("nope");
  });
  it("cai no fallback em resposta vazia/sem message", async () => {
    expect(await extractErrorMessage(new Response("", { status: 500 }), "fallback")).toBe("fallback");
  });
});
```

(Conferir no original `src/hooks/authFetchHelpers.ts` o texto exato de fallback e a forma do `onError` — o spec manda; ajustar os esperados do teste ao real ANTES de implementar.)

`frontend/src/lib/use-auth-roles.test.ts`: cobrir os 4 helpers — `roles: ["finance-analyzer"]` → `isFinanceAnalyzer === true`, demais false; roles combinados; sem usuário → tudo false. Mockar `global.fetch` para `/auth/me` retornar o usuário desejado; montar com `renderHook` do `@testing-library/react`; aguardar `ready === true`.

Run: `cd frontend && npx vitest run src/lib/auth-fetch-helpers.test.ts src/lib/use-auth-roles.test.ts`
Expected: FAIL (módulos/helpers inexistentes).

- [ ] **Step 2: Implementar**

- `auth-fetch-helpers.ts`: port 1:1 do original (61 linhas — parse JSON, `body.message ?? fallback`).
- `use-auth.ts`: adicionar os 4 helpers derivados de `user?.roles` (espelhar a nomenclatura de `src/hooks/useAuth.ts`).

- [ ] **Step 3: Instalar qr-scanner**

Run: `cd frontend && npm install qr-scanner@^1.4.2`
(Ainda sem uso — chega na Task 14; instalar agora para tipagem do mock de testes.)

- [ ] **Step 4: Verificar**

Run: `cd frontend && npx vitest run && npm run check`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(fase-0.4): authFetchHelpers + role helpers no use-auth + dep qr-scanner"
```

---

## Task 4: Componentes base — ModalConfirm, TabPanel, PageContainer, DataTable, StatCard

**Files:**
- Create: `frontend/src/components/islands/admin/ui/ModalConfirm.tsx` (port de `src/components/ModalConfirm/index.tsx`)
- Create: `frontend/src/components/islands/admin/ui/TabPanel.tsx` (port de `src/components/TabPanel/index.tsx`)
- Create: `frontend/src/components/islands/admin/ui/PageContainer.tsx` (port de `AdminPageContainer`)
- Create: `frontend/src/components/islands/admin/ui/DataTable.tsx` (port de `AdminDataTable`)
- Create: `frontend/src/components/islands/admin/ui/StatCard.tsx` (port do React `StatCard`)
- Test: `frontend/src/components/islands/admin/ui/__tests__/ui.test.tsx`

**Interfaces:**
- Produces (assinaturas idênticas aos originais — os arquivos-fonte são o spec):
  - `ModalConfirm({ open, onClose, title, description?, confirmLabel?, cancelLabel?, variant? })`
  - `TabPanel({ children?, index, value })`
  - `PageContainer({ children })` — `Container maxWidth="lg"`
  - `DataTable({ table, page, totalPages, onPageChange, tableContainerSx?, paginationMarginTop? })`
  - `StatCard({ icon, value, label, color?, variant? })`

- [ ] **Step 1: Testes falhando**

`frontend/src/components/islands/admin/ui/__tests__/ui.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../../test/render-mui";
import ModalConfirm from "../ModalConfirm";
import TabPanel from "../TabPanel";

describe("ModalConfirm", () => {
  it("confirma via onClose(true)", async () => {
    const onClose = vi.fn();
    renderWithMui(<ModalConfirm open onClose={onClose} title="Excluir?" confirmLabel="Excluir" />);
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(onClose).toHaveBeenCalledWith(true);
  });
  it("cancela via onClose(false)", async () => {
    const onClose = vi.fn();
    renderWithMui(<ModalConfirm open onClose={onClose} title="Excluir?" />);
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalledWith(false);
  });
});

describe("TabPanel", () => {
  it("só renderiza children do painel ativo", () => {
    render(
      <div>
        <TabPanel index={0} value={1}>painel-0</TabPanel>
        <TabPanel index={1} value={1}>painel-1</TabPanel>
      </div>,
    );
    expect(screen.queryByText("painel-0")).not.toBeInTheDocument();
    expect(screen.getByText("painel-1")).toBeInTheDocument();
  });
});
```

(Antes de implementar, ler `ModalConfirm` original e conferir: o que `onClose` recebe (boolean vs void), labels padrão dos botões, e o papel de `variant`. Corrigir o teste para espelhar o comportamento real.)

- [ ] **Step 2: Portar os 5 componentes**

Ler cada original e portar com MUI v9 (deep imports `@mui/material/X`), sem hex (tokens do tema). NENHUM deles leva `MuiIslandProvider` próprio — o tema vem da ilha-pai (e do `renderWithMui` nos testes).

- [ ] **Step 3: Verificar**

Run: `cd frontend && npx vitest run && npm run check`
Expected: verde.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/islands/admin/ui/
git commit -m "feat(fase-0.4): componentes base admin (ModalConfirm, TabPanel, PageContainer, DataTable, StatCard)"
```

---

## Task 5: Componentes vendor — VendorTransactionForm + VendorTransactionCard

**Files:**
- Create: `frontend/src/components/islands/admin/vendors/VendorTransactionForm.tsx` (port de `src/components/VendorTransactionForm/index.tsx`, 292 linhas)
- Create: `frontend/src/components/islands/admin/vendors/VendorTransactionCard.tsx` (port de `VendorTransactionCard`, 122 linhas)
- Test: `frontend/src/components/islands/admin/vendors/__tests__/vendor-tx.test.tsx`

**Interfaces:**
- Consumes: `parseAuthJson`/`extractErrorMessage` (Task 3), `formatBRL` (`lib/transaction`).
- Produces: `VendorTransactionForm({ direction, vendors, accounts, authFetch, apiUrl, onSuccess, initialValues?, initialKey? })` exportando `VendorTxFormValues` e `emptyVendorTxForm`; `VendorTransactionCard({ tx, direction, accountLabel, onReuse, onDelete })` — assinaturas idênticas ao original.

- [ ] **Step 1: Testes falhando** — cobrir: render por `direction` (payment vs receipt); submit monta o body correto e chama `authFetch` (mock resolvendo 201 — validar o payload capturado); validação bloqueia submit com campos obrigatórios vazios (ler o original: o que é obrigatório? replicar e testar). Card: render dos campos + `onReuse` ao clicar em reutilizar.

- [ ] **Step 2: Portar** — fiel ao original; MUI v9; `authFetch`/`apiUrl` por props (injeção preservada para testes).

- [ ] **Step 3: Verificar** — `npx vitest run && npm run check` verde.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/islands/admin/vendors/
git commit -m "feat(fase-0.4): VendorTransactionForm e VendorTransactionCard portados"
```

---

## Task 6: Dialogs de evento — EventOrdersDialog, EventReimbursementDialog, MarkdownLite

**Files:**
- Create: `frontend/src/components/islands/admin/events/EventOrdersDialog.tsx` (port de `src/components/EventOrdersDialog/index.tsx`, 712 linhas)
- Create: `frontend/src/components/islands/admin/events/EventReimbursementDialog.tsx` (port, 234 linhas)
- Create: `frontend/src/components/islands/admin/events/MarkdownLite.tsx` (port, 114 linhas)
- Test: `frontend/src/components/islands/admin/events/__tests__/event-dialogs.test.tsx`

**Interfaces:**
- Consumes: `parseAuthJson`/`extractErrorMessage` (Task 3), `TabPanel` (Task 4).
- Produces: `EventOrdersDialog({ open, onClose, eventId?, eventKey?, eventTitle, apiUrl, authFetch })`; `EventReimbursementDialog({ open, onClose, apiUrl, authFetch, title, eventId?, eventKey?, ... })` (props exatas no original); `MarkdownLite({ text })`.

- [ ] **Step 1: Testes falhando** — `MarkdownLite`: 3-4 casos reais do renderer original (heading, negrito, link — o original tem sanitização própria sem deps; ler a implementação e cobrir suas regras, incluindo o que ele BLOQUEIA). Dialogs: estados loading/erro/vazio com `authFetch` mockado; render condicionado a `open`.

- [ ] **Step 2: Portar os 3 componentes** — fiel ao original; MUI v9; sem provider próprio.

- [ ] **Step 3: Verificar** — `npx vitest run && npm run check` verde.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/islands/admin/events/
git commit -m "feat(fase-0.4): EventOrdersDialog, EventReimbursementDialog e MarkdownLite portados"
```

---

## Task 7: Admin — lançamento (direto + transferências) + stub de transferências

**Files:**
- Create: `frontend/src/components/islands/admin/lancamento/LancamentoApp.tsx` (port de `src/pages/admin/lancamento.tsx`, 712 linhas — decompor em subcomponentes na mesma pasta se passar de ~400 linhas: `DirectExpenseForm`, `TransfersPanel`)
- Create: `frontend/src/pages/admin/lancamento.astro`
- Create: `frontend/src/pages/admin/transferencias.astro` (redirect stub — copiar o padrão `RedirectStub.astro` da 0.3)
- Test: `frontend/src/components/islands/admin/lancamento/__tests__/lancamento.test.tsx` (conversão de `src/pages/admin/__tests__/lancamento.test.tsx`)

**Interfaces:**
- Consumes: `useAuth` (com `isFinanceAnalyzer` — Task 3), `parseAuthJson`/`extractErrorMessage` (Task 3), `PageContainer`/`TabPanel`/`ModalConfirm` (Task 4), `formatBRL` (`lib/transaction`).
- Produces: `<LancamentoApp />` ilha `client:only`; rota `/admin/lancamento` (title `Admin — Lançamento | CODAQUI.dev` — conferir o build de referência: `grep -o "<title>[^<]*" build/admin/lancamento.html`) e `/admin/transferencias` (redirect).

- [ ] **Step 1: Converter o teste existente** — copiar `src/pages/admin/__tests__/lancamento.test.tsx` para o destino e adaptar: `jest.mock` → `vi.mock` (com hoisting: usar `vi.mock` com factory), `jest.fn` → `vi.fn`, imports `@site/...` → relativos, `render` → `renderWithMui` quando envolver MUI. Rodar: FAIL (ilha inexistente).

- [ ] **Step 2: Portar a ilha** — ler `lancamento.tsx` integralmente; replicar tabs (Lançamento direto / Transferências), sub-tabs de transferências (Pendentes/Aprovadas/Rejeitadas), formulário, ações approve/reject, estados de erro com `Alert`. Endpoints por `authFetch` da `useAuth`.

- [ ] **Step 3: Shells `.astro`** — `lancamento.astro` (AppLayout + `<LancamentoApp client:only="react" />`); `transferencias.astro` → `<RedirectStub to="/admin/lancamento?tab=transferencias" />`.

- [ ] **Step 4: Verificar** — `npx vitest run && npm run build && npm run check`; conferir título de `dist/admin/lancamento/index.html` vs `build/admin/lancamento.html`.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(fase-0.4): /admin/lancamento com transferências + redirect /admin/transferencias"
```

---

## Task 8: Admin — reembolsos + fornecedores

**Files:**
- Create: `frontend/src/components/islands/admin/reembolsos/ReembolsosApp.tsx` (port de `reembolsos.tsx`, 568 linhas)
- Create: `frontend/src/components/islands/admin/fornecedores/FornecedoresApp.tsx` (port de `fornecedores.tsx`, 336 linhas)
- Create: `frontend/src/pages/admin/reembolsos.astro`, `frontend/src/pages/admin/fornecedores.astro`
- Test: `__tests__/reembolsos.test.tsx` (conversão do teste existente), `__tests__/fornecedores.test.tsx` (novo — estados fetch/401/vazio + CRUD básico)

**Interfaces:**
- Consumes: Tasks 3 e 4; `StatCard.astro` NÃO serve aqui (ilha) — usar `StatCard` React da Task 4 onde o original usa.
- Produces: `<ReembolsosApp />`, `<FornecedoresApp />`; rotas `/admin/reembolsos`, `/admin/fornecedores`.

- [ ] **Step 1: Converter teste de reembolsos + escrever teste de fornecedores** — reembolsos: adaptar `__tests__/reembolsos.test.tsx` (mesmas regras de conversão da Task 7). fornecedores (sem teste original): cobrir lista vazia/erro, criação (POST com payload certo), exclusão com `ModalConfirm`.

- [ ] **Step 2: Portar as duas ilhas** — fiel: reembolsos tem ações approve/reject/delete/revert + saldos de `GET /ledger/community-balances` (fetch público); fornecedores é CRUD com chips contadores.

- [ ] **Step 3: Shells `.astro`** — AppLayout + ilha `client:only`; títulos conforme `build/admin/*.html`.

- [ ] **Step 4: Verificar** — `npx vitest run && npm run build && npm run check` verde.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(fase-0.4): /admin/reembolsos e /admin/fornecedores"
```

---

## Task 9: Admin — pagamentos + recebimentos

**Files:**
- Create: `frontend/src/components/islands/admin/pagamentos/PagamentosApp.tsx` (port de `pagamentos.tsx`, 500 linhas)
- Create: `frontend/src/components/islands/admin/recebimentos/RecebimentosApp.tsx` (port de `recebimentos.tsx`, 220 linhas)
- Create: `frontend/src/pages/admin/pagamentos.astro`, `frontend/src/pages/admin/recebimentos.astro`
- Test: `__tests__/{pagamentos,recebimentos}.test.tsx` (novos — estados + formulário/histórico)

**Interfaces:**
- Consumes: `VendorTransactionForm`/`VendorTransactionCard` (Task 5), Tasks 3-4.
- Produces: `<PagamentosApp />` (formulário + histórico + templates), `<RecebimentosApp />`; rotas correspondentes.

- [ ] **Step 1: Testes falhando** — pagamentos: render de histórico vazio/erro; criação de template (POST `/vendors/templates`); exclusão de pagamento com confirmação. recebimentos: criação (POST `/vendors/receipts` via form) e exclusão.

- [ ] **Step 2: Portar as ilhas** — atenção aos helpers do original (`parseBrlInput` já portado em `lib/transaction.ts` — verificar nome real do export: `parseBrlInput`).

- [ ] **Step 3: Shells + verificar + commit**

```bash
git add frontend/
git commit -m "feat(fase-0.4): /admin/pagamentos e /admin/recebimentos"
```

---

## Task 10: Admin — empresas + sorteios + carteiras

**Files:**
- Create: `frontend/src/components/islands/admin/empresas/EmpresasApp.tsx` (port de `empresas.tsx`, 400)
- Create: `frontend/src/components/islands/admin/sorteios/SorteiosApp.tsx` (port de `sorteios.tsx`, 445)
- Create: `frontend/src/components/islands/admin/carteiras/CarteirasApp.tsx` (port de `carteiras.tsx`, 267 — usa `WalletTransactionDetailDialog` JÁ portado e `DataTable`)
- Create: as 3 rotas `.astro`
- Test: conversões de `empresas.test.tsx` e `sorteios.test.tsx` + `carteiras.test.tsx` novo

**Interfaces:**
- Consumes: Tasks 3-4; `WalletTransactionDetailDialog` + helpers `lib/wallet-transactions.ts` (já existem).
- Produces: 3 ilhas + rotas `/admin/empresas`, `/admin/sorteios`, `/admin/carteiras`.

- [ ] **Step 1: Converter testes existentes (empresas, sorteios) + criar carteiras** — carteiras: paginação (`GET /club/admin/wallet/all-transactions?type=&page=&limit=`), diálogo de detalhe ao clicar.

- [ ] **Step 2: Portar as 3 ilhas** — empresas: listagem paginada + ativação (`PATCH /companies/:id/status`) com diálogo de carteira/membros; sorteios: CRUD + `POST /club/raffles/:id/draw` (ação de sortear com confirmação) + entries.

- [ ] **Step 3: Shells + verificar + commit**

```bash
git add frontend/
git commit -m "feat(fase-0.4): /admin/empresas, /admin/sorteios e /admin/carteiras"
```

---

## Task 11: Admin hub — `/admin` (membros + papéis)

**Files:**
- Create: `frontend/src/components/islands/admin/hub/AdminHubApp.tsx` (port de `src/pages/admin/index.tsx`, 617 linhas)
- Create: `frontend/src/pages/admin/index.astro` (shell novo — `/admin` ainda não existe no Astro; AppLayout da Task 2)
- Test: conversão de `__tests__/index.test.tsx`

**Interfaces:**
- Consumes: `DataTable` (Task 4), `ModalConfirm` (Task 4), Tasks 3.
- Produces: `<AdminHubApp />` — listagem de membros (`GET /admin/members` paginado), edição (`PATCH`), CRUD de papéis, exclusão; rota `/admin` com title de referência (`build/admin.html`).

- [ ] **Step 1: Converter teste existente** — adaptar `__tests__/index.test.tsx`.

- [ ] **Step 2: Portar a ilha** — fiel ao original (inclui busca/filtros se houver).

- [ ] **Step 3: Shell + verificar + commit**

```bash
git add frontend/
git commit -m "feat(fase-0.4): hub /admin (membros e papéis)"
```

---

## Task 12: Admin — eventos (gestão completa, substitui a POC)

**Files:**
- Create: `frontend/src/components/islands/admin/eventos/EventosAdminApp.tsx` + subcomponentes na mesma pasta (`EventFormDialog.tsx`, `TicketTypesPanel.tsx`, `StaffPanel.tsx`, `PublishCancelActions.tsx` etc. — decompor o original de 2.576 linhas em arquivos de ~300-500 linhas, SEM mudar comportamento)
- Modify: `frontend/src/pages/admin/eventos.astro` (manter shell, trocar a ilha)
- Delete: `frontend/src/components/islands/AdminEventsApp.tsx` (POC read-only) e seu teste se houver
- Test: conversão de `__tests__/eventos.test.tsx`

**Interfaces:**
- Consumes: Tasks 3, 4, 6 (`MarkdownLite`, dialogs), `buildEventPath`/`buildEventPublicPath` (`lib/event-path.ts`, já portado).
- Produces: `<EventosAdminApp />` — CRUD managed (`POST/PATCH /events`), ticket-types, staff, publish/cancel, force-sync snapshot (`POST /events/internal/snapshot`), mini-editor markdown (`MarkdownLite` para preview), dialogs de pedidos/reembolso. Paridade total com `src/pages/admin/eventos.tsx`.

- [ ] **Step 1: Converter teste existente** (`__tests__/eventos.test.tsx`).

- [ ] **Step 2: Decompor e portar** — ler o original integralmente antes; mapear as seções (hub lista / form / ticket-types / staff / ações / dialogs) para arquivos; portar seção a seção mantendo textos e endpoints. O force-sync e o reconcile-quota seguem como estão.

- [ ] **Step 3: Trocar o shell + remover a POC** — `eventos.astro` aponta para a ilha nova; deletar `AdminEventsApp.tsx` e referências.

- [ ] **Step 4: Verificar** — `npx vitest run && npm run build && npm run check` verde; `grep -rn "AdminEventsApp" frontend/src` → só a nova ilha.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(fase-0.4): /admin/eventos gestão completa (substitui POC read-only)"
```

---

## Task 13: Admin — overrides

**Files:**
- Create: `frontend/src/components/islands/admin/overrides/OverridesApp.tsx` + `EventOverrideHistory.tsx` (port de `src/components/EventOverrideHistory/index.tsx`, 140 linhas, na mesma pasta)
- Create: `frontend/src/pages/admin/overrides.astro`
- Test: `__tests__/overrides.test.tsx` (novo — sem teste original; cobrir tabs, estados, e o fluxo PUT de override)

**Interfaces:**
- Consumes: Tasks 3, 4, 6 (`EventOrdersDialog`, `EventReimbursementDialog`).
- Produces: `<OverridesApp />` — 3 tabs: Override de metadados / Organizers / Ativação de features (endpoints do inventário §1, incl. `overrideApiUrl`, import/rematch de participantes, ticket-types externos).

- [ ] **Step 1: Teste falhando** — tabs renderizam seus painéis; PUT de override com payload correto; estado de erro do `Alert`.

- [ ] **Step 2: Portar** — 2.202 linhas: decompor em `OverridesTab.tsx`, `OrganizersTab.tsx`, `ActivationTab.tsx` na pasta da ilha.

- [ ] **Step 3: Shell + verificar + commit**

```bash
git add frontend/
git commit -m "feat(fase-0.4): /admin/overrides (3 tabs + histórico)"
```

---

## Task 14: Admin — check-in (QR/câmera + manual)

**Files:**
- Create: `frontend/src/components/islands/admin/checkin/CheckinApp.tsx` (port de `src/pages/admin/eventos-checkin.tsx`, 815 linhas — subcomponentes `QrScannerPanel.tsx`, `ManualSearch.tsx` na mesma pasta)
- Create: `frontend/src/pages/admin/eventos-checkin.astro`
- Create: `frontend/src/test/mocks/qr-scanner.ts` (port de `src/__mocks__/qr-scanner.ts`)
- Test: conversão de `__tests__/eventos-checkin.test.tsx`

**Interfaces:**
- Consumes: `qr-scanner` (Task 3), `parseAuthJson`/`extractErrorMessage` (Task 3), `PageContainer` (Task 4).
- Produces: `<CheckinApp />` — seletor de evento (interno e `external:<eventKey>`), câmera QR com start/stop, fallback manual (`?query=` no backend para internos; filtro client-side para externos), `POST .../checkin`, contador de presentes, deep-link `?event=`. Roles: `CHECKIN_ROLES = ["admin","event_organizer","event_checker"]` (+ `event_host` via `canUseList` — replicar a lógica original de permissão).

- [ ] **Step 1: Converter teste + mock do qr-scanner** — adaptar `__tests__/eventos-checkin.test.tsx` e o mock `src/__mocks__/qr-scanner.ts` (registrar o mock via `vi.mock("qr-scanner")` apontando para `frontend/src/test/mocks/qr-scanner.ts`).

- [ ] **Step 2: Portar a ilha** — atenção: o scanner usa `BarcodeDetector`/WebWorker do `qr-scanner`; manter a instanciação em ref e o cleanup start/stop; HTTPS local (mkcert) continua valendo para câmera no celular (documentado no DEVELOPMENT.md).

- [ ] **Step 3: Shell + verificar + commit**

```bash
git add frontend/
git commit -m "feat(fase-0.4): /admin/eventos-checkin (QR/câmera + busca manual)"
```

---

## Task 15: Admin — emails (logs + templates)

**Files:**
- Create: `frontend/src/components/islands/admin/emails/EmailsApp.tsx` (port de `emails.tsx`, 384 linhas) + `EmailsTemplatesTab.tsx` (port de `src/components/EmailsTemplatesTab/index.tsx`, 288 linhas — preview usa `dangerouslySetInnerHTML` com HTML sanitizado pelo backend, replicar como está)
- Create: `frontend/src/pages/admin/emails.astro`
- Test: conversão de `__tests__/emails.test.tsx`

**Interfaces:**
- Consumes: `StatCard` (Task 4), `TabPanel` (Task 4), Tasks 3.
- Produces: `<EmailsApp />` — tabs Logs/Templates, StatCards de volume, filtros, resend (`POST /notifications/emails/:id/resend`).

- [ ] **Step 1: Converter teste existente.**

- [ ] **Step 2: Portar ilha + TemplatesTab.**

- [ ] **Step 3: Shell + verificar + commit**

```bash
git add frontend/
git commit -m "feat(fase-0.4): /admin/emails (logs + templates)"
```

---

## Task 16: /membro — dashboard (5 tabs) + editar

**Files:**
- Create: `frontend/src/components/islands/member/dashboard/MemberDashboardApp.tsx` + subcomponentes na pasta (`DonationsTab.tsx`, `SubscriptionsTab.tsx`, `WalletTab.tsx`, `EventsTab.tsx` com sub-tabs Próximos/Comprei para outros/Histórico) — port de `src/pages/membro/index.tsx` (1.663 linhas)
- Create: `frontend/src/components/islands/member/EditarPerfilApp.tsx` (port de `membro/editar.tsx`, 114 linhas)
- Create: `frontend/src/pages/membro/index.astro`, `frontend/src/pages/membro/editar.astro`
- Test: conversão de `src/pages/membro/__tests__/index.test.tsx` + `editar.test.tsx` novo (form bio 280 chars + LinkedIn)

**Interfaces:**
- Consumes: `useAuth`, Tasks 3-4, `ModalConfirm`, `WalletTransactionDetailDialog`/`ClubWalletTransactionsTable` (já portados), `QRCodeSVG` (`qrcode.react`), `formatBRL`, `buildEventPath`/`buildEventPublicPath` (`lib/event-path.ts`).
- Produces: `<MemberDashboardApp />` (header com avatar/QR/copiar URL/logout/link editar + tabs Visão Geral/Doações/Assinaturas/Carteira/Eventos; cancelamento de inscrição; download de certificado), `<EditarPerfilApp />`; rotas `/membro` (title `Área do Membro | CODAQUI.dev`) e `/membro/editar`.

- [ ] **Step 1: Converter teste do dashboard + criar teste de editar.**

- [ ] **Step 2: Portar** — decompor por tab; endpoint a endpoint conforme inventário §2. O cancelamento de inscrição usa `ModalConfirm` + `DELETE /events/registrations/:id`; certificado `GET /events/registrations/:id/certificate`.

- [ ] **Step 3: Shells + verificar + commit**

```bash
git add frontend/
git commit -m "feat(fase-0.4): /membro (dashboard 5 tabs) e /membro/editar"
```

---

## Task 17: /membros/empresa — MyCompanySection

**Files:**
- Create: `frontend/src/components/islands/member/company/MyCompanyApp.tsx` (port de `src/components/MyCompanySection/index.tsx`, 1.006 linhas — subcomponentes `CompanyHeader.tsx`, `CollaboratorsPanel.tsx`, `CompanyWalletPanel.tsx`, `SupportSummary.tsx`)
- Create: `frontend/src/pages/membros/empresa.astro` — shell com **`noindex`** (paridade com o original) + `Container maxWidth="md"` na ilha
- Test: `__tests__/my-company.test.tsx` (novo — estados das 4 seções + distribuir SortCoins)

**Interfaces:**
- Consumes: `useAuth` (helper `api()` local do original usa `authFetch` — injetar via hook), Tasks 3-4.
- Produces: `<MyCompanyApp />`; rota `/membros/empresa`.

- [ ] **Step 1: Teste falhando** — carregamento de `/companies/me`; estados sem empresa (CTA); distribuição de SortCoins (POST com payload validado).

- [ ] **Step 2: Portar** — seções internas conforme inventário §3 (edição cadastral, colaboradores add/remove, carteira + transações paginadas, resumo de apoio).

- [ ] **Step 3: Shell + verificar + commit**

```bash
git add frontend/
git commit -m "feat(fase-0.4): /membros/empresa (conta PJ com noindex)"
```

---

## Task 18: /eventos/comprovante — recibo autenticado

**Files:**
- Create: `frontend/src/components/islands/events/ReceiptApp.tsx` (port de `src/pages/eventos/comprovante.tsx`, 261 linhas)
- Create: `frontend/src/pages/eventos/comprovante.astro`
- Test: `frontend/src/components/islands/events/__tests__/receipt.test.tsx` (novo — `?order=`, estados de carregamento/erro, login redirect quando deslogado)

**Interfaces:**
- Consumes: `useAuth` (`login({ returnTo })` quando deslogado), `formatBRL`, `PageContainer` (Task 4).
- Produces: `<ReceiptApp />` — `GET /events/orders/:orderId/receipt` via `authFetch`, botão Imprimir (`print()`); rota `/eventos/comprovante`.

- [ ] **Step 1: Teste falhando** — deslogado chama `login` com `returnTo` do pathname+search; logado renderiza recibo com dados mockados; erro mostra `Alert`.

- [ ] **Step 2: Portar + shell + verificar + commit**

```bash
git add frontend/
git commit -m "feat(fase-0.4): /eventos/comprovante (recibo autenticado)"
```

---

## Task 19: /auth/callback — upgrade (default return /membro + COMMUNITY_KEY)

**Files:**
- Modify: `frontend/src/components/islands/AuthCallback.tsx`
- Modify: `frontend/src/lib/auth-client.ts` (se o cleanup de `COMMUNITY_KEY` morar lá)
- Test: `frontend/src/components/islands/__tests__/AuthCallback.test.tsx` (novo)

**Interfaces:**
- Consumes: `RETURN_KEY`, `COMMUNITY_KEY` (`auth-client.ts`).
- Produces: comportamento igual ao Docusaurus `src/pages/auth/callback.tsx`: default return `/membro` (hoje é `/`); limpar `COMMUNITY_KEY` no finalize; manter validação anti-open-redirect (`safeReturnPath`).

- [ ] **Step 1: Teste falhando** — sem `sessionStorage[RETURN_KEY]` → redirect para `/membro`; com return válido → redirect para ele; return inválido (absoluto) → cai no default.

- [ ] **Step 2: Implementar** — ler `src/pages/auth/callback.tsx` (183 linhas) e espelhar o fluxo (inclui `resolveCommunityFromPath`? NÃO portar branding de comunidade — é Fase 0.5; mas a LIMPEZA de `COMMUNITY_KEY` deve entrar).

- [ ] **Step 3: Verificar + commit**

```bash
git add frontend/
git commit -m "feat(fase-0.4): /auth/callback com default return /membro e limpeza de COMMUNITY_KEY"
```

---

## Task 20: Gate de paridade estendido + verificação final da 0.4

**Files:**
- Modify: `frontend/scripts/diff-urls.mjs` (remover exclusões de 0.4)
- Modify: `docs/superpowers/plans/2026-10-26-fase-0-4-app-admin-membro.md` (checkboxes)

- [ ] **Step 1: Estender o gate** — em `EXCLUDE`, remover `/^\/admin(\/|$)/`, `/^\/membro(\/|$)/`, `/^\/membros\/empresa(\/|$)/`, `/^\/auth(\/|$)/`, `/^\/eventos\/comprovante(\/|$)/`; em `SECTIONS`, adicionar `"admin"`, `"membro"`, `"auth"` (`membros/empresa` e `eventos/comprovante` já são cobertos pelas caminhadas de `membros`/`eventos` com as exclusões removidas). Atualizar o comentário do histórico.

Run: `cd frontend && npm run build && node scripts/diff-urls.mjs`
Expected: paridade 100% incluindo as novas seções.

- [ ] **Step 2: Gates completos**

```bash
cd frontend && npm run build && npm run check && npm run test && node scripts/diff-urls.mjs
npm run typecheck   # raiz
```

Expected: tudo verde.

- [ ] **Step 3: Smoke manual documentado** — `make astro-dev` com backend local (`make db-up` + `npm run start:dev` no backend) e conferir ponta a ponta: login GitHub → `/admin` e `/membro` carregam com dados; check-in abre; comprovante com `?order=` válido. Registrar o resultado no relatório (se não rodar backend local neste ambiente, documentar como pendência ambiental como na 0.3).

- [ ] **Step 4: Checkboxes + critérios** — marcar o plano; conferir critérios de pronto abaixo.

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "chore(fase-0.4): verificação final — paridade app 100%, ilhas testadas (Vitest+RTL), fluxos 401 cobertos"
```

---

## Critérios de pronto da 0.4 (da spec)

- [ ] Paridade funcional: todas as `/admin/*` + `/membro/*` + `/membros/empresa` + `/eventos/comprovante` migradas, mesmos endpoints/estados/textos
- [ ] Gate `diff-urls` sem exclusões de 0.4 — 0 URLs faltando
- [ ] Testes das ilhas (Vitest + Testing Library) verdes — 9 testes convertidos do jest + novos por batch
- [ ] Fluxos authFetch/401 cobertos (logout automático → redirect)
- [ ] `useAuth` com helpers de role completos; `authFetchHelpers` portado
- [ ] POC `AdminEventsApp` removida, gestão completa de eventos no ar
- [ ] Gates verdes: build, astro check, vitest, typecheck da raiz

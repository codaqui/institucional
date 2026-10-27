# Task 11 — Gates de tenant (tenant-urls) + runbook de operação Cloudflare Pages

**Status:** ✅ concluída — `make astro-verify-tenants` verde na primeira rodada (4 builds + 3 gates de allow-list), `astro-verify` existente continua verde com a checagem nova.

## O que foi entregue

### 1. `frontend/scripts/tenant-urls.mjs` (+ `tenant-urls.test.mjs`, 10 testes)

Gate de allow-list por tenant: `node scripts/tenant-urls.mjs <dist> <tenant>` —
exit 1 listando as URLs faltantes, exit 0 com relatório `✔ N/N URLs presentes`.

- **Base (todo tenant):** `/`, `/apoiar`, `/transparencia`, `/equipe`.
- **Blog:** com `src/content/community-blog/<slug>/` existente, exige `/blog` + os
  slugs lidos dos frontmatters (regex `^slug:\s*(.+)$` por `.md`, sem slug é
  ignorado) + `/blog/tags` — este último **só quando o tenant tem a rota**
  (`src-tenants/<slug>/pages/blog/tags`), interpretação do "(opcional)" do brief.
  Hoje só o tisocial tem blog e tem tags → 17 URLs exigidas.
- **Docs:** exige `/docs` quando o tenant tem rota docs (`src-tenants/<slug>/pages/docs`)
  **ou** conteúdo (`src/content/community-docs/<slug>`) — cobre os 3 tenants
  (devparana/elasnocodigo leem docs de `comunidades/<slug>/docs/`, fora de `src/content`).
- Aceita as duas emissões de página estática (`<url>/index.html` e `<url>.html`);
  valida tenant contra `tenants.config.mjs` (`Tenant desconhecido` — build
  quebraria antes do gate de qualquer forma).
- API pura exportada (`requiredUrls`, `checkTenantUrls`) com `rootDir`
  injetável — o teste usa fixture fake de root (padrão `build-tenant-redirects.test.mjs`).

### 2. Makefile

- **`astro-verify-tenants`**: loop de 4 builds — codaqui (`env -u TENANT npm run build`,
  protege contra `TENANT` exportada no ambiente) + 3 tenants (`TENANT=$t npm run build`
  + `node scripts/tenant-urls.mjs dist $t`). Lista de tenants lida de
  `frontend/tenants.config.mjs` via `$(shell node --input-type=module …)` (fonte única);
  falha fechada se a lista vier vazia (anti falso-verde). Nota final lembra o R7.
- **`astro-verify`** ganhou 1 checagem: `npx tsc -p functions/tsconfig.json`
  (type-check da Pages Function — tsconfig próprio com `noEmit: true`, fora do
  `astro check`). **Item do checklist da fase ("tsc da Function deve rodar nos
  gates", da revisão da proxy) fica satisfeito: agora roda no gate, não só no report.**

### 3. DEVELOPMENT.md

- Seção nova **"Multi-tenant (Fase 0.5)"** (entre "Frontend (Astro)" e "Backend"):
  como funciona (srcDir por `TENANT`, `tenants.config.mjs`, `_redirects`, gates)
  + runbook do brief (projetos Pages, secrets, cutover de DNS com janela 1–2h
  offline aceita, verificação pós-DNS, rollback via `git checkout <sha> -- workers/`
  + `npm run worker:deploy:<slug>`, gap `*.pages.dev`, nota Windows `core.symlinks`)
  + **R7** (`astro check` não é gate em modo tenant — gates por build documentados).
- `AGENT-INDEX` do arquivo mantido intacto — só adicionada a linha da seção nova.
- Tabela de secrets do GitHub Actions: `CLOUDFLARE_API_TOKEN` (mínimo
  *Cloudflare Pages:Edit*) + `CLOUDFLARE_ACCOUNT_ID` (workflow `deploy-astro`, da T10).
- Lista de comandos make da seção Astro: `astro-verify-tenants` incluído.

## Gates

| Gate | Resultado |
|---|---|
| `make astro-verify-tenants` | ✅ 4 builds + 3 allow-lists — tisocial **17/17**, elasnocodigo **5/5**, devparana **5/5** |
| `npx vitest run` (frontend) | ✅ 56 arquivos / **492 testes** (10 novos do `tenant-urls`) |
| `make astro-verify` (existente + tsc) | ✅ build + check + test + **tsc Function OK** + smoke + diff-urls paridade 100% |
| `npx tsc -p functions/tsconfig.json` | ✅ 0 erros, `noEmit` efetivo (nada gravado em `functions/`) |

## Desvios / decisões de interpretação

- **`/blog/tags` condicional à rota** (ver acima) — comportamento idêntico hoje.
- **`/docs` por rota ou conteúdo** (ver acima) — o brief dizia só "/docs se existir".
- `astro-verify-tenants` inclui o build codaqui (sem gate de URLs — coberto pelo
  `astro-verify`), conforme instrução do dispatch ("os 4 builds").

## Notas / preocupações

- Os builds de tenant logam `ECONNREFUSED` do `member-pages` (backend local fora
  do ar) — comportamento documentado de fallback, não afeta o gate.
- Worktree precisou de `npm ci` + symlink local `build → ../../build` (mesmo
  padrão das T5/T9) para o `diff-urls` do `astro-verify` — o symlink está no
  `.gitignore`, não vai pro commit.
- O workflow `deploy-astro.yml` (T10, em paralelo) ainda não existe nesta branch;
  o DEVELOPMENT.md já referencia os secrets e o nome do workflow conforme o plano.
- Cutover de DNS em si continua sendo ação do usuário (R3) — runbook documentado,
  sem validação ponta a ponta possível neste ambiente (sem credenciais Cloudflare).

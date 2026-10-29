<!-- AGENT-INDEX
purpose: Plano de implementação da Fase 0.6 (Cutover do codaqui.dev para o Cloudflare Pages) — redirects legados em _redirects, remoção do Docusaurus e dos workflows gh-pages, reescrita do AGENTS.md, ADR 011 e corte de DNS com rollback ensaiado.
audience: AI agents executando com superpowers:subagent-driven-development.
status: pronto para execução (2026-10-28); rulings no ledger SDD.
related-docs:
  - docs/plans/codaqui-1-0/refatoracao-frontend-astro.md — spec da Fase 0 (linha 0.6 da tabela)
  - docs/superpowers/plans/2026-10-27-fase-0-5-multi-tenant-pages.md — fase anterior (multi-tenant)
  - docs/adrs/004-multisite-communities.md — superseda parcial (nota já registrada na 0.5)
agent-protocol:
  - Cada task = worktree próprio (branch fase-0-6/task-N a partir de develop), merge em develop quando DONE (ruling herdada), revisão depois.
  - Máximo 5 subagentes em paralelo (pedido do usuário).
-->

# Fase 0.6 — Cutover codaqui.dev: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cortar o codaqui.dev do GitHub Pages para o Cloudflare Pages (projeto `codaqui` já existe), removendo o Docusaurus do repo, migrando os redirects legados para `_redirects`, reescrevendo o AGENTS.md para o stack Astro e publicando a ADR 011.

**Architecture:** Todo o trabalho de repo (redirects, remoção do Docusaurus, CI, docs) acontece ANTES do corte de DNS — o GitHub Pages segue servindo codaqui.dev até a janela de cutover, e o `deploy-astro.yml` já publica o Pages a cada push. No cutover (janela curta, TTL ~5min): trocar o apex para CNAME → `codaqui.pages.dev` + attach dos custom domains (validação HTTP ocorre no pós-DNS). Rollback ensaiado = re-criar os 4 registros A do GitHub Pages (valores fixos neste plano).

**Tech Stack:** Astro 7 (existente em `frontend/`), Cloudflare Pages (projeto `codaqui` existente), GitHub Actions (`deploy-astro.yml` existente), DNS Cloudflare (API, zona `7d25116af2182b27811d350558152f1e`).

**Spec:** `docs/plans/codaqui-1-0/refatoracao-frontend-astro.md` (fase 0.6 da tabela + §Conteúdo/SEO e redirects + §Riscos #1 cutover).

## Global Constraints

- **Contratos intocados:** backend API, snapshots (`static/`), workflows de sync, Stripe, Giscus, gtag.
- **TTL já baixo**: registros apex com `ttl=1` (auto, ~300s no Free) — sem preparação de véspera.
- **NÃO TOCAR nos registros** `api`/`apps`/`firefox`/`ping`/`ssh` (Cloudflare Tunnel), `dados` (Streamlit), MX/SPF/DKIM/DMARC — o cutover mexe SÓ em apex `A` + `www` `CNAME`.
- **Rollback do DNS** (valores exatos, para o runbook): 4× `A codaqui.dev` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (DNS-only); `CNAME www` → `codaqui.github.io`.
- **Conteúdo canônico preservado**: `blog/`, `trilhas/`, `comunidades/`, `static/` permanecem na raiz (fontes copiadas pelos scripts do Astro). O que mora em `src/` e é consumido por scripts (`src/pages/*.md`, `src/data/{communities,social}.ts`) migra ANTES da deleção de `src/`.
- Zero hex hardcoded; commits pt-BR conventional; todo `.md` novo com header AGENT-INDEX; máximo 5 subagentes em paralelo; worktrees por task.
- A app Astro **permanece em `frontend/`** (ruling D1) — promoção à raiz, se desejada, é cleanup posterior.

## Decisões de arquitetura (fechadas neste plano)

- **D1 — Sem promoção de `frontend/` à raiz nesta fase.** O cutover de DNS é a parte de maior risco; reestruturar o repo na mesma janela multiplica risco sem ganho de produto. A spec diz "pode ser promovido" (opcional).
- **D2 — Migração mínima do conteúdo canônico**: os 4 `.md` de `src/pages/` viram canônicos em `frontend/src/content/pages/` (patches do `copy-content.mjs` aplicados uma vez, na migração); `src/data/{communities,social}.ts` vão para `scripts/data/` (mesma forma, novo path). `blog/`/`trilhas/` continuam na raiz como fonte do `copy-content`.
- **D3 — `diff-urls` passa a usar referência versionada**: antes de deletar o Docusaurus, gera-se `frontend/scripts/url-reference.json` (walk do `build/` final, sem `/@handle` — dinâmicos por build). O gate passa a verificar `dist ⊇ referência` + parsear `dist/_redirects` como URLs válidas. O `build/` deixa de ser dependência.
- **D4 — Redirects legados viram `_redirects`** (edge, 301) — os 15 stubs `RedirectStub.astro` são deletados; a lista exata está na T2.
- **D5 — Previews**: PRs ficam com build-check apenas (`astro-tenants` no pr-check); previews navegáveis continuam sendo os branch deployments do Pages (`develop.t...pages.dev` via push em develop, já existente).

---

### Task 1: Migração do conteúdo canônico que mora em `src/`

**Files:**
- Move: `src/pages/regex.md`, `src/pages/termos-de-compra.md`, `src/pages/sobre/conduta.md`, `src/pages/sobre/pais-responsaveis.md` → `frontend/src/content/pages/` (canônicos, versionados)
- Move: `src/data/communities.ts`, `src/data/social.ts` → `scripts/data/communities.ts`, `scripts/data/social.ts`
- Modify: `frontend/scripts/copy-content.mjs` (deixa de copiar `pages/`; continua copiando `blog/` + `trilhas/` da raiz)
- Modify: `frontend/.gitignore` (remove as entradas `src/content/pages/` e `public/blog-assets|trilhas-assets` conforme o novo modelo — PÁGINAS agora versionadas; blog/trilhas copiados continuam ignorados)
- Modify: `scripts/sync-social-stats.mjs` (paths `src/data/...` → `scripts/data/...`)
- Modify: `frontend/src/content.config.ts` se o glob de `pages` mudar (conferir — o schema `pages` lê `src/content/pages`; como o dir agora é versionado, o glob fica o mesmo, sem copy)

**Interfaces:**
- Produces: `frontend/src/content/pages/*.md` (4 arquivos, patches já aplicados — admonitions→blockquote e MUI→HTML nos 2 .mdx-like); `scripts/data/{communities,social}.ts` (exports inalterados).

- [ ] **Step 1:** Aplicar os patches manualmente equivalentes aos do `copy-content.mjs` nos 4 `.md` movidos (o copy faz substituições literais — leia o script e aplique o mesmo resultado final; o conteúdo já está em `frontend/src/content/pages/` no .gitignore, então compare o que hoje é gerado vs. o fonte e commite o GERADO como canônico).
- [ ] **Step 2:** Mover os 2 data files para `scripts/data/`; ajustar `sync-social-stats.mjs` (paths nas linhas que leem `src/data/…` — o parse é por regex, manter o formato do arquivo).
- [ ] **Step 3:** `copy-content.mjs`: remover o bloco que copia `pages/`; manter blog/trilhas. Atualizar comentários.
- [ ] **Step 4:** Rodar `cd frontend && npm run build && npm run check && npm run test` e `node --test scripts/*.test.mjs` na raiz + `npm run sync:social --dry` se existir modo (senão validar por leitura). Confirmar que as páginas /regex, /termos-de-compra, /sobre/conduta, /sobre/pais-responsaveis saem no dist com conteúdo idêntico ao anterior.
- [ ] **Step 5:** Commit `refactor(fase-0.6): migra conteúdo canônico de src/ para frontend/scripts`

---

### Task 2: `_redirects` legados + fim dos RedirectStub + diff-urls com referência versionada

**Files:**
- Modify: `frontend/scripts/build-tenant-redirects.mjs` → renomear responsabilidade para "extras de build" (manter nome do arquivo, atualizar header): quando TENANT vazio (codaqui), escrever `dist/_redirects` com os redirects legados abaixo; tenants continuam com as regras deles.
- Delete: `frontend/src/components/astro/RedirectStub.astro` e as 15 páginas-stub: `quero/{estudar,apoiar,mentoria}.astro`, `team.astro`, `contact.astro`, `conduta.astro`, `ong.astro`, `timeline.astro`, `sobre/timeline.astro`, `pais_responsaveis.astro`, `admin/transferencias.astro`, `blog/archive/{index,2022,2023,2024,2025}.astro`
- Create: `frontend/scripts/archive-urls.mjs` (gera a referência do build/ final)
- Create: `frontend/scripts/url-reference.json` (versionado, gerado pelo archive)
- Modify: `frontend/scripts/diff-urls.mjs` (modo referência versionada)

**Interfaces:**
- Produces: `dist/_redirects` do codaqui com (ordem: específicos antes de splats):
  ```
  /quero/estudar /participe/estudar 301
  /quero/apoiar /participe/apoiar 301
  /quero/mentoria /participe/mentoria 301
  /team /sobre/equipe 301
  /contact /contato 301
  /conduta /sobre/conduta 301
  /ong /sobre/ong 301
  /timeline /sobre/insights 301
  /sobre/timeline /sobre/insights 301
  /pais_responsaveis /sobre/pais-responsaveis 301
  /admin/transferencias /admin/lancamento?tab=transferencias 302
  /blog/archive /blog 301
  /blog/archive/2022 /blog 301
  /blog/archive/2023 /blog 301
  /blog/archive/2024 /blog 301
  /blog/archive/2025 /blog 301
  ```
  (302 no transferencias para não cachear query de tab; demais 301.)
- Produces: `url-reference.json`: array de URLs do `build/` final (walk recursivo `.html`/feeds, EXCLUINDO `/^\/@[^/]+/`), gerado por `node frontend/scripts/archive-urls.mjs` ANTES de qualquer deleção do Docusaurus (o script falha se `build/` ausente).
- diff-urls novo contrato: URLs válidas = (arquivos `.html`/feeds do dist) ∪ (targets de `dist/_redirects`); verifica referência ⊆ válidas; extras seguem informativos.

- [ ] **Step 1:** Estender o script de extras (`build-tenant-redirects.mjs`): bloco `else` (sem TENANT) escrevendo o _redirects acima. Testes: fixture escrita exata (estender o teste existente).
- [ ] **Step 2:** Criar `archive-urls.mjs` (walk de `ROOT/build`, toUrl reutilizando a lógica do diff-urls — extraia para um módulo comum pequeno se limpo, senão duplique com comentário) + gerar e commitar `url-reference.json`.
- [ ] **Step 3:** Reescrever `diff-urls.mjs` no modo referência: remove dependência de `OLD/build`; lê `url-reference.json`; acrescenta URLs de `_redirects` ao conjunto válido. Manter o guard anti-falso-verde (referência ausente → exit 1).
- [ ] **Step 4:** Deletar RedirectStub + as 15 stubs. `grep -rn "RedirectStub" frontend/src` deve zerar.
- [ ] **Step 5:** Gates: `cd frontend && npm run build` → `dist/_redirects` com as 16 linhas; `node scripts/diff-urls.mjs` verde contra o dist; `npx vitest run && npm run check`; confirmar que `/team` responde via `npx wrangler pages dev dist` com 301 → `/sobre/equipe`.
- [ ] **Step 6:** Commit `feat(fase-0.6): redirects legados em _redirects + stubs removidos + diff-urls com referência versionada`

---

### Task 3: Remoção do app Docusaurus + package.json raiz mínimo + Makefile/compose/.gitignore

**Files:**
- Delete: `src/`, `docusaurus.config.ts`, `sidebars.ts`, `tsconfig.json` (raiz), `jest.config.ts`, `jest.setup.ts`, `Dockerfile` (raiz), `CNAME` (raiz), `static/CNAME`, `site/`, `images/`, `.github/lighthouserc.json`, `.github/lighthouse-budget.json`
- Modify: `package.json` raiz → mínimo: scripts `astro:*`, `sync:*`, `sync`, `test:scripts`; devDeps: `playwright`, `wrangler` (remover TODAS as deps do Docusaurus/MUI/react/jest/ts-jest/testing-library/etc.)
- Modify: `.gitignore` (raiz): remover entradas de `build/`, `.docusaurus/`, `.cache/`, `site/`, `mkdocs-material/`, `venv/`, `sql-commands`, `workers/**/.wrangler/`; manter todo o resto
- Modify: `compose.yaml`: remover o serviço `docusaurus` (e redes/volumes só dele, se houver)
- Modify: `Makefile`: remover `frontend-clean/frontend-start/frontend-build/frontend-typecheck/frontend-serve`; ajustar `setup` e mensagens

- [ ] **Step 1:** Deleções (git rm -r). `images/`: grep por `images/header.png` antes (README antigo?) — se referenciado em .md que sobrevive, trocar para `static/img/` equivalente ou remover a referência.
- [ ] **Step 2:** `package.json` raiz mínimo — mantendo `engines` (node ≥24) e os scripts sync (que rodam com node built-ins + playwright). `npm install` na raiz deve ficar leve; `node --test scripts/*.test.mjs` verde.
- [ ] **Step 3:** compose config válido (`podman compose -f compose.yaml config -q`), Makefile sem targets quebrados (`make help` lista só o existente).
- [ ] **Step 4:** **Gates pós-corte de fato**: `npm run typecheck` some — substituir verificação por `cd frontend && npm run check && npm run test && npm run build && node scripts/diff-urls.mjs` + `make astro-verify-tenants` + backend build/test. Workflows da T4 ainda vão referenciar scripts removidos NESTE interim — a T3 e a T4 devem mergear JUNTAS ou em sequência imediata (mesma wave, T4 primeiro se conflitar: regra — T4 mergeia antes da T3).
- [ ] **Step 5:** Commit `chore(fase-0.6): remove o app Docusaurus — package.json raiz mínimo, compose/Makefile limpos`

---

### Task 4: Rework do CI (pr-check) + deleção dos workflows gh-pages

**Files:**
- Delete: `.github/workflows/gh-deploy.yml`, `pr-preview-deploy.yml`, `pr-preview-cleanup.yml`
- Modify: `.github/workflows/pr-check.yml`
- Modify: `.github/workflows/security` (Trivy skip-dirs: remover `build`, `old-docs-backup` se presentes)

**Interfaces:**
- pr-check final: jobs `metadata` (ajustar comentários), `backend-check`, `security-scan`, `coverage-report` (só backend), `astro-tenants` (existente), NOVO `astro-codaqui` (build codaqui + `npm run check` + `npm run test` no frontend) — sem deploy, sem secrets.
- Deletar jobs: `typecheck`, `frontend-tests`, `build`, `lighthouse`, `reuse-develop-preview`.

- [ ] **Step 1:** Deletar os 3 workflows gh-pages. `grep -rn "gh-pages\|previews/pr-" .github/workflows` deve zerar (exceto comentários históricos propositalmente atualizados).
- [ ] **Step 2:** pr-check: remover jobs Docusaurus; adicionar `astro-codaqui` (checkout, setup-node, `npm ci` em frontend, `npm run build && npm run check && npm run test`). `actionlint` 0 erros.
- [ ] **Step 3:** Commit `ci(fase-0.6): pr-check só Astro+backend; workflows gh-pages removidos`

---

### Task 5: README.md + DEVELOPMENT.md para o stack Astro

**Files:**
- Modify: `README.md` (raiz), `DEVELOPMENT.md`

- [ ] **Step 1:** README: stack Astro/Pages, badges/links, quickstart (`make astro-dev`), estrutura de dirs pós-0.6, remoção de menções Docusaurus/gh-pages. Manter CNPJ/licença/contato.
- [ ] **Step 2:** DEVELOPMENT.md: seção de setup sem `npm install` raiz pesado (frontend + backend), comandos (`make astro-*`, `make astro-verify-tenants`), deploy (Pages matrix; backend ARM64), tabela de secrets/vars (remover as só de gh-pages se houver), runbook multi-tenant (existente) mantido. AGENT-INDEX do arquivo preservado.
- [ ] **Step 3:** Commit `docs(fase-0.6): README e DEVELOPMENT.md no stack Astro`

---

### Task 6: AGENTS.md reescrito para o stack Astro

**Files:**
- Modify: `AGENTS.md` (reescrita completa)

- [ ] **Step 1:** Reescrever mantendo o formato (índice, tech stack, commands, directory structure, critical decisions, anti-patterns, PR checklist, convenções): Tech Stack do site = Astro 7 + ilhas React 19/MUI v9 + Tailwind v4 (tokens `--cq-*`), hosting Cloudflare Pages matrix (tenants em tenants.config.mjs, Pages Function de proxy em functions/[[path]].ts), backend NestJS inalterado. Commands: `make astro-verify`, `make astro-verify-tenants`, gates por build. Directory structure pós-corte (sem src/ Docusaurus). Decisões críticas: manter as do backend (events/ledger/roles/financial) + 0.5/0.6 (multi-tenant build matrix, noindex app, redirects _redirects, diff-urls versionado). Anti-patterns atualizados (sem `Grid item`, sem system props MUI, zero hex, conteúdo canônico em blog//trilhas/ na raiz copiado pelo copy-content, páginas community.config read-only). PR checklist: gates Astro + backend. Sobre/manutenção: sincismo de eventos/social-stats inalterado.
- [ ] **Step 2:** Commit `docs(fase-0.6): AGENTS.md reescrito para o stack Astro`

---

### Task 7: ADR 011 — Refatoração de frontend para Astro + multi-tenant por build matrix

**Files:**
- Create: `docs/adrs/011-frontend-astro-multi-tenant-pages.md`

- [ ] **Step 1:** ADR no formato das 001–004 (AGENT-INDEX + metadados + Contexto/Decisão/Estado/Consequências/Links): decisão Astro monolito (Abordagem A) + build matrix por tenant + Pages Function; status **implementado** (fases 0.1–0.6); nota de supersessão parcial da ADR 004 (whitelabel) com o que permanece válido; riscos mitigados (cutover rollback, previews, SEO paridade 100%).
- [ ] **Step 2:** Commit `docs(fase-0.6): ADR 011 — refatoração Astro + multi-tenant por build matrix`

---

### Task 8: Runbook de cutover + attach dos custom domains codaqui.dev/www

**Files:**
- Modify: `DEVELOPMENT.md` (seção "Cutover codaqui.dev (Fase 0.6)")

- [ ] **Step 1:** Attach via API (aguarda validação pós-DNS): `POST /accounts/{id}/pages/projects/codaqui/domains` para `codaqui.dev` e `www.codaqui.dev` (curl -4; token em /tmp/cf_codaqui_env). Verificar `pending`/erro "CNAME not set" — esperado.
- [ ] **Step 2:** Runbook no DEVELOPMENT.md: pré-checks (gate diff-urls verde, deploy-astro verde em develop/main), passos do cut (valores exatos dos registros atuais e novos), verificação pós-cut (curl -4: `/` 200 título Codaqui, /health via proxy, /comunidades/tisocial, /admin 200 noindex, RSS, sitemap.xml, amostra de ~30 URLs do url-reference sem 404), rollback (recriar os 4 A + www CNAME — snippet curl pronto), pós-estável (remover TXT `_github-pages-challenge-codaqui`, desabilitar GitHub Pages via API, deletar branch gh-pages — critério: 7 dias estável).
- [ ] **Step 3:** Commit `docs(fase-0.6): runbook de cutover do codaqui.dev + custom domains pendentes`

---

### Task 9: EXECUÇÃO do cutover (janela com o usuário)

> Gatilho: usuário confirma a janela. Somente DEPOIS das T1–T8 mergeadas e do deploy-astro verde.

- [ ] **Step 1:** Criar `CNAME codaqui.dev → codaqui.pages.dev` (proxied) e atualizar `CNAME www.codaqui.dev → codaqui.pages.dev`; deletar os 4 `A` do apex (curl -4; registrar ids antes).
- [ ] **Step 2:** Aguardar validação dos custom domains (`active`) e propagação (~5-10 min); verificar checklist do runbook (T8) em produção.
- [ ] **Step 3:** Smoke essencial: `/` (title), `/eventos`, `/transparencia`, `/admin` (noindex), login `/auth/github` → 302, doação, `/@<handle conhecido>`, RSS, sitemap. Registrar resultado.
- [ ] **Step 4:** Manter gh-pages intacto (rollback). Documentar no ledger: data/hora do cut, cf-ray de amostra, resultado.

---

### Task 10: Pós-cut estável (após ~7 dias, critério do usuário)

- [ ] **Step 1:** Desabilitar GitHub Pages do repo (`gh api -X DELETE /repos/codaqui/institucional/pages`), remover TXT `_github-pages-challenge-codaqui`, deletar branch `gh-pages` (`git push origin :gh-pages`), remover qualquer resto de `previews/` no ledger/docs.
- [ ] **Step 2:** Gates finais completos + commit `chore(fase-0.6): fim do GitHub Pages — DNS, custom domains e repo 100% no Pages`.

## Critérios de pronto (da spec, mapeados)

- [ ] DNS cortado com rollback ensaiado (T8 runbook + T9 execução)
- [ ] 0 404s em amostra (T9 verifica amostra; Search Console é do usuário — registrar dia do cut para acompanhamento)
- [ ] CI publicando em `main` (deploy-astro existente; T4 remove o legado)
- [ ] `_redirects` legados (T2)
- [ ] Remoção do Docusaurus e do `gh-deploy.yml` (T3/T4)
- [ ] AGENTS.md reescrito para o stack Astro (T6)
- [ ] Plano multisite marcado como substituído (✅ feito na 0.5)
- [ ] ADR 011 implementado (T7)

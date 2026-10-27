<!-- AGENT-INDEX
purpose: Report da Task 10 (Fase 0.5) — workflow de deploy matrix Astro no Pages + job de build de tenants no pr-check.
audience: mantainers, AI agents
status: concluída
sections:
  - Entregáveis (arquivos tocados)
  - Ruling da T1 aplicado (codaqui com TENANT vazio)
  - Correção de bug do brief (secrets em steps.if)
  - Validação (gates)
  - Desvios vs. brief
  - Pré-requisitos pendentes (T11 runbook)
  - Problemas pré-existentes encontrados (fora de escopo)
-->

# Task 10 — CI: deploy matrix Astro (Pages) + build de tenants no pr-check

**Status:** ✅ concluída — YAML validado (actionlint + pyyaml + simulação do matrix) e sanity `TENANT=tisocial` verde reproduzindo o comando exato do workflow (28 páginas, `_redirects` escrito).

## Entregáveis

| Arquivo | Mudança |
|---|---|
| `.github/workflows/deploy-astro.yml` | **Novo** — `push` em main/develop + `workflow_dispatch` (input `tenant`), matrix de 4 tenants, build em `frontend/` + deploy direct upload na raiz (`npx wrangler pages deploy`) |
| `.github/workflows/pr-check.yml` | **Job `astro-tenants` adicionado ao final** — mesmo matrix, só `npm ci --ignore-scripts` + `TENANT=… npm run build` (sem deploy, sem secrets). Aditivo: nenhum job existente foi alterado |

## Ruling da T1 aplicado (obrigatório)

O build codaqui **não aceita `TENANT=codaqui`** — `TENANT_BY_NAME` (frontend/tenants.config.mjs) só tem os 3 tenants e `astro.config.mjs:12` lançaria `TENANT desconhecido: codaqui`. Aplicado:

- Matrix entry codaqui é `{ tenant: "", project: codaqui, site: "https://codaqui.dev" }`.
- `TENANT` passado via `env:` do step (`TENANT: ${{ matrix.tenant }}`), não interpolado no `run` — string vazia é falsy no config (`TENANT ? … : null`) e cai no `srcDir: "./src"` (site principal).
- Nomes de steps usam `matrix.project` (codaqui com tenant vazio renderizaria `Build ()` se usasse `matrix.tenant`).

Simulação local replicando as linhas 10–14/22 do `astro.config.mjs` contra o matrix real:

```
codaqui      TENANT=""               srcDir=./src
tisocial     TENANT="tisocial"       srcDir=./src-tenants/tisocial
elasnocodigo TENANT="elasnocodigo"   srcDir=./src-tenants/elasnocodigo
devparana    TENANT="devparana"      srcDir=./src-tenants/devparana
```

## Correção de bug do brief: `secrets` em `steps.if`

O YAML verbatim do brief usava `if: ${{ secrets.CLOUDFLARE_API_TOKEN != '' && … }}` direto nos steps — **`secrets` não é contexto disponível em `steps.if`** (tabela oficial de disponibilidade de contextos; actionlint reprova). Na prática o workflow quebraria/seria avaliado incorretamente quando os secrets fossem criar. Corrigido com o padrão canônico:

```yaml
env:                                            # nível do job (secrets é válido aqui)
  HAS_CLOUDFLARE_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN != '' }}
steps:
  - if: ${{ env.HAS_CLOUDFLARE_TOKEN == 'true' && (github.event.inputs.tenant == '' || github.event.inputs.tenant == matrix.tenant) }}
```

Efeito preservado do brief: sem secrets, todos os steps do job são pulados e o job fica **verde**; com secrets, o filtro `github.event.inputs.tenant` seleciona um tenant único no dispatch (vazio = todos).

## Validação (gates)

| Gate | Resultado |
|---|---|
| `actionlint .github/workflows/deploy-astro.yml` | **0 erros** |
| `actionlint .github/workflows/pr-check.yml` | Só 2 erros **pré-existentes** no job `lighthouse` (linhas 356 e 371) — byte-a-byte idênticos aos da develop original (`git show develop:…`), fora do escopo desta task |
| Parse pyyaml + asserts estruturais | OK: triggers, `permissions: {}`, `concurrency: deploy-astro-${{ github.ref }}`, matrix idêntico nos 2 workflows, `cache-dependency-path: frontend/package-lock.json`, env do step, env de secrets do deploy, ausência de secrets/deploy no job do pr-check, diff de jobs do pr-check = apenas `+astro-tenants` |
| Simulação do matrix vs `astro.config.mjs` | 4 entries resolvem sem erro; codaqui cai no `src/` principal |
| Sanity `cd frontend && npm ci --ignore-scripts && TENANT=tisocial SITE_URL=https://tisocial.org.br npm run build` | **OK** — 608 pkgs, 28 páginas, `build-tenant-redirects: dist/_redirects escrito (TENANT=tisocial)` |

`npx vitest run` e `npm run check` não são afetados (nada em `frontend/src` foi tocado).

## Desvios vs. brief (todos deliberados)

1. **Ruling T1** (mandado pelo orquestrador): entry codaqui com `tenant: ""` + `TENANT` via `env:` + nomes com `matrix.project` — inclusive no job do pr-check.
2. **Guard de secrets via `env.HAS_CLOUDFLARE_TOKEN`** em vez de `secrets.*` direto no `if` (bug do brief, ver seção acima).

## Pré-requisitos pendentes (runbook T11)

- **Secrets de repo**: `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`. Sem eles o workflow de deploy faz skip de todos os steps (verde, sem build) — o pr-check passa a ser o gate de build de tenants até lá.
- **4 projetos Cloudflare Pages** com os nomes exatos `codaqui`, `tisocial`, `elasnocodigo`, `devparana`; production branch `main` (o `--branch=${{ github.ref_name }}` vira production só na main).
- **Atenção ao wrangler na raiz**: o step de deploy roda na raiz para reusar o `wrangler` das devDependencies do `package.json` raiz, mas o workflow só roda `npm ci` em `frontend/` — sem `node_modules` na raiz o `npx wrangler` baixa a versão latest do registry (funciona, mas ignora o pin `^4.87.0`). Recomendado no runbook: adicionar `npm ci --ignore-scripts` na raiz (guarded pelo mesmo `if`) quando os secrets forem criados, ou aceitar o download.
- O brief cita `make astro-verify-tenants` como fonte de verdade local — **esse target não existe** no Makefile (há só `astro-verify`, que cobre o build codaqui). Se o runbook quiser um gate local dos 4 tenants, o target precisa ser criado.

## Problemas pré-existentes (NÃO corrigidos, fora de escopo)

- `pr-check.yml` job `lighthouse`: `if: needs.metadata.outputs.reuse_develop_preview != 'true'` sem `metadata` em `needs` (avalia sempre `true`); shellcheck SC2162 (`read` sem `-r`) no step "Remove redirect-only pages". Ambos reprovados pelo actionlint já na develop.

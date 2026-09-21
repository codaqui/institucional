<!-- AGENT-INDEX
purpose: Plano de correção das vulnerabilidades de dependências (npm audit / Dependabot) tratáveis sem breaking changes.
audience: Mantenedores e AI agents executando a correção.
status: ready-to-execute — 2026-09-21 (develop 08c36e8)
sections:
  - Contexto e fonte dos dados
  - Resumo executivo
  - Princípios de execução
  - Onda 1 — Backend (runtime, P0)
  - Onda 2 — Frontend bundle de runtime (P1)
  - Onda 3 — Dev/CI em lote único (P2)
  - Critérios de pronto
  - Melhoria de processo (prevenção de recorrência)
related-docs:
  - AGENTS.md — convenção de commit, bump de versão do backend, validações
  - docs/plans/update/README.md — upgrades MAJORS (trilha separada, com breaking changes)
  - DEVELOPMENT.md — setup e comandos
agent-protocol:
  - Execute as ondas em ordem. Cada onda é um PR próprio.
  - NÃO use `npm audit fix --force` (pode puxar majors — esses ficam na trilha docs/plans/update).
  - Regenere o snapshot de audit no início da execução (`npm audit --json`) — novos advisories podem ter saído.
-->

# Plano de Correção de Vulnerabilidades (Dependabot/npm audit)

## Contexto e fonte dos dados

- **2026-09-21**, branch `develop` (commit `08c36e8`). GitHub reportou **130 alerts** no push (2 critical, 59 high, 52 moderate, 17 low) — esse número conta *instâncias* de alerta (pacote × manifest × caminho transitivo).
- O `gh api repos/codaqui/institucional/dependabot/alerts` retorna **403** com o PAT atual (escopo `repo`; o endpoint exige `security_events` ou `admin:repo_hook`). Ver "Melhoria de processo" ao final.
- Fonte utilizada: **`npm audit --json`** em ambos os workspaces — mesmo GitHub Advisory Database, colapsado em **46 advisories únicos**: **32 no frontend (2 critical) e 14 no backend (0 critical)**.
- Diferença 130 → 46: Dependabot contabiliza cada dependência vulnerável por caminho transitivo; `npm audit` agrupa por advisory. O levantamento local pode estar à frente do snapshot da `main`.

## Resumo executivo

**Todas as 46 vulnerabilidades têm correção dentro do range semver atual (patch/minor).** Nenhum breaking change é necessário para zerar o audit — os majors (MUI 9, TS 6, ESLint 10, Stripe 22) seguem na trilha separada de [`docs/plans/update/README.md`](../update/README.md).

| Workspace | critical | high | moderate | low | total |
|-----------|----------|------|----------|-----|-------|
| Frontend (`/`) | 2 | 13 | 14 | 3 | 32 |
| Backend (`/backend`) | 0 | 8 | 4 | 2 | 14 |

Comando de correção em ambos: `npm audit fix` (sem `--force`).

## Princípios de execução

1. **Sem `--force`**: `npm audit fix` sozinho só aplica patches/minors compatíveis com os ranges declarados. `--force` incluiria majors — proibido neste plano.
2. **Uma onda = um PR** (branch a partir de `develop`): Onda 1 backend, Onda 2 frontend bundle, Onda 3 dev/CI. Facilita rollback e isolamento de culpa se algo quebrar.
3. **Validação obrigatória por onda** (do AGENTS.md):
   - Frontend: `npm run typecheck && npm run build && npm run test:frontend`
   - Backend: `npm run build && npm run lint && npx jest` (dentro de `/backend`)
4. **Bump de versão do backend**: mudança em `backend/` exige bump semver em `backend/package.json` (fix → patch), conforme AGENTS.md.
5. **Regenerar o levantamento no dia da execução** — o snapshot abaixo é de 2026-09-21; rode `npm audit --json` de novo antes de cada onda.
6. Workflows usam `npm ci` — o lockfile commitado é a fonte da verdade; `package.json` só muda se um range precisar alargar (improvável, dado que todos os fixes cabem no range).

---

## Onda 1 — Backend (runtime, P0)

**Porque primeiro:** único workspace com código servido em produção (API NestJS em `api.codaqui.dev`). Todas as 14 advisories corrigidas num PR só — os fixes são patch/minor e o backend tem boa cobertura de testes como rede de segurança.

| Severidade | Pacote | Via | Natureza |
|------------|--------|-----|----------|
| high | `multer` <2.2.0 | `@nestjs/platform-express` | DoS via field names aninhados (multipart) |
| high | `@nestjs/platform-express` | direto (traz multer) | herda multer |
| high | `nodemailer` ≤9.1.0 | **direto** | `resolveContent()` ignora `disableFileAccess` |
| high | `form-data` <4.0.6 | transitivo | CRLF injection em multipart |
| high | `js-yaml` <3.15.0 | transitivo | DoS quadratic merge key |
| high | `browserslist`, `brace-expansion`, `fast-uri` | toolchain | DoS / memória (build e runtime auxiliar) |
| moderate | `typeorm` ≤0.3.28 | **direto** | SQL injection em Update/SoftDeleteQueryBuilder |
| moderate | `@nestjs/swagger` | direto | herda js-yaml |
| moderate | `qs` ≤6.15.1 | express | DoS remoto em `qs.stringify` |
| moderate | `baseline-browser-mapping` | toolchain | crash em input inválido |
| low | `@babel/core`, `body-parser` | toolchain/runtime | file read (source map) / DoS |

**Passos:**

```bash
cd backend
npm audit --json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['metadata']['vulnerabilities'])"  # snapshot antes
npm audit fix
npm run build && npm run lint && npx jest --silent
```

- Se `npm audit fix` não resolver `multer` (porque o fix exige `@nestjs/platform-express` > 11.1.19): `npm install @nestjs/platform-express@latest` dentro do minor compatível (`^11.x`) e revalidar.
- **Bump patch em `backend/package.json`** (ex.: 0.8.0 → 0.8.1).
- Commit: `fix(backend): corrige vulnerabilidades npm audit (multer, nodemailer, typeorm, qs, js-yaml)` + push → PR para `develop`.

**Pós-merge:** o workflow `publish-backend.yml` publica a imagem com a nova versão; acompanhar deploy em homologação antes de `develop → main`.

---

## Onda 2 — Frontend bundle de runtime (P1)

**Porque separada:** estes pacotes **embarcam no JS servido ao usuário** — não são só build. Risco real de XSS/DoS no navegador de quem acessa o site.

| Severidade | Pacote | Via | Natureza |
|------------|--------|-----|----------|
| critical | `shell-quote` ≤1.8.3 | transitivo (tooling que também pode vazar para scripts) | escape de newline em `.op` |
| critical | `websocket-driver` <0.7.5 | transitivo | bypass de resource limit via compressão |
| moderate | `mermaid` ≤11.14.0 | `@docusaurus/theme-mermaid` | sanitização `classDef` em state diagrams → XSS |
| moderate | `dompurify` ≤3.4.5 | `mermaid` + `jspdf` | sanitização IN_PLACE cross-realm |

> `mermaid` renderiza no cliente nas páginas de diagrama; `jspdf`+`dompurify` roda no fluxo de certificado. Os dois críticos são de tooling, mas entram no PR junto por serem a mesma operação de lockfile.

**Passos:**

```bash
npm audit fix
npm run typecheck && npm run build && npm run test:frontend
```

- Validar manualmente no preview: página de algum post com diagrama mermaid e o fluxo de certificado (emissão/download).
- Commit: `fix(deps): corrige vulnerabilidades do bundle de runtime (mermaid, dompurify, shell-quote, websocket-driver)`.

---

## Onda 3 — Dev/CI em lote único (P2)

**Restante do frontend (26 advisories)** — exposição limitada a desenvolvimento, CI e build: `webpack-dev-server`, `wrangler`/`miniflare`/`undici` (tooling Cloudflare), `sharp`/`image-size`/`svgo` (processamento de imagem no build), `postcss`/`postcss-selector-parser`/`nanoid`/`colord`/`fflate`/`joi`/`launch-editor`/`sockjs`/`uuid`/`http-proxy-middleware`/`esbuild`, `@babel/plugin-transform-modules-systemjs`.

**Passos:**

```bash
npm audit fix
npm run typecheck && npm run build && npm run test:frontend
```

- Commit: `chore(deps): npm audit fix do toolchain de dev/build`.
- Se algum pacote travar (ex.: `wrangler` fixado por range de outro pacote), tratar individualmente com `npm install <pkg>@<versão-patched>` e registrar no PR.

---

## Critérios de pronto

- [ ] `npm audit --json` em `/` e `/backend` reporta **0 vulnerabilidades** (ou só as documentadas como sem fix, com justificativa).
- [ ] Typecheck, build e testes verdes em ambos os workspaces após cada onda.
- [ ] Backend com `version` bumpada e imagem publicada pelo workflow.
- [ ] Preview validado: `/eventos` (fonte doity), página com mermaid, fluxo de certificado.
- [ ] `develop → main` com os 3 PRs mergeados e produção sem alertas novos no próximo push.

## Melhoria de processo (prevenir recorrência)

1. **Escopo do token local:** `gh auth refresh -h github.com -s security_events` (interativo) para o PAT passar a ler `gh api .../dependabot/alerts` diretamente. Alternativa não interativa: PAT fine-grained com permissão **Dependabot alerts: read**.
2. **Gate em CI:** workflow agendado (semanal) rodando `npm audit --audit-level=high` nos dois workspaces e abrindo issue/alerta quando > 0 — detecta antes do push.
3. **Dependabot security updates:** já ativo (é a origem dos 130 alerts). Opcional: `dependabot.yml` agrupando updates de patch/minor por workspace para reduzir PR noise.
4. **Trilha majors:** os alerts restantes após este plano serão major-only — continuar em [`docs/plans/update/README.md`](../update/README.md) (MUI 9, TS 6, ESLint 10, Stripe 22), 1 major por PR com janela de homologação.

---

## Anexo — reproduzir o levantamento

```bash
# Dependabot (precisa de escopo security_events/admin:repo_hook no PAT)
gh api repos/codaqui/institucional/dependabot/alerts --paginate --jq '.[] | {severity: .security_advisory.severity, package: .dependency.package.name, manifest: .dependency.manifest_path}'

# npm audit (fonte utilizada neste plano)
npm audit --json > /tmp/audit-root.json
(cd backend && npm audit --json > /tmp/audit-backend.json)

# totais
python3 -c "import json; print(json.load(open('/tmp/audit-root.json'))['metadata']['vulnerabilities'])"
python3 -c "import json; print(json.load(open('/tmp/audit-backend.json'))['metadata']['vulnerabilities'])"
```

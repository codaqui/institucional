<!-- AGENT-INDEX
purpose: Anexo do plano Codaqui 1.0.0 — itens transversais G3–G6 decididos pela presidência em 2026-10-29 (anti-captcha Cloudflare Turnstile, busca do site, certificados sem validade, retenção de auditoria). Mapeamento por fase (1a–7) com arquitetura proposta.
audience: Presidência, mantenedores, AI agents implementando as fases 1a em diante.
status: design registrado em 2026-10-29 (decisões G3–G6 da presidência); Turnstile = candidata aprovada Cloudflare Turnstile gratuita (site já está no Cloudflare); busca = recomendação Pagefind (site pós-Fase 0 não tem busca); certificados = decisão sem mudança de código; auditoria = retenção operacional 30 dias **configurável por painel admin** (ratificado) + governo permanente.
sections:
  - G3 — Anti-captcha (Cloudflare Turnstile): mapeamento, arquitetura, fallbacks, fase
  - G4 — Busca do site: comparativo, recomendação Pagefind, pontos de instalação, o que não busca, fase
  - G5 — Certificados sem validade: decisão registrada (nada a implementar; nota para ADR futura)
  - G6 — Retenção de auditoria: política governo (permanente) vs. operacional (30 dias), flag configurável, cron de purga, fase
related-docs:
  - docs/plans/codaqui-1-0/README.md — plano-mãe 1.0.0 (fases 1a→7, decisões de design)
  - docs/plans/codaqui-1-0/auth.md — guest claim (Fase 2, primeiro novo formulário anônimo; Turnstile obrigatório)
  - docs/plans/codaqui-1-0/c4p.md — submissão pública do C4P (Fase 7, Turnstile obrigatório)
  - docs/adrs/001-event-platform.md — plataforma de eventos (decisão #2: inscrição/check-in exigem conta, sem guest)
  - AGENTS.md — decisão 3 (proxy same-origin), decisão 9 (rotas noindex), padrões de backend
  - backend/src/audit/ — módulo de auditoria existente (tabela audit_logs, cleanup manual, retenção 90d hardcoded)
  - backend/src/app.module.ts — ThrottlerModule global (30 req/min/IP) já ativo
agent-protocol:
  - Este anexo REGISTRA decisões transversais — não criar código a partir dele sem o plano de implementação da fase correspondente.
  - Chaves/secrets citadas vivem em .env.example (templates) e em vars/secrets do repo — nunca commitar valores reais.
  - Fases citadas seguem o plano-mãe (1a→7); "1a/1b" refere-se ao split de 2026-10-05.
-->

# Itens transversais G3–G6 — Turnstile, Busca, Certificados e Auditoria

> **Origem:** decisões de presidência de 2026-10-29 (itens G3–G6) para o plano Codaqui 1.0.0. Este anexo consolida o design de cada item: mapeamento no site atual, arquitetura proposta, fallbacks e fase sugerida. Nenhum código é escrito aqui — cada item entra pelo plano de implementação da sua fase.

| Item | Decisão (2026-10-29) | Fase sugerida |
|---|---|---|
| **G3 Anti-captcha** | Cloudflare Turnstile (gratuito) | Infra na **1a**; obrigatório no guest claim da **Fase 2**, primeiro novo formulário anônimo |
| **G4 Busca** | Pagefind | **1b** |
| **G5 Certificados** | Sem validade — decisão registrada, zero código | — (nota na ADR futura de certificados/horas) |
| **G6 Auditoria** | Operacional 30d rotativo (**configurável por painel admin**, env como fallback) + governo permanente | **1a** |

---

## G3 — Anti-captcha: Cloudflare Turnstile

### Por Turnstile

- **Gratuito** e a conta Cloudflare da associação **já existe** — os 4 sites são projetos Cloudflare Pages no mesmo account.
- **Sem cookies próprios e sem persistência do token no nosso banco.** Cloudflare ainda processa dados técnicos da requisição (por exemplo IP e metadados do dispositivo); isso deve constar como compartilhamento com operador na P1/inventário, sem alegar ausência absoluta de PII.
- Alternativas com cookies/rastreamento ou maior fricção foram descartadas.

### Onde entra (mapeamento por formulário público)

| Formulário | Fase | Rota/endpoint | Turnstile |
|---|---|---|---|
| **Guest claim de evento** | 2 | `POST /events/public/guest-claim` — [auth.md](auth.md) | **Obrigatório; gate da fase** |
| **Candidatura de embaixador** | 4b | candidatura autenticada em `/universitario` | **Recomendado** contra automação; auth já reduz anonimato |
| **Pedido de mentoria** | 5 | `POST /mentorship/sessions` | **Obrigatório** |
| **Submissão C4P** | 7 | `POST /c4p/:slug/talks` | **Obrigatório** |
| **Inscrição de membro em evento** | atual | OAuth + inscrição autenticada | Não se aplica ao redirect OAuth |
| **Doação anônima** | atual | `POST /stripe/checkout-session` | **Fora da 1a**; reavaliar antes de habilitar, medindo fricção e fraude |

### Arquitetura

- **Frontend:** script oficial + wrapper `TurnstileField`, sem biblioteca de terceiros; chave pública `PUBLIC_TURNSTILE_SITE_KEY` por ambiente.
- **Backend:** `backend/src/common/turnstile/` com verificação `siteverify`, timeout de 5s, `success===true`, hostname exato, secret `TURNSTILE_SECRET` e proteção contra replay por hash em memória por 5 minutos.
- **Guard:** opt-in por rota, lendo `turnstileToken` do body ou `cf-turnstile-token`. Nenhuma rota existente recebe o guard na 1a.
- **Chaves por ambiente:** produção restringe os 4 domínios; dev/homologação usam pares próprios. Testes unitários e CI **mockam `fetch`** e não dependem das test keys nem de chamada externa; as test keys só podem ser usadas em um smoke manual explicitamente autorizado.

### Fallbacks e degradação

1. **Sem secret:** no-op com warn somente fora de produção; produção falha fechada com 503 e mensagem acionável.
2. **siteverify indisponível:** 503 transiente e retry; nunca registrar sucesso silencioso.
3. **Acessibilidade:** widget oficial navegável por teclado/screen reader e instrução junto ao submit.
4. **LGPD:** token não é persistido; somente hash temporário anti-reuso. O tratamento pela Cloudflare entra na P1 e no inventário.

**Fase:** infra testada na **1a**; aplicação no guest claim na **Fase 2** e nos demais formulários conforme suas fases. Doação não muda neste recorte.

---

## G4 — Busca do site

### Estado atual

O site pós-Fase 0 **não tem busca** (nenhum mecanismo indexado/bundled em `frontend/` — confirmado na árvore). A spec antiga da Fase 0 citava Pagefind como candidata; este anexo reavalia e recomenda.

### Comparativo curto

| Critério | **Pagefind** | Algolia DocSearch | FlexSearch (client-side) |
|---|---|---|---|
| Modelo | Index **estático gerado no pós-build** (`npx pagefind --site dist`), servido de `/pagefind/` no próprio site | SaaS externo (crawler + índice na Algolia) | Índice em JSON montado no build e buscado no browser |
| Custo | Grátis/OSS | Grátis para OSS **mediante aprovação** de aplicação (fora do nosso controle) | Grátis |
| JS no primeiro load | **Zero** (bundle só carrega na `/busca`) | Sim (dropdown embutido no header de toda página) | Sim |
| Integração Astro | **Padrão oficial da documentação do Astro** | Genérica | Pipeline próprio de índice para construir |
| pt-BR | Sim (stemming padrão) | Sim | Requer tuning manual |
| Multi-tenant (build matrix) | Index por build, sem custo de infra | Um app por domínio | Bundle por tenant |

**Recomendação: Pagefind.** É o padrão da comunidade Astro, indexa em pós-build sobre o HTML estático gerado (casa com a arquitetura "conteúdo canônico + build" da Fase 0), não adiciona JS ao primeiro load além do campo de busca, e não depende de aprovação de terceiros.

### Pontos de instalação

1. **Dependência/build:** `pagefind` em `devDependencies` de `frontend/package.json`; o script `build` passa a rodar `astro build && node scripts/build-tenant-redirects.mjs && pagefind --site dist` (index no diretório `dist/pagefind/`, servido estaticamente). Como `deploy-astro.yml` e `pr-check.yml` já invocam `npm run build`, **nenhuma mudança de workflow** é necessária; `make astro-verify` passa a cobrir o index automaticamente.
2. **Página `/busca`:** nova `frontend/src/pages/busca.astro` usando o componente padrão `pagefind-ui` (web component) com i18n pt-BR. Rota **noindex e fora do sitemap** (mesmo padrão das rotas de app — decisão 9 do AGENTS.md): página de busca não deve ser indexada.
3. **Atalho "/" (opcional, recomendado):** listener global de teclado que foca o campo de busca ao pressionar `/` fora de inputs (excluir campos de formulário); link "Buscar" no `SiteHeader` (desktop + drawer mobile).
4. **Exclusões:** o index cobre o conteúdo estático do dist — blog, trilhas, páginas institucionais, eventos gerados, comunidades. **Não indexa:** ilhas e rotas autenticadas (`/admin/*`, `/membro/*`, `/auth/*`, `/eventos/comprovante`, `/eventos/detalhe`) nem dados em runtime de API (transparência em tempo real, painéis). Mecanismo: atributo `data-pagefind-ignore` condicional no `BaseLayout` quando a página for `noindex` (exclusão automática pelo mesmo critério do sitemap) + exclusão de `/pagefind/` e `/_*` na config.
5. **Multi-tenant:** **fora de escopo no 1.0.0** — os sites whitelabel são pequenos e o index dobraria o tempo do build matrix. Apenas o portal codaqui ganha `/busca`. Tenants podem adotar depois com o mesmo mecanismo (decisão registrada).

**Fase:** **1b** (UX/transversal, junto ao refinamento da sidebar e da política de privacidade).

---

## G5 — Certificados sem validade (decisão registrada)

**Decisão da presidência (2026-10-29):** certificados são emissões por **tempo/presença em evento datado** — "a hora foi dada no dia". Eles **não têm validade**. Cabe a **quem usa o certificado** validar se a **data do evento** e a carga horária atendem ao seu propósito (horas complementares, comprovação de experiência, etc.).

**Consequência: nada a implementar.** O certificado atual já carrega data do evento + carga horária (`managed_events.workloadMinutes`, com fallback de duração — regra de derivação de 2026-10-05 no plano-mãe), e a verificação pública em `/certificado/verificar` confirma autenticidade. Nenhum campo de "validade até" será criado.

- **Nota para ADR futura:** incluir esta decisão ("certificados sem validade; verificação pela data do evento cabe ao consumidor") na ADR de certificados/horas da Fase 2 (ADR 006 — Diretorias e ledger de horas, ou ADR própria se a presidência preferir separar).
- **Microcopy opcional (1b):** na página de verificação, uma linha do tipo "Emitido em `<data do evento>` — sem validade; confira se a data atende ao seu propósito". Cosmético, não requisito.

---

## G6 — Retenção de auditoria

### Estado atual

- Tabela `audit_logs` (`backend/src/audit/entities/audit-log.entity.ts`) com `AUDIT_RETENTION_DAYS = 90` **hardcoded** e cleanup **somente manual** (`POST /audit/cleanup`, admin). Não há cron.
- O enum `AuditAction` mistura dois perfis de evento: **alto volume** (`auth.login/logout`, `event.checkin` — um registro por participante check-inado) e **baixo volume de governo** (concessão/revogação de papéis, aprovações, overrides). Com o 1.0.0 o volume operacional cresce (check-ins em todos os eventos externos ativados, horas), e o custo de retenção infinita deixa de fazer sentido.

### Política (decisão da presidência, 2026-10-29)

Separar em duas classes com retenções distintas:

| Classe | Conteúdo | Retenção |
|---|---|---|
| **Auditoria de governo** | Concessões e decisões: mudanças de `roles`, concessão de selo/tier, aprovações de horas/mentores/embaixadores, criação/encerramento de diretorias e projetos, assembleias, finalização de campanhas C4P, mudanças de vínculo de avaliador | **Permanente — nunca expira** (baixíssimo volume; é a trilha de atos da associação) |
| **Logs operacionais** | `auth.login/logout`, `event.checkin`, importações de participantes, syncs internos, overrides de evento, edição de templates de e-mail, cancelamentos Stripe | **Rotativo: 30 dias por padrão**, **configurável pelo painel admin** (ver implementação) para aumentar com o crescimento |

### Implementação proposta (backend, padrões do monorepo)

1. **Coluna `category`** em `audit_logs` (`'governance' \| 'operational'`, migration aditiva, default `'operational'` + índice composto `(category, createdAt)`). O mapeamento action → category vive junto ao enum `AuditAction` (código), não em banco.
2. **Retenção configurável por painel:** `AUDIT_OPERATIONAL_RETENTION_DAYS` (default **30**) como fallback de env; o valor efetivo fica em `app_settings` com `GET/PUT /settings/audit-retention` (role `admin`, audit em governo). O endpoint não usa `/admin/` para não colidir com as páginas estáticas no proxy. `AuditService` resolve env → settings, range 7–365.
3. **Painel admin:** página `/admin/configuracoes` com campo numérico e hint do valor efetivo/origem, seguindo o padrão de ilha + `authFetch` + `Alert`.
4. **Cron de purga:** diário às **03:17**, chamando `cleanupOperational()` somente para `category='operational'` fora da retenção efetiva. Categoria `governance` nunca entra na purga; a contagem removida vai ao log da aplicação.
5. **API admin:** `GET /audit/logs` ganha filtro `category`; `POST /audit/cleanup` executa a mesma política (manual = operacional apenas, com o retention efetivo). Swagger atualizado.
6. **LGPD/minimização:** retenções e bases legais entram na P1/inventário com revisão jurídica. Novos logs de governo não persistem `ipAddress` (desnecessário para uma trilha permanente); a migration zera esse campo nos registros classificados como governo, preservando ator, ação, alvo e data.

### O que nunca expira

Todo registro de **governo** — concessões de selo/horas/tier, papéis, aprovações de mentores/embaixadores, assembleias, finalizações C4P. Estes são a trilha permanente de atos administrativos da associação (princípio 2 do plano-mãe: "tudo auditável"); o volume é baixo e o custo de guardá-los é irrelevante ao lado do valor probatório.

**Fase:** **1a** (fundações de dados — a tabela e o módulo já existem; a migration da `category` + env + cron são aditivos e baratos, e a 1a já terá novas ações de governo: roles `diretor`/`voluntario`, selo, etc.).

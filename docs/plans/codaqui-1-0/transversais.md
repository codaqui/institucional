<!-- AGENT-INDEX
purpose: Anexo do plano Codaqui 1.0.0 — itens transversais G3–G6 decididos pela presidência em 2026-10-29 (anti-captcha Cloudflare Turnstile, busca do site, certificados sem validade, retenção de auditoria). Mapeamento por fase (1a–7) com arquitetura proposta.
audience: Presidência, mantenedores, AI agents implementando as fases 1a em diante.
status: design registrado em 2026-10-29 (decisões G3–G6 da presidência); Turnstile = candidata aprovada Cloudflare Turnstile gratuita (site já está no Cloudflare); busca = recomendação Pagefind (site pós-Fase 0 não tem busca); certificados = decisão sem mudança de código; auditoria = retenção operacional 30 dias configurável + governo permanente.
sections:
  - G3 — Anti-captcha (Cloudflare Turnstile): mapeamento, arquitetura, fallbacks, fase
  - G4 — Busca do site: comparativo, recomendação Pagefind, pontos de instalação, o que não busca, fase
  - G5 — Certificados sem validade: decisão registrada (nada a implementar; nota para ADR futura)
  - G6 — Retenção de auditoria: política governo (permanente) vs. operacional (30 dias), flag configurável, cron de purga, fase
related-docs:
  - docs/plans/codaqui-1-0/README.md — plano-mãe 1.0.0 (fases 1a→7, decisões de design)
  - docs/plans/codaqui-1-0/c4p.md — submissão pública do C4P (Fase 7, primeiro formulário público anônimo)
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
| **G3 Anti-captcha** | Cloudflare Turnstile (gratuito) | Infra na **1a**; obrigatório antes da **4b** (primeiro formulário público) |
| **G4 Busca** | Pagefind (recomendado neste anexo) | **1b** |
| **G5 Certificados** | Sem validade — decisão registrada, zero código | — (nota na ADR futura de certificados/horas) |
| **G6 Auditoria** | Operacional 30d rotativo (env configurável) + governo permanente | **1a** |

---

## G3 — Anti-captcha: Cloudflare Turnstile

### Por Turnstile

- **Gratuito** (até 1M verificações/mês, widgets ilimitados) e a conta Cloudflare da associação **já existe** — os 4 sites (codaqui + 3 tenants) são projetos Cloudflare Pages no mesmo account (`frontend/tenants.config.mjs`, `.github/workflows/deploy-astro.yml`).
- **Sem cookies e sem PII** no modelo padrão (desafio não interativo na maioria dos casos) — compatível com a política de privacidade P1 (a coleta será declarada lá) e com LGPD.
- Alternativas (reCAPTCHA, hCaptcha) foram descartadas: cookies/rastreamento e fricção desnecessária para uma ONG.

### Onde entra (mapeamento por formulário público)

| Formulário | Fase | Rota/endpoint | Público hoje? | Turnstile |
|---|---|---|---|---|
| **Submissão C4P** | 7 (G) | `POST /c4p/:slug/talks` (a criar — ver [c4p.md](c4p.md)) | Sim, anônimo (substitui Google Forms) | **Obrigatório** |
| **Candidatura de embaixador (Universitário)** | 4b (H) | página `/universitario` → candidatura com motivação | Sim (membro logado, formulário público) | **Obrigatório** |
| **Pedido de mentoria** | 5 (F) | `POST /mentorship/sessions` (a criar) | **Sim, 100% anônimo** (mentorando convidado: nome + e-mail, sem login) | **Obrigatório** |
| **Inscrição em evento** | — | hoje **não existe guest**: ADR 001 (decisão #2) exige conta GitHub para inscrever-se/check-in. O ponto de entrada público real é o início do OAuth (`/auth/github`) e o cadastro de inscrição autenticado | Parcial (o OAuth é público) | **Recomendado** no início do fluxo OAuth (barateia brute-force de redirects) e **obrigatório se um cadastro de guest for introduzido** no futuro (padrão convidado por token, como o mentorando — risco 12 do plano-mãe) |
| **Doação anônima** | existe | `POST /stripe/checkout-session` com `OptionalJwtAuthGuard` (anônimo ≤ R$ 100, `/participe/apoiar`) | Sim | **Recomendado** em modo managed/invisível: Stripe já tem sinais antifraude próprios e o throttler global (30 req/min/IP — `backend/src/app.module.ts`) já atua, mas é o único endpoint público de dinheiro. Decisão final no plano de implementação |

> **Nota de mapeamento:** o briefing citou "cadastro de guest em evento (auth.md)". Não há guest em evento no sistema atual (ADR 001) e não há `auth.md` no repo — o equivalente funcional hoje é o fluxo de autenticação OAuth + inscrição autenticada, e o candidato futuro é o registro de convidado por token. O desenho abaixo cobre os dois casos sem custo extra.

### Arquitetura

- **Frontend (widget):** script oficial `https://challenges.cloudflare.com/turnstile/v0/api.js` + `<div class="cf-turnstile">` no formulário, em ilha React própria (wrapper mínimo, sem lib de terceiros). Preferência pelo modo **managed** (não interativo na maior parte dos casos; checkbox apenas quando o Cloudflare desconfia). Chave pública do site injetada no build via env `PUBLIC_TURNSTILE_SITE_KEY` (mesmo padrão do `PUBLIC_STRIPE_PUBLISHABLE_KEY` em `deploy-astro.yml` — vars do repo por ambiente).
- **Backend (verificação):** `TurnstileService` em `backend/src/common/` faz POST em `https://challenges.cloudflare.com/turnstile/v0/siteverify` com `secret` + `token` + `remoteip` (opcional), timeout ~5s; resposta exige `success === true` e `hostname` conferindo com o domínio do request. Secret em `TURNSTILE_SECRET_KEY` (backend `.env`, nunca exposta; template em `.env.example`).
- **Guard:** `TurnstileGuard` (global opt-in por rota, igual ao pattern `JwtAuthGuard`/`RolesGuard`) lendo o token do body (`turnstileToken` no DTO) ou do header `cf-turnstile-token`. Aplicado SOMENTE nos endpoints públicos listados acima — nunca em rotas autenticadas de admin (login já é barreira).
- **Anti-reuso:** token é single-use com TTL de ~5 min; o service mantém um cache em memória dos tokens já validados (hash) para rejeitar replay dentro da janela.
- **Chaves por ambiente:** painel Turnstile da conta Cloudflare. Produção restringe os hostnames dos 4 domínios (mesmo account). Dev/homolog usam pares próprios; **CI usa as test keys públicas do Turnstile** (`1x0000000000000000000000000000000AA` sempre aprova, `2x0000000000000000000000000000000AA` sempre bloqueia), mantendo os testes de contrato do guard determinísticos.

### Fallbacks e degradação

1. **Sem secret configurado** (dev local): guard vira no-op com warn — mesmo padrão `SMTP_NOT_CONFIGURED` do módulo de e-mail. Em **produção sem secret** = erro de configuração → **fail-closed** nos formulários públicos ("verificação indisponível, tente novamente") + alerta operacional.
2. **siteverify fora/down:** erro 503 transiente no endpoint com mensagem amigável e retry no formulário (nunca silenciar o submit).
3. **Acessibilidade:** modo managed exibe checkbox nativo do Cloudflare (navegável por teclado/screen reader); se o desafio interativo aparecer, instrução clara ao lado do botão de envio.
4. **LGPD:** a verificação não grava PII no nosso banco — o token transitório não é persistido (só o cache de anti-reuso em memória). Declarar a coleta na política P1 (Fase 1b).

**Fase:** infra (service + guard + envs + workflow de chaves) na **1a**; aplicação em cada formulário público conforme a fase do subsistema, com **obrigatoriedade antes da Fase 4b** (primeiro formulário público do 1.0.0). Doação anônima pode receber o widget já na 1b.

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
| **Logs operacionais** | `auth.login/logout`, `event.checkin`, importações de participantes, syncs internos, overrides de evento, edição de templates de e-mail, cancelamentos Stripe | **Rotativo: 30 dias por padrão**, via flag configurável para aumentar com o crescimento |

### Implementação proposta (backend, padrões do monorepo)

1. **Coluna `category`** em `audit_logs` (`'governance' \| 'operational'`, migration aditiva, default `'operational'` + índice composto `(category, createdAt)`). O mapeamento action → category vive junto ao enum `AuditAction` (código), não em banco.
2. **Flag configurável:** env `AUDIT_OPERATIONAL_RETENTION_DAYS` (default **30**) lida no `AuditService` — substitui a constante hardcoded; documentar em `backend/.env.example`. Aumentar a retenção = mudar env, sem deploy.
3. **Cron de purga:** cron diário (ex.: 03:00, `CronExpression.EVERY_DAY_AT_3AM` — mesmo pattern dos crons do módulo `notifications`) chamando `cleanupOperational()`: `DELETE FROM audit_logs WHERE category='operational' AND createdAt < now() - <retention> days`. Categoria `governance` **nunca** entra na purga. Logar contagem removida.
4. **API admin:** `GET /audit/logs` ganha filtro `category`; `POST /audit/cleanup` executa a mesma política (manual = operacional apenas, com o retention do env). Swagger atualizado.
5. **LGPD/compliance:** retenção de 30 dias do operacional e permanência do governo (legítimo interesse/obrigação de prestação de contas de associação sem fins lucrativos) são **declarados na Política de Privacidade** (P1, Fase 1b) e no inventário `docs/modules/privacy/`.

### O que nunca expira

Todo registro de **governo** — concessões de selo/horas/tier, papéis, aprovações de mentores/embaixadores, assembleias, finalizações C4P. Estes são a trilha permanente de atos administrativos da associação (princípio 2 do plano-mãe: "tudo auditável"); o volume é baixo e o custo de guardá-los é irrelevante ao lado do valor probatório.

**Fase:** **1a** (fundações de dados — a tabela e o módulo já existem; a migration da `category` + env + cron são aditivos e baratos, e a 1a já terá novas ações de governo: roles `diretor`/`voluntario`, selo, etc.).

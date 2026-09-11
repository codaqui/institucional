<!-- AGENT-INDEX
purpose: Consolidação dos próximos passos do monorepo (investigação de 2026-09-10) para avaliação e coordenação pelo mantenedor. Resume status de cada área, pendências concretas, prioridades sugeridas e riscos.
audience: mantenedores, AI agents
status: snapshot de coordenação — atualizar ou regenerar após cada rodada de execução
sections:
  - Resumo executivo
  - Prioridade imediata (bugs e validações)
  - Eventos — UI/UX (Sprint 6 e pendências)
  - Eventos — Sync (Camada 3)
  - Multisite / comunidades
  - Real Network (RFC)
  - Atualização de dependências
  - Pendências operacionais e higiene
  - Varredura de bugs (2026-09-10)
related-docs:
  - docs/plans/event-uiux-improvements/README.md
  - docs/plans/events-sync-improvements/MAP.md
  - docs/plans/multisite/README.md
  - docs/plans/real-network/README.md
  - docs/plans/update/README.md
  - docs/README.md — índice central
agent-protocol:
  - Este arquivo é um snapshot gerado por investigação em 2026-09-10. Antes de agir sobre um item, confirme no código se ele continua pendente.
-->

# Próximos Passos — Consolidação (2026-09-10)

> Snapshot de coordenação gerado por varredura dos planos em `docs/plans/`, do código (frontend + backend), de branches e das issues abertas. Cada item aponta a evidência no código. **Revalidar antes de executar** — este documento envelhece rápido.

## Resumo executivo

| Área | Status | Próximo marco |
|------|--------|---------------|
| Eventos — UI/UX | Sprints 1–5 concluídas | Corrigir bug de reembolso; Sprint 6 (hub unificado) em planejamento |
| Eventos — Sync | Camadas 1–2 implementadas | Validar run em produção; Camada 3 aguarda aprovação |
| Multisite | Código à frente do plano (3 comunidades ativas) | Atualizar doc; onboarding de CamposTech e Cloud Native Maringá |
| Real Network | RFC teórico, nada implementado | Sprint 0 (handle Mastodon) é independente e barato (~1 dia) |
| Dependências | Patch/minor em dia; majors pendentes | Stripe 22 + ESLint 10 (PRs pequenos e independentes) |
| Financeiro | Follow-up conhecido aberto | Taxas Stripe de ingressos fora do ledger |
| Operacional | SMTP não configurado em prod | E-mails transacionais falhando (`SMTP_NOT_CONFIGURED`) |

---

## 🔴 Prioridade imediata

### 1. Bug financeiro no cálculo de reembolso (perfil do membro) — ✅ CORRIGIDO (2026-09-10)
- **Onde:** `src/pages/membro/index.tsx` — era `Math.round(Number.parseFloat(amount))` sem tratamento de centavos.
- **Fix:** helper `parseBrlInput` em `src/utils/transaction.tsx`, aplicado também em transferências (`admin/lancamento.tsx`) e `EventReimbursementDialog`.

### 2. Validar o sync de eventos em produção
- Única pendência da Rodada 1 de `events-sync-improvements` (`MAP.md:91`): conferir o log do próximo run do workflow `sync-event-snapshots.yml` — deve mostrar `N override(s) carregado(s)` com N>0 quando houver overrides no banco.
- **Bloqueia:** o início da Camada 3.

### 3. Configurar SMTP em produção
- Sem `SMTP_USER`/`SMTP_PASS` no servidor ARM64, todo e-mail transacional (confirmação de inscrição, lembrete D-1, pós-evento) é registrado como `failed`/`SMTP_NOT_CONFIGURED` (`backend/src/notifications/email.provider.ts:41`).
- Os crons rodam mesmo assim — o backlog de falhas acumula em `email_logs` (visível em `/admin/emails`).
- **Ação:** configurar credenciais Gmail SMTP (`.env.example:78-91`) e decidir o que fazer com os logs falhos acumulados.

### 4. Taxas Stripe de ingressos fora do ledger
- Doações capturam a taxa; ingressos de evento não — o fallback busca por `referenceId: <paymentIntentId>` e ingressos usam `event-ticket:<orderId>`, então a taxa é descartada com warn (`backend/src/stripe/stripe.service.ts:1226-1233`).
- **Ação:** no handler `handleEventTicketCheckoutCompleted` (`stripe.service.ts:772`), localizar a tx pelo `orderId` e registrar a taxa; se novo prefixo de `referenceId` for criado, sincronizar o classificador em `src/utils/transaction.tsx`.

---

## Eventos — UI/UX

Plano: `docs/plans/event-uiux-improvements/README.md`. Sprints 1–5 confirmadas no código. Pendências verificadas:

**Admin (`src/pages/admin/eventos.tsx`):**
- ✅ 2026-09-11: 3.2.3 confirmação na publicação, 3.2.5 edição de tipos de ingresso (PATCH), 3.3.2 select de timezone, 3.3.4 validação de slug, parsing de moeda robusto (falta só a máscara visual de 3.3.3), **bug crítico de edição** (`property slug should not exist` — payload PATCH não envia mais slug) e **campo de descrição longa** end-to-end (entity + Migration023 + snapshot + página pública).
- 3.2.4 Botão "Ver página pública" não desabilitado em rascunhos (só Tooltip).
- 3.3.4 restante: validar `endAt > startAt`.

**Checkout (`src/pages/eventos/detalhe.tsx`):**
- 3.4.1 Formulário não persiste pré-login (sessionStorage só cobre o return URL).
- 3.4.2 Redirect imediato pós-pagamento, sem confirmação suave.
- 3.4.4 Inscrição gratuita não permite "inscrever outra pessoa" (`AttendeeSection` retorna `null` para free).

**Check-in (`src/pages/admin/eventos-checkin.tsx`):**
- 3.5.2 Sem feedback tátil/sonoro nem auto-dismiss — **maior valor operacional no dia do evento**.
- 3.5.3 Evento selecionado não vai para a query string.
- 3.5.4 `checkinLoading` global desabilita todos os botões.

**Perfil / listagem pública:**
- 3.6.1 Aba "Carteira" mostra só reembolsos — renomear.
- 3.8.2/3.8.3/3.8.4 Busca textual, filtro na URL e badge de override ausentes em `src/pages/eventos.tsx`.

**Sprint 6 — Hub unificado 🟡:** não existe `/admin/eventos-hub`. Antes de iniciar: declarar `/admin/overrides` como legado (risco de trabalho paralelo conflitante, §6 do plano). Cada item implementado deve atualizar `docs/modules/events/CODE_MANUAL.md`.

---

## Eventos — Sync (Camada 3: eliminar o último PR)

Plano: `docs/plans/events-sync-improvements/` (Camadas 1–2 ✅ em 2026-09-04; Camada 3 design aprovado, **aguarda aprovação explícita do mantenedor**).

Sequência:
1. Validar produção (item 🔴 2 acima).
2. Criar secret `GITHUB_DISPATCH_TOKEN` (fine-grained, `actions:write`); documentar em `.env.example`/`DEVELOPMENT.md`.
3. Backend: dispatch `repository_dispatch` (`event_type: sync-event-snapshots`) com debounce ~60s, gated por env var; hookar em publicar/editar/cancelar managed events.
4. Workflow: `on: repository_dispatch` + `types: [sync-event-snapshots]`.
5. Admin: trocar botão de force-sync para o novo endpoint; remover `prUrl`/`prNumber` da UI.
6. Fase final: remover `syncInternalSnapshot`, rotas e testes; atualizar AGENTS.md e ADR 001.

⚠️ **Blast radius maior que o design sugere:** `GitHubDBService` também é usado por `members.service.ts:185` (token OAuth criptografado do membro) e `event-organizer.module.ts`. A remoção completa de `backend/src/github-db/` é um follow-up **separado** da troca do force-sync — exige decidir o destino do token do membro.

---

## Multisite / comunidades

**O código está à frente do plano.** `docs/plans/multisite/README.md` diz "Fase 1 em andamento / Fase 2 em stand-by", mas já existem 3 comunidades (`tisocial`, `elasnocodigo`, `devparana`) em `comunidades/index.ts:16-19`, com workers e domínios próprios na whitelist (`backend/src/common/allowed-origins.config.ts:12-17`). O link em `/sobre/ong` (marcado aberto no plano) já existe (`src/pages/sobre/ong.tsx:81-130`).

**Ações:**
1. **Atualizar `docs/plans/multisite/README.md`** — pré-condição para coordenar o resto (risco de decisão errada por doc defasado).
2. Medir tempo de build com 3 comunidades (plano exige alerta se > 1.5× baseline) **antes** de adicionar a 4ª.
3. Onboarding da restante que terá página (CamposTech): checklist em `docs/modules/community/COMMUNITY_SITES.md:37-46` — consulte https://campostechpg.com.br/ para buscar dados.
4. Checkbox técnicos abertos: testes unitários backend da whitelist/guard (§6.10), sitemap por comunidade com canonical correto, template de e-mail para troca de NS + runbook Cloudflare.
5. Adiados (sem ação agora): tabela `community_sites` no banco, migração para Cloudflare Pages (5+ comunidades), URLs limpas.
6. `elasnocodigo` e `devparana` não têm `blog/` — criar ao ativarem `features.blog`.

---

## Atualização de dependências

Plano: `docs/plans/update/README.md` (histórico de execução vazio — 0% executado). Ordem sugerida:

1. **Stripe SDK 21 → 22** (backend, risco baixo): código não usa `StripeContext`/`StripeError`; validar `npx jest src/stripe` + webhook em homologação. Atualizar `backend/README.md:34`.
2. **ESLint 9 → 10 + class-validator 0.14 → 0.15** (backend, PR conjunto pequeno).
3. **MUI 7 → 9** (frontend, risco médio, 1-2 dias): codemod `@mui/codemod v9.0.0/preset-safe` em commit isolado; testar `Autocomplete` das páginas admin + mobile. ⚠️ Novo baseline de browser (Chrome 117+/Safari 17+) — decisão de produto dado o público jovem com equipamentos antigos.
4. **TypeScript 5 → 6**: backend pode subir sozinho; frontend **bloqueado** até Docusaurus declarar suporte.
5. Antes de executar: regerar snapshot com `npm outdated` (exigência do próprio plano). Vulnerabilidades transitivas (DOMPurify, uuid) ficam reféns de upstream — só monitorar, sem `npm audit fix --force`.

---

## Pendências operacionais e higiene

- **Branches mortas:** `feature/tisocial-multisite` está 100% mergeada (0 commits à frente de `develop`); `.worktrees/` vazio. Apagar branches locais/remotas já mergeadas (confirmar remotas antes).
- **Migrations:** 22 migrations cobrem as 29 tabelas — em dia, nenhuma entidade órfã.
- **TODOs no código:** zero pendências reais marcadas (só falsos positivos de máscaras de CPF/CNPJ).
- **Docs a sincronizar a cada PR:** AGENTS.md e `backend/README.md:27-34` fixam versões (MUI v7, TS 5.7, Stripe 21, class-validator 0.14) — atualizar junto com cada upgrade.

---

## Varredura de bugs (2026-09-10)

Varredura sistemática em frontend, backend, workers e scripts. **30+ bugs corrigidos na develop** (build front ✅, 376 testes front ✅, 623 testes backend ✅, backend em `0.6.1`).

### Corrigidos

**Frontend:**
- Parsing monetário centralizado em `parseBrlInput` (`src/utils/transaction.tsx`) — reembolso arredondava para inteiro (`membro/index.tsx`), transferência idem (`admin/lancamento.tsx`), separador de milhar quebrava valor em 1000x (`EventReimbursementDialog`, preços de ingresso em `admin/eventos.tsx` e `admin/overrides.tsx`).
- Botão de doação mensal exibia "/ano" (`DonationFlow`); recibo PDF com "@@handle" e nome do doador nunca resolvido (`DonationReceiptPdf`); estornos classificados como "Estorno de Doação" no portal (novos tipos `*-reversal`); CSV exportado com colunas quebradas por vírgula (`TransactionTable`).
- Admin: spinner eterno em falha de rede (`eventos.tsx`, `empresas.tsx`, `sorteios.tsx`); erro invisível em excluir/reverter reembolso e excluir fornecedor; `updateStatus` otimista sem checar resposta (`empresas.tsx`); sorteio (financeiro) sem confirmação nem guard de double-click — agora com `ModalConfirm`; guards de double-click em publicar/staff (`eventos.tsx`) e câmera do check-in; data epoch `31/12/1969` com `paidAt` null; `extractErrorMessage` juntando arrays do ValidationPipe; `canManage` stale após expirar sessão (`eventos/detalhe.tsx`); evento sem data válida sumindo da listagem pública (`eventos.tsx`).

**Backend:**
- **Stripe:** renovações de assinatura evaporavam com a API `2026-03-25.dahlia` (resolver agora lê `invoice.parent.subscription_details` com fallback legado); `checkout.session.completed` processava sessão `unpaid` (boleto/Pix) — agora ignorada + handlers `async_payment_succeeded/failed`; order de evento era marcada PAID antes dos efeitos (retry do Stripe virava no-op) — agora claim atômico + rollback para PENDING em falha + dedup de registrations; Checkout Session de ingresso criada sem `expires_at` — agora alinhada à expiração da order (31 min).
- **Eventos:** `refundOrder` impossível para eventos externos (agora resolve conta por `externalActivationId`); check-in e certificado aceitos para inscrição estornada/cancelada (rejeitados); cancelamento de inscrição PAGA sem estorno (agora 409 orientando refund); refund parcial usava preço atual do lote em vez do valor pago; rota pública vazava `attendeeName`.
- **Expenses (módulo dormente):** misturava centavos com reais (R$150 → R$15.000 no ledger) — DTO agora em centavos + `referenceId: expense:<id>`.
- **Ledger:** totais do Portal de Transparência inflados por estornos — reversals excluídos de `totalReceived`/`totalExpenses`.

**Scripts/workers:**
- Falha no Discord derrubava o snapshot inteiro de social-stats (agora degradado); default da API local na porta errada (`3000`→`3001`); Meetup cancelado com data passada virava "completed" (ordem dos checks + duração default 3h); override "zumbi" persistia após deleção (raw.json por fonte + re-aplicação do zero).
- Worker: cookie de sessão vazava para o GitHub Pages no pass-through estático (sanitizado); prefixos de API faltando (`/events/`, `/reimbursements/`, `/companies/`, `/club/`, `/vendors/`, `/account-transfers/`, `/admin/`, `/notifications/`) — checkout e verificação de certificado quebrados nos domínios whitelabel; `content-encoding` removido na resposta reescrita.

### Backlog (requerem decisão/refactor — não corrigidos)

1. **Atomicidade do ledger:** `LedgerService.recordTransaction` abre transação própria — callers que embrulham em `dataSource.transaction` não têm atomicidade real (estados partidos, retry com referenceId novo → débito/estorno duplo em reembolsos; transfer travada em unique violation). Refactor arquitetural.
2. **Race de saldo em aprovação de reembolso:** lock `pessimistic_write` é na linha do reembolso, não na conta — duas aprovações concorrentes sobre a mesma carteira passam juntas (saldo negativo).
3. **Rejeição × aprovação concorrentes** (`rejectRequest` sem lock em reimbursements e transfers): estado final pode ser "rejeitado" com dinheiro movido.
4. **Idempotência de refund de ingresso:** gap check-then-insert + `referenceId` com `Date.now()` → reversal duplicado em corrida webhook × admin; quota pode ser devolvida em dobro (`releaseEventTicketQuota` em ambos os caminhos).
5. **Refund total após cancelamento de ingresso pago:** combinação cancel+refund pode estornar o charge inteiro incluindo ingresso já cancelado (comunidade arca).
6. **Cancelar 1 assinatura congela SortCoins mesmo havendo outra ativa** (`stripe.service.ts` ~508-529).
7. **`fetchActiveSubscriptions` trunca em 100/status sem paginar** — contagens públicas do Clube ficam menores que as reais com 100+ assinaturas.
8. **Paginação backend × filtros client-side no hub de eventos** (`admin/eventos.tsx`): com paginação ativa, busca/filtros só varrem a página carregada e `pageCount` usa total não filtrado. Atrelado ao Sprint 6 (hub unificado).
9. **`amount` não-inteiro no checkout de doação vira 500** (`stripe.controller.ts` ~175-188): falta `Number.isInteger` → 400.
10. **Webhook Stripe no Dashboard:** assinar `checkout.session.async_payment_succeeded`/`async_payment_failed` (config fora do código).
11. **`MembersWall` usa `customFields.apiUrl` direto** sem `resolveApiUrl` — não passa pelo worker em domínio whitelabel.
12. **Override "zumbi" — transição:** snapshots legados sem `raw.json` perdem o badge falso mas mantêm campos mesclados antigos por 1 run; normaliza sozinho no próximo sync por fonte.

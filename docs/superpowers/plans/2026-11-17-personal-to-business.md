<!-- AGENT-INDEX
purpose: Plano TDD da Fase 8b.3 — conversão recuperável de assinatura pessoal mensal em apoio empresarial sem nova cobrança.
audience: Implementers e revisores
status: Em execução em develop
sections:
  - Constraints e review focus
  - Tasks 1–5
  - Gates e rollout
related-docs:
  - ../specs/2026-11-17-personal-to-business-design.md — desenho com decisões de empresa pendente e recorrência mensal
  - ../../adrs/003-club-business-pj.md — regras atuais
agent-protocol: Executar em develop após ratificação; nenhuma conversão real, refund, cancelamento ou backfill.
-->

# Personal to Business Subscription Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que admin configure o perfil da empresa e converta uma assinatura pessoal mensal ativa em apoio empresarial preservando a mesma assinatura, histórico e wallets.

**Architecture:** Migration 052 registra a conversão e serializa por `subscriptionId`. Um service dedicado valida Stripe/empresa, atualiza somente metadados e recupera trabalho pendente; a UI admin usa busca de membros e confirmação explícita.

**Tech Stack:** NestJS 11, TypeORM 0.3.28, PostgreSQL 18, Stripe SDK 21, Jest 30, React 19, MUI 9, Vitest, Node 24.

**Spec:** `docs/superpowers/specs/2026-11-17-personal-to-business-design.md`

## Global Constraints

- Trabalhar em `develop` somente após ratificação e sem conversão real durante testes.
- Não criar checkout/assinatura, cancelar, reembolsar, mudar preço/período, reclassificar ledger ou transferir moedas.
- Somente assinatura pessoal mensal ativa; empresa nova permanece `pending` e empresa existente preserva status.
- Sem e-mail/token/customer/metadados completos na tabela de conversão, snapshot ou fixtures.
- Usar `/mentorship/member-options` e os prefixos de proxy atuais; sem `/admin/` na API.
- Bump minor, changelog e ADRs somente após código verificado.

## Review Focus

- Admin edita somente perfil permitido; CNPJ, assinatura, status, tier e selo não mudam e o update parcial não sobrescreve vínculos Stripe (Task 3).
- Empresa nova não pode virar pública/selo/badge por conversão (Task 4).
- Assinatura anual, `past_due`, de outro membro ou de outra empresa é recusada sem escrita (Task 4).
- Falha após Stripe deve ser retomável sem nova cobrança ou empresa duplicada (Task 4).
- Repetição/concorrência retorna `already_converted` sem nova escrita Stripe (Task 4).
- Invoices antigas, wallet pessoal e moedas não mudam; somente eventos futuros usam empresa (Task 4).

---

### Task 1: Migration, entidade e ação de auditoria

**Files:**
- Create: `backend/src/migrations/1794900000000-CompanySubscriptionConversion052.ts`
- Create: `backend/src/companies/entities/company-subscription-conversion.entity.ts`
- Create: `backend/src/companies/company-subscription-conversion.migration.spec.ts`
- Modify: `backend/src/audit/entities/audit-log.entity.ts`
- Modify: `backend/src/audit/audit-category.ts`
- Test: `backend/src/audit/audit-category.spec.ts`
- Modify: `backend/src/companies/companies.module.ts`

**Interfaces:**
- Produces: entidade com `id`, `stripeSubscriptionId` único, `memberId`, `companyId`, `requestedById`, `status`, `createdAt`, `updatedAt`, `completedAt`.
- Produces: `AuditAction.COMPANY_SUBSCRIPTION_CONVERTED = 'company.subscription_converted'` como governo.

- [ ] **Step 1: Escrever testes falhos**

Verificar tabela, campos mínimos, unique da assinatura, down/up e classificação de governo. Atualizar a contagem de ações pelo valor atual +1.

- [ ] **Step 2: Confirmar a falha**

Run: `cd backend && npx jest src/companies/company-subscription-conversion.migration.spec.ts src/audit/audit-category.spec.ts --runInBand`
Expected: FAIL porque migration/entidade/ação não existem.

- [ ] **Step 3: Implementar e verificar**

Criar migration reversível, entidade e registro no módulo/auditoria. Repetir o comando até PASS.

### Task 2: Candidatos mensais por membro

**Files:**
- Create: `backend/src/companies/company-subscription-conversion.service.ts`
- Test: `backend/src/companies/company-subscription-conversion.service.spec.ts`
- Modify: `backend/src/companies/companies.controller.ts`
- Test: `backend/src/companies/companies.controller.spec.ts`
- Modify: `backend/src/companies/companies.module.ts`

**Interfaces:**
- Produces: `listPersonalSubscriptions(memberId)` retornando `{id,amountCents,interval,currentPeriodEnd}`.
- Produces: `GET /companies/admin/personal-subscriptions?memberId=<uuid>` com JWT + admin.

- [ ] **Step 1: Escrever testes falhos**

Verificar busca por status/memberId, filtro de business/anuais, projeção sem customer/PII, período no formato atual do item e rejeição de UUID inválido/não admin.

- [ ] **Step 2: Confirmar a falha**

Run: `cd backend && npx jest src/companies/company-subscription-conversion.service.spec.ts src/companies/companies.controller.spec.ts --runInBand`
Expected: FAIL porque o service/rota não existem.

- [ ] **Step 3: Implementar busca e rota**

Usar Stripe search com UUID validado, status ativo e memberId, derivar preço/intervalo/período do item atual e registrar provider no módulo.

- [ ] **Step 4: Verificar**

Repetir o comando até PASS.

### Task 3: Configuração administrativa do perfil da empresa

**Files:**
- Create: `backend/src/companies/company-profile.ts`
- Test: `backend/src/companies/company-profile.spec.ts`
- Modify: `backend/src/companies/companies.service.ts`
- Test: `backend/src/companies/companies.service.spec.ts`
- Modify: `backend/src/companies/companies.controller.ts`
- Test: `backend/src/companies/companies.controller.spec.ts`
- Modify: `backend/src/audit/entities/audit-log.entity.ts`
- Modify: `backend/src/audit/audit-category.ts`
- Test: `backend/src/audit/audit-category.spec.ts`

**Interfaces:**
- Produces: `CompaniesService.updateManagedProfile(companyId, dto, actor)` para admin, usando `UpdateCompanyDto`.
- Produces: `AuditAction.COMPANY_PROFILE_UPDATED = 'company.profile_updated'` como governo.
- Preserves: acesso do responsável atual por `PATCH /companies/:id`.

- [ ] **Step 1: Escrever testes falhos**

Cobrir admin editando nome legal, nome fantasia, logo e website; responsável mantém acesso; CNPJ/assinatura/status/tier/selo inalterados; update parcial não apaga vínculo Stripe; URLs inválidas falham; auditoria contém antes/depois.

- [ ] **Step 2: Confirmar a falha**

Run: `cd backend && npx jest src/companies/companies.service.spec.ts src/companies/companies.controller.spec.ts src/audit/audit-category.spec.ts --runInBand`
Expected: FAIL porque o método/ação não existem.

- [ ] **Step 3: Implementar edição e verificar**

Usar lock da empresa, permitir admin sem remover o caminho do responsável e fazer update parcial somente das colunas presentes no DTO. Criar helper HTTPS com `new URL`, sem allowlist de comprovantes, compartilhado por cadastro/edição/conversão. Auditar sem dados desnecessários. Repetir o comando até PASS.

### Task 4: Conversão recuperável e idempotente

**Files:**
- Modify: `backend/src/companies/company-subscription-conversion.service.ts`
- Test: `backend/src/companies/company-subscription-conversion.service.spec.ts`
- Modify: `backend/src/companies/companies.controller.ts`
- Test: `backend/src/companies/companies.controller.spec.ts`
- Modify: `backend/src/companies/companies.module.ts`

**Interfaces:**
- Produces: `convert(dto, actor)` e `POST /companies/admin/subscription-conversions` retornando `{conversionId,companyId,subscriptionId,status:'converted'|'already_converted'}`.
- Consumes: migration/entidade da Task 1 e Stripe da Task 2.

- [ ] **Step 1: Escrever testes falhos da matriz de conversão**

Cobrir status/recorrência/membro inválidos, empresa de outro responsável, CNPJ duplicado, empresa nova `pending`, empresa existente preservada, mesma assinatura/metadados, idempotência, concorrência, falha antes/depois de Stripe e ausência de ledger/backfill.

- [ ] **Step 2: Confirmar a falha**

Run: `cd backend && npx jest src/companies/company-subscription-conversion.service.spec.ts src/companies/companies.controller.spec.ts --runInBand`
Expected: FAIL porque `convert` não existe.

- [ ] **Step 3: Implementar fluxo recuperável**

Criar/reutilizar conversão com unique + lock, validar estado atual, aplicar o helper HTTPS da Task 3 à empresa nova, atualizar somente quatro metadados, vincular empresa/wallet e marcar conclusão. Em retry após sucesso externo, completar somente o que falta. Auditar e responder sem segredos.

- [ ] **Step 4: Verificar módulo completo**

Run: `cd backend && npx jest src/companies src/stripe --runInBand`
Expected: PASS.

### Task 5: Aba admin, documentação e rollout

**Files:**
- Create: `frontend/src/components/islands/admin/empresas/SubscriptionConversionPanel.tsx`
- Create: `frontend/src/components/islands/admin/empresas/SubscriptionConversionPanel.test.tsx`
- Modify: `frontend/src/components/islands/admin/empresas/EmpresasApp.tsx`
- Test: `frontend/src/components/islands/admin/empresas/empresas.test.tsx`
- Modify: `docs/adrs/003-club-business-pj.md`
- Modify: `docs/adrs/010-business-tiers.md`
- Modify: `docs/plans/pos-1-0/README.md`

**Interfaces:**
- Consumes: endpoints das Tasks 2 e 4, edição da Task 3 e `/mentorship/member-options`.
- Produces: aba **Converter assinatura** somente admin.

- [ ] **Step 1: Escrever testes falhos da UI**

Cobrir busca de membro, candidatos mensais, empresa existente/nova, CNPJ, nome legal/fantasia, logo/website, salvamento separado do perfil, confirmação da mesma assinatura, empresa nova pendente, erro e repetição `already_converted` sem nova conversão.

- [ ] **Step 2: Confirmar a falha**

Run: `cd frontend && npx vitest run src/components/islands/admin/empresas`
Expected: FAIL porque painel/aba não existem.

- [ ] **Step 3: Implementar painel e documentar**

Integrar busca, seleção, empresa e confirmação com `authFetch`; atualizar ADRs/roadmap sem antecipar release.

- [ ] **Step 4: Verificar**

Repetir o comando até PASS.

### Gates e rollout

- [ ] Migration 052 down/up em dump isolado, preservando empresas/vínculos existentes.
- [ ] Jornada sintética: empresa nova permanece pendente; mesma assinatura; repetição `already_converted`; invoice futura segue metadados empresariais; histórico/wallet pessoal preservados.
- [ ] `cd backend && npm run build && npx jest --silent`
- [ ] `make astro-verify` e `make astro-verify-tenants`
- [ ] Atualizar changelog/versões com bump minor; revisão independente e PR para `develop`.
- [ ] Publicar migration/backend/frontend; somente depois executar uma conversão real expressamente autorizada e conferir a próxima invoice.

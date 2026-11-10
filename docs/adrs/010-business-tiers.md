<!-- AGENT-INDEX
purpose: ADR da Fase 6 — Empresa Amiga/Aliada, due diligence, vitrine e badges SVG.
audience: AI agents, mantenedores, administração e operadores de release.
status: Implementado e verificado em dump real; PR para develop, release 0.21.0, sync inicial e validação controlada pendentes.
sections:
  - Contexto e decisão
  - Modelo e regras
  - APIs e privacidade
  - Admin, membro e hotpage
  - Badges e retenção
  - Verificação e rollout
related-docs:
  - 003-club-business-pj.md — fluxo financeiro e ativação de empresas
  - 013-hour-ledger.md — padrão de badges atômicos
  - ../superpowers/specs/2026-11-10-business-tiers-design.md — design aprovado
  - ../superpowers/plans/2026-11-10-business-tiers.md — plano TDD e evidências
agent-protocol:
  - Não alterar Stripe, wallet, ativação manual ou congelamento por inadimplência.
  - Aliada exige status active, evidência HTTPS e validação admin; badge nunca contém evidência ou notas.
  - Aliada vencida fica sem selo até renovação; não há downgrade diário.
-->

# ADR 010 — Business tiers

- **Data da decisão:** 2026-11-10
- **Status:** Implementado e verificado; integração e publicação pendentes
- **Escopo:** Backend 0.21.0, migration 045, due diligence, hotpage e badges PJ

## Contexto e decisão

O módulo `companies` já tinha CNPJ, assinatura, ativação manual, carteira e patrocinadores, mas não diferenciava apoio financeiro de engajamento comprovado. A listagem pública também espalhava a entidade inteira, incluindo IDs internos.

A Fase 6 cria **Empresa Amiga** como o apoio financeiro atual e **Empresa Aliada** como nível validado por evidência. Uma única evidência atual por empresa atende a regra sem criar uma tabela relacional desnecessária.

## Modelo e regras

A migration 045 adiciona `tier`, `engagementCriterion`, `evidenceUrl`, `validationNotes`, `validatedAt`, `validatedByMemberId` e `sealValidUntil`. Todas as empresas existentes permanecem `amiga`.

Validar Aliada exige `status=active`, um critério (`workshop`, `hiring`, `business_event`) e uma URL HTTPS aceita pelo `StorageService`. Admin grava validação e validade de um ano. Definir Amiga preserva evidência/notas de auditoria e não altera assinatura.

Amiga recebe selo enquanto o apoio está ativo. Aliada recebe selo somente com apoio ativo e validade vigente. Aliada vencida fica como **renovação pendente** no admin e fora do endpoint de badges, mas permanece na vitrine e não sofre downgrade automático.

## APIs e privacidade

- `PATCH /companies/:id/tier`: valida Aliada ou retorna para Amiga, somente admin, com auditoria.
- `GET /companies/badges/public`: retorna somente `id`, `name`, `tradeName`, `tier` e `sealValidUntil` das empresas elegíveis.
- `GET /companies/sponsors`: mantém métricas e acrescenta `tier`, `sealValidUntil` e `sealActive`.

Todas as projeções usam allowlists explícitas. `responsibleMemberId`, IDs Stripe, critério, evidência, notas e aprovadores não são públicos.

## Admin, membro e hotpage

`/admin/empresas` mostra tier, validade, diálogo de evidência, validação, downgrade e renovação. `/membros/empresa` mostra preview do SVG e snippets Markdown/HTML quando elegível, ou orientação de renovação.

A hotpage `/empresas` apresenta proposta de valor, comparação de níveis, benefícios, captação a partir de R$ 200/mês, jornada de Aliada e vitrine. `SponsorsIsland` mostra Amiga, Aliada e renovação pendente sem esconder a empresa.

## Badges e retenção

`sync-company-badges.mjs` consulta `/companies/badges/public`, valida toda a coleção, escapa XML e escreve `static/badges/empresas/<uuid>.svg` atomicamente. UUID mantém o caminho estável mesmo se o nome mudar.

O sync remove obsoletos somente após sucesso e restaura o estado anterior em falha. `COMPANY_BADGES_API_URL` usa `http://localhost:3001` por padrão; o workflow diário é 06:19 UTC + dispatch e fica fora do agregador `npm run sync`.

Evidências, notas, responsável, critérios, aprovadores e IDs Stripe não entram no SVG. A retenção da evidência segue a política interna; badges antigos são removidos no próximo sync válido quando deixam de ser elegíveis.

## Verificação e rollout

- Testes cobrem migration, validação incompleta/inválida, validade anual, downgrade, expiração, renovação, projeções sem campos internos, admin, membro, vitrine e sync atômico.
- E2E PostgreSQL em dump real executou Amiga → ativação → validação Aliada → badge → expiração → ausência → renovação, sem alterar Stripe ou wallet.
- Migration 045 down/up preservou empresa, assinatura e carteira. Banco descartável e fixtures foram removidos.
- Rollout: merge autorizado → `v0.21.0-backend` → redeploy/migration 045 → sync inicial de badges → frontend → validação Aliada controlada. Nenhum release ou sync real ocorre sem comando explícito.

<!-- AGENT-INDEX
purpose: Design aprovado da Fase 6 — Empresa Amiga/Aliada, due diligence, vitrine e badges SVG.
audience: Mantenedores, implementers, administração e revisores da PR.
status: Concluído e publicado em v0.21.0-backend; validação controlada é acompanhamento operacional.
sections:
  - Contexto e decisão
  - Escopo e não escopo
  - Alternativas
  - Modelo da migration 045
  - Regras de tier e validade
  - APIs e auditoria
  - Admin, membro e hotpage
  - Badges e privacidade
  - Testes e rollout
related-docs:
  - docs/adrs/003-club-business-pj.md — fluxo atual de empresas e assinaturas
  - docs/adrs/013-hour-ledger.md — padrão de badges e visibilidade
  - docs/plans/codaqui-1-0/README.md — subsistema E e critérios da Fase 6
agent-protocol:
  - Não alterar Stripe, wallet, ativação manual ou congelamento por past_due.
  - Aliada exige status active, evidência HTTPS e validação admin; snapshot/badge nunca contém evidência ou notas.
  - Não fazer downgrade diário: Aliada vencida fica sem selo até nova validação.
-->

# Fase 6 — Business tiers

## Contexto e decisão

O módulo `companies` já oferece cadastro PJ, CNPJ, assinatura Stripe a partir de R$ 200/mês, ativação manual, carteira de SortCoins e vitrine de patrocinadores. Não existem níveis, critérios de engajamento, due diligence, hotpage comercial ou badges PJ.

A Fase 6 cria **Empresa Amiga** e **Empresa Aliada** sem alterar o fluxo financeiro. Amiga permanece o apoio financeiro atual. Aliada exige apoio ativo e validação administrativa de pelo menos um critério de engajamento, com evidência e validade de um ano.

## Escopo e não escopo

### Incluído

- Tier, critério, evidência, notas internas, validação e validade na própria `companies`.
- Validação/downgrade admin com auditoria e projeções públicas por allowlist.
- Hotpage `/empresas`, tier nos patrocinadores e indicação de renovação pendente.
- Admin de due diligence e cartão de selo em `/membros/empresa`.
- Badges SVG atômicos em `static/badges/empresas/<company-uuid>.svg`, script e workflow próprios.
- Migration, testes unitários/frontend/scripts e E2E PostgreSQL em dump real.

### Fora

- Mudanças em Stripe, cobrança, assinatura, wallet, SortCoins ou congelamento por inadimplência.
- Múltiplas evidências por empresa, tabela `company_evidence` ou histórico relacional novo.
- Sistema próprio para Codaqui Business Events.
- Downgrade automático diário, remoção da vitrine por selo vencido ou revogação de apoio.
- Upload de evidências pelo backend; links continuam em serviços aceitos pelo `StorageService`.
- Release, deploy, sync real ou mudança de dados de produção sem comando explícito.

## Alternativas

1. **Campos na própria `companies` — escolhido.** Uma evidência atual por empresa atende a regra e mantém o modelo simples; auditoria registra as transições.
2. **Tabela de evidências.** Suportaria múltiplos documentos e histórico relacional, mas adiciona complexidade sem demanda atual.
3. **Somente tier/validade.** Não atende evidência, due diligence ou rastreabilidade.

## Modelo da migration 045

Backend **0.21.0**, migration **045**, adiciona:

- `tier` varchar(32), default `amiga`, check em `amiga|aliada`;
- `engagementCriterion` varchar(32), nullable, check em `workshop|hiring|business_event`;
- `evidenceUrl` text, nullable;
- `validationNotes` text, nullable;
- `validatedAt` timestamptz, nullable;
- `validatedByMemberId` uuid, nullable, FK → `members`, `ON DELETE RESTRICT`;
- `sealValidUntil` timestamptz, nullable.

Registros existentes ficam `amiga` e preservam status, assinatura e visibilidade. A migration não valida Aliada nem gera badges reais.

## Regras de tier e validade

- Cadastro novo nasce `amiga`; `status` continua seguindo o fluxo atual.
- Validar Aliada exige `status=active`, critério e evidência HTTPS aceita pelo `StorageService`.
- `validatedAt` usa o instante da validação; `sealValidUntil` usa um ano depois; `validatedByMemberId` registra o admin.
- Definir Amiga exige admin, mas não apaga evidência/notas de auditoria nem altera assinatura.
- Amiga tem selo enquanto `status=active`.
- Aliada tem selo somente com `status=active` e `sealValidUntil > now`.
- Aliada vencida aparece no admin como **renovação pendente**, não recebe badge e pode ser revalidada. A vitrine e o apoio não são removidos nem rebaixados automaticamente.

## APIs e auditoria

- `PATCH /companies/:id/tier` (admin): `{ tier, engagementCriterion?, evidenceUrl?, validationNotes? }`.
- Validar Aliada exige todos os dados atuais ou enviados; campos de validação são atualizados atomicamente.
- Definir Amiga registra o downgrade sem apagar a evidência de auditoria.
- `GET /companies/badges/public`: coleção pública de empresas com selo vigente, contendo somente `id`, `name`, `tradeName`, `tier` e `sealValidUntil`.
- `GET /companies/sponsors`: inclui `tier`, `sealValidUntil` e `sealActive`, mas mantém compatibilidade dos demais campos consumidos.
- Projeções públicas não expõem `responsibleMemberId`, IDs Stripe, critério, evidência, notas ou aprovadores.
- Novas ações de auditoria para validação de Aliada e retorno para Amiga, com empresa e admin, sem evidência no payload público.

## Admin, membro e hotpage

`/admin/empresas` mostra tier, validade e estado do selo. Um diálogo permite escolher critério, evidência e notas, validar Aliada ou definir Amiga, e renovar um selo vencido.

`/membros/empresa` mostra tier/vigência, preview do SVG quando elegível e snippets Markdown/HTML. Empresas sem selo veem orientação sobre ativação ou renovação, sem URL de badge inválida.

A hotpage `/empresas` apresenta, nesta ordem:

1. Proposta de valor para empresas;
2. Comparação Amiga × Aliada;
3. Benefícios de vitrine, badge, Business Events e ponte com projetos;
4. Captação a partir de R$ 200/mês pelo fluxo existente;
5. Jornada de validação para Aliada;
6. Vitrine dos apoiadores com `SponsorsIsland`.

`SponsorsIsland` recebe `tier`, `sealValidUntil` e `sealActive`, mostrando Amiga, Aliada ou renovação pendente sem esconder o apoiador.

## Badges e privacidade

`sync-company-badges.mjs` consulta `/companies/badges/public`, valida toda a coleção e escreve `static/badges/empresas/<uuid>.svg` com XML escapado e texto acessível. UUID evita colisões e mudanças de nome não alteram o caminho.

O sync usa arquivos temporários + rename, remove somente badges obsoletos após sucesso e restaura o estado anterior em falha. `COMPANY_BADGES_API_URL` usa `http://localhost:3001` por padrão. O workflow `sync-company-badges.yml` roda diariamente às 06:19 UTC e por dispatch, fora do agregador `npm run sync`.

Evidências, notas, responsável, critérios, aprovadores e IDs Stripe nunca entram no SVG. A página pública mostra apenas tier e validade necessários à vitrine.

## Testes e rollout

- Migration: defaults, checks, FK e down sem alterar dados atuais.
- Service: cadastro Amiga, validação incompleta, evidência inválida, validação Aliada, downgrade, expiração e renovação.
- API: projeções sem campos internos e badge somente vigente.
- Frontend: diálogo admin, membro elegível/inelegível e tiers no `SponsorsIsland`.
- Scripts: XML, validação, escrita atômica, remoção de obsoletos e restauração em erro.
- E2E real: Amiga → validação Aliada → badge → expiração → ausência do badge → renovação, sem alterar Stripe/wallet.
- Gates: backend build/Jest, scripts, Vitest/astro check, `make astro-verify` e `make astro-verify-tenants`.

Rollout: merge autorizado → release `v0.21.0-backend` → redeploy/migration 045 → sync inicial de badges → frontend → uma validação Aliada controlada. Nenhum release ou sync real ocorre sem comando explícito.

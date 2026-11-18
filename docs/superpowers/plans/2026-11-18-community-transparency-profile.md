<!-- AGENT-INDEX
purpose: Plano TDD da Fase 10.2 — transparência comunitária com escopo declarado, perfil por designations e deep link de mentoria.
audience: Implementadores e revisores.
status: Implementada em develop/1.8.0 com jornada PostgreSQL e browser; evidências registradas no documento.
related-docs:
  - ../specs/2026-11-18-journeys-mockups-design.md — contratos, privacidade e limites de atribuição.
agent-protocol:
  - Não publicar atas/horas comunitárias totais; não expor PII nem designation sem visibilidade pública.
-->

# Fase 10.2 — Transparência e Perfil Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Colocar atividades reais antes das finanças nos sites das comunidades e conectar perfis públicos a comunidades e mentoria sem violar controles de visibilidade.

**Architecture:** Dois serviços NestJS focados fazem projeções públicas somente leitura sobre os modelos existentes. O frontend mantém o shell estático Astro e adiciona ilhas independentes para dados runtime; o diretório de mentores resolve um deep link contra o snapshot ativo.

**Tech Stack:** NestJS 11, TypeORM/PostgreSQL, Astro 7, React 19, MUI v9, Vitest/Jest.

**Spec:** `docs/superpowers/specs/2026-11-18-journeys-mockups-design.md`

## Global Constraints

- Não criar migration, sync, vínculo paralelo ou nova chave de privacidade.
- Comunidade é atribuída somente por `communityProjectKey=slug`; horas entram apenas como `event_checkin` aprovadas.
- O filtro anual usa o início do evento para todas as métricas, inclusive horas.
- `profileVisibility.designations=false` oculta pills, comunidades e CTA de mentoria do perfil individual.
- Não expor participantes, e-mails, notas, atores ou IDs internos de designations.

## Review Focus

- Evento limítrofe de ano/horas aprovadas tardiamente: espera-se atribuição ao ano do evento; Task 1 testa o filtro SQL e anos disponíveis.
- Comunidade inexistente/inativa: espera-se 404, não zeros aparentemente válidos; Task 1 testa a validação antes das agregações.
- Membro com designation expirada/oculta: espera-se omissão completa de vínculos; Task 3 cobre ambos.
- Falha da API de atividades: espera-se finanças funcionando e retry independente; Task 2 testa os estados separados.
- `?mentor=` desconhecido ou mudança de snapshot: espera-se diretório normal sem seleção inventada; Task 5 testa fallback.

---

### Task 1: Projeção pública de transparência por comunidade

**Files:**
- Create: `backend/src/communities/community-transparency.types.ts`
- Create: `backend/src/communities/community-transparency.service.ts`
- Test: `backend/src/communities/community-transparency.service.spec.ts`
- Create: `backend/src/communities/dto/community-transparency-query.dto.ts`
- Modify: `backend/src/communities/communities.controller.ts`
- Modify: `backend/src/communities/communities.module.ts`
- Create: `backend/src/communities/communities.controller.spec.ts`

**Interfaces:**
- Produces: `CommunityTransparencyService.get(slug: string, year?: number): Promise<CommunityTransparencyResult>`.
- Result: `{community:{slug,name},responsible,year:number|null,availableYears:number[],metrics:{events,participations,certificates,eventHours},upcomingActivities,recentActivities}`.
- Route: `GET /communities/public/:slug/transparency?year=YYYY`.

- [x] **Step 1: Escrever testes falhos do service e controller**
  Cobrir slug inexistente/inativo 404, ano inválido 400, eventos managed/external por slug, exclusão de draft/canceled, participações confirmadas, certificados concedidos+confirmados, horas `approved/event_checkin` com visibilidade pública e mesmo ano do evento. Verificar atividades sem PII, responsible público, anos ordenados e query delegada.

- [x] **Step 2: Confirmar a falha**
  Run: `cd backend && npx jest src/communities/community-transparency.service.spec.ts src/communities/communities.controller.spec.ts --runInBand`
  Expected: FAIL porque service/rota não existem.

- [x] **Step 3: Implementar consulta agregada**
  Validar comunidade ativa; usar SQL PostgreSQL com CTEs/união de managed_events e external_event_activations, joins de registrations e horas/membros. Filtrar ano por `startAt` do evento em todos os agregados, limitar próximas ASC e recentes DESC a 5, retornar números normalizados e somente campos do contrato. Registrar DTO `year` inteiro com transformação e faixa razoável; prover service no módulo sem alterar ledger.

- [x] **Step 4: Verificar contratos**
  Run: `cd backend && npx jest src/communities --runInBand`
  Expected: PASS.

- [x] **Step 5: Commit**
  `git add backend/src/communities && git commit -m "feat(fase-10): projeta transparência pública das comunidades"`

### Task 2: Experiência whitelabel com atividades antes das finanças

**Files:**
- Create: `frontend/src/lib/community-transparency.ts`
- Test: `frontend/src/lib/community-transparency.test.ts`
- Modify: `frontend/src/components/islands/CommunityTransparencyIsland.tsx`
- Test: `frontend/src/components/islands/__tests__/CommunityTransparencyIsland.test.tsx`
- Modify: `frontend/src/components/astro/community/CommunityTransparenciaPage.astro`

**Interfaces:**
- Consumes: resultado da Task 1 e `resolveApiUrl(import.meta.env.SITE)`.
- Produces: `fetchCommunityTransparency(apiUrl, slug, year?, signal?)` e UI independente de atividades/finanças.

- [x] **Step 1: Escrever testes falhos de parse e UI**
  Cobrir URL com ano, resposta inválida/erro HTTP, métricas reais, rótulo “horas de voluntariado em eventos”, empty state, seleção de ano, responsáveis, retry de atividades sem desmontar movimentações e falha financeira sem apagar atividades.

- [x] **Step 2: Confirmar a falha**
  Run: `cd frontend && npx vitest run src/lib/community-transparency.test.ts src/components/islands/__tests__/CommunityTransparencyIsland.test.tsx`
  Expected: FAIL pelos helpers/seções ausentes.

- [x] **Step 3: Implementar loader, ilha e shell**
  Validar defensivamente o payload; separar hooks/estados e botões retry; renderizar métricas, próximas/recentes atividades e responsáveis antes do saldo. Adicionar faixa associativa com CNPJ e hero da spec no componente Astro compartilhado, preservando branding e CTA de apoio. Não renderizar atas nem totais não suportados.

- [x] **Step 4: Verificar**
  Run: `cd frontend && npx vitest run src/lib/community-transparency.test.ts src/components/islands/__tests__/CommunityTransparencyIsland.test.tsx && npm run check`
  Expected: PASS.

- [x] **Step 5: Commit**
  `git add frontend/src/lib/community-transparency* frontend/src/components/islands/CommunityTransparencyIsland.tsx frontend/src/components/islands/__tests__/CommunityTransparencyIsland.test.tsx frontend/src/components/astro/community/CommunityTransparenciaPage.astro && git commit -m "feat(fase-10): aproxima transparência das atividades das comunidades"`

### Task 3: Engagement público por designation e privacidade

**Files:**
- Create: `backend/src/members/member-engagement.service.ts`
- Create: `backend/src/members/member-engagement.types.ts`
- Test: `backend/src/members/member-engagement.service.spec.ts`
- Modify: `backend/src/members/members.controller.ts`
- Modify: `backend/src/members/members.module.ts`
- Test: `backend/src/members/members.controller.spec.ts`

**Interfaces:**
- Produces: `MemberEngagementService.getByHandle(handle: string): Promise<MemberEngagement>`.
- Result: `{designations:Array<{key,label}>,communities:Array<{slug,name,href}>,mentor:{id,href}|null}`.
- Route: `GET /members/by-handle/:handle/engagement`.

- [x] **Step 1: Escrever testes falhos**
  Cobrir handle inválido/inexistente 404; membro inativo 404; visibilidade false retornando arrays vazios/mentor null; designation pending/ended/expirada omitida; comunidade inativa omitida; comunidades deduplicadas; mentor exigindo perfil ativo+membro ativo+designation vigente; payload sem targetId/appointedBy/notes; targets event/C4P/projeto/diretoria omitidos.

- [x] **Step 2: Confirmar a falha**
  Run: `cd backend && npx jest src/members/member-engagement.service.spec.ts src/members/members.controller.spec.ts --runInBand`
  Expected: FAIL porque service/rota não existem.

- [x] **Step 3: Implementar projeção limitada**
  Resolver membro e visibilidade; consultar designations ativas/vigentes em lote; resolver somente comunidades ativas e programa mentoria. Usar `mentor_profiles.id` como ID público e `/participe/mentoria?mentor=<id>` como href. Não alterar `findAllActive` nem o payload geral de membros.

- [x] **Step 4: Verificar**
  Run: `cd backend && npx jest src/members src/mentorship --runInBand`
  Expected: PASS.

- [x] **Step 5: Commit**
  `git add backend/src/members && git commit -m "feat(fase-10): expõe vínculos públicos com privacidade"`

### Task 4: Perfil com vínculos e CTA de mentoria

**Files:**
- Create: `frontend/src/components/islands/MemberEngagementIsland.tsx`
- Test: `frontend/src/components/islands/MemberEngagementIsland.test.tsx`
- Modify: `frontend/src/pages/[...handle].astro`

**Interfaces:**
- Consumes: resultado da Task 3, `routeHandle` e `resolveApiUrl`.
- Produces: pills/comunidades/CTA sem bloquear a carteirinha estática.

- [x] **Step 1: Escrever testes falhos**
  Cobrir loading, erro com retry, visibilidade vazia sem seção órfã, pills sem IDs internos, comunidades com href e CTA apenas com mentor ativo.

- [x] **Step 2: Confirmar a falha**
  Run: `cd frontend && npx vitest run src/components/islands/MemberEngagementIsland.test.tsx`
  Expected: FAIL porque a ilha não existe.

- [x] **Step 3: Implementar e integrar ao perfil**
  Renderizar seção acessível após carteirinha/links sociais, preservar `MemberProfileIsland` atual e usar `client:visible`. Links de comunidade usam `/comunidades/<slug>`; GitHub/LinkedIn continuam inalterados.

- [x] **Step 4: Verificar**
  Run: `cd frontend && npx vitest run src/components/islands/MemberEngagementIsland.test.tsx src/lib/member-path.test.ts && npm run check`
  Expected: PASS.

- [x] **Step 5: Commit**
  `git add frontend/src/components/islands/MemberEngagementIsland* 'frontend/src/pages/[...handle].astro' && git commit -m "feat(fase-10): conecta perfil a comunidades e mentoria"`

### Task 5: Deep link do diretório de mentoria

**Files:**
- Create: `frontend/src/lib/mentor-query.ts`
- Test: `frontend/src/lib/mentor-query.test.ts`
- Modify: `frontend/src/components/islands/mentorship/MentorDirectoryIsland.tsx`
- Test: `frontend/src/components/islands/mentorship/MentorDirectoryIsland.test.tsx`

**Interfaces:**
- Produces: `findMentorByQuery(mentors: PublicMentor[], value: string | null): PublicMentor | null`, comparando ID exato ou handle case-insensitive.
- Consumes: `loadSlots(mentor)` existente.

- [x] **Step 1: Escrever testes falhos**
  Cobrir null/vazio/desconhecido, ID, handle com caixa diferente e inicialização que chama disponibilidade uma única vez; garantir que interação manual posterior continua possível.

- [x] **Step 2: Confirmar a falha**
  Run: `cd frontend && npx vitest run src/lib/mentor-query.test.ts src/components/islands/mentorship/MentorDirectoryIsland.test.tsx`
  Expected: FAIL porque seleção por query não existe.

- [x] **Step 3: Implementar inicialização controlada**
  Ler `window.location.search` somente no cliente, resolver contra `mentors` do snapshot e chamar `loadSlots` uma vez com ref de inicialização. Não criar mentor nem escrever tokens/PII na URL.

- [x] **Step 4: Verificar**
  Run: `cd frontend && npx vitest run src/lib/mentor-query.test.ts src/components/islands/mentorship/MentorDirectoryIsland.test.tsx`
  Expected: PASS.

- [x] **Step 5: Commit**
  `git add frontend/src/lib/mentor-query* frontend/src/components/islands/mentorship/MentorDirectoryIsland* && git commit -m "feat(fase-10): abre mentoria pelo perfil selecionado"`

### Task 6: Jornada PostgreSQL e gates da entrega

**Files:**
- Modify: `docs/superpowers/plans/2026-11-18-community-transparency-profile.md` com evidências reais.

- [x] **Step 1: Preparar dump isolado e fixtures sintéticas**
  Restaurar o dump em banco temporário, sem tocar produção; criar duas comunidades sintéticas, eventos managed/external, registrations confirmadas/canceladas, presença, certificado e horas com membros visíveis/ocultos e dois anos de evento.

- [x] **Step 2: Exercitar APIs e jornada real**
  Validar `Desde o início` e anos individuais, isolamento entre slugs, ausência de PII, designation expirada/oculta e CTA por mentor vigente. No frontend local, seguir perfil → `/participe/mentoria?mentor=` → horários → solicitação `requested` usando fixture sintética.

- [x] **Step 3: Executar gates**
  Run: `cd backend && npm run build && npx jest --silent`
  Run: `make astro-verify && make astro-verify-tenants`
  Expected: todos verdes; bancos temporários removidos ao final.

- [x] **Step 4: Registrar e commitar evidências**
  Incluir contagens e limitações verificadas, sem dados reais do dump; `git add docs/superpowers/plans/2026-11-18-community-transparency-profile.md && git commit -m "docs(fase-10): registra jornada de transparência e mentoria"`

## Evidência de execução — 2026-11-18

- Dump isolado atualizado com fixtures sintéticas: Alpha all-time `{events:3,participations:4,certificates:3,eventHours:3.5}`; 2025 `{1,2,2,2}`; 2026 `{2,2,1,1.5}`; Beta isolada `{1,1,0,0}`. Horas ocultas/pendentes e inscrição cancelada ficaram fora das agregações corretas.
- Engagement real: membro visível manteve somente Alpha, designation expirada de Beta não apareceu; membro com `designations=false` retornou vínculos vazios; mentor vigente expôs o UUID público do perfil.
- Jornada Playwright: perfil → comunidade; perfil sem vínculos visíveis; perfil de mentor → CTA → mentor preselecionado → horário → sessão `requested`. Uma segunda reserva direta pela API também foi `requested`; nenhum provider externo foi usado.
- Correções incorporadas: admin+mentor não é mais redirecionado para fora do próprio painel; admin/mentoria tem link para “Minha disponibilidade e sessões”; membros só são carregados ao abrir a edição de mentor.
- Investigação de conta real sem expor PII adicional: o dump mostra empresa ativa sem customer/subscription/conversão vinculada. Os pagamentos mensais encontrados são doações avulsas por Checkout Session, não renovações de invoice de assinatura; portanto não são candidatos à conversão. Nenhuma consulta Stripe autenticada estava disponível nesta sessão e nenhuma mutação foi feita.
- Gates: backend 136 suites/1.624 testes; frontend 152 arquivos/1.217 testes; paridade de URLs e quatro builds aprovados.
- Banco e role temporários removidos; nenhum dado do dump foi adicionado ao repositório.

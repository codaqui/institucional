<!-- AGENT-INDEX
purpose: Plano TDD da fase Experiência do Membro — painel, perfil público, certificados e selos.
audience: Implementers e revisores da fase posterior à PR #628.
status: Concluído e publicado em v0.25.0-backend (PRs #630/#631); validação visual em produção pendente.
sections:
  - Navegação e visão geral
  - Perfil público e selo
  - Certificados por persona
  - Gates e rollout
related-docs:
  - docs/superpowers/specs/2026-11-11-member-experience-design.md — contrato e sequência
agent-protocol:
  - Não alterar identidade, autorização, fila ou conteúdo dos certificados.
  - Não criar migration nem expor dados adicionais no perfil ou snippets.
-->

# Experiência do Membro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar painel, perfil público e jornada de certificados com deep links, menos ruído e um guia de selo para README.

**Architecture:** Reorganização progressiva dos componentes atuais. Helpers puros cuidam de seções/deep links e snippets; React/MUI reutiliza os dados e regras existentes, sem migration ou nova API obrigatória.

**Tech Stack:** Astro 7, React 19, MUI v9, Vitest/Testing Library, TypeScript, tokens `--cq-*`.

**Spec:** `docs/superpowers/specs/2026-11-11-member-experience-design.md`

## Global Constraints

- Preservar identidade, `secondaryEmails`, autorização, fila e conteúdo do certificado.
- Não criar métricas globais a partir da página atual nem expor novos dados públicos.
- Preservar deep links antigos; novos usam `section` e `tab`.
- Snippet usa origem real e handle validado; alt fixo “Selo Codaqui”, sem HTML no nome.
- Implementar depois da PR #628 e antes de Announcements.

## Review Focus

- Query inválida ou legada: cair em Visão geral, nunca em tela vazia ou tab inexistente.
- Perfil sem doações/carteira: ocultar ruído e manter contribuições reais em evidência.
- Clipboard ausente/negado: fallback no gesto e mensagem por `role="status"`.
- Lote vazio/falha de fila: não iniciar polling; erro deve orientar próxima ação.
- Certificado sem presença e impressão: concessão continua disponível e só uma cópia aparece no DOM fora de `beforeprint`.

---

### Task 1: Navegação, deep links e cabeçalho compacto

**Files:**
- Create: `frontend/src/lib/member-navigation.ts` e `.test.ts`
- Modify: `frontend/src/components/islands/member/dashboard/MemberDashboardApp.tsx`
- Modify: `frontend/src/components/islands/member/dashboard/MemberHeader.tsx`
- Modify: `frontend/src/components/islands/member/__tests__/member-dashboard.test.tsx`

**Interfaces:**
- `MemberSection = "overview" | "participation" | "finance" | "account"`.
- `memberSectionFromSearchParams(search: string): MemberSection`.
- `buildMemberHref(section: MemberSection, tab?: string): string`.

- [ ] **Step 1: Escrever testes RED**

```ts
expect(memberSectionFromSearchParams("?section=participation&tab=certificates"))
  .toEqual({ section: "participation", tab: "certificates" });
expect(memberSectionFromSearchParams("?section=invalid")).toBe("overview");
expect(memberSectionFromSearchParams("?tab=future")).toBe("participation");
expect(buildMemberHref("participation", "certificates"))
  .toBe("?section=participation&tab=certificates");
```

- [ ] **Step 2: Confirmar RED**

Run: `cd frontend && npx vitest run src/lib/member-navigation.test.ts`
Expected: helpers inexistentes.

- [ ] **Step 3: Implementar helpers e reorganizar navegação**

Normalizar legados (`purchase=success`, `tab=future`) sem quebrar URLs. Renderizar quatro seções, reduzir o cabeçalho e remover ações duplicadas. Compra abre Participação/Eventos futuros; certificado abre Participação/Certificados.

- [ ] **Step 4: Confirmar GREEN**

Run: `cd frontend && npx vitest run src/lib/member-navigation.test.ts src/components/islands/member/__tests__/member-dashboard.test.tsx`
Expected: deep links e quatro seções verdes.

- [ ] **Step 5: Commit**

```bash
git add frontend && git commit -m "feat(membro): agrupa navegação e deep links"
```

### Task 2: Visão geral e Participação/Certificados

**Files:**
- Modify: `frontend/src/components/islands/member/dashboard/OverviewTab.tsx`
- Create: `frontend/src/components/islands/member/dashboard/MemberCertificatesTab.tsx` e teste.
- Modify: `frontend/src/components/islands/member/dashboard/MemberDashboardApp.tsx`
- Modify: `frontend/src/components/islands/events/GuestClaimIsland.tsx` e teste.

**Interfaces:**
- `certificateAvailability(reg: EventRegistration): "available" | "pending_account" | "unavailable"`.
- Destino `?section=participation&tab=certificates&certificate=<registrationId>`.

- [ ] **Step 1: Escrever testes RED**

Cobrir disponível, pendente de conta, indisponível, seleção por `certificate=<id>`, retorno de compra e CTA do aceite apontando para o certificado correto.

- [ ] **Step 2: Confirmar RED**

Run: `cd frontend && npx vitest run src/components/islands/member/dashboard/MemberCertificatesTab.test.tsx src/components/islands/events/GuestClaimIsland.test.tsx`
Expected: destino/estado inexistente.

- [ ] **Step 3: Implementar visão geral e área de certificados**

Reutilizar inscrições já carregadas, sem métricas falsas. Mostrar disponibilidade, pendência e ação “Ver certificado”; abrir item por deep link. Após claim, usar “Abrir meu certificado” quando concedido e histórico explicativo quando não houver concessão.

- [ ] **Step 4: Confirmar GREEN**

Run: `cd frontend && npx vitest run src/components/islands/member/dashboard src/components/islands/events/GuestClaimIsland.test.tsx`
Expected: jornadas membro/convidado verdes.

- [ ] **Step 5: Commit**

```bash
git add frontend && git commit -m "feat(certificados): cria destino claro para participantes"
```

### Task 3: Perfil público e guia do selo

**Files:**
- Create: `frontend/src/lib/badge-snippet.ts` e `.test.ts`
- Modify: `frontend/src/components/islands/member/profile/ProfileBadges.tsx` e `.test.tsx`
- Modify: `frontend/src/components/islands/MemberProfileIsland.tsx` e teste.
- Modify: `frontend/src/pages/[...handle].astro` se necessário para a ordem das seções.

**Interfaces:**
- `buildBadgeSnippets(origin: string, githubHandle: string): { markdown: string; html: string }`.
- Clipboard Markdown/HTML com fallback e região `role="status"`.

- [ ] **Step 1: Escrever testes RED**

```ts
expect(buildBadgeSnippets("https://codaqui.dev", "endersonmenezes").markdown)
  .toBe("[![Selo Codaqui](https://codaqui.dev/badges/endersonmenezes.svg)](https://codaqui.dev/@endersonmenezes)");
```

Também HTML, origem local, handle inválido, selo ausente, clipboard negado e repetição.

- [ ] **Step 2: Confirmar RED**

Run: `cd frontend && npx vitest run src/lib/badge-snippet.test.ts src/components/islands/member/profile/ProfileBadges.test.tsx`
Expected: guia/snippets inexistentes.

- [ ] **Step 3: Implementar ordem do perfil e guia de compartilhamento**

Ordenar identidade → contribuições → selo → histórico → vínculos públicos. Ocultar seções vazias sem esconder conteúdo real. Exibir bloco rolável com Markdown/HTML e botões que mantêm foco, usam fallback no gesto e anunciam sucesso/erro fora do botão.

- [ ] **Step 4: Confirmar GREEN**

Run: `cd frontend && npx vitest run src/lib/badge-snippet.test.ts src/components/islands/member/profile src/components/islands/member/profile/MemberProfileIsland.test.tsx`
Expected: ordem, clipboard e privacidade verdes.

- [ ] **Step 5: Commit**

```bash
git add frontend && git commit -m "feat(perfil): orienta compartilhamento do selo"
```

### Task 4: Concessor — importação, seleção e fila retomável

**Files:**
- Modify: `frontend/src/components/islands/admin/overrides/ActivationTab.tsx` e teste.
- Modify: `frontend/src/components/islands/admin/checkin/CertificateCenter.tsx` e teste.
- Modify: `frontend/src/components/islands/admin/checkin/useCertificateInviteProgress.ts` e teste.
- Modify: `frontend/src/components/islands/CertificateVerifyIsland.tsx` e teste.
- Modify: footer público para link de verificação.

**Interfaces:**
- Deep link `/admin/eventos-checkin?event=<key>&tab=certificates&filter=registration_pending&batch=<uuid>`.
- Batch `total=0` não faz polling; `batch=<uuid>` retoma com autorização existente.

- [ ] **Step 1: Escrever testes RED**

Cobrir importação com pendências e CTA, cert-only sem checkin/payments, reload com batch, resumo enviados/retry/failed/skipped, seleção de falhas para novo lote e copy neutra de `{valid:false}`.

- [ ] **Step 2: Confirmar RED**

Run: `cd frontend && npx vitest run src/components/islands/admin/overrides src/components/islands/admin/checkin src/components/islands/CertificateVerifyIsland.test.tsx`
Expected: deep link/estados ausentes.

- [ ] **Step 3: Implementar continuação e estados por participante**

Distinguir elegível, concedido aguardando cadastro, pendente sem concessão e convite aguardando aceite. Explicar convite sem concessão e permitir “Conceder e depois convidar” como duas ações explícitas. Preservar fila/autorização; não reprocessar históricos.

- [ ] **Step 4: Confirmar GREEN**

Run: `cd frontend && npx vitest run src/components/islands/admin/overrides src/components/islands/admin/checkin src/components/islands/CertificateVerifyIsland.test.tsx`
Expected: importação, fila e copy verdes.

- [ ] **Step 5: Commit**

```bash
git add frontend && git commit -m "feat(certificados): retoma e orienta a fila de convites"
```

### Task 5: Acessibilidade, impressão e validação final

**Files:**
- Modify: `frontend/src/components/islands/member/dashboard/MemberDashboardApp.tsx`
- Modify: `frontend/src/components/islands/member/dashboard/CertificateCard.tsx` e teste.
- Modify: `frontend/src/styles/global.css` e `.test.ts`
- Modify: `docs/plans/codaqui-1-0/README.md`

**Interfaces:**
- “Imprimir / salvar PDF”, “Copiar código”, “Copiar link de verificação”, “Abrir verificação”.
- Cópia de impressão somente durante `beforeprint`, removida em `afterprint`.

- [ ] **Step 1: Escrever testes RED**

Verificar cópia de link/código, falha de clipboard, uma cópia antes de imprimir e remoção depois, A4 sem navegação/backdrop e link público de verificação.

- [ ] **Step 2: Confirmar RED**

Run: `cd frontend && npx vitest run src/components/islands/member/dashboard src/styles/global.test.ts`
Expected: ações/estilo incompletos.

- [ ] **Step 3: Implementar ações e folha A4**

Manter o certificado canônico, QR e dados atuais. Ocultar somente navegação/backdrop/ações, sem `!important` e sem duplicar a árvore acessível fora da impressão.

- [ ] **Step 4: Confirmar GREEN e gates**

```bash
cd frontend && npm run check && npm run test
npm run test:scripts
make astro-verify
make astro-verify-tenants
cd backend && npm run build && npx jest --silent
```

- [ ] **Step 5: Commit**

```bash
git add frontend docs && git commit -m "feat(membro): finaliza acessibilidade e impressão"
```

### Task 6: Documentação e rollout

- [ ] **Step 1: Atualizar status da fase e evidências**

Marcar concluído apenas com testes reais, preservar decisões e registrar o que não foi validado visualmente em navegadores.

- [ ] **Step 2: Integrar e revisar**

Merge feature em `develop`, PR para `main`, SonarCloud sem issues. Não iniciar Announcements antes dessa integração.

- [ ] **Step 3: Validar produção**

Verificar `/membro`, `/@endersonmenezes`, convite, concessão, retry, impressão e guia do selo em claro/escuro.

---

## Registro de implementação (2026-11-11)

- Tasks 1–5 concluídas com RED→GREEN e commits na branch `feat/member-experience`: navegação, participação/certificados, perfil/selo, fila do concessor e acessibilidade.
- Backend **0.25.0**, sem migration: `getGuestInvite` projeta apenas `registrationId` da inscrição convidada e `certificateGranted` booleano para viabilizar o deep link exigido.
- Evidências: frontend **116 arquivos/1.000 testes**; backend **107 suites/1.356 testes** (2 skipped); scripts **94/94**; `make astro-verify` com paridade de **646 URLs**; quatro builds multi-tenant verdes.
- Revisão independente concluída. O bug crítico de impressão foi corrigido com portal direto para `document.body` e `flushSync`; ownership de certificados, consumo único do deep link do check-in e persistência da subaba também foram corrigidos com testes RED→GREEN.
- Announcements passa a usar backend **0.26.0/migration 047** para evitar colisão de versão.
- Pendem: integração em `develop`, PR/release e validação visual/manual em claro/escuro de `/membro`, `/@endersonmenezes`, convite, concessão, retry, impressão e guia do selo. Essas etapas não foram marcadas como validadas em produção.

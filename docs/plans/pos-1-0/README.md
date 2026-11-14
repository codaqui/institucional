<!-- AGENT-INDEX
purpose: Roadmap pós-1.0.0 do monorepo Codaqui — candidatos de fase consolidados (planos anteriores + 12 demandas do mantenedor diagnosticadas em 2026-11-13). Fonte de coordenação para a presidência escolher o próximo marco. Substitui o snapshot histórico de docs/plans/PROXIMOS_PASSOS.md (2026-09-10, arquivado).
audience: Presidência, mantenedores, AI agents planejando o pós-1.0.0.
status: Consolidação viva (2026-11-13) — 1.0.0 publicado em 13/11 com hotfix 1.0.1 (DI do TurnstileGuard) já em produção; campanha piloto do C4P pendente. Revalidar cada item no código antes de executar; itens ⚠️ exigem revalidação explícita.
sections:
  - Contexto e lições recentes
  - Roadmap de fases propostas (origem → diagnóstico → escopo → esforço)
  - Priorização sugerida
  - Candidatos anteriores (pré-12-pontos)
  - Pendências operacionais
  - Como propor uma nova fase
related-docs:
  - docs/plans/codaqui-1-0/README.md — plano-mãe 1.0.0 (Fase 7 = última fase)
  - docs/plans/PROXIMOS_PASSOS.md — snapshot histórico 2026-09-10 (arquivado; itens ⚠️ precisam de revalidação)
  - docs/adrs/012-c4p.md — Fase 7 e seus follow-ups
  - docs/plans/events-sync-improvements/MAP.md · event-uiux-improvements/ · update/ · real-network/ · multisite/
agent-protocol:
  - NENHUMA fase aqui está aprovada — a presidência escolhe e ratifica o escopo (ritual das fases 1a-7: spec → plano TDD → implementação → revisão independente → ADR se houver contrato novo).
  - Os diagnósticos abaixo foram levantados em 2026-11-13 com evidência arquivo:linha; revalide antes de escrever tarefas.
  - ⚠️ = item herdado do snapshot 2026-09-10 que pode já ter sido resolvido pelas fases 2-7.
  - As "Fases 7.x/8/9" são RÓTULOS de organização, não versões aprovadas; o bump semver segue o padrão (feat → minor, fix → patch).
-->

# Fases pós-1.0.0 — roadmap consolidado

## Contexto e lições recentes

- **13/11/2026**: Fase 7 (C4P) mergeada em `main` + release **1.0.0-backend**. O deploy crash-loopou por falha de DI (`C4pModule` usava `TurnstileGuard` sem importar `TurnstileModule`); hotfix **1.0.1** mesmo dia. Sistema online.
- **Lição de processo (gap de teste)**: falha de DI de guard em módulo novo não foi pega por nenhum teste — specs de controller fazem override de guards, o E2E de C4P mocka o guard, e os E2E de boot real não rodam na CI (pr-check = build + jest unitário). **Follow-up permanente: job de boot do app real (E2E com Postgres de serviço) no `pr-check.yml`.**
- **Campanha piloto do C4P ainda pendente** — é o gate que valida os menores deferidos da Fase 7 e a decisão 4 da spec (vitrine fora da janela).

## Roadmap de fases propostas

Origem das demandas: **P1–P12** = os 12 pontos levantados pelo mantenedor em 13/11/2023 (diagnosticados com evidência); **F7-review** = menores deferidos da revisão independente da Fase 7; candidatos anteriores na seção própria.

---

### Fase 7.1 — Correções pontuais de UI (P — 1 PR)

| Item | Diagnóstico (evidência) |
|---|---|
| P5 Texto estourando o card de evento | **Corrigido em 2026-11-13:** `EventCard.astro` limita visualmente todos os resumos a 3 linhas e quebra URLs longas (`overflow-wrap:anywhere`); o sync Discord agora remove Markdown e trunca o resumo em 220 caracteres, como as demais fontes. “Ver detalhes” mantém acesso ao conteúdo completo. |
| P8 Prévia de post com imagem no blog | Card da listagem é texto-only por construção: `plainExcerpt` (`frontend/src/lib/blog-utils.ts:110-139`) remove `![alt](url)`/`<img>`; ~10 posts têm imagem antes do `<!-- truncate -->` e o `image:` do frontmatter (schema existe, `content.config.ts:21`) é ignorado na listagem. |
| F7-review Menores C4P | Lista completa em `docs/adrs/012-c4p.md` (teste de votos de removido, hardening do accept, ILike escape, vitrine fora da janela, cap 100 da finalização, heurística do Alert, O(n²) do progresso). |

**Escopo sugerido**: card de blog com thumbnail (`image:` do frontmatter, fallback ao remover imagens do excerpt); menores C4P de baixo risco. O tratamento de descrições de eventos (line-clamp + `overflow-wrap` nos cartões e remoção de Markdown + limite de 220 caracteres no sync Discord) já foi aplicado. **Esforço: P.** Sem dependências.

---

### Fase 7.2 — Consistência do fluxo de mentoria (P-M — 1 PR)

| Item | Diagnóstico (evidência) |
|---|---|
| P1 Mentor ativo não aparece no frontend | **Desconexão confirmada**: aprovação pelo módulo genérico de designations (`POST /designations/:id/confirm`, `designations.controller.ts:94-131`) ativa a designation mas **nunca ativa o `mentor_profiles`** — e `/mentorship/public` filtra só `profile.active` + `members.isActive` (`mentorship.service.ts:257-276`). Corolário armadilha: candidatura aprovada por esse caminho quebra com 404 **deixando a designation ativa** (`mentorship.service.ts:107`). `apply()` não é transacional (designation gravada antes do perfil unique → 500 deixa candidatura órfã, `mentorship.service.ts:41-55`). Revoke genérico não desativa o perfil (mentor continua no diretório público). `/@handle` não rotula o papel "Mentor" (`[...handle].astro:61-78`). Dados de produção (dump 13/11): 1 mentor ativo, 5 placeholders pendentes — consistente, mas o gap é de fluxo. |
| P2 Dashboard do mentor + match de usuários | Ilha renderiza `scheduledAt` em ISO cru, status sem rótulo, sem avatar/handle/link `/@handle`; **não usa `menteeMemberId`/`menteeEmail`** que o backend já devolve (`sessions.service.ts:41-44`); `menteeMemberId` só nasce da reserva logada ou do match de e-mail no OAuth — **não existe vínculo manual**; pattern de busca de membros já existe e pode ser reaproveitado (`MentorDirectory.tsx:37-44`). |

**Escopo sugerido**: (a) backend — `apply()` transacional; ativação do perfil no caminho genérico de designations para `mentor @ program('mentoria')` (ou bloquear com mensagem orientando o fluxo correto); revoke desativa perfil; rótulo "Mentor" no `/@handle`; (b) frontend — dashboard do mentor com datas pt-BR, status traduzidos, avatar+link do mentorando quando `menteeMemberId`, e ação de vincular sessão a um membro (Autocomplete de membros). **Esforço: P-M.** Sem dependências. Teste de discriminação do P1 (já documentado): `GET /mentorship/public` contém o mentor? sim → latência de sync; não → perfil/membro inativo.

---

### Fase 8 — Páginas públicas conectadas ao banco (M)

| Item | Diagnóstico (evidência) |
|---|---|
| P3 `/sobre/equipe` 100% estático | `team.ts` (18 entradas; 13 com URL de GitHub); a infra de match por handle **já existe** e é usada pelos embaixadores (`community-devparana.ts:153-193,229-291`) e pela vanity `/@handle` — `equipe.astro` simplesmente não chama `loadPublicMembers()`. Conceito de placeholder da mentoria reaproveitável (registro inativo + reatribuição preservando UUID, `migration 046`). |
| P4 `/sobre/ong` desconectada | Comunidades (`data/communities.ts`) e portais (`data/community-portals.ts`) hardcoded; só o muro de doadores é dinâmico (`/members/donors`). O snapshot público de comunidades (ADR 007, selo/níveis/doação) **existe e não é consumido** na página. |

**Escopo sugerido**: equipe enriquecida em build-time por `githubHandle` (nome/avatar/bio/link preferidos da API, decisão 17) + fallback ao cadastro local; placeholders para entradas sem conta (associação automática estilo mentoria) com vista a página futura 100% automática; ONG consumindo o snapshot de comunidades (níveis/selo) e a fonte única de portais (`tenants.config.mjs`). **Esforço: M.** Depende de: decisão sobre o que é "equipe" institucional vs. roster automático.

---

### Fase 8b — Projetos de extensão e patrocínio PJ (M)

| Item | Diagnóstico (evidência) |
|---|---|
| P12 Cadastro de projeto de extensão assistido | Formulário exige **UUID digitado** para mentor/coMentors (sem autocomplete — pattern de busca já existe na ilha de mentoria); ODS só número sem nomes (`ProjectsAdminApp.tsx:321-322`); orçamento/anexos/parceria/`supportPartners` existem no modelo (migration 038) mas **não renderizados na UI**; metodologia PjBL deveria vir pré-preenchida (`cadastro-projeto-extensao.md:111`); validações de carga/datas só no backend; **sem campos de área CNPq** (nem no plano — decidir se entra no alinhamento MEC). |
| P6 Projetos atuais → extensão | Página híbrida: 11 repos open source estáticos (`data/projects.ts`) + seção de extensão que **já lê o snapshot** (`data/projects-extension.ts`) mas está vazia (zero `extension_projects` ativos públicos). Os 11 repos **não encaixam naturalmente** no modelo (falta entidade jurídica obrigatória, ODS, datas, mentor) — permanecem como vitrine open source. |
| P7 Conversão de assinatura pessoal → empresa | `/patrocinadores` lê só `companies` (`companies.service.ts:353-385`); assinatura pessoal **nunca aparece** e não existe conversão pós-fato (metadata Stripe fixa na criação; métricas somam por `companyId`). Um patrocinador real com conta pessoal está invisível na página por isso. **Escopo**: endpoint admin "converter assinatura pessoal em apoio empresarial" (vincula `companyId` existente ou cria Company a partir da assinatura, com trilha de auditoria) + doc do operador. |

**Esforço: M.** Dependência: P12 e P6 dividem o módulo de projetos (um PR ou dois). Dump de produção disponível em `pg_dump/` (restaurável via `scripts/db-restore-prod.sh`) para cruzar o patrocinador do P7.

---

### Fase 9 — UX dos painéis (/membro, nav admin) (M)

| Item | Diagnóstico (evidência) |
|---|---|
| P9 `/membro` over-information | Sub-aba "SortCoins e reembolsos" contém **apenas reembolsos** (`WalletTab.tsx:147` — o rótulo é que está errado); doações/assinaturas/reembolsos aparecem em 3 lugares cada (overview + sub-aba + dialog); Tabs MUI aninhadas em 3 níveis com mesmo peso visual (`EventsTab.tsx:343` sub-sub-Tabs indistinguível); estado só por query string. |
| P10 Sub-menus do admin | 9 grupos/25 itens (`AppNavIsland.tsx:76-205`); órfãos: "Mentoria" (Programas) aponta para área de membro, "Transferências" só existe no hub, Universitário (programa ADR 015) fora de "Programas", critério role-vs-designation misto em Governança, C4P dentro de Eventos (questionável), grupos de 1 item (Gestão, Programas, Empresas) inflam a sidebar. |

**Escopo sugerido**: renomear a sub-aba para "Reembolsos" e consolidar as entradas duplicadas; hierarquia visual das Tabs (2 níveis no máximo ou pesos distintos); proposta de nova taxonomia da sidebar (agrupar por domínio de valor, resolver órfãos) com migração gradual. **Esforço: M.** Alto valor percebido, baixo risco técnico — bom candidato a primeira fase pós-correções.

---

## Priorização sugerida

1. **Fase 7.1** (correções pontuais) — menor esforço, fecha relatos visíveis imediatos.
2. **Fase 7.2** (mentoria) — bug funcional real (P1) + quick win de UX (P2).
3. **Fase 9** (painéis) — alto valor percebido, sem risco de contrato.
4. **Fase 8** (páginas públicas) — depende de uma decisão de produto (o que é automático).
5. **Fase 8b** (projetos/patrocínio) — o P7 tem valor financeiro imediato (patrocinador invisível); o P12 é o maior gap de UX operacional.
6. Depois, os candidatos anteriores (próxima seção) conforme apetite.

## Candidatos anteriores (pré-12-pontos, sem aprovação)

| Candidato | Estado | Esforço |
|---|---|---|
| **Camada 3 do sync de eventos** — eliminar GitHub-as-database (dispatch `repository_dispatch`, remover force-sync de PR) | Design aprovado desde 2026-09 (`docs/plans/events-sync-improvements/`); ⚠️ blast radius: `GitHubDBService` compartilhado (token OAuth do membro) — remoção completa é follow-up separado | M |
| **Sprint 6 — hub unificado de eventos** | `event-uiux-improvements/README.md`; ⚠️ revalidar escopo (fases 1a-7 e Fase 6a suplantaram várias dores) | M |
| **Hardening financeiro** ⚠️ REVALIDAR | Backlog 2026-09-10: atomicidade do ledger, race de saldo, idempotência de refund, SortCoins congelado por 1 cancelamento, `fetchActiveSubscriptions` cap 100, taxas Stripe de ingressos fora do ledger, `amount` não inteiro → 500. Fases 2-7 tocaram essas áreas — item a item antes de virar tarefa. Maior risco real do sistema | M-G |
| **Atualização de dependências** | `update/README.md` ⚠️ defasado (MUI 9 e TS 5.7 já feitos); restam Stripe 21→22, ESLint 10, class-validator 0.15, TS 6 (backend). Regerar com `npm outdated` | P-M |
| **Real Network Sprint 0** | Handle Mastodon no perfil (~1 dia, independente) | P |
| **Votação eletrônica formal (1.1)** | Só desenho conceitual; quorum eletrônico + auditoria + LGPD | G |
| **Consolidação de frontend (onda 2)** | Não é refatoração (Fase 0/ADR 011 concluída): boilerplate das ~15 ilhas admin, `client:only` onipresente, ilhas grandes, system props remanescentes, tipos duplicados | M |
| **Multisite — onboarding** | CamposTech/Cloud Native sem site; medir build com 3 tenants antes da 4ª; `multisite/README.md` defasado | P |

## Pendências operacionais (não são fases de código)

1. **Campanha piloto do C4P** (valida menores deferidos e a decisão 4 da spec).
2. **Discussion real da primeira assembleia** (Fase 3) e assembleia real.
3. **Validação visual** do Experiência do Membro (Fase 6a) e **aviso real** de Announcements (Fase 6b).
4. **CI: job de boot do app real** (lição do hotfix 1.0.1) — Postgres de serviço no `pr-check.yml` executando ao menos um E2E de boot sem overrides de guard.
5. Limpeza de branches mortas/worktrees (se houver).

## Como propor uma nova fase

Mesmo ritual das fases 1a–7: (1) investigar e consolidar achados com evidência; (2) spec executável em `docs/superpowers/specs/YYYY-MM-DD-<nome>-design.md` com pontos de revisão humana; (3) plano TDD; (4) ratificação das decisões em conflito pela presidência; (5) implementação em `develop` com PR de acompanhamento; (6) revisão independente; (7) ADR própria se introduzir contrato novo. Bump semver: feat → minor, fix → patch.

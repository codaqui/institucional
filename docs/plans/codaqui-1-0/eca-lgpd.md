<!-- AGENT-INDEX
purpose: Design do fluxo ECA/LGPD do plano Codaqui 1.0.0 — sinalização de conteúdo destinado a maiores (flag adultOnly + venueType), componente de aviso reutilizável (<AdultContentNotice>) e responsabilidades do organizador, sem coleta de idade e sem policiamento de menores.
audience: Presidência, mantenedores, AI agents implementando as fases 1a/1b.
status: integrado ao plano executável da Fase 1a (Task 10 de fase-1a.md). Escopo limitado à sinalização informativa 18+; texto de privacidade P1 passa por revisão jurídica e não presume ausência de dados de adolescentes.
sections:
  - Contexto e decisões da presidência
  - 1. Princípios
  - 2. Flag de conteúdo adulto (adultOnly) + componente <AdultContentNotice>
  - 3. Tipos de local (venueType) como alavanca de dados
  - 4. Fluxo ECA/LGPD para material e eventos
  - 5. Mapeamento no plano Codaqui 1.0.0
  - 6. O que NÃO faremos
  - Pontos abertos
related-docs:
  - docs/plans/codaqui-1-0/README.md — plano-mestre (subsistemas, privacidade P1–P3, fases 1a→7, versionamento 0.12.0+)
  - docs/adrs/001-event-platform.md — plataforma de eventos (flag é extensão dela; sem ADR nova)
  - docs/modules/events/ROLES.md — papéis de eventos (quem seta o flag)
  - AGENTS.md — decisões 5 (snapshots de eventos), 12 (padrões), Design System (tokens --cq-*)
agent-protocol:
  - Fatos validados no código em 2026-10-29: backend/src/events/entities/managed-event.entity.ts (campos atuais), backend/src/events/events.service.ts (toEventItem, linha ~308; GET /events/public/managed), backend/src/events/dto/event.dto.ts (Create/UpdateEventDto), backend/src/events/entities/event-override.entity.ts (payload JSON de metadados de externos), frontend/src/lib/events.ts (EventItem/EventSummary), frontend/src/pages/eventos/[...path].astro (detalhe), frontend/src/components/astro/EventCard.astro (chips da listagem), frontend/src/styles/tokens.css (--cq-color-warning 5.02:1 / --cq-color-warning-bg).
  - Este documento é design: nada aqui foi implementado. Campos de código citados referenciam o estado ATUAL (sem adultOnly/venueType).
  - Latência: o flag segue o pipeline de snapshots (sync de hora em hora + build) — mesma latência dos overrides já documentada no plano.
-->

# ECA/LGPD — Sinalização de conteúdo destinado a maiores e cuidados com menores

> **Origem:** decisões da presidência (2026-10-29). Eventos são livres e as inscrições acontecem normalmente em plataformas terceiras; eventos internos e processos são 100% GitHub-based; o GitHub aceita pessoas de **13+**; a associação **não mapeia idades** dos membros; alguns eventos acontecem em bares/restaurantes (público maior de idade). Entregas: (a) sistema de sinalização para eventos/conteúdos destinados a maiores, com aviso reutilizável que **desencoraja menores sem policiar**; (b) fluxo de material/cuidados ECA/LGPD.

## Contexto e decisões da presidência

- O piso etário da nossa identidade digital já é herdado: conta no site = conta GitHub, e os [Termos do GitHub](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) exigem 13+ ("You must be age 13 or older"). O link repassado pela presidência aponta para o [Code of Conduct da comunidade GitHub](https://docs.github.com/en/site-policy/github-terms/github-community-code-of-conduct) — documento de convivência que reforça as mesmas regras; a cláusula etária propriamente dita vive nos Termos. Comentários (Giscus) e processos internos também passam por GitHub.
- Eventos externos (Meetup, Discord, Sympla, Doity, OCGroups) têm inscrição fora do nosso domínio — não vemos quem se inscreve.
- Eventos internos (`managed_events`) têm inscrição pelo site, com login (GitHub, 13+).
- **Não sabemos (e não queremos saber) quem é menor de idade.** O sistema precisa funcionar sem data de nascimento.

## 1. Princípios

1. **Zero coleta de idade.** Nenhum cadastro (membro, mentorando convidado, C4P, inscrição em evento) pergunta data de nascimento ou idade. Isso é invariante: não há campo, não haverá.
2. **Bases legais são hipóteses de trabalho para revisão jurídica na P1**, não conclusão automática deste anexo: execução de contrato/gestão associativa para conta e operações, consentimento revogável para opt-ins e obrigação legal quando aplicável a registros financeiros.
3. **Crianças e adolescentes exigem cuidado específico, sem inferência etária.** O piso GitHub 13+ não comprova que todo usuário é adulto: adolescentes podem ter conta e dados tratados pela plataforma. Portanto não usar a frase absoluta "não tratamos dados de menores". O produto não é dirigido a crianças, não coleta idade e não infere faixa etária; orienta acompanhamento de responsável e oferece canal para revisão/remoção quando um caso for identificado. Regras de consentimento e verificação para crianças/adolescentes devem ser revistas na P1 conforme o contexto real do tratamento.
4. **GitHub 13+ como requisito da plataforma-base, não como verificação de maioridade.** A Codaqui não duplica controle etário nem usa o cadastro GitHub para estimar idade.
5. **Sinalizar, não policiar.** O flag `adultOnly` é **informativo**: avisa que o local/horário/conteúdo é destinado a maiores, desencoraja a participação de menores desacompanhados e declara nossa postura de dados. Ele **não bloqueia inscrição**, não verifica idade e não controla entrada.
6. **Responsabilidade do organizador em eventos sinalizados.** Quem cadastra/edita o evento (organizer dono via `event_organizer_ownership`, ou admin) é responsável por classificar: conhece o local, o horário e o conteúdo. O sistema sugere (via `venueType` + horário — seção 3), mas **confirmação humana é obrigatória** — a sugestão nunca grava sozinha.
7. **Transparência sobre indexação.** Evento sinalizado continua **indexável** (sem noindex, fora do `SITEMAP_EXCLUDE`): o aviso existe para informar na listagem e no detalhe, não para esconder. Conteúdo adulto de fato (que não organizaríamos) é outra história e não é o caso aqui.

## 2. Flag de conteúdo adulto (`adultOnly`)

### Definição

- **`adultOnly: boolean, NOT NULL, DEFAULT false`** em `managed_events`.
- Semântica: "evento em local e/ou horário e/ou com conteúdo destinado a maiores de 18 anos" — happy hours, encontros em bar/restaurante noturno, conteúdo com linguagem/temática adulta. É uma **sinalização de contexto**, não uma restrição técnica.
- Default `false` preserva os ~eventos existentes sem migração de dados (a coluna chega preenchida).

### Quem seta

- **Organizer** (dono do evento via ownership) e **admin**, no formulário do evento (cadastro e edição) — novos campos em `CreateEventDto`/`UpdateEventDto` (`@IsBoolean()` + `@Type(() => Boolean)`; `@IsEnum(VenueType) @IsOptional()`).
- Mudança do flag após publicação gera entrada no `audit` (ator, evento, valor anterior/novo) — é classificação sensível, segue o padrão do módulo `audit`.

### Como aparece no snapshot público

Pipeline validado no código (estado atual):

1. `ManagedEvent` → `EventsService.toEventItem()` (`backend/src/events/events.service.ts`) → `GET /events/public/managed` (somente `published`).
2. Workflow `sync-event-snapshots.yml` (horário) lê esse endpoint e grava `static/events/internal/codaqui/`; o build do site emite `/eventos/<slug>`.
3. Acréscimo no serializer: `adultOnly: event.adultOnly` (sempre presente, explícito) e `...(event.venueType && { venueType: event.venueType })`.
4. Tipo no frontend: `EventItem.adultOnly?: boolean` + `export type VenueType = 'bar' | 'restaurante' | 'auditorio' | 'campus' | 'online' | 'outro'` em `frontend/src/lib/events.ts`.

**Latência = latência dos overrides** (mudança reflete no próximo sync + build — documentar no admin, como no risco 8 do plano).

### Eventos externos (mecanismo existente, zero schema novo)

Eventos de fontes externas já têm via de metadados: `event_overrides.payload` é um **JSON livre** aplicado pelo sync (hoje já carrega `speakers`, e o badge "Verificado por @handle" usa esse caminho — `EventOverrideBadge.astro`). Para externos sinalizados, o organizer dono do override seta **`payload.adultOnly = true`** (mesma chave, mesmo shape no `EventItem`). O frontend consome `event.adultOnly` de forma uniforme, qualquer que seja a fonte.

### Componente `<AdultContentNotice>` (reutilizável)

**Arquivo canônico:** `frontend/src/components/astro/AdultContentNotice.astro` (componente de **servidor**, zero JS — recomendado como padrão).

- **Copy centralizada** em `frontend/src/lib/adult-content.ts` (constantes exportadas + teste unitário `adult-content.test.ts`) — é o "i18n" do site: pt-BR único hoje, com props `title?`/`body?` permitindo override futuro sem tocar páginas.
- **Texto padrão (pt-BR):**
  - Título: "Evento destinado a maiores de 18 anos"
  - Corpo: "Este evento acontece em local, horário ou contexto destinado a maiores. Menores de idade devem participar acompanhados de um responsável legal. A sinalização é informativa e não substitui as regras do local nem a responsabilidade do organizador."
- **Marcação:** `<div class="adult-content-notice" role="note" aria-label="Aviso: evento destinado a maiores de idade">` — ícone 🔞 (`aria-hidden="true"`), título em negrito, corpo. Sem interatividade no padrão.
- **Estilo (zero hex, tokens `--cq-*`):** fundo `var(--cq-color-warning-bg)`, borda esquerda 4px `var(--cq-color-warning)`, texto `var(--cq-color-warning)` — par warning já tem contraste AA (5.02:1 claro / 6.15:1 escuro) e varia por `[data-theme]` automaticamente (`tokens.css`). Cantos arredondados; padding e tipografia seguem o padrão das admonitions existentes.
- **Uso — página de detalhe** (`frontend/src/pages/eventos/[...path].astro`): `{event.adultOnly && <AdultContentNotice />}` **imediatamente após o bloco data/local e antes da seção de inscrição** — quem chega pelo CTA vê o aviso primeiro.
- **Uso — listagem** (`frontend/src/components/astro/EventCard.astro`, fileira de chips): `<span class="chip chip-warning" title="Evento destinado a maiores de 18 anos"><span aria-hidden="true">🔞</span> +18</span>` — `chip-warning` já existe e usa tokens.
- **Variante ilha (opcional):** `frontend/src/components/islands/AdultContentNoticeIsland.tsx` (`client:load`) só se a presidência quiser o aviso **descartável** ("Não mostrar novamente" em `localStorage`, chave `cq-adult-notice-dismissed`). Recomendação do design: **lançar a versão estática** (zero custo de hidratação); a ilha é um follow-up independente.

### Alvos futuros (registrados, não implementar agora)

- **`c4p_calls.adultOnly`** (Fase 7): campanha cujo enunciado/conteúdo é 18+; usa o mesmo componente na hotpage da chamada.
- **Trilhas e blog (conteúdo Markdown):** frontmatter `adultOnly: true` renderizado pelo mesmo `<AdultContentNotice>` dentro do corpo. Caso raro (conteúdo técnico não costuma ser), mas o componente já estará lá.

## 3. Tipos de local (`venueType`) como alavanca de dados

**Campo:** `managed_events.venueType` — `enum` TypeORM (`varchar` + check, mesmo padrão de `ManagedEventStatus`), **nullable** (eventos legados ficam `NULL` = não informado; não inventar valor).

| Valor | Quando |
|---|---|
| `bar` | Bar, pub, cervejaria |
| `restaurante` | Restaurante, pizzaria, casa de show com jantar |
| `auditorio` | Auditório, sala de palestras, teatro |
| `campus` | IES/escola, biblioteca, campus |
| `online` | Remoto/Discord/streams |
| `outro` | Tudo o mais |

**Heurística data-leveraged (sugestão, nunca grava sozinha):**

> `venueType ∈ {bar, restaurante}` **E** hora de início ≥ **18h no `timezone` do evento** → o formulário exibe banner de sugestão: *"Este evento parece destinado a maiores (local + horário). Marcar como 18+?"* com o checkbox **pré-marcado**; o organizer confirma ou desmarca. A regra vive no frontend (formulário) e é repetida como hint no backend; o valor persistido é sempre decisão humana.

Por que confirmação humana: restaurante almoço (13h) não é 18+; bar durante conferência diurna pode ter área family. O dado é alavanca de atenção, não de automação.

## 4. Fluxo ECA/LGPD para material e eventos

### Checklist do organizador (aplicável a eventos internos e externos sinalizados)

1. **Classificação:** conteúdo adequado — se houver linguagem/temática/local 18+, marcar `adultOnly` e descrever o contexto no resumo (ex.: "happy hour — o local serve bebidas alcoólicas").
2. **Local e horário:** preencher `venueType`; avaliar a sugestão do sistema (seção 3); no texto do evento, orientar que menores só participam acompanhados de responsável legal.
3. **Imagem e fotos:** se houver fotógrafo/filmagem, avisar no texto do evento. Fotos que capturem menores exigem consentimento do responsável legal (LGPD art. 14); preferir enquadrar sem foco em menores; qualquer responsável pode pedir remoção em contato@codaqui.dev. ECA art. 53 responsabiliza quem organiza atividades destinadas a crianças e adolescentes — nosso desenho evita esse enquadramento ao não dirigir eventos a menores, mas o cuidado com imagem vale para eventos abertos ao público geral.
4. **Inscrição e dados:** não perguntar idade nem usar o formulário para registrar dados de terceiros sem base e finalidade válidas. O login GitHub 13+ não comprova maioridade; orientar acompanhamento de responsável e encaminhar qualquer situação identificada envolvendo criança/adolescente ao canal de privacidade, sem criar um fluxo caseiro de consentimento.
5. **Material de divulgação:** respeitar a mesma classificação do evento (criativo de happy hour não vai para canal de menor).

### O que o SISTEMA faz

- Persiste `adultOnly` + `venueType`; propaga `adultOnly` no snapshot (internos via coluna; externos via `event_overrides.payload.adultOnly`).
- Renderiza aviso na página de detalhe e badge +18 na listagem (seção 2).
- Sugere o flag (venueType + horário) com confirmação humana; audita mudanças do flag.
- Mantém o evento **indexável e no sitemap** (princípio 7) — sinalizado, não escondido.
- P1 — Política de Privacidade ganha a seção **"Menores de idade"** (seção 5).

### O que fica FORA (do sistema e da associação)

- **Venda/distribuição de bebidas alcoólicas:** responsabilidade do estabelecimento (CNPJ e alvará do local, legislação estadual). Não vendemos, não distribuímos, não cobramos — apenas sinalizamos o contexto.
- Controle de entrada, verificação de documento, guarda/transporte de menores.
- Registro civil de participantes menores (não coletamos; se algum dia um evento exigir, será caso pontual com consentimento do responsável e entrada no inventário de tratamentos).

## 5. Mapeamento no plano Codaqui 1.0.0

| Onde | O quê |
|---|---|
| **Backend 0.12.0 / Migration 031** | `managed_events` +`adultOnly` +`venueType`; DTOs e serializer; audit de mudança; externos por `payload.adultOnly` |
| **Frontend / Task 10 da 1a** | `adult-content.ts`, `AdultContentNotice.astro`, badge, detalhe, formulário e tipos. Gates: `make astro-verify` + tenants |
| **P1 — Política de Privacidade (1b)** | Seção "Crianças e adolescentes": não coletamos nem inferimos idade; GitHub 13+ não é prova de maioridade; orientação sobre acompanhamento, imagem e canal de revisão/remoção; significado e limites do aviso 18+. Texto e bases legais passam por revisão jurídica, sem declaração absoluta de ausência de dados de menores |
| **ADR** | Extensão da ADR 001, sem ADR nova |

Fora da **1a** (avaliar em suas fases): `c4p_calls.adultOnly` e frontmatter `adultOnly` em trilhas/blog.

## 6. O que NÃO faremos

- **Não perguntar idade/data de nascimento** em cadastro, inscrição, mentoria, C4P ou qualquer formulário — hoje e no 1.0.0.
- **Não bloquear menores**: o piso é o do GitHub (13+); acima disso, sinalizamos e orientamos (responsável legal acompanha), sem impedir participação. A associação não é porta de evento.
- **Não verificar documentos de identidade** nem fazer controle de entrada/escuta etária.
- **Não criar cadastro dedicado de menores nem registrar dados de terceiros** (como "cadastro do filho") sem finalidade, base legal e processo de consentimento revistos; situações identificadas seguem o canal de privacidade e o inventário.
- **Não auto-classificar eventos**: a heurística venueType+horário **sugere**, nunca grava.
- **Não desindexar** eventos sinalizados (sem noindex / sem sair do sitemap).
- **Não tocar em bebida alcoólica** — venda/distribuição é do estabelecimento.
- **Não usar qualquer forma de inferência biométrica/estimativa de idade** por imagem.

## Pontos abertos

1. **Threshold do horário noturno** — ✅ **ratificado em 2026-10-29: 18h** (horário local do evento); copy v1 do warning aprovada para seguir, melhorias podem surgir na implementação.
2. **Copy final do aviso** — validar com presidência/jurídico antes de publicar (menção ao ECA/LGPD deve ser precisa).
3. **Variante ilha descartável** — decidir depois do lançamento da versão estática (se vale a hidratação).
4. **Badge 🔞 vs "+18"** — manter texto "+18" legível com emoji decorativo `aria-hidden` (proposta deste design; confirmar em revisão de acessibilidade).

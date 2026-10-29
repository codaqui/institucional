<!-- AGENT-INDEX
purpose: Design do fluxo ECA/LGPD do plano Codaqui 1.0.0 — sinalização de conteúdo destinado a maiores (flag adultOnly + venueType), componente de aviso reutilizável (<AdultContentNotice>) e responsabilidades do organizador, sem coleta de idade e sem policiamento de menores.
audience: Presidência, mantenedores, AI agents implementando as fases 1a/1b.
status: design proposto em 2026-10-29 a partir das decisões da presidência (eventos livres; GitHub 13+ como piso; sem mapeamento de idades; eventos em bares/restaurantes) — aguardando integração pelo orquestrador no README do plano.
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
2. **Base legal por contexto (LGPD art. 7º).**
   - Membro (OAuth GitHub: id, handle, nome, e-mail, avatar): **execução de contrato** (adesão à associação) + **legítimo interesse** (gestão associativa) — arts. 7º, V e IX.
   - Campos opcionais (bio, LinkedIn, e-mails secundários, opt-ins): **consentimento** — art. 7º, I (revogável no painel).
   - Financeiro (Stripe, doações, PJ): execução de contrato + obrigação legal/fiscal — arts. 7º, V e II/c.
   - E-mails transacionais e analytics: legítimo interesse, com opt-out onde aplicável.
3. **Menores de idade = não tratamos dados (LGPD art. 14).** Dado pessoal de criança/adolescente exige consentimento específico e em destaque de pelo menos um responsável legal, com dever de verificação do controlador. Como não coletamos idade, não podemos operar esse consentimento em escala — a resposta é **não captar dados de menores** e orientar o público: menores só participam acompanhados de responsável, e o responsável é quem registra o que for necessário. Qualquer dado de menor que chegar por exceção (ex.: foto, contato pontual) é tratado sob art. 14 e removido sob solicitação em contato@codaqui.dev.
4. **GitHub 13+ como plataforma-base.** Conta, OAuth, processos e comentários já herdam o piso do GitHub. O sistema nunca precisa duplicar essa verificação.
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
4. Tipo no frontend: `EventItem.adultOnly?: boolean` + `export type VenueType = 'bar' | 'restaurante' | 'auditório' | 'campus' | 'online' | 'outro'` em `frontend/src/lib/events.ts`.

**Latência = latência dos overrides** (mudança reflete no próximo sync + build — documentar no admin, como no risco 8 do plano).

### Eventos externos (mecanismo existente, zero schema novo)

Eventos de fontes externas já têm via de metadados: `event_overrides.payload` é um **JSON livre** aplicado pelo sync (hoje já carrega `speakers`, e o badge "Verificado por @handle" usa esse caminho — `EventOverrideBadge.astro`). Para externos sinalizados, o organizer dono do override seta **`payload.adultOnly = true`** (mesma chave, mesmo shape no `EventItem`). O frontend consome `event.adultOnly` de forma uniforme, qualquer que seja a fonte.

### Componente `<AdultContentNotice>` (reutilizável)

**Arquivo canônico:** `frontend/src/components/astro/AdultContentNotice.astro` (componente de **servidor**, zero JS — recomendado como padrão).

- **Copy centralizada** em `frontend/src/lib/adult-content.ts` (constantes exportadas + teste unitário `adult-content.test.ts`) — é o "i18n" do site: pt-BR único hoje, com props `title?`/`body?` permitindo override futuro sem tocar páginas.
- **Texto padrão (pt-BR):**
  - Título: "Evento destinado a maiores de 18 anos"
  - Corpo: "Este evento acontece em local e horário destinados a maiores. Menores de idade só devem participar acompanhados de um responsável legal. A Codaqui não coleta dados pessoais de menores de idade."
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
| `auditório` | Auditório, sala de palestras, teatro |
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
4. **Inscrição de menores:** não coletar dados de menores em nenhuma etapa. No nosso sistema a inscrição exige login GitHub (13+); em plataformas terceiras, o organizador orienta que o responsável legal acompanhe e seja quem se inscreve.
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
| **Backend 0.12.x** (junto da Fase 1a) | Migration (≥ 026): `managed_events` +`adultOnly` (bool, NOT NULL, default false) +`venueType` (enum nullable). DTOs (`Create/UpdateEventDto`). `toEventItem` expõe ambos. Audit em mudança de `adultOnly`. Reconhecer `payload.adultOnly` no sync/override de externos (frontend já lê do `EventItem`). |
| **Frontend** (mesma janela da 1a/1b) | `src/lib/adult-content.ts` + `AdultContentNotice.astro` + badge no `EventCard.astro` + condicional na `[...path].astro`; campos no formulário admin/organizer com sugestão venueType+horário; tipos em `src/lib/events.ts`. Tenants herdam via `src/` compartilhado. Gates: `make astro-verify` (+ tenants se tocar em compartilhado). |
| **P1 — Política de Privacidade** (Fase 1b, `/sobre/privacidade`) | Nova seção **"Menores de idade"**: não coletamos idade; piso GitHub 13+; dados de menores só com consentimento do responsável (art. 14 LGPD) e remoção sob solicitação; imagem; o que o sinalizador 18+ significa (aviso informativo) e o que **não** significa (não é controle de entrada nem verificação). Atualizar o inventário em `docs/modules/privacy/`. |
| **ADR** | Não gera ADR nova — é extensão da plataforma de eventos (ADR 001); citar este documento na nota de implementação da Fase 1a. |

Fora do 1.0.0 (registrado como alvo futuro): `c4p_calls.adultOnly` (Fase 7), frontmatter `adultOnly` em trilhas/blog.

## 6. O que NÃO faremos

- **Não perguntar idade/data de nascimento** em cadastro, inscrição, mentoria, C4P ou qualquer formulário — hoje e no 1.0.0.
- **Não bloquear menores**: o piso é o do GitHub (13+); acima disso, sinalizamos e orientamos (responsável legal acompanha), sem impedir participação. A associação não é porta de evento.
- **Não verificar documentos de identidade** nem fazer controle de entrada/escuta etária.
- **Não coletar dados pessoais de menores** (nem em nome do responsável como "cadastro do filho"); exceção pontual só com consentimento do responsável (art. 14) + registro no inventário.
- **Não auto-classificar eventos**: a heurística venueType+horário **sugere**, nunca grava.
- **Não desindexar** eventos sinalizados (sem noindex / sem sair do sitemap).
- **Não tocar em bebida alcoólica** — venda/distribuição é do estabelecimento.
- **Não usar qualquer forma de inferência biométrica/estimativa de idade** por imagem.

## Pontos abertos

1. **Threshold do horário noturno** — ✅ **ratificado em 2026-10-29: 18h** (horário local do evento); copy v1 do warning aprovada para seguir, melhorias podem surgir na implementação.
2. **Copy final do aviso** — validar com presidência/jurídico antes de publicar (menção ao ECA/LGPD deve ser precisa).
3. **Variante ilha descartável** — decidir depois do lançamento da versão estática (se vale a hidratação).
4. **Badge 🔞 vs "+18"** — manter texto "+18" legível com emoji decorativo `aria-hidden` (proposta deste design; confirmar em revisão de acessibilidade).

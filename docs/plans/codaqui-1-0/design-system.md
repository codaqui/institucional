<!-- AGENT-INDEX
purpose: Anexo do plano Codaqui 1.0.0 — adoção do Design System Codaqui (tokens, tema, correção de contraste WCAG) dentro da Fase 0 (refatoração Astro) e a página pública /design-system (brand book interativo) como entrega da Fase 0.3.
audience: Presidência, mantenedores, AI agents implementando a Fase 0.
status: design aprovado em 2026-10-20 (tokens novos integrados ao refactor do frontend; correção de contraste do verde acionável aprovada; página pública confirmada como entrega da Fase 0.3). Origem: protótipo externo "Kimi_Agent_Codaqui Design System (1)" analisado em 2026-10-20.
sections:
  - Origem e análise do protótipo
  - Decisões de design (2026-10-20)
  - Tokens canônicos
  - Divergências do protótipo a resolver na adoção
  - Página pública /design-system
  - Integração com as subfases da Fase 0
  - O que NÃO portar do protótipo
  - Critérios de pronto
related-docs:
  - docs/plans/codaqui-1-0/README.md — plano-mãe 1.0.0
  - docs/plans/codaqui-1-0/refatoracao-frontend-astro.md — Fase 0 (este anexo altera as subfases 0.1 e 0.3 e o "fora de escopo")
  - AGENTS.md — padrões atuais do tema MUI (a tabela de tokens fica desatualizada até a Fase 0.1; ver seção de integração)
agent-protocol:
  - Até a Fase 0.1, este anexo é a fonte canônica de tokens. A partir da 0.1, a fonte canônica é o código (Tailwind theme + createCodaquiTheme) e este documento registra apenas as decisões.
  - O protótipo de origem vive em code-to-analyze/ (gitignored): não referenciar caminhos dele em código; portar conteúdo, não arquivos.
-->

# Design System Codaqui — Adoção na Fase 0 e página pública (anexo do plano 1.0.0)

> **Origem:** protótipo externo gerado e iterado fora do repo (`code-to-analyze/Kimi_Agent_Codaqui Design System (1)`), contendo: um guia normativo v1.0 (~450 linhas, com contrastes WCAG medidos e escrito contra o código real deste repo), dois arquivos drop-in (`codaqui-tokens.css` com tokens `--cq-*` + ponte `--ifm-*`, e `codaqui-mui-theme.ts` preservando a API `createCodaquiTheme(mode)`) e uma vitrine SPA (React + Vite + Tailwind + shadcn) que funciona como **brand book interativo**. Decisões deste anexo alinhadas em 2026-10-20.

## Origem e análise do protótipo

Achados da análise técnica (2026-10-20):

1. **O guia normativo é o entregável mais valioso** — princípios, marca, cor (com tabelas de contraste medidas), tipografia, espaçamento 4pt, raios/sombras, iconografia, movimento, specs de componentes (incluindo os componentes reais do repo: `DonationFlow`, `TransactionTable`, `EventOverrideBadge`), acessibilidade WCAG 2.2 AA, tom de voz, governança e roadmap.
2. **Achado central de acessibilidade:** o verde de marca `#57B593` tem contraste **2.49:1 sobre branco — reprova WCAG AA** para texto/ação. O DS separa "cor de marca" (decoração, hero, logo) de "cor acionável" (Primary 700 `#378369`, 4.55:1).
3. **O AGENTS.md está desatualizado, não o protótipo:** o AGENTS.md documenta `primary.main = #22c55e` e `secondary #0ea5e9`, mas o código real (`src/theme/muiTheme.ts`) usa `#57B593`/`#87D2B7`. O protótipo parte dos valores reais do código.
4. **Os assets de marca já são nossos:** os 3 SVGs do protótipo (`logo_principal`, `logo_monocromatica`, `logo_mono2`) são idênticos aos de `static/img/`.
5. **A vitrine não usa MUI** — é React + Tailwind + shadcn consumindo os tokens `--cq-*` diretamente; o tema MUI proposto vive fora do app, como arquivo drop-in para este repo.
6. A pasta inclui ainda um artefato não relacionado (`codaqui_100_membros/`, post de rede social "100+ membros") — **fora de escopo**.

## Decisões de design (2026-10-20)

1. **O DS é adotado dentro da Fase 0** (refatoração Astro), não como fase separada: o frontend novo já nasce com os tokens novos. Nada de escrever CSS/tema duas vezes.
2. **Correção de contraste aprovada:** a cor acionável no tema claro passa de `#57B593` para **`#378369`** (primary-700); no escuro, **`#89CBB3`**. `#57B593` permanece como cor de marca/decoração (hero, logo, ilustrações — nunca texto ou fundo de botão sobre branco). É mudança visual visível em botões e links, com ganho WCAG AA.
3. **Versão pública do Design System** — página **`/design-system`** no próprio site, portando a ideia da vitrine (brand book scrollável com seções: História, Marca, Cores, Tipografia, Componentes, Acessibilidade, Tom de Voz). Pública por princípio: transparência é valor da associação, e o guia serve a voluntários, comunidades parceiras e parceiros de mídia.
4. **Uma fonte de tokens, dois consumidores:** os tokens `--cq-*` alimentam tanto o theme do Tailwind v4 (layouts/componentes `.astro`) quanto o `createCodaquiTheme` (MUI v9, ilhas React). Nunca hardcode de hex em componente.
5. **Dados reais, não estimados:** a timeline da vitrine usa números inventados; a página pública consome `src/data/timeline.ts` e os snapshots reais (`static/social-stats/`).

## Tokens canônicos

Resumo normativo (o detalhe exato é fixado na implementação da Fase 0.1 a partir do guia de origem):

| Camada | Decisão |
|---|---|
| Cor de marca | Verde `#57B593` + ameixa `#3A2F39` — decoração/hero/logo apenas |
| Cor acionável (claro) | Primary 700 `#378369` (4.55:1 sobre branco — AA) |
| Cor acionável (escuro) | `#89CBB3` |
| Escala primary | 50–900 |
| Neutros | Escala "plum" 50–900 derivada do ameixa — **cinzas puros proibidos** |
| Semânticas | info/success/warning/error, todas com pares AA verificados |
| Backgrounds dark | `#2A2130` / `#3A2F39` (mantidos do tema atual) |
| Tipografia | System fonts (decisão de performance — "performance é inclusão"), escala modular 1.25 (12–48px), pesos 400/500/700/800, mono para números de impacto |
| Espaçamento | Escala 4pt (4–96px); container 1200px; alvos de toque ≥44px |
| Raios | 4 / 8 / 12 / 16 / 999px |
| Sombras | Tingidas de ameixa (`rgba(32,24,31,…)`) |
| Movimento | 120/200/320ms; `prefers-reduced-motion` obrigatório |
| Tom de voz | pt-BR primeiro; linguagem inclusiva ("participantes", nunca "alunos"); hashtags oficiais `#QueroEstudar`, `#QueroApoiar`, `#QueroMentoria`, `#ClubCodaqui` |

## Divergências do protótipo a resolver na adoção

1. **Duas gramáticas de token:** o CSS drop-in usa `--cq-color-primary-*` enquanto a vitrine usa `--cq-primary-*` e nomes semânticos diferentes (`--cq-action-bg` vs `--cq-action-primary-bg`, `--cq-border` vs `--cq-border-default`). A Fase 0.1 **unifica a nomenclatura em uma única gramática** antes de gerar Tailwind theme e MUI theme.
2. **`secondary` muda de significado:** hoje é o verde claro `#87D2B7`; o DS propõe secondary = neutro plum. Impacto nas ilhas MUI que usam `color="secondary"` — mapear na 0.1.
3. **Ponte Docusaurus não se aplica mais:** o drop-in `codaqui-tokens.css` mantém aliases `--ifm-*` e `--codaqui-*` para o Docusaurus. Como o DS entra **na Fase 0 (Astro)**, esses aliases legados **não são portados** — nascemos limpos no stack novo. (Se algo do DS precisar chegar ao Docusaurus antes do cutover, é só a correção de contraste pontual — decisão da 0.1.)

## Página pública `/design-system`

A ideia da vitrine buildada no protótipo, portada para o stack da Fase 0:

- **Stack:** `.astro` puro + Tailwind v4, com ilhas mínimas (`client:visible`/`client:load`): swatches de cor que copiam o hex ao clicar, toggle de tema, demo de foco por Tab. Casa com a regra "zero JS por padrão" — a vitrine é ~95% apresentação.
- **Seções** (espelhando a vitrine): Hero com marca · 01 História (timeline **real**, de `timeline.ts`) · 02 Marca (3 logos de `static/img/` + regras de respiro/uso proibido) · 03 Cores (escalas com badge WCAG por swatch, incluindo o alerta "por que `#57B593` não é acionável") · 04 Tipografia (escala renderizada ao vivo) · 05 Componentes (demos dos padrões: botões, badges, alertas, formulários, tabela financeira) · 06 Acessibilidade (checklist + demo de foco) · 07 Tom de voz (tabela "Diga / Evite / Por quê" + hashtags).
- **Renders:** rota estática no build de **todos os tenants** (o DS é da Codaqui; sites de comunidade podem linkar). SEO/OG próprios no `BaseLayout`.
- **O que ela não é:** não é Storybook, não é documentação de API de componentes — é o brand book público. Documentação técnica de componentes fica no AGENTS.md/docs internos.

## Integração com as subfases da Fase 0

| Subfase | O que muda por causa deste anexo |
|---|---|
| **0.1 — Esqueleto + POC** | Em vez de copiar o tema atual, **porta os tokens `--cq-*`** (nomenclatura unificada) gerando: theme do Tailwind v4 + `createCodaquiTheme` (MUI v9) com a cor acionável corrigida. Corrige a tabela de tokens do AGENTS.md na mesma PR. |
| **0.3 — Site público** | Entrega extra explícita: **página `/design-system`** completa, com critério de pronto próprio (seções acima + Lighthouse ≥ o das demais páginas públicas). |
| **0.4 — App (admin/membro)** | Ilhas MUI consomem o tema novo; mapeamento dos usos de `secondary` resolvido na 0.1. |
| **0.6 — Cutover** | AGENTS.md reescrito já documenta os tokens novos como padrão. |

## O que NÃO portar do protótipo

- **O app Vite/Tailwind/shadcn da vitrine** como aplicação — é referência de design/interação, não código a manter. A página pública nasce `.astro`.
- Os ~55 componentes shadcn scaffoldados e ~20 dependências sem uso (recharts, zod, react-hook-form, embla, vaul, sonner…) — resíduo de geração.
- A pasta `codaqui_100_membros/` (artefato de marketing não relacionado).
- Os aliases de compatibilidade `--ifm-*`/`--codaqui-*` (ver decisão 3 da seção anterior).

## Critérios de pronto

- **Tokens (0.1):** Tailwind theme e `createCodaquiTheme` gerados da mesma fonte; contraste AA verificado nos pares acionáveis; AGENTS.md corrigido (`#22c55e` → valores reais novos).
- **Página pública (0.3):** `/design-system` no ar com as 8 seções; swatches copiando hex; dados de história vindos de `timeline.ts`; acessível (skip link, foco visível, reduced-motion); zero erros de contraste nos próprios componentes da página.

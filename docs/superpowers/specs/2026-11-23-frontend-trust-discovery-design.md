<!-- AGENT-INDEX
purpose: Desenho curto da correção de confiança informacional, acessibilidade e descoberta nas jornadas públicas do frontend.
audience: Presidência, mantenedores, implementadores e revisores.
status: Concluída em develop/1.9.1 com TDD, gates, evidência visual e revisão independente sem achados críticos/importantes.
sections:
  - Intenção
  - Escopo e restrições
  - Abordagens
  - Desenho
  - Verificação e documentação
related-docs:
  - ../../plans/frontend-jornadas/README.md — inventário vivo das jornadas.
  - ../../../.impeccable/critique/2026-11-23T15-18-16Z__docs-plans-frontend-jornadas-readme-md.md — evidências da revisão dual-agent.
  - 2026-11-18-journeys-mockups-design.md — posicionamento e sistema visual preservados.
agent-protocol:
  - Preservar Astro, React/MUI, Tailwind, tokens, URLs e o posicionamento visual incumbente.
  - Não reexecutar entregas anteriores nem ampliar para admin, dados de insights ou fallbacks noscript.
-->

# Confiança e descoberta nas jornadas públicas

## Intenção

Corrigir os três problemas P1 encontrados na revisão de 2026-11-23: valores financeiros falsamente zerados durante falhas, barreiras de acessibilidade em páginas centrais e rotas públicas sem descoberta interna. A entrega aumenta a confiança de quem acompanha e audita a Associação sem redesenhar o frontend.

É uma mudança pequena, concentrada no portal e nas ilhas compartilhadas de transparência, com testes de comportamento e verificação visual nos dois temas.

## Escopo e restrições

### Objetivos

- Distinguir loading, erro, ausência de conta e zero financeiro real.
- Atingir contraste AA nos elementos identificados e remover saltos de headings reproduzidos pelo detector.
- Tornar `/empresas` e `/regex` alcançáveis pelo rodapé sem aumentar a navegação principal.
- Atualizar o inventário de jornadas, o índice de planos e o changelog com o estado efetivamente verificado.

### Não objetivos e anti-objetivos

- Não alterar framework, arquitetura, tokens primitivos, layout geral, URLs, redirects ou conteúdo factual.
- Não incluir admin, consolidação de comunidades, números de insights, noscript, paginação de eventos ou novo redesign.
- Não apresentar `R$ 0,00` quando a API falhou ou quando não existe conta para a comunidade.
- Não adicionar links a `/empresas` ou `/regex` no sitemap: ambas já são públicas; a mudança é somente de descoberta.

## Abordagens

1. **Confiança e descoberta — escolhida.** Corrige somente os três P1 e suas regressões diretas. Menor blast radius, testes focados e uma release patch.
2. **Jornadas públicas completas.** Acrescentaria faixa associativa, fontes divergentes, copy e noscript. Foi rejeitada para este ciclo por misturar correções urgentes com trabalho de conteúdo e robustez.
3. **Público + admin.** Acrescentaria padrões operacionais administrativos. Foi rejeitada porque exigiria outro desenho, autenticação e uma matriz maior de testes.

## Desenho

### 1. Transparência sem falso zero

Arquivos principais: `frontend/src/components/islands/TransparencyApp.tsx`, `CommunityTransparencyIsland.tsx` e seus testes.

- Separar erro de saldos e erro de estatísticas; respostas HTTP não bem-sucedidas não podem virar dados nulos equivalentes a zero.
- Exibir skeleton apenas durante loading. Em erro ou ausência de conta, exibir `—`; somente uma resposta válida pode produzir valores numéricos, inclusive zero.
- Manter atividades, finanças e movimentações independentes. O retry de saldo/estatísticas não desmonta atividades nem tabelas que continuam válidas.
- Remover a copy que promete disponibilidade do backend em produção; a mensagem deve descrever a falha atual e oferecer nova tentativa.
- Nos KPIs, valores deixam de ser headings: preservam o `variant` visual do MUI com componente semântico de texto.

### 2. Contraste e hierarquia

Arquivos principais: `frontend/src/pages/comunidades/index.astro`, `frontend/src/components/islands/DiscordWidgetIsland.tsx` e `TransparencyApp.tsx`.

- Chips e CTA usam o par semântico `bg-action text-on-action`, válido nos dois temas, em vez de `text-white` ou `text-primary-800` sobre fundo variável.
- O título do Discord usa `component="h2"`, mantendo o `variant` visual atual e o mesmo nível das seções vizinhas.
- Valores dos KPIs não criam saltos `h1 → h4`; nenhum estilo tipográfico muda.

### 3. Descoberta pelo rodapé

Arquivo principal: `frontend/src/lib/site-navigation.ts` e `site-navigation.test.ts`.

- Adicionar **Empresas apoiadoras** (`/empresas`) ao grupo **Participar**.
- Adicionar **Guia de Regex** (`/regex`) ao grupo **Conteúdo e contato**.
- Manter o header/drawer atuais para não criar mais um ponto de decisão; os testes garantem os destinos no mapa compartilhado do footer.

## Verificação e documentação

- TDD nos estados de erro, zero legítimo, ausência de conta, retry e mapa de navegação.
- `cd frontend && npm run check && npm run test` e build do portal; rodar `make astro-verify` e `make astro-verify-tenants` por haver ilha compartilhada.
- Inspecionar `/comunidades`, `/eventos` e `/transparencia` em 390×844 e 1440×900, claro/escuro, com detector e screenshots; confirmar contraste, hierarquia, retry e ausência de overflow.
- Atualizar `docs/plans/frontend-jornadas/README.md` com os achados de 2026-11-23, sem apagar o histórico, e `docs/plans/README.md` com esta entrega.
- Criar release patch **1.9.1** em `CHANGELOG.md`, alinhando `frontend/package.json`, `backend/package.json` e lockfiles. Não declarar publicação/deploy sem evidência.

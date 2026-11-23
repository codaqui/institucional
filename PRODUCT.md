<!-- AGENT-INDEX
purpose: Contexto durável e confirmado do produto Codaqui para decisões de UX, conteúdo e implementação.
audience: Mantenedores, presidência, designers e AI agents.
status: Registro inicial confirmado em 2026-11-23; decisões abertas permanecem explícitas.
sections:
  - Platform
  - Users
  - Product Purpose
  - Positioning
  - Operating Context
  - Capabilities and Constraints
  - Brand Commitments
  - Evidence on Hand
  - Product Principles
  - Accessibility & Inclusion
related-docs:
  - AGENTS.md — invariantes técnicos e operacionais.
  - docs/plans/frontend-jornadas/README.md — inventário vivo das jornadas.
  - docs/adrs/007-community-registry.md — registro de comunidades.
agent-protocol:
  - Confirmar fatos novos antes de alterar este registro; não incluir direção visual, métricas inventadas ou planos como capacidades publicadas.
-->

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Público primário:** comunidades de tecnologia, incluindo organizadores e participantes. Organizadores precisam integrar sua comunidade, publicar atividades e receber estrutura com prestação de contas; participantes precisam descobrir e acompanhar essas atividades.

Outras visões essenciais:

- **Aprender:** pessoas que buscam trilhas, mentoria, eventos e certificados.
- **Apoiar:** pessoas e empresas que querem doar, assinar o Clube, apoiar projetos ou patrocinar.
- **Acompanhar e auditar:** sociedade pública que verifica contas, atas, impacto, projetos e dados abertos.
- **Operar:** membros, mentores, diretorias e administradores que gerenciam participação, atividades, governança e finanças com permissões próprias.

## Product Purpose

A Codaqui reúne comunidades de tecnologia sob uma estrutura associativa compartilhada. O portal permite descobrir comunidades e atividades, aprender, participar, apoiar e auditar o que foi realizado.

Sucesso significa comunidades conseguindo executar suas atividades com estrutura, pessoas encontrando caminhos claros de participação e qualquer visitante conseguindo distinguir dados confirmados de dados indisponíveis ao acompanhar impacto e finanças.

## Positioning

Codaqui é uma **associação de comunidades**, não apenas uma plataforma educacional ou um agregador de eventos. As comunidades realizam as atividades; a Associação oferece estrutura institucional, governança e prestação de contas.

O mecanismo combina portais com identidade própria, agenda e recursos compartilhados, vínculo associativo explícito e transparência pública de atividades e finanças. Aprender é uma das atividades das comunidades, não a identidade exclusiva do produto.

## Operating Context

- O portal público, os sites das comunidades, a área do membro e a administração compartilham o mesmo monorepo e respeitam papéis e visibilidade diferentes.
- Conteúdo estático e snapshots alimentam o build; dados operacionais e financeiros podem exigir APIs em runtime e precisam apresentar loading, erro, empty state e retry sem confundir indisponibilidade com zero.
- Comunidades preservam branding e rotas próprias enquanto usam recursos compartilhados. O build multi-tenant e a paridade de URLs fazem parte da operação.
- Eventos, C4P, mentoria, projetos, certificados, assembleias, apoio financeiro e governança têm fluxos públicos e administrativos distintos.
- Releases e pendências operacionais são acompanhados no changelog e no índice de planos; propostas não devem ser descritas como funcionalidades publicadas.

## Capabilities and Constraints

- Descoberta de comunidades, eventos, trilhas, mentoria, projetos, membros e conteúdo institucional.
- Participação em atividades, submissão e avaliação de C4P, certificados, verificação pública e apoio financeiro.
- Transparência de atividades e finanças por comunidade, com vínculos públicos condicionados à privacidade.
- Áreas de membro e administração para operar os domínios existentes com autorização.
- URLs publicadas, conteúdo canônico, multi-tenant, privacidade e fontes de dados existentes devem ser preservados.
- Não fabricar números, pessoas, atividades, atas, depoimentos ou disponibilidade de backend. Zero é um dado retornado, nunca um fallback para erro ou ausência.
- A landing dedicada para integrar comunidades, atas/exportação comunitária e demais pendências do inventário são decisões abertas, não capacidades presumidas.

## Brand Commitments

- Usar **Codaqui**, **CODAQUI.dev** e **Associação** conforme o contexto existente.
- Comunicar em português com linguagem associativa, clara e acolhedora: “participantes”, “programa”, “encontros”, “comunidades integradas”, “assembleias” e “prestação de contas”.
- Preservar o posicionamento “comunidades fazem, a Associação dá estrutura e presta contas”.
- Preservar nomes, logotipos e materiais canônicos das comunidades em `comunidades/`; não substituir identidade comunitária por uma marca genérica.

## Evidence on Hand

- Branding e conteúdo canônico das comunidades em `comunidades/`.
- Conteúdo editorial e educacional em `blog/` e `trilhas/`.
- Snapshots gerados por workflows em `static/`, incluindo comunidades, eventos, mentores, projetos e estatísticas; esses arquivos não são editados manualmente.
- Dados financeiros e de atividades obtidos pelas APIs existentes, com estados de indisponibilidade tratados explicitamente.
- Inventário de jornadas em `docs/plans/frontend-jornadas/README.md` e revisão Impeccable de 2026-11-23 em `.impeccable/critique/`.
- Não há autorização para inventar depoimentos, clientes, benchmarks, atas, métricas ou atividades ausentes nessas fontes.

## Product Principles

1. **Comunidades primeiro:** decisões de produto começam pelo valor entregue a organizadores e participantes, sem excluir as demais visões.
2. **Atividades antes de números:** transparência mostra o que as comunidades fizeram antes de apresentar finanças.
3. **Dados reais ou incerteza explícita:** conteúdo real, empty states honestos e indisponibilidade declarada valem mais que completude fictícia.
4. **Participação sem becos:** cada visão deve ter um próximo passo descobrível e compatível com seus dados e permissões.
5. **Estrutura compartilhada com identidade preservada:** recursos comuns não apagam a autonomia visual, editorial e comunitária dos tenants.

## Accessibility & Inclusion

- Contraste AA para texto e controles, hierarquia sequencial de headings, um `main` por página e landmarks identificáveis.
- Navegação por teclado, foco visível, nomes acessíveis, `alt` adequado e estados de erro anunciáveis.
- Indicadores de página, tabs e filtros não dependem somente de cor.
- Conteúdo e jornadas devem funcionar em mobile e nos dois temas suportados, sem expor PII para melhorar aparente completude.

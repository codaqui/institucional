<!-- AGENT-INDEX
purpose: Design da Fase E1 — Aquisição Pública e Medição, parte da Fase E de Experiência e Crescimento. Redesenha home e jornadas públicas com direção “impacto comunitário”, instrumenta funis sem confundir intenção com conversão e prepara baseline de quatro semanas.
audience: Presidência, mantenedores, AI agents que escreverão o plano e implementarão E1.
status: design aprovado em conversa para escrita desta spec; aguardando revisão do arquivo antes do plano de implementação. Não implementado.
sections:
  - Contexto e evidências
  - Decisões validadas
  - Atores e jornadas
  - Arquitetura de informação e direção visual
  - Requisitos por página e fallbacks
  - Analytics, privacidade e baseline
  - Arquitetura técnica e dados
  - Testes e critérios de aceite
  - Roadmap E1–E3 e fora de escopo
related-docs:
  - docs/plans/codaqui-1-0/README.md — plano-mãe e sequência de fases
  - docs/plans/codaqui-1-0/fase-1a.md — pré-requisito de dados e permissões
  - docs/plans/codaqui-1-0/transversais.md — Pagefind, privacidade e itens transversais
  - frontend/src/pages/index.astro — home atual
  - frontend/src/components/astro/SiteHeader.astro — navegação atual
  - frontend/src/styles/tokens.css — fonte canônica do Design System
  - static/analytics/index.json — baseline histórica de pageviews
agent-protocol:
  - Após revisão e aprovação desta spec, invocar superpowers:writing-plans. Não implementar diretamente da spec.
  - E2 (membro/conversão) e E3 (admin/operação) terão specs próprias; não incluí-las no plano de E1.
  - Não transformar cliques em conversões: apenas confirmações reais no backend contam como inscrição ou pagamento concluído.
-->

# Design Spec — Fase E1: Aquisição Pública e Medição

## 1. Contexto e evidências

A saída do Docusaurus para Astro entregou uma base técnica melhor: HTML estático, ilhas sob demanda, Design System com tokens, navegação acessível e gates de build. Entretanto, a migração preservou a arquitetura de conteúdo anterior, sem redesenhar aquisição, proposta de valor ou conversão.

Evidências auditadas:

- `frontend/src/pages/index.astro`: a home é uma sequência genérica de hero, prova social, funcionalidades, comunidades e Discord.
- `HeroBanner.astro`: “Democratizando comunidades e projetos de tecnologia!” não explica claramente as diferentes formas de participação; só existem os CTAs `#QueroEstudar` e `#QueroApoiar`.
- `SiteHeader.astro`: muitos links concorrentes, sem agrupamento explícito pelas intenções dos atores.
- Eventos e trilhas aparecem entre os conteúdos mais acessados de `static/analytics/index.json`, mas não têm presença proporcional na home.
- A instrumentação atual em `BaseLayout.astro` registra pageviews via GA4, sem taxonomia de CTAs ou confirmação de conversões.
- O fluxo de mentoria usa Google Calendar externo; o backend atual não consegue confirmar um agendamento.
- Inscrições em eventos e pagamentos Stripe já possuem confirmação real no backend e podem ser medidos sem inventar novos critérios de sucesso.

Conclusão: o problema não é falta de um novo framework nem de um novo logo. É a ausência de uma arquitetura de experiência orientada por atores, jornadas e resultados mensuráveis.

## 2. Decisões validadas no brainstorming

| Tema | Decisão |
|---|---|
| Resultado | Jornadas equilibradas, com funis e métricas separados por público |
| Abrangência total | Plataforma completa, dividida em specs independentes |
| Primeiro subprojeto | Aquisição pública; membro e admin virão depois |
| Direção visual | Nova direção chamada **impacto comunitário**, sem trocar o logo |
| Combinação escolhida | Estrutura e confiança da opção C (impacto institucional) + linguagem humana e histórias da opção A (editorial comunitária) |
| Posição no roadmap | Nova Fase E depois da Fase 1a; a antiga 1b é absorvida em E1–E3 |
| Metas numéricas | Instrumentar, medir baseline de quatro semanas e só então definir melhorias relativas |
| Conversão | Cliques medem intenção; somente confirmações reais contam como inscrição ou pagamento |
| Identidade visual | Nova direção de apresentação, não rebrand nem troca de logo |
| Conteúdo | Dados reais e curadoria em código; sem CMS e sem estatísticas fictícias |
| Escopo de E1 | Portal Codaqui apenas; nenhuma home de tenant é alterada |

### Nome da fase

**Fase E — Experiência e Crescimento**, posicionada depois da Fase 1a:

- **E1 — Aquisição pública e medição:** esta spec.
- **E2 — Membro e conversão:** incluirá `profileVisibility`, painel e perfil público.
- **E3 — Admin e operação:** incluirá refinamento do `AppLayout`/sidebar.

Os conteúdos da antiga Fase 1b são redistribuídos entre E1–E3. Não haverá duas fases de UX concorrentes. A Fase 2 de pessoas e horas vem depois de E.

## 3. Atores e quatro jornadas canônicas

A arquitetura deixa de apresentar “muitos atores” como uma lista de páginas e passa a organizar quatro intenções principais.

### 3.1 Aprender

**Público:** pessoas em início, transição ou evolução de carreira, participantes e mentorandos.

**Jornada:** descobrir na home/conteúdo → escolher trilha autônoma ou mentoria → iniciar trilha ou agendar → acessar conteúdo/confirmação.

**Regra de métrica:** início de trilha é engajamento. Clique para agendar mentoria é intenção; agendamento concluído só será conversão quando existir confirmação interna, prevista para a Fase 5.

### 3.2 Participar de eventos

**Público:** participantes, interessados em encontros e membros de comunidades.

**Jornada:** próximo evento/agenda → comparação e detalhe → inscrição → confirmação, QR quando aplicável, lembrete e compartilhamento.

**Regra de métrica:** `event_registration_complete` só é emitido após inscrição confirmada no backend. Check-in é ativação posterior, não conversão de aquisição.

### 3.3 Apoiar

**Público:** doadores PF/PJ, empresas e apoiadores recorrentes.

**Jornada:** entender impacto e transparência → escolher destino, valor e frequência → checkout Stripe → sucesso, recibo e prestação de contas.

**Regra de métrica:** `begin_checkout` é intenção; `purchase` só é emitido após confirmação por webhook Stripe. Abrir o checkout nunca conta como doação.

### 3.4 Conectar comunidades

**Público:** comunidades parceiras, organizadores, mantenedores e instituições.

**Jornada:** explorar rede e portais → entender benefícios e responsabilidades → apresentar a comunidade → retorno humano/portal.

**Regra de métrica:** `community_contact_click` mede intenção. Aprovação da parceria só será conversão quando o fluxo D2 existir.

### Jornadas complementares, sem virar um quinto funil

- **Contribuir com open source:** `/projetos` orienta contribuição em projetos mantidos no GitHub. Não misturar com os futuros projetos de extensão da Fase 4.
- **Mentorar/voluntariar:** aparece como ação dentro de Aprender e da comunidade, não como nova arquitetura paralela.
- **Ler histórias e impacto:** blog, transparência e insights sustentam todas as jornadas, sem CTA concorrente desnecessário.

## 4. Arquitetura de informação

### 4.1 Header

Navegação principal simplificada por intenção:

- **Aprender:** consolida Trilhas e Mentoria.
- **Eventos:** agenda e detalhes.
- **Comunidades:** rede, portais e apoio institucional.
- **Projetos:** projetos open source e, futuramente, extensão com distinção explícita.
- **Sobre:** Associação, Equipe, Membros, Insights, Transparência, Conduta, Pais e Responsáveis e Design System.
- **Apoiar:** CTA visual principal.

API sai da navegação principal e permanece em `/desenvolvedores/api` e no rodapé. Contato permanece acessível, sem disputar a hierarquia primária.

### 4.2 Home

Ordem das seções:

1. **Hero:** eyebrow “Associação sem fins lucrativos”, título “Educação aberta. Impacto que você pode acompanhar.”, explicação curta e CTAs “Começar a aprender” e “Conhecer a Codaqui”.
2. **História real ao lado do hero:** relato verificável de participante, mentor ou comunidade, com nome/contexto e link para o conteúdo completo.
3. **Escolha seu próximo passo:** quatro cards — Quero aprender, Quero participar, Quero apoiar, Sou uma comunidade — cada um com uma ação principal.
4. **Acontecendo agora:** próximo evento real e trilha real em destaque.
5. **Histórias e impacto:** relatos reais do blog, dados reais de programas/comunidades e link para transparência.
6. **Fechamento por intenção:** retomada das quatro jornadas, sem introduzir novos CTAs concorrentes.

A home não terá carrossel, feed genérico de cards nem números estimados. Conteúdo dinâmico vem das fontes já existentes.

### 4.3 Hierarquia de CTA

Cada seção possui uma ação primária e, no máximo, uma secundária. O botão principal muda conforme a intenção da seção; “Apoiar” não compete com aprendizado em todos os blocos.

## 5. Direção visual — impacto comunitário

A apresentação combina:

- **Da direção C:** estrutura institucional, legibilidade, confiança, dados reais e transparência.
- **Da direção A:** headline editorial, espaço para histórias, acolhimento e linguagem centrada em pessoas.

Regras:

- Logo e cores de marca permanecem. Não é rebrand.
- A nova linguagem é implementada por tokens em `frontend/src/styles/tokens.css`; nenhum hex solto em componentes.
- Tipografia editorial pode usar stack local, como Georgia, para headlines; nenhuma fonte externa é baixada.
- Cards têm hierarquia clara, não decoração gratuita. Espaçamento e ritmo seguem o Design System.
- Layout mobile-first em 360, 768 e 1280px; alvos de toque ≥44px.
- Sem carrossel, parallax ou animação obrigatória. `prefers-reduced-motion` é respeitado.
- HTML estático primeiro; nenhum hero pesado ou biblioteca de animação.

## 6. Requisitos por página e fallbacks

### Home

- Usa `frontend/src/data/home.ts` para curadoria de CTAs, jornadas e referências de histórias.
- Próximo evento vem do snapshot de eventos; trilha em destaque vem dos dados de trilhas.
- Se não houver evento futuro, o bloco é substituído por conteúdo real de blog/comunidade, sem card vazio.
- Se a história curada não existir ou estiver indisponível, ela é ocultada e o hero se expande; nenhum depoimento fictício é criado.
- Título SEO recomendado: “Codaqui — Educação aberta e comunidades de tecnologia”. Canonical e URLs existentes não mudam.

### Aprender (`/participe/estudar` e `/participe/mentoria`)

- A escolha entre trilha autônoma e mentoria fica explícita antes do detalhamento.
- Trilhas mostram nível, conteúdo e ação direta de começar/continuar.
- Mentoria mostra foco dos mentores e expectativa da sessão antes do link externo.
- Cronograma e conteúdo histórico ficam abaixo da ação principal; não bloqueiam a escolha.
- A saída para Google Calendar registra intenção, nunca agendamento concluído.

### Eventos (`/eventos` e detalhe)

- Home destaca o próximo evento real com data, local e comunidade.
- Listagem mantém filtros e ganha busca/estado na URL quando implementado no plano.
- Detalhe prioriza informações para decidir e a inscrição, preservando login e retorno.
- Confirmação oferece próximos passos reais: calendário, QR quando aplicável e compartilhamento.

### Apoiar (`/participe/apoiar`)

- Impacto e transparência antecedem a configuração da doação.
- PF/PJ, destino, valor e frequência permanecem no fluxo atual, com menos distrações.
- Retorno de sucesso oferece recibo e transparência; criar conta é opcional, nunca barreira pós-pagamento.
- Doação para comunidade preserva `communityId`, `returnPath` e o contexto do portal.

### Comunidades (`/comunidades`, `/sobre/ong` e portais)

- A página explica benefícios e responsabilidades antes do contato.
- Níveis e selo usam os dados entregues pela Fase 1a.
- CTA orienta a apresentar a comunidade com contexto mínimo, sem criar um formulário público paralelo antes de D2.
- Portais existentes continuam sendo o destino para quem já participa da rede.

### Pagefind, privacidade e conduta

E1 absorve estes itens da antiga 1b:

- Pagefind no portal Codaqui, com `/busca` noindex e fora do sitemap.
- P1/P2 revisados para cobrir GA4, eventos de CTA, Measurement Protocol, Cloudflare e retenções.
- P3: Código de Conduta com navegação e “como reportar” em destaque, sem alterar o texto normativo.

## 7. Analytics e baseline

### 7.1 Taxonomia mínima

Eventos somente em pontos estratégicos; não instrumentar todos os cliques indiscriminadamente.

| Evento | Origem | Natureza | Parâmetros permitidos |
|---|---|---|---|
| `cta_click` | Frontend | Intenção | `journey`, `placement`, `destination`, `content_id` opcional |
| `trail_start` | Frontend | Engajamento | `track_slug`, `source` |
| `mentorship_schedule_click` | Frontend | Intenção | `mentor_id` público opcional, `source` |
| `event_registration_complete` | Backend | Conversão | `event_id`, `community_id`, `source` |
| `begin_checkout` | Frontend | Intenção | `community_id`, `donation_type`, `ui_mode` |
| `purchase` | Backend/webhook | Conversão | `transaction_id`, `value`, `currency`, `community_id`, `donation_type` |
| `community_contact_click` | Frontend | Intenção | `placement`, `contact_channel` |
| `sign_up` | Backend | Ativação | `provider`, `source` quando disponível |

Nunca enviar nome, e-mail, telefone, handle, token, cookie, endereço IP ou conteúdo de formulários.

### 7.2 GA4 e Measurement Protocol

- O GA4 existente continua com `anonymize_ip: true`.
- O frontend usa uma lib tipada, `frontend/src/lib/growth-analytics.ts`, como única porta para `dataLayer`.
- O backend envia somente conversões reais via GA4 Measurement Protocol.
- `GA4_MEASUREMENT_ID` e `GA4_API_SECRET` ficam em env; somente templates no `.env.example`.
- `transaction_id` usa o identificador de referência já existente para impedir duplicação em retries.
- `client_id` é pseudônimo e não contém `memberId`, e-mail ou handle.
- Na E1 não há costura de identidade entre sessão de browser e conversão server-side. Funis client-side e confirmações server-side são analisados separadamente, evitando complexidade e rastreamento desnecessário.
- Falha no GA nunca bloqueia inscrição, checkout, login ou navegação e nunca reverte uma transação.

### 7.3 Baseline e análise

- Período inicial: quatro semanas após instrumentação em produção.
- Cortes mínimos: jornada, dispositivo, origem de tráfego e página de entrada.
- UTM padronizada para campanhas: `utm_source`, `utm_medium`, `utm_campaign` em minúsculas e sem dados pessoais.
- Relatório semanal no GA4, sem criar um dashboard novo antes de haver dados.
- Após o baseline, metas relativas são definidas por funil. Não há número arbitrário de conversão nesta spec.
- Não há A/B testing na E1. Comparações serão antes/depois, com cautela sobre sazonalidade.
- Teste qualitativo com 5–8 pessoas de perfis diferentes na home e nos dois fluxos mais importantes identificados pelos dados.

## 8. Arquitetura técnica e dados

### Frontend

Componentes pequenos, majoritariamente `.astro`:

- `HomeHero.astro` — proposta de valor e história curada.
- `JourneyCards.astro` — quatro intenções e CTAs.
- `LiveOpportunities.astro` — evento e trilha reais.
- `ImpactStories.astro` — relatos e impacto.
- `growth-analytics.ts` — contratos e emissão de eventos de intenção/engajamento.

`frontend/src/data/home.ts` contém somente curadoria e referências. Não duplica eventos, estatísticas, blog, mentores ou comunidades.

### Backend

Um service interno de analytics é consumido pelos fluxos existentes de eventos e Stripe:

- Recebe apenas dados permitidos da conversão.
- Emite GA4 Measurement Protocol com timeout e logs sem PII.
- Idempotência por `transaction_id`/referenceId.
- Não altera estados de inscrição, order, pagamento ou ledger.
- Testes usam `fetch` mockado; nenhum teste chama GA4 de verdade.

Não há novo módulo de domínio, tabela ou CMS para E1.

### SEO e compartilhamento

- URLs existentes permanecem estáveis.
- Canonical, OG e JSON-LD de Organization/Event/Person são preservados ou melhorados sem mudar o contrato.
- Histórias reais reforçam clusters de conteúdo existentes: eventos, trilhas, comunidades e impacto.
- Não criar páginas programáticas ou conteúdo fino para cada ator.

## 9. Acessibilidade, privacidade, desempenho e erros

- WCAG 2.2 AA, HTML semântico, headings sem saltos, foco visível e navegação completa por teclado.
- Testes manuais com leitor de tela em amostras da home, apoio e detalhe de evento.
- Imagens com `alt`, conteúdo sem depender apenas de cor e controles com nome acessível.
- Performance móvel medida antes e depois; sem regressão relevante causada por imagens, animações ou JS.
- Analytics é sempre opcional para a experiência: bloqueio do GA não produz erro visual nem impede ações.
- Falta de snapshot usa os fallbacks existentes; falta de história curada não deixa espaço vazio.
- Falha de emissão server-side fica apenas em log sanitizado e não afeta o compromisso da transação.
- P1/inventário explicam GA4, Cloudflare, eventos e retenções antes da ativação em produção.

## 10. Testes e critérios de aceite

### Automatizados

- Unitários para `home.ts`, contratos de analytics e seleção de fallbacks.
- Componentes para header, quatro jornadas, links, teclado e estados vazios.
- Testes comprovam que payloads não contêm PII e que retries não duplicam `purchase` ou inscrição.
- Backend com fetch mockado para sucesso, timeout e resposta inválida do GA4.
- `make astro-verify` e `make astro-verify-tenants`.
- `cd backend && npm run build && npx jest --silent` quando houver mudança no backend.
- `npm run test:scripts` quando houver mudança em scripts.

### Manuais e ponta a ponta

1. Visitante entende as quatro jornadas e chega a cada destino sem procurar no rodapé.
2. Próximo evento e trilha exibidos na home são os mesmos das fontes canônicas.
3. Inscrição confirmada gera exatamente um evento backend; clique sem inscrição não gera conversão.
4. Pagamento confirmado por webhook gera exatamente um `purchase`; checkout abandonado não gera.
5. Clique em mentoria registra intenção e não conversão concluída.
6. GA bloqueado não impede aprendizado, inscrição ou doação.
7. Navegação por teclado, reduced-motion e layouts 360/768/1280px funcionam.
8. Lighthouse Accessibility ≥95 nas páginas alteradas e nenhuma regressão visual/funcional nos fluxos existentes.
9. Testes com 5–8 pessoas registram principais dúvidas e bloqueios; achados críticos são corrigidos antes do encerramento de E1.

## 11. Entrega e versionamento

E1 é entregue em uma branch própria após o merge da Fase 1a. O plano de implementação definirá tasks e commits pequenos. Se houver alteração em `backend/`, o release recebe a próxima minor livre, sem reutilizar `0.12.0`.

Critérios finais:

- Nova home e quatro jornadas publicadas no portal Codaqui.
- Direção “impacto comunitário” aplicada sem rebrand.
- Pagefind, P1/P2 e P3 entregues nos respectivos fluxos.
- Taxonomia de intenção e conversões reais funcionando sem PII.
- Baseline de quatro semanas documentada para orientar as metas de E2 e melhorias posteriores.
- Nenhuma mudança de home em tenants e nenhum conteúdo fictício publicado.

## 12. Fora de escopo de E1

- Novo logo ou substituição do Design System.
- CMS, novo blog ou migração de conteúdo para banco.
- Campanhas pagas, automação de marketing e A/B testing.
- Dashboard interno novo de analytics antes do baseline.
- Specs de membro/admin, dashboards operacionais e redesign completo de admin.
- Novo fluxo público de comunidades (D2) ou mentoria interna (Fase 5).
- Home nova para tenants.
- Alteração de regras de inscrição, pagamento, ledger ou RBAC.

<!-- AGENT-INDEX
purpose: Registrar o desenho aprovado para sorteio de apoiadores e contraste do seletor empresarial.
audience: Mantenedores, designers e AI agents.
status: Aprovado em 2026-11-24 para implementação na PR #673 como 1.13.0.
sections:
  - Intenção e escopo
  - Abordagens
  - Desenho aprovado
  - Verificação
related-docs:
  - frontend/src/components/islands/SocialProofStrip.tsx — carrossel atual.
  - frontend/src/components/islands/CompanySupportIsland.tsx — seletor empresarial.
agent-protocol:
  - Preservar dados públicos, autoplay acessível, navegação manual e integração Stripe.
-->

# Apoiadores aleatórios e doação empresarial

## Intenção e escopo

Mostrar uma pessoa ou empresa por vez no banner em ordem aleatória, mantendo autoplay e controles acessíveis. Corrigir o contraste do seletor “Doação única”/“Assinatura mensal” em `/participe/apoiar/?modo=empresa`, alinhando-o ao padrão visual da frequência pessoal.

Não alterar métodos Stripe, payloads, dados públicos, valores de doações ou a correção textual de Pix já presente na PR #673.

## Abordagens

1. **Fila embaralhada — aprovada.** Embaralhar na carga e a cada ciclo, evitando repetição imediata inclusive na fronteira do ciclo. Variedade sem repetições consecutivas.
2. **Sorteio independente — descartada.** Cada tick sortearia qualquer item e poderia repetir o mesmo apoiador várias vezes seguidas.
3. **Somente embaralhar na carga — descartada.** Evitaria complexidade, mas repetiria sempre a mesma ordem e não atende à proposta de renovar o ciclo.

## Desenho aprovado

- Reutilizar o mapeamento atual de pessoas e empresas e aplicar Fisher–Yates com fonte aleatória injetável para testes determinísticos.
- Autoplay continua a cada seis segundos, com pausa por hover, foco, página oculta e `prefers-reduced-motion`.
- Setas e indicadores percorrem a ordem corrente. Ao avançar do último para o primeiro, uma nova fila é embaralhada; o primeiro item não pode ser o último exibido quando houver mais de um item.
- A contagem pública, slides, live region e chaves estáveis por tipo/ID permanecem.
- O seletor empresarial usa `size="small"`, texto `text.primary`, padding equivalente à frequência pessoal, seleção `primary.main` + `primary.contrastText` e hover `primary.dark`. O token de contraste é necessário porque o texto adequado é branco no tema claro e `primary.900` no escuro. A troca de jornada e a URL permanecem inalteradas.
- Agrupar na PR #673 como 1.13.0, com manifests, lockfiles e changelog.

## Verificação

- Testes determinísticos de embaralhamento, preservação dos itens e não repetição na fronteira.
- Testes atuais de autoplay, acessibilidade e troca de jornada permanecem verdes.
- Contraste do seletor verificado no componente e visualmente em claro/escuro, desktop e mobile.
- Build, `astro check`, suíte completa, gates multi-tenant e CI/Sonar da PR.

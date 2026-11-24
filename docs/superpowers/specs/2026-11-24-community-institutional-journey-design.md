<!-- AGENT-INDEX
purpose: Registrar a correção aprovada para conectar Comunidades, Apoio Institucional e Títulos.
audience: Mantenedores, designers e AI agents.
status: Aprovado em 2026-11-24 para implementação na release 1.12.1.
sections:
  - Intenção
  - Escopo
  - Abordagens
  - Desenho aprovado
  - Verificação
related-docs:
  - PRODUCT.md — posicionamento da Codaqui como associação de comunidades.
  - frontend/src/lib/site-navigation.ts — navegação pública compartilhada.
agent-protocol:
  - Implementar como refinamento das jornadas existentes, sem redesign ou novas alegações institucionais.
-->

# Jornada entre Comunidades, Associação e Títulos

## Intenção

Tornar descobrível a relação entre quem realiza as atividades, quem oferece estrutura institucional e onde o visitante verifica os reconhecimentos oficiais. Hoje `/sobre/titulos/` não possui entrada nos destinos analisados, e os vínculos entre `/comunidades/` e `/sobre/ong/` aparecem apenas como links pontuais.

## Escopo

- Conectar `/comunidades/`, `/sobre/ong/` e `/sobre/titulos/` em uma navegação local compartilhada.
- Adicionar Títulos e Reconhecimentos ao grupo institucional do rodapé.
- Preservar identidade visual, conteúdo factual, rotas e demais jornadas.
- Publicar como correção de jornada na versão 1.12.1, com changelog.

Não inclui redesign, alteração do cabeçalho principal ou criação de uma nova página institucional.

## Abordagens

1. **Navegação institucional compartilhada — aprovada.** Uma mesma navegação logo após o hero das três páginas explica cada destino e identifica a página atual. Resolve a relação no ponto de entrada sem alterar a navegação global.
2. **Somente links contextuais — descartada.** Seria mais discreta, mas manteria a descoberta dependente da leitura completa.
3. **Novo grupo Associação no cabeçalho — descartado.** Ampliaria o escopo e adicionaria complexidade à navegação principal.

## Desenho aprovado

Um componente Astro compartilhado apresenta a frase já estabelecida pelo posicionamento do produto: as comunidades realizam, a Associação oferece estrutura e presta contas. Três destinos aparecem em sequência:

1. **Comunidades participantes:** conhecer as iniciativas que formam a rede.
2. **Apoio institucional:** entender a estrutura oferecida pela Associação.
3. **Títulos e reconhecimentos:** consultar registros e reconhecimentos oficiais.

Cada destino contém rótulo, descrição curta e link. A navegação usa landmark próprio, hierarquia semântica, foco visível e `aria-current="page"`; o estado atual não depende somente de cor. No mobile, os destinos permanecem legíveis e com alvos adequados, sem navegação horizontal escondida. Cores e superfícies seguem os tokens existentes nos temas claro e escuro.

O rodapé recebe o link “Títulos e reconhecimentos” em “Associação e transparência”.

## Verificação

- Testes dos três destinos, estado atual e entrada no rodapé.
- Build, `astro check`, testes do frontend e gates multi-tenant.
- Conferência visual das três páginas em desktop e mobile, nos dois temas, verificando posição, conteúdo e ausência de overflow.

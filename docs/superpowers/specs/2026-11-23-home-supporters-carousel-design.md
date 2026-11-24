<!-- AGENT-INDEX
purpose: Desenho aprovado na conversa para o carrossel de pessoas apoiadoras e patrocinadores da home.
audience: Implementadores, revisores e mantenedores do frontend.
status: Implementado e verificado em 2026-11-24; gates verdes (astro check 0 erros, 1332 testes, build ok) e verificação real em navegador com fixtures controladas.
sections:
  - Intenção
  - Escopo
  - Abordagens
  - Desenho
  - Verificação
  - Status de implementação
related-docs:
  - frontend/src/components/islands/SocialProofStrip.tsx
  - frontend/src/components/islands/SponsorsIsland.tsx
  - frontend/src/pages/empresas.astro
agent-protocol:
  - Usar somente dados públicos e benefícios já publicados; não exibir valores doados por pessoas.
-->

# Carrossel de apoiadores da home

## Intenção

Dar visibilidade alternada a pessoas apoiadoras e empresas patrocinadoras junto à faixa “N pessoas apoiam”, tornando a presença na home um benefício explícito da Empresa Amiga.

## Escopo

- Substituir o texto isolado por um carrossel que preserve a contagem pública de apoiadores.
- Alternar pessoa → patrocinador → pessoa → patrocinador usando `/members/donors` e `/companies/sponsors`.
- Mostrar avatar e nome da pessoa, sem valores ou quantidade de doações; mostrar logo/nome, tier e site da empresa quando disponível.
- Informar nos slides empresariais os benefícios já publicados: vitrine na home, selo enquanto o apoio estiver ativo e SortCoins.
- Registrar o benefício da presença no banner da home em `/empresas` e ajustar a chamada correspondente em `/patrocinadores`.
- Rotação automática com anterior/próximo e indicadores; pausa por hover/focus e comportamento estático sob `prefers-reduced-motion`.

Não criar novos níveis, benefícios, endpoints, dependências ou dados fictícios. Não alterar o hero nem as demais seções da home.

## Abordagens

1. **Carrossel automático e acessível — escolhido.** React sem nova dependência, com controles explícitos e pausa por interação. Atende à rotação pedida, mas exige cuidado com foco, anúncios e movimento.
2. Somente manual: mesma apresentação e dados, sem autoplay. Mais simples, mas não atende à rotação automática escolhida.
3. Banner estático: menor complexidade, mas não alterna pessoas e empresas e foi descartado.

## Desenho

A faixa mantém a contagem e apresenta um slide por vez. O carrossel intercala as coleções até a maior delas; se uma fonte estiver vazia, a outra continua utilizável. Falhas de carregamento preservam um fallback textual e o CTA empresarial, sem slides inventados.

Os controles têm nomes acessíveis e indicam posição. Mudanças automáticas não interrompem foco nem anunciam continuamente a leitores de tela; a região usa `aria-live="off"` durante autoplay e `polite` após ação manual. O movimento para quando o ponteiro entra, quando qualquer controle recebe foco, quando a página fica oculta e quando a pessoa prefere movimento reduzido.

O layout permanece compacto, com conteúdo centralizado no desktop e fluxo responsivo no mobile. Imagens têm dimensões reservadas e logos usam `object-fit: contain`.

## Verificação

- Testes de intercalação, estados vazios/erro, alternância automática, controles e pausa.
- Build, `astro check` e suíte completa do frontend.
- Inspeção claro/escuro em 390px e 1440px, navegação por teclado, movimento reduzido e ausência de overflow.
- Conferir os links públicos e o texto dos benefícios empresariais.

## Status de implementação

Implementado em 2026-11-24, conforme o desenho acima, em `frontend/src/components/islands/SocialProofStrip.tsx`.

- Gates (2026-11-24): `astro check` 0 erros/0 warnings; `vitest run` 166 arquivos / 1332 testes passados; `astro build` + redirects + pagefind concluídos.
- Verificação real em navegador (Chromium via Playwright) com fixtures controladas interceptando `/members/donors` e `/companies/sponsors`: intercalação pessoa → patrocinador, laço anterior/próximo, indicadores com `aria-current`, autoplay de 6s (ticks medidos entre ~5.955ms e ~6.059ms após o gatilho), ciclo rearmado a ~6s após ação manual sem avanço duplo, pausa por hover/focus com retomada a ~6s, `aria-live` `off` → `polite` após ação manual, `prefers-reduced-motion` sem avanço automático com navegação manual preservada, e ausência de overflow horizontal em 1440×900 e 390×844 (claro e escuro).
- Benefício registrado em `/empresas` e chamada ajustada em `/patrocinadores` (commit 051bfecd1924).

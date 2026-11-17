<!-- AGENT-INDEX
purpose: Design aprovado da Fase 7.1 — conter resumos dos cards de evento e exibir thumbnails nos cards do blog sem alterar o Design System.
audience: Mantenedores e AI agents implementando a fase.
status: Concluído; integrado pela PR #652 e publicado na linha 1.1.0, após 1.0.2.
sections:
  - Intenção e escopo
  - Abordagens consideradas
  - Design aprovado
  - Verificação
related-docs:
  - ../../plans/pos-1-0/README.md — Fase 7.1 (P5 e P8)
  - ../../plans/frontend-jornadas/README.md — jornadas públicas de Eventos e Blog
agent-protocol:
  - Não alterar layouts, tokens, URLs, slugs ou o conteúdo canônico dos posts.
  - Implementar com TDD e gates padrão do monorepo.
-->

# Fase 7.1 — Cards de eventos e prévia do blog

## Intenção e escopo

Evitar que resumos longos estourem os cards de eventos e tornar a listagem do blog visualmente útil para posts que já possuem imagens, sem mudar o Design System ou exigir edição retroativa dos posts.

**Inclui:** `EventCard.astro`, normalização do resumo do Discord no sync, `BlogPostCard.astro` e derivação da imagem em `postCardProps()`.

**Não inclui:** paginação de eventos, novos placeholders, mudança de slugs, edição dos Markdown canônicos, alteração de tokens/layouts ou novos campos obrigatórios no frontmatter.

## Abordagens consideradas

1. **Aprovada — melhoria progressiva derivada dos dados existentes:** CSS para conter o resumo; `image:` do frontmatter com fallback para a primeira imagem Markdown/HTML do corpo. Aproveita `BlogPostCard` e `postCardProps()` em todas as listagens.
2. **Exigir `image:` em todos os posts:** previsível, mas exigiria edição retroativa e deixaria posts antigos dependentes de manutenção manual. Descartada.
3. **Thumbnails genéricos para todos os posts:** uniformidade visual, mas adiciona ruído sem informação. Descartada; posts sem imagem mantêm o formato atual.

## Design aprovado

### Eventos

- O resumo do card usa line clamp de três linhas, `overflow-wrap: anywhere` e `overflow: clip`, incluindo o shorthand `line-clamp` como progressive enhancement.
- O Discord passa por `stripMarkdown()` e `truncateText()` como as demais fontes; o limite contratual existente é 220 caracteres. O fallback textual permanece quando a descrição está vazia.

### Blog

- `postCardProps()` produz `image: { src, alt } | null`.
- Prioridade da fonte: `data.image`; depois, a primeira imagem Markdown `![alt](url)` ou HTML `<img src="...">` do corpo, incluindo formas com aspas simples e atributos em ordem variável quando couber ao parser defensivo escolhido.
- Caminhos locais são normalizados por `contentAssetUrl()`; URLs HTTP(S) remotas permanecem inalteradas.
- O thumbnail é decorativo porque o título já identifica o post: `alt=""` e `aria-hidden="true"`. Não se reutiliza texto alternativo do corpo para evitar anúncio redundante.
- `BlogPostCard.astro` renderiza a imagem apenas quando presente, em área 16:9 com `object-fit: cover`, dimensões reservadas (640×360) e `loading="lazy"`. Sem imagem, o card atual permanece inalterado.
- Não há alteração em excerpts, tempo de leitura, URLs, feeds, páginas de post ou schema.

## Verificação

- Testes Vitest para prioridade frontmatter/corpo, Markdown/HTML, assets locais/remotos, ausência de imagem e props decorativas.
- Teste do sync para o resumo do Discord com Markdown, descrição longa e fallback vazio.
- `npm run test:scripts`, testes/check/build do frontend, `make astro-verify` e `make astro-verify-tenants`.
- Inspeção do HTML gerado para confirmar thumbnail, atributos decorativos e resumo contido.

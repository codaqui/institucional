# Development

## Setup

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm start
```

O servidor de desenvolvimento estará disponível em `http://localhost:3000`.

## Build

```bash
# Gerar build de produção
npm run build

# Servir build localmente
npm run serve
```

## Estrutura do Projeto

O site é construído com [Docusaurus 3.9](https://docusaurus.io/).

- `blog/` - Posts do blog com frontmatter YAML
- `trilhas/` - Trilhas de aprendizado (plugin docs do Docusaurus)
- `src/pages/` - Páginas estáticas do site
- `src/css/` - Estilos customizados
- `static/` - Arquivos estáticos (imagens, fontes, etc.)
- `docusaurus.config.ts` - Configuração principal do site
- `sidebars.ts` - Configuração das barras laterais das trilhas

## Development Environment

A branch `develop` é a branch de desenvolvimento, onde todas as features são testadas e desenvolvidas. O preview dela é publicado em [https://codaqui.dev/previews/develop/](https://codaqui.dev/previews/develop/).

Os previews usam uma estratégia unificada em subpaths do `gh-pages`:

- `develop` → `https://codaqui.dev/previews/develop/`
- PRs → `https://codaqui.dev/previews/pr-<numero>/`

Esses builds usam `SITE_URL=https://codaqui.dev` com `BASE_URL` específico do subpath para que os assets sejam resolvidos corretamente no preview.

Quando o PR é `develop -> main`, o workflow reutiliza o preview contínuo de `develop` em vez de publicar um preview dedicado do PR.

SEO/robots:

- Produção publica `robots.txt` com sitemap em `https://codaqui.dev/sitemap.xml`
- Previews usam `noIndex: true`
- Os workflows de preview sobrescrevem `build/robots.txt` com `Disallow: /`

## Deploy

O deploy é feito automaticamente via GitHub Actions quando há push nas branches `main` ou `develop`:

- `main` → deploys to `gh-pages` (produção)
- `develop` → atualiza o preview em `gh-pages/previews/develop/`

Se necessário, o workflow de deploy também pode ser executado manualmente pelo GitHub Actions com `workflow_dispatch`.

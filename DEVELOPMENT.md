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

A Branch `develop` é a branch de desenvolvimento, onde todas as features são testadas e desenvolvidas. O workflow dela cria a branch `gh-pages-develop` e você é capaz de visualizar o status dela [clicando aqui](https://raw.githack.com/codaqui/institucional/gh-pages-develop/index.html).

Esse build usa `SITE_URL=https://raw.githack.com` e `BASE_URL=/codaqui/institucional/gh-pages-develop/` para que os assets sejam resolvidos corretamente no preview.

## Deploy

O deploy é feito automaticamente via GitHub Actions quando há push nas branches `main` ou `develop`:

- `main` → deploys to `gh-pages` (produção)
- `develop` → deploys to `gh-pages-develop` (desenvolvimento)

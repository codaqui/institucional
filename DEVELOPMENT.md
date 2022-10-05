# Development

## Setup

```bash
## Export GH_TOKEN
export GH_TOKEN=<INSERT_YOUR_TOKEN_HERE>

## Basic Requirements
pip install -r requirements.txt

# Insider from Mkdocs (Private)
pip install git+ssh://git@github.com/squidfunk/mkdocs-material-insiders.git

# Social Cards Dependency
## Ubuntu
apt-get install libcairo2-dev libfreetype6-dev libffi-dev libjpeg-dev libpng-dev libz-dev

## Fedora
yum install cairo-devel freetype-devel libffi-devel libjpeg-devel libpng-devel zlib-devel

## Windows
## See: https://www.cairographics.org/download/

## MacOS
brew install cairo freetype libffi libjpeg libpng zlib

# Server Online
mkdocs serve
```

## Deploy Locale

Você pode usar o seguinte comando abaixo para enviar localmente sua versão de emergência, porém recomendamos utilizar o fluxo de git-flow.

```
mkdocs gh-deploy
```

## Development Environment

A Branch `develop` é a branch de desenvolvimento, onde todas as features são testadas e desenvolvidas. O Workflow dela cria a branch `gh-pages-develop` e você é capaz de visualizar o status dela [clicando aqui](https://raw.githack.com/codaqui/institucional/gh-pages-develop/index.html).

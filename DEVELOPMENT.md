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

## Eventos e snapshots de API

A página `/eventos` não deve manter listas de eventos em código. O padrão é publicar snapshots estáticos consumidos pelo frontend:

```bash
/events/index.json
/events/<source>/<source_id>/index.json
/events/<source>/<source_id>/<event_id>.json
```

Exemplos:

- `/events/discord/codaqui.json`
- `/events/meetup/python-maringa.json`

Responsabilidades:

- workflow/integrador: consulta a API externa, normaliza o payload e grava o snapshot
- frontend: lê o índice agregado e renderiza a agenda

Modelo híbrido adotado:

- `events/index.json`: índice resumido para a página pública
- `events/<source>/<source_id>/index.json`: shard por fonte
- `events/<source>/<source_id>/<event_id>.json`: detalhe individual

Para Discord, o repositório já possui:

- `events.config.json` com o cadastro das fontes
- `scripts/sync-events.mjs` para gerar snapshots
- `.github/workflows/sync-event-snapshots.yml` para sincronização periódica

Sem `DISCORD_BOT_TOKEN`, o script preserva os eventos existentes ou usa fallback configurado, evitando apagar a agenda publicada.

## Sync Scripts

Scripts de sincronização que buscam dados de APIs externas e geram snapshots estáticos consumidos pelo site.

| Script | Comando | Descrição |
|--------|---------|-----------|
| `sync:analytics` | `npm run sync:analytics` | Busca dados de analytics mensais do `codaqui/dados` (incremental) |
| `sync:analytics:full` | `npm run sync:analytics:full` | Re-busca todos os meses desde 2024-01 |
| `sync:social` | `npm run sync:social` | Busca contagens de seguidores/membros das redes sociais |
| `sync:events` | `npm run sync:events` | Sincroniza snapshots de eventos (incremental — 30 dias passados + futuros) |
| `sync:events:full` | `npm run sync:events:full` | Re-paginação completa de todos os eventos passados |
| `sync` | `npm run sync` | Executa `sync:events` + `sync:social` + `sync:analytics` em sequência |
| `sync:full` | `npm run sync:full` | Executa `sync:events:full` + `sync:social` + `sync:analytics:full` em sequência |

### Variáveis de ambiente necessárias

| Variável | Usada por | Descrição |
|----------|-----------|-----------|
| `DISCORD_BOT_TOKEN` | `sync:events`, `sync:social` | Token de bot Discord para buscar eventos e contagem de membros |
| `META_ACCESS_TOKEN` | `sync:social` | Token de usuário Meta (Instagram follower counts, WhatsApp groups) |
| `META_BUSINESS_APP_ID` | `sync:social` | App ID do Meta Business (usado para trocar token de longa duração) |
| `META_BUSINESS_APP_SECRET` | `sync:social` | App Secret do Meta Business |
| `DADOS_DISPATCH_TOKEN` | `sync:analytics` | GitHub PAT com `actions:write` no repo `codaqui/dados` para disparar `report.yaml` |

Todos os secrets são opcionais — scripts fazem fallback ou pulam plataformas indisponíveis.

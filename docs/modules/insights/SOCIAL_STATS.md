<!-- AGENT-INDEX
purpose: Documentação viva do módulo de estatísticas e presença digital (Insights / Social Stats).
audience: AI agents, mantenedores, contribuidores
sections:
  - Visão geral
  - Fontes de dados
  - Schema do snapshot
  - Atualização manual de baseline
  - Workflow de sync
  - Adicionar novo perfil social
related-docs:
  - AGENTS.md — guia geral do monorepo
  - ../../../src/data/social.ts — perfis sociais da Codaqui
  - ../../../src/data/communities.ts — comunidades parceiras e seus perfis
  - ../../../scripts/sync-social-stats.mjs — script de sincronização
-->

# Insights & Social Stats

A página `/sobre/insights` agrega quatro módulos: **live stats bar**, **presença digital**, **comunidades parceiras** e a **linha do tempo** (timeline). Ela substitui a antiga URL `/sobre/timeline` (agora um redirect).

## Fontes de dados

| What | Source | Auto-fetched? |
|------|--------|---------------|
| Discord member count (Codaqui) | Discord Bot API (`/guilds/{id}?with_counts=true`) | ✅ daily |
| Meetup member count (DevParaná) | Meetup gql2 GraphQL | ✅ daily |
| GitHub followers (Codaqui org) | GitHub public REST API | ✅ daily |
| YouTube subscribers | — (no public API) | ❌ manual `baselineCount` |
| Instagram followers | — (blocked) | ❌ manual `baselineCount` |
| Total events | Reads `static/events/index.json` | ✅ (from events sync) |

## Schema do snapshot (`static/social-stats/index.json`)

```json
{
  "generatedAt": "ISO 8601",
  "totalEvents": 373,
  "profiles": [
    {
      "entityId": "codaqui",
      "platform": "discord",
      "handle": "@codaqui",
      "url": "https://discord.com/invite/...",
      "countLabel": "membros",
      "baselineCount": 692,
      "count": 722,
      "fetchedAt": "ISO 8601",
      "isFallback": false
    }
  ]
}
```

## Atualização manual de baseline

Para atualizar uma contagem manual (YouTube, Instagram):

1. Edite `baselineCount` em `src/data/social.ts` (para perfis da Codaqui) ou em `src/data/communities.ts` (para comunidades parceiras).
2. Execute `node scripts/sync-social-stats.mjs` localmente para regenerar `static/social-stats/index.json`.
3. Commit ambos os arquivos (data file + snapshot).

## Workflow de sync

- **File:** `.github/workflows/sync-social-stats.yml`
- **Schedule:** daily at 06:00 UTC + manual dispatch
- **Secret required:** `DISCORD_BOT_TOKEN`

Para rodar localmente:

```bash
DISCORD_BOT_TOKEN=<token> node scripts/sync-social-stats.mjs
```

## Adicionar um novo perfil social

1. Adicione uma entrada `SocialProfile` em `codaquiSocialProfiles` em `src/data/social.ts` (para Codaqui) ou em `socialProfiles[]` na entrada da comunidade em `src/data/communities.ts`.
2. Se a plataforma tiver API pública, adicione uma função de fetch em `scripts/sync-social-stats.mjs` e chame-a em `main()`.
3. Regenere o snapshot localmente e commit.

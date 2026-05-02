<!-- AGENT-INDEX
purpose: Plan for storing event override metadata in this repo as the source of truth (GitHub-as-Database pattern).
audience: Devs extending the events sync pipeline, AI agents adding new sources/overrides.
status: planning + partial implementation — actual sync lives in scripts/sync-events.mjs and static/events/.
sections:
  - Visão Geral
  - Fontes de Eventos Atuais e Futuras
  - Schema do Override
  - GitHub-as-Database: Fluxo do Commit
  - GitHub Action: Validação de Overrides
  - Backend: Variáveis de Ambiente
  - Padrão Reutilizável: GitHub-as-Database
  - UI da Página de Evento: Dados Máximos
  - Testes Necessários
  - Checklist de Implementação
related-docs:
  - AGENTS.md §7 Events System — actual implemented events flow (snapshot pipeline)
agent-protocol: This is the EXTENDED plan. For the currently implemented snapshot pipeline, see AGENTS.md §7 first.
-->

# Event Organizer — Metadados via GitHub como Banco de Dados

Plano técnico para o sistema de correção de metadados de eventos externos por organizadores confiáveis,
usando o próprio repositório GitHub como fonte de verdade (GitHub-as-Database pattern).

---

## Visão Geral

Os eventos da Codaqui vêm de fontes externas (Discord, Meetup, Bevy/CNCF) via snapshots JSON gerados automaticamente.
O **Event Organizer** é um membro confiável com permissão de sobrescrever campos desses eventos
(título, imagem, descrição, localização, tags) sem depender de banco de dados externo.

A correção é persistida como um arquivo `.override.json` commitado no repositório, versionado pelo Git,
e aprovado automaticamente por um bot. O frontend lê e mescla os dois arquivos na página do evento.

---

## Fontes de Eventos Atuais e Futuras

| sourceKey | Plataforma | URL | Status |
|---|---|---|---|
| `discord:codaqui` | Discord | [Server Codaqui](https://discord.com/invite/xuTtxqCPpz) | ✅ Ativo |
| `meetup:devparana` | Meetup | [DevParaná](https://www.meetup.com/pt-BR/developerparana/) | ✅ Ativo |
| `bevy:cloud-native-maringa` | CNCF Community (Bevy) | [community.cncf.io/cloud-native-maringa](https://community.cncf.io/cloud-native-maringa/) | ✅ Ativo |
| `ocgroups:cloud-native-maringa` | OCGroups (futuro CNCF) | [ocgroups.dev](https://ocgroups.dev/) | 🔜 Planejado |

### Migração Bevy → OCGroups

A CNCF está migrando a plataforma de comunidades do **Bevy** para o **[OCGroups](https://ocgroups.dev/)**.
Quando a migração ocorrer:

1. Adicionar nova fonte `ocgroups:cloud-native-maringa` no `events.config.json`
2. Implementar `resolveOCGroupsEvents()` em `scripts/sync-events.mjs` (nova API a documentar)
3. Manter `bevy:cloud-native-maringa` temporariamente para histórico de eventos passados
4. Os overrides existentes em `static/events/bevy/cloud-native-maringa/` continuam válidos (dados históricos)
5. Após migração completa, deprecar a fonte Bevy (manter arquivos, parar sync)

> ⚠️ Monitorar [ocgroups.dev](https://ocgroups.dev/) — a API pública ainda não está documentada.
> Quando disponível, seguir o padrão dos adaptadores existentes em `scripts/sync-events.mjs`.



### Nova role: `event_organizer`

> ⚠️ **`MemberRole` é single-value no schema atual.** Adicionar `event_organizer` diretamente
> pode sobrescrever `admin` ou `finance-analyzer` na mesma coluna.
> Antes de implementar, migrar para multi-role com array `text[]`:

```typescript
// backend/src/members/entities/member.entity.ts
// Novo enum:
export enum MemberRole {
  MEMBRO           = 'membro',
  EVENT_ORGANIZER  = 'event_organizer',  // ← novo
  FINANCE_ANALYZER = 'finance-analyzer',
  ADMIN            = 'admin',
}

// Coluna migrada de enum para array nativo do Postgres:
// Antes:   @Column({ type: 'enum', ... }) role: MemberRole;
// Depois (recomendado — array PG nativo, suporta GIN index e queries com ANY/&&):
@Column({ type: 'text', array: true, default: () => "ARRAY['membro']::text[]" })
roles: MemberRole[];   // ex: ['membro'], ['admin'], ['membro','event_organizer']

// ⚠️ Não use `simple-array` aqui: ele serializa em string CSV e perde
// as garantias de array nativo (queries seguras, indexação, constraints).
```

> Atualizar `RolesGuard` para usar `user.roles.includes(requiredRole)` em vez de igualdade.
> Atribuição: somente um `admin` pode adicionar/remover roles.

### Ownership de evento

Um `event_organizer` é "dono" de um conjunto de eventos externos. O mapeamento de ownership
é armazenado em `static/events/organizers.json` (também no repositório — sem banco):

```json
{
  "version": 1,
  "ownerships": [
    {
      "memberId": "uuid-do-membro",
      "githubHandle": "sehandle",
      "scope": ["meetup:devparana:*"]
    },
    {
      "memberId": "outro-uuid",
      "githubHandle": "outro",
      "scope": ["discord:codaqui:1234567890", "discord:codaqui:9876543210"]
    }
  ]
}
```

Escopo (`scope`) suporta:
- `source:sourceId:eventId` — evento específico
- `source:sourceId:*` — todos os eventos de uma fonte

O backend lê `organizers.json` em memória (cache de 5 min) para verificar permissão.

---

## Schema do Override

Arquivo: `static/events/<source>/<sourceId>/<eventId>.override.json`

Exemplo: `static/events/meetup/devparana/226163759.override.json`

```json
{
  "eventId": "226163759",
  "sourceKey": "meetup:devparana",
  "extendData": {
    "imageUrl": "https://res.cloudinary.com/...",
    "summary": "Resumo corrigido pelo organizador.",
    "location": "Nome correto do local",
    "tags": ["meetup", "devparana", "presencial", "mobile"],
    "featured": true
  },
  "ownerId": "uuid-do-membro",
  "ownerHandle": "githubHandle",
  "updatedAt": "2026-04-29T23:00:00-03:00",
  "reason": "Corrigindo título e adicionando banner do evento"
}
```

**Campos sobrescrevíveis** (`extendData`):

| Campo | Tipo | Notas |
|---|---|---|
| `imageUrl` | `string` | Banner/capa do evento |
| `summary` | `string` | Descrição override (max 500 chars) |
| `location` | `string` | Nome/endereço corrigido |
| `tags` | `string[]` | Lista completa (substitui, não adiciona) |
| `featured` | `boolean` | Destaque na página de eventos |
| `title` | `string` | Override de título (use com cautela) |

**Campos que nunca são sobrescrevíveis**: `id`, `startAt`, `endAt`, `href`, `source`, `sourceId`, `status`

---

## GitHub-as-Database: Fluxo do Commit

O override usa um **GitHub App** (token de instalação) para commitar, não o token pessoal do organizador.
O token pessoal com `public_repo` **não garante acesso write** a repositórios que o usuário
não tem como colaborador — a scope limita mas não concede. Usar GitHub App evita esse problema
e mantém o repo com controle centralizado de acesso.

A **autoria do organizador** é preservada no commit message e no arquivo override (campo `ownerHandle`).

### Pré-requisito: GitHub App

Criar GitHub App `codaqui-bot` com permissão `Contents: write` no repositório `codaqui/institucional`.
O backend usa `APP_ID` + `PRIVATE_KEY` para gerar tokens de instalação via
`POST /app/installations/:id/access_tokens`.

### Validação obrigatória no backend antes do commit

```typescript
// Antes de chamar GitHub API, o backend valida o conteúdo:
function validateOverride(data: unknown): asserts data is EventOverride {
  // 1. Verificar campos proibidos (startAt, endAt, id, source, status, href)
  // 2. Verificar tipos de cada campo de extendData
  // 3. Limitar summary a 500 chars
  // 4. Limitar tags a 10 itens
  // 5. Limitar speakers a 10 itens
  if (!isValid) throw new BadRequestException('Override inválido: ' + reason);
}
```

> Nunca commitar dados não validados — o arquivo vai direto para `main` (ou para um PR).

### Fluxo do commit (todos os modos)

```
[Organizer] → PUT /events/override/:sourceKey/:eventId
    │
    ├── Backend: JWT válido + roles.includes('event_organizer') + scope cobre o evento
    ├── Backend: valida campos de extendData (ANTES de qualquer commit)
    │
    ├── GitHubDBService (GitHub App token):
    │   ├── GET /repos/codaqui/institucional/contents/...override.json  (sha atual)
    │   └── PUT /repos/.../contents/...
    │         commit message = "event: override <eventId> by @handle — <reason>"
    │         committer = GitHub App (bot)
    │         author name/email preservado nos metadados do override JSON
    │
    │   Se GITHUB_CREATE_PR=true:
    │   ├── Cria branch: event-override/<eventId>-<timestamp>
    │   └── Cria PR draft, label "event-override"
    │
    └── Retorna: { sha, htmlUrl/prUrl, status: 'committed' | 'pr_open' }
```

### Modo de dev (PR visível, sem auto-merge)

```bash
# .env (dev)
GITHUB_CREATE_PR=true        # true = cria PR aberto (dev); false = commit direto main (prod)
GITHUB_COMMIT_DISABLED=true  # true = 100% local, sem chamar GitHub API (offline)
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY_BASE64=
GITHUB_INSTALLATION_ID=
GITHUB_REPO_OWNER=codaqui
GITHUB_REPO_NAME=institucional
```

O PR de dev fica aberto no GitHub — inspecionar o diff do JSON, fechar se inválido,
mesclar manualmente após validação. Em produção (`GITHUB_CREATE_PR=false`), commit direto.

> Pasta `.gitignore`d `static/events/_dev-overrides/` só é usada quando
> `GITHUB_COMMIT_DISABLED=true` (modo completamente offline).



A página `/eventos/[sourceKey]/[id]` (ou `/eventos?source=X&id=Y`) precisa mesclar:

1. Dados do snapshot: `static/events/<source>/<sourceId>/<id>.json`
2. Override (se existir): `static/events/<source>/<sourceId>/<id>.override.json`

```typescript
// src/utils/event-override.ts

export interface EventOverride {
  eventId: string;
  sourceKey: string;
  extendData: Partial<EventItem>;
  ownerHandle: string;
  updatedAt: string;
  reason?: string;
}

export async function loadEventWithOverride(
  source: string,
  sourceId: string,
  eventId: string
): Promise<{ event: EventItem; override: EventOverride | null }> {
  const basePath = `/events/${source}/${sourceId}/${eventId}.json`;
  const overridePath = `/events/${source}/${sourceId}/${eventId}.override.json`;

  const [baseRes, overrideRes] = await Promise.allSettled([
    fetch(basePath).then(r => r.json()),
    fetch(overridePath).then(r => r.json()),
  ]);

  const base: EventDetailFile = baseRes.status === 'fulfilled' ? baseRes.value : null;
  const override: EventOverride | null =
    overrideRes.status === 'fulfilled' ? overrideRes.value : null;

  if (!base) throw new Error(`Evento não encontrado: ${eventId}`);

  const event: EventItem = override
    ? { ...base.event, ...override.extendData }
    : base.event;

  return { event, override };
}
```

A página exibe um badge **"Metadados verificados por @handle"** quando override existe.

---

## GitHub Action: Validação de Overrides

O commit é feito pelo backend usando o token do **GitHub App `codaqui-bot`** (committer
preservado nos metadados do JSON, autor lógico no `ownerHandle`). Como o backend valida o
schema antes de commitar e o GitHub App tem permissão `Contents: write`, o arquivo vai
direto para `main` sem necessidade de auto-merge.

A GitHub Action abaixo é uma **defesa em profundidade**: revalida o schema em cada push,
caso alguém edite os arquivos override fora do fluxo do backend (ex.: PR manual):

```yaml
# .github/workflows/validate-overrides.yml
name: Validate event overrides

on:
  push:
    branches: [main]
    paths:
      - 'static/events/**/*.override.json'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with: { node-version: '24' }
      - name: Validate override schema
        run: node scripts/validate-overrides.mjs
```

```javascript
// scripts/validate-overrides.mjs — valida todos os *.override.json
// Verifica: campos obrigatórios, tipos, campos proibidos (startAt, status, etc.)
```

---

## Backend: Variáveis de Ambiente

```
# .env.example — adicionar:
GITHUB_COMMIT_DISABLED=false    # true = modo 100% local, grava em _dev-overrides/
GITHUB_CREATE_PR=false          # true = cria PR aberto (dev); false = commit direto (prod)
GITHUB_REPO_OWNER=codaqui
GITHUB_REPO_NAME=institucional

# GitHub App — usado para commits no repositório (NUNCA token pessoal de membro):
GITHUB_APP_ID=                  # ID numérico do GitHub App `codaqui-bot`
GITHUB_APP_INSTALLATION_ID=     # ID da instalação no org `codaqui`
GITHUB_APP_PRIVATE_KEY=         # Chave privada PEM do GitHub App (multiline; usar base64 se necessário)
```

> **Combinações práticas:**
> - Dev inspeção: `GITHUB_CREATE_PR=true` → cria PR real, visível no GitHub, não auto-merge
> - Dev offline: `GITHUB_COMMIT_DISABLED=true` → grava localmente em `_dev-overrides/`
> - Produção: ambos `false` (padrão) → commit direto em `main`

> ⚠️ **Não há `MEMBER_TOKEN_ENCRYPTION_KEY`**: o backend não armazena tokens pessoais do
> GitHub. A autoria do organizador é registrada no campo `ownerHandle` do JSON override e
> repetida na commit message — o committer real é sempre o GitHub App.



| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/events/organizers` | Admin | Lista mapeamento de ownership |
| `POST` | `/events/organizers` | Admin | Atribui eventos a um organizer |
| `DELETE` | `/events/organizers/:memberId` | Admin | Remove ownership |
| `PUT` | `/events/override/:sourceKey/:eventId` | event_organizer | Cria/atualiza override via GitHub |
| `DELETE` | `/events/override/:sourceKey/:eventId` | event_organizer | Remove override via GitHub delete file API |
| `GET` | `/events/override/:sourceKey/:eventId` | Público | Retorna override atual (cache 5min) |

---

---

## Padrão Reutilizável: GitHub-as-Database

Este fluxo (backend valida → **GitHub App** commita em `main` → autoria do membro preservada nos metadados/commit message) é reutilizável para:

| Caso de uso | Arquivo alvo | Quem dispara (role) |
|---|---|---|
| Override de metadados de evento | `static/events/**/*.override.json` | event_organizer |
| Atualização de dados da equipe | `src/data/team.ts` | admin |
| Atualização de stats manuais (YouTube, Instagram) | `src/data/social.ts` | admin |
| Upload de fallback de eventos | `events.config.json` | admin |

> Em todos os casos o **committer é o GitHub App `codaqui-bot`**. O backend nunca usa
> tokens pessoais do membro para escrita — isso garante que:
> 1. Não dependemos do membro ser colaborador write do repo (`public_repo` scope OAuth não cobre);
> 2. Todos os tokens sensíveis ficam no servidor (não trafegam para o browser);
> 3. A auditoria fica centralizada (commits do bot, autoria lógica em `ownerHandle`).

### Biblioteca interna: `GitHubDBService`

```typescript
// backend/src/github-db/github-db.service.ts
@Injectable()
export class GitHubDBService {
  /**
   * Commita um arquivo no repositório usando o token de instalação do GitHub App.
   * O `actorHandle` é apenas para a commit message — não é usado como autenticação.
   * Em modo dev (GITHUB_COMMIT_DISABLED=true), grava localmente em static/events/_dev-overrides/.
   */
  async commitFile(opts: {
    path: string;           // caminho no repositório
    content: string;        // conteúdo em UTF-8
    message: string;        // commit message (inclui "by @<actorHandle>")
    actorHandle: string;    // handle GitHub do membro que disparou a ação (auditoria)
  }): Promise<{ sha: string; htmlUrl: string }>;

  async readFile(path: string): Promise<string | null>;

  async deleteFile(opts: {
    path: string;
    message: string;
    actorHandle: string;
  }): Promise<void>;
}
```

> Internamente o service usa `GITHUB_APP_ID` + `GITHUB_APP_INSTALLATION_ID` + `GITHUB_APP_PRIVATE_KEY`
> para gerar tokens de instalação de curta duração via `POST /app/installations/:id/access_tokens`.

---

## UI da Página de Evento: Dados Máximos

O objetivo da UI é mostrar **o potencial máximo de um evento bem preenchido**,
inspirando organizadores a completar todos os campos. Quanto mais dados, mais rico o cartão.

### Campos disponíveis (base + override)

| Campo | Fonte | Preenchimento |
|---|---|---|
| `title` | sync / override | Automático |
| `summary` | sync / override | Automático + override recomendado |
| `imageUrl` | sync / **override** | **Organizer deve preencher** |
| `startAt` + `endAt` | sync | Automático |
| `timezone` | sync | Automático |
| `location` | sync / override | Automático + override para nome correto |
| `platform` | sync | Automático |
| `host` | sync | Automático |
| `tags` | sync / **override** | **Organizer deve adicionar** |
| `userCount` | sync | Automático (updated on sync) |
| `featured` | sync / **override** | **Organizer decide destacar** |
| `speakers[]` | **override only** | **Organizer preenche** |
| `slidesUrl` | **override only** | **Organizer preenche (pós-evento)** |
| `videoUrl` | **override only** | **Organizer preenche (pós-evento)** |
| `registrationUrl` | **override only** | **Organizer preenche** |

> Adicionar `speakers[]`, `slidesUrl`, `videoUrl`, `registrationUrl` ao schema de `extendData`.

### Wireframe: Evento com dados completos

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         [Banner 16:9 — imageUrl]                                 │
│              Fotografia ou arte do evento, fornecida pelo organizer              │
│                                                  ✅ Verificado por @handle       │
└──────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│  [Chip: AGENDADO ●]  [Chip: ☁️ Meetup]  [Chip: 📍 Maringá, PR]                  │
│                                                                                   │
│  DevParaná MeetUP #42                                                             │
│  ─────────────────────────────────────────────────────                           │
│  📅 Sáb, 10 Mai 2026 • 14h00 – 18h00 (America/Sao_Paulo)                       │
│  📍 FCV – Faculdade Cidade Verde · Av. Horácio Raccanello, 5950 – Novo Centro  │
│  👥 142 confirmados   🔁 Evento mensal                                           │
│                                                                                   │
│  [Inscrever-se]  [Compartilhar]  [Adicionar ao calendário]                       │
└──────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│  SOBRE O EVENTO                                                                   │
│  ────────────────────────────────────────────────────────────────────────────── │
│  Teremos 4 palestras sobre Docker, Angular, Ionic e mais. Um encontro incrível  │
│  para quem trabalha ou quer entrar no mundo do desenvolvimento de software.     │
│                                                                                   │
│  🏷 kubernetes  cloud-native  devops  presencial  maringa  meetup                │
└──────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│  PALESTRANTES                                                                     │
│  ──────────────────────────────────────────────────────────────────────────────  │
│  [Avatar] @fulano     [Avatar] @ciclano    [Avatar] @beltrano                   │
│   Título da palestra   Título da palestra   Título da palestra                  │
│   github.com/fulano    linkedin.com/...     github.com/...                       │
└──────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│  MATERIAIS  (visível pós-evento)                                                  │
│  ──────────────────────────────────────────────────────────────────────────────  │
│  [▶️ Ver gravação]   [📑 Ver slides]   [💬 Discussão no GitHub]                  │
└──────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│  ORGANIZADO POR                                                                   │
│  ──────────────────────────────────────────────────────────────────────────────  │
│  [Logo DevParaná]  DevParaná  ·  Meetup  ·  Ver todos os eventos                │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Campos expandidos em `extendData`

```typescript
// Adicionar ao schema EventOverride.extendData:
interface ExtendData {
  // Campos existentes:
  imageUrl?: string;
  summary?: string;
  location?: string;
  tags?: string[];
  featured?: boolean;
  title?: string;

  // Campos novos para UI rica:
  speakers?: Array<{
    name: string;
    handle?: string;         // GitHub handle
    avatarUrl?: string;
    talkTitle?: string;
    profileUrl?: string;     // GitHub, LinkedIn, site
  }>;
  registrationUrl?: string;  // link de inscrição (se diferente de href)
  slidesUrl?: string;        // pós-evento: link para slides
  videoUrl?: string;         // pós-evento: YouTube, etc.
  discussionUrl?: string;    // GitHub Discussion, fórum, etc.
}
```

### Gamificação visual: Completude do Evento

Para motivar organizadores, exibir um **indicador de completude** no painel do organizer:

```
┌──────────────────────────────────────────────────────┐
│  Completude do evento: ████████░░ 80%                │
│  ✅ Imagem do evento                                  │
│  ✅ Descrição corrigida                               │
│  ✅ Tags adicionadas                                  │
│  ✅ Palestrantes (2 de 3)                             │
│  ⬜ Slides (disponível após o evento)                 │
│  ⬜ Gravação (disponível após o evento)               │
└──────────────────────────────────────────────────────┘
```

Quanto mais completo o evento, melhor o SEO e mais engajamento na página.

### Progressão do card na listagem

O card de evento na página `/eventos` também cresce conforme os dados:

| Nível | Campos preenchidos | Visual |
|---|---|---|
| Mínimo | título + data + plataforma | Chip + título + data |
| Básico | + summary + location | + resumo 2 linhas |
| Bom | + imageUrl + tags | + banner pequeno + chips de tags |
| Completo | + palestrantes + userCount + featured | + avatares + "142 confirmados" + destaque hero |

### Mudanças em `src/pages/eventos.tsx`

- Continua lendo `static/events/index.json` para a listagem
- `index.json` inclui campo `hasOverride: boolean` (adicionado pelo script de sync quando `.override.json` existe)
- Cards mostram `userCount` e primeiro palestrante se disponível
- Eventos `featured: true` aparecem em seção "Em destaque" no topo

### Nova página: `src/pages/eventos/[...slug].tsx` ou query params

- Lê o evento base + override (via `loadEventWithOverride()`)
- Banner hero com `imageUrl` (fallback: gradiente com emoji da fonte)
- Badge "Verificado por @handle" quando override existe
- Para `event_organizer` autenticado e dono do evento: botão "Editar metadados"
- Formulário de edição: todos os campos de `extendData` + campo "Motivo da alteração"
- Indicador de completude no formulário

### Componente: `EventOverrideBadge`

```tsx
// src/components/EventOverrideBadge/index.tsx
interface Props {
  override: EventOverride;
}
export default function EventOverrideBadge({ override }: Props) {
  return (
    <Chip
      size="small"
      color="success"
      icon={<VerifiedIcon />}
      label={`Verificado por @${override.ownerHandle}`}
      title={override.reason ?? 'Metadados corrigidos pelo organizador'}
    />
  );
}
```

---

## Testes Necessários

### Backend
- `github-db.service.spec.ts` — mock GitHub API, testa create/update/delete
- `events-override.controller.spec.ts` — permissões por role, validação de scope
- `organizers.service.spec.ts` — parse de scope glob (`meetup:devparana:*` vs específico)

### Frontend
- `event-override.test.ts` — merge de dados (extendData sobrescreve, campos ausentes preservados)
- `EventOverrideBadge.test.tsx` — render condicional
- Mock de `fetch` para `.override.json` retornando 404 (sem override) e 200 (com override)

### GitHub Action
- `validate-override-signature.mjs` — testes com HMAC válido/inválido

---

## Checklist de Implementação

- [ ] Criar GitHub App `codaqui-bot` com permissão `Contents: write` em `codaqui/institucional`
- [ ] Migrar `MemberRole` de enum single-value para `text[]` + `RolesGuard` update
- [ ] Adicionar `EVENT_ORGANIZER` em `MemberRole` + migration Postgres
- [ ] Criar `static/events/organizers.json` com estrutura inicial vazia
- [ ] Criar módulo `backend/src/github-db/` com `GitHubDBService` (GitHub App token + PR mode + local mode)
- [ ] Criar módulo `backend/src/event-organizer/` com endpoints de ownership e override
- [ ] Adicionar validação de override no backend (campos proibidos, tipos, limites) antes do commit
- [ ] Adicionar `GITHUB_COMMIT_DISABLED`, `GITHUB_CREATE_PR`, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY_BASE64`, `GITHUB_INSTALLATION_ID`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME` em `.env.example`
- [ ] Adicionar `static/events/_dev-overrides/` ao `.gitignore`
- [ ] Criar workflow `.github/workflows/validate-overrides.yml`
- [ ] Criar script `scripts/validate-overrides.mjs`
- [ ] Atualizar script `scripts/sync-events.mjs` para incluir `hasOverride` no `index.json`
- [ ] Criar `src/utils/event-override.ts` com `loadEventWithOverride()`
- [ ] Criar `src/components/EventOverrideBadge/`
- [ ] Atualizar página de eventos para usar merge e badge
- [ ] Testes unitários (backend + frontend)
- [ ] Atualizar `AGENTS.md` com novo role e padrão GitHub-as-DB

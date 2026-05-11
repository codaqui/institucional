<!-- AGENT-INDEX
purpose: Plan for storing event override metadata in this repo as the source of truth (GitHub-as-Database pattern).
audience: Devs extending the events sync pipeline, AI agents adding new sources/overrides.
status: design confirmed — always-PR model with codaqui-bot auto-merge. Implementation pending.
sections:
  - Visão Geral
  - Fontes de Eventos Atuais e Futuras
  - Schema do Override
  - CRUD de Overrides (GitHub-as-Database)
  - Dois Caminhos para Editar
  - GitHub App: codaqui-bot (validação + auto-merge)
  - GitHub Action: Validação e Auto-Merge de Overrides
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

## CRUD de Overrides (GitHub-as-Database)

Toda operação de override — criar, atualizar ou deletar — é tratada como uma
**operação de banco de dados via Git**: cada operação gera uma branch + PR,
que é validado e auto-mergeado pelo `codaqui-bot`. Nunca há commit direto em `main`.

| Operação | O que acontece no arquivo | Branch criada? | PR criado? |
|---|---|---|---|
| **Create** | Novo arquivo `.override.json` | ✅ | ✅ |
| **Read** | Leitura direta do arquivo em `main` | ❌ | ❌ |
| **Update** | Atualiza conteúdo do `.override.json` | ✅ | ✅ |
| **Delete** | Remove o arquivo `.override.json` | ✅ | ✅ |

### Convenção de branch

```
event-override/<sourceKey>-<eventId>-<timestamp>
Exemplo: event-override/meetup-devparana-226163759-1746823200000
```

### Ciclo de vida do PR

```
[Operação disparada]
        │
        ├── Backend cria branch → commita mudança no arquivo → abre PR
        │   ou owner cria branch diretamente no GitHub → edita arquivo → abre PR
        │
        ▼
[PR aberto com label "event-override"]
        │
        ▼
[codaqui-bot recebe webhook do PR]
        ├── Valida JSON do diff (campos proibidos, tipos, limites)
        ├── Se inválido → "Request changes" com comentário explicando o erro
        └── Se válido → Aprova PR → Habilita auto-merge (squash) → GitHub mergeia → deleta branch
```

---

## Dois Caminhos para Editar

O sistema suporta dois caminhos igualmente válidos. Ambos terminam no mesmo fluxo de PR + bot.

### Caminho A: Painel Admin (site)

1. `event_organizer` autenticado acessa `/admin/eventos`
2. Seleciona o evento e preenche o formulário de override
3. Clica em "Salvar" → backend:
   a. Valida os campos **antes** de qualquer chamada à GitHub API
   b. Cria branch `event-override/<sourceKey>-<eventId>-<ts>` via GitHub App token
   c. Commita o `.override.json` (create/update) ou deleta o arquivo (delete) na branch
   d. Abre PR com label `event-override`, título: `event: override <eventId> by @<handle> — <reason>`
4. `codaqui-bot` processa o PR (veja seção abaixo)
5. PR auto-mergeado em segundos; frontend vê o override na próxima requisição

### Caminho B: GitHub diretamente (web editor ou clone local)

1. `event_organizer` (ou qualquer membro autorizado) cria branch `event-override/<slug>-<ts>`
2. Cria, edita ou deleta o arquivo `.override.json` no caminho correto:
   `static/events/<source>/<sourceId>/<eventId>.override.json`
3. Abre PR com label `event-override` contra `main`
4. `codaqui-bot` valida o diff e auto-mergeia (mesmo fluxo do Caminho A)

> **Regra de segurança:** O `codaqui-bot` rejeita PRs que contenham alterações fora de
> `static/events/**/*.override.json`. PRs mistos (override + outro arquivo) são bloqueados.

---

## GitHub App: codaqui-bot (validação + auto-merge)

### Permissões necessárias

| Permissão | Nível | Para quê |
|---|---|---|
| `Contents` | Write | Criar branches e commitar arquivos (Caminho A) |
| `Pull requests` | Write | Criar PRs, aprovar, habilitar auto-merge |
| `Workflows` | Read | Ler status de checks antes de mergear |

> O repositório precisa ter **auto-merge habilitado** nas configurações:
> _Settings → General → Allow auto-merge_

### Lógica de validação do bot

```typescript
// Pseudocódigo do webhook handler do codaqui-bot
async function onPullRequestOpened(pr: PullRequest) {
  // 1. Verificar que todos os arquivos modificados são *.override.json
  const files = await listPRFiles(pr.number);
  const invalidFiles = files.filter(f => !f.filename.match(
    /^static\/events\/[^/]+\/[^/]+\/[^/]+\.override\.json$/
  ));
  if (invalidFiles.length > 0) {
    await requestChanges(pr.number, `PR contém arquivos fora do escopo permitido: ${invalidFiles.map(f => f.filename).join(', ')}`);
    return;
  }

  // 2. Para cada arquivo modificado (exceto deletions): validar JSON
  for (const file of files) {
    if (file.status === 'removed') continue;
    const content = await getFileContent(pr.head.sha, file.filename);
    const result = validateOverrideSchema(JSON.parse(content));
    if (!result.ok) {
      await requestChanges(pr.number, `JSON inválido em ${file.filename}: ${result.reason}`);
      return;
    }
  }

  // 3. Tudo válido: aprovar + habilitar auto-merge
  await approvePR(pr.number, '✅ Override validado automaticamente pelo codaqui-bot.');
  await enableAutoMerge(pr.number, 'SQUASH');
  // Após merge: GitHub deleta a branch automaticamente (configurar em Settings → Delete head branches)
}
```

### Validação do schema de override

```typescript
function validateOverrideSchema(data: unknown): { ok: boolean; reason?: string } {
  // Campos proibidos (nunca sobrescrevíveis)
  const forbidden = ['id', 'startAt', 'endAt', 'href', 'source', 'sourceId', 'status'];
  for (const key of forbidden) {
    if (key in (data as Record<string, unknown>).extendData ?? {}) {
      return { ok: false, reason: `Campo proibido: extendData.${key}` };
    }
  }
  // Limites
  if ((data as EventOverride).extendData?.summary?.length > 500)
    return { ok: false, reason: 'summary excede 500 caracteres' };
  if ((data as EventOverride).extendData?.tags?.length > 10)
    return { ok: false, reason: 'tags excede 10 itens' };
  if ((data as EventOverride).extendData?.speakers?.length > 10)
    return { ok: false, reason: 'speakers excede 10 itens' };
  return { ok: true };
}
```

---

## GitHub Action: Validação e Auto-Merge de Overrides

A GitHub Action abaixo é o ponto de entrada para o `codaqui-bot` processar PRs de override.
Ela é disparada em `pull_request` (não em push para `main`), garantindo validação **antes** do merge.

```yaml
# .github/workflows/validate-event-overrides.yml
name: Validate & auto-merge event overrides

on:
  pull_request:
    types: [opened, synchronize, reopened]
    paths:
      - 'static/events/**/*.override.json'

jobs:
  validate-and-merge:
    name: Validate override + auto-merge
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write

    steps:
      - name: Generate GitHub App token
        id: app-token
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ vars.GH_APP_ID }}
          private-key: ${{ secrets.GH_APP_PRIVATE_KEY }}

      - uses: actions/checkout@v6
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          token: ${{ steps.app-token.outputs.token }}

      - uses: actions/setup-node@v6
        with: { node-version: '24' }

      - name: Validate override files
        run: node scripts/validate-overrides.mjs
        # Sai com código 1 se qualquer *.override.json for inválido

      - name: Approve PR (codaqui-bot)
        if: success()
        env:
          GH_TOKEN: ${{ steps.app-token.outputs.token }}
        run: |
          gh pr review ${{ github.event.pull_request.number }} \
            --approve \
            --body "✅ Override validado automaticamente pelo codaqui-bot."

      - name: Enable auto-merge
        if: success()
        env:
          GH_TOKEN: ${{ steps.app-token.outputs.token }}
        run: |
          gh pr merge ${{ github.event.pull_request.number }} \
            --squash \
            --auto \
            --delete-branch
```

> **Branch deletion automática:** o flag `--delete-branch` garante que a branch é deletada
> após o merge, mesmo para PRs criados pelo Caminho B (edição direta no GitHub).

---

## UI da Página de Evento: Dados Máximos

A página `/eventos/[sourceKey]/[id]` (ou `/eventos?source=X&id=Y`) precisa mesclar:

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

## Backend: Variáveis de Ambiente

```
# .env.example — adicionar:
GITHUB_REPO_OWNER=codaqui
GITHUB_REPO_NAME=institucional

# GitHub App — usado para criar branches + PRs (NUNCA token pessoal de membro):
GITHUB_APP_ID=                  # ID numérico do GitHub App `codaqui-bot`
GITHUB_APP_INSTALLATION_ID=     # ID da instalação no org `codaqui`
GITHUB_APP_PRIVATE_KEY=         # Chave privada PEM do GitHub App (multiline; usar base64 se necessário)
```

> ⚠️ **Não há `GITHUB_CREATE_PR` nem `GITHUB_COMMIT_DISABLED`** — o modelo é sempre-PR.
> O backend nunca commita direto em `main`. A autoria do organizador é registrada no campo
> `ownerHandle` do JSON override e no commit message — o committer real é sempre o GitHub App.

### Endpoints do módulo `event-organizer`

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/events/organizers` | Admin | Lista mapeamento de ownership |
| `POST` | `/events/organizers` | Admin | Atribui eventos a um organizer |
| `DELETE` | `/events/organizers/:memberId` | Admin | Remove ownership |
| `PUT` | `/events/override/:sourceKey/:eventId` | event_organizer | Cria/atualiza override (abre PR) |
| `DELETE` | `/events/override/:sourceKey/:eventId` | event_organizer | Remove override (abre PR de delete) |
| `GET` | `/events/override/:sourceKey/:eventId` | Público | Retorna override atual (cache 5min) |
| `GET` | `/events/override/:sourceKey/:eventId/pr` | event_organizer | Retorna PR em aberto para o override |

---

## Padrão Reutilizável: GitHub-as-Database

Este fluxo (backend valida → **GitHub App** cria branch + PR → `codaqui-bot` auto-mergeia →
branch deletada) é reutilizável para qualquer dado que vive no repositório:

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
   * Cria uma branch, commita a mudança e abre um PR.
   * O `actorHandle` é preservado no commit message e no título do PR.
   * O bot (`codaqui-bot`) valida e auto-mergeia o PR após aprovação.
   */
  async createPRWithFile(opts: {
    branch: string;         // nome da branch (ex: "event-override/meetup-devparana-123-ts")
    path: string;           // caminho do arquivo no repositório
    content: string;        // conteúdo em UTF-8 (undefined para deletar)
    commitMessage: string;  // "event: override <eventId> by @<actorHandle> — <reason>"
    prTitle: string;        // título do PR
    actorHandle: string;    // handle GitHub do membro (auditoria)
    labels?: string[];      // ex.: ["event-override"]
  }): Promise<{ prNumber: number; prUrl: string }>;

  async readFile(path: string): Promise<string | null>;

  /**
   * Cria branch + PR de delete (remove o arquivo override).
   * Mesmo fluxo: bot valida que só *.override.json está sendo removido e auto-mergeia.
   */
  async createPRDeleteFile(opts: {
    branch: string;
    path: string;
    commitMessage: string;
    prTitle: string;
    actorHandle: string;
  }): Promise<{ prNumber: number; prUrl: string }>;

  /** Retorna o PR aberto para uma branch (útil para polling de status) */
  async getPRForBranch(branch: string): Promise<{ number: number; state: string; mergedAt: string | null } | null>;
}
```

> Internamente o service usa `GITHUB_APP_ID` + `GITHUB_APP_INSTALLATION_ID` + `GITHUB_APP_PRIVATE_KEY`
> para gerar tokens de instalação de curta duração via `POST /app/installations/:id/access_tokens`.
> Nunca há `commitFile()` direto em `main` — todo write passa por branch + PR.

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
- `scripts/validate-overrides.mjs` — valida todos os `*.override.json` modificados no PR:
  - Campos proibidos (startAt, endAt, id, source, status, href)
  - Tipos de cada campo de `extendData`
  - Limites (summary ≤ 500 chars, tags ≤ 10, speakers ≤ 10)
  - PRs mistos (override + outro arquivo) devem falhar

---

## Checklist de Implementação

- [ ] Criar GitHub App `codaqui-bot`:
  - Permissão `Contents: write` + `Pull requests: write`
  - Habilitar auto-merge no repositório (_Settings → General → Allow auto-merge_)
  - Habilitar delete automático de branches após merge (_Settings → General → Automatically delete head branches_)
- [ ] Migrar `MemberRole` de enum single-value para `text[]` + `RolesGuard` update
- [ ] Adicionar `EVENT_ORGANIZER` em `MemberRole` + migration Postgres
- [ ] Criar `static/events/organizers.json` com estrutura inicial vazia
- [ ] Criar módulo `backend/src/github-db/` com `GitHubDBService`:
  - `createPRWithFile()` — cria branch + commita + abre PR
  - `createPRDeleteFile()` — cria branch + remove arquivo + abre PR
  - `readFile()` — lê arquivo de `main`
  - `getPRForBranch()` — retorna estado do PR aberto
- [ ] Criar módulo `backend/src/event-organizer/` com endpoints de ownership e override
- [ ] Adicionar validação de override no backend (campos proibidos, tipos, limites) **antes** de criar branch
- [ ] Adicionar `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME` em `.env.example`
- [ ] Criar workflow `.github/workflows/validate-event-overrides.yml` (on: pull_request → validate + approve + auto-merge)
- [ ] Criar script `scripts/validate-overrides.mjs`
- [ ] Atualizar script `scripts/sync-events.mjs` para incluir `hasOverride: boolean` no `index.json`
- [ ] Criar `src/utils/event-override.ts` com `loadEventWithOverride()`
- [ ] Criar `src/components/EventOverrideBadge/`
- [ ] Atualizar página de eventos para usar merge e badge
- [ ] Testes unitários (backend + frontend + validate-overrides.mjs)
- [ ] Atualizar `AGENTS.md` com novo role e padrão GitHub-as-DB (sempre-PR, sem commit direto)

<!-- AGENT-INDEX
purpose: Design da Camada 2 — endurecimento do pipeline de sync de eventos e da UX da listagem (try/catch, escrita atômica, futuro/passado por data, validações de DTO, testes).
audience: AI agents, maintainers
read-first: true
sections:
  - L2-5 — Robustez do sync (try/catch em applyOverride + escrita atômica)
  - L2-6 — Separação futuro/passado por startAt
  - L2-7 — Validações de DTO (imageUrl @IsUrl, capacity condicional)
  - L2-8 — Testes de processInternalSource e overrides no sync
  - Critérios de aceite
related-docs:
  - ./MAP.md — mapa de navegação do plano
  - ./layer1-quick-wins-design.md — quick wins (pré-requisito de contexto)
  - ../../../AGENTS.md — convenções do monorepo
agent-protocol:
  - Escopo fechado por item. Mantenha o estilo do arquivo (o sync é um .mjs com padrões próprios; o frontend usa MUI v7 Grid size={}).
  - Testes .mjs: seguir o padrão existente em scripts/sync-events.test.mjs (runner próprio, sem framework).
-->

# Layer 2 — Robustez do pipeline e da UX

## L2-5 — Robustez do sync 🟡 (frente B)

**Arquivo:** `scripts/sync-events.mjs`.

### 5a. try/catch em `applyOverride` (~linhas 54-69)

`JSON.parse(override.payload)` sem proteção: um payload corrompido no banco derruba o script inteiro e nenhuma fonte é gravada.

**Mudança:** envolver o parse/merge em try/catch. Em erro: logar um warning com `sourceKey:eventId` e o motivo, e seguir com o evento **sem** override (não marcar `hasOverride`). Não abortar o sync.

### 5b. Escrita atômica (~linhas 1499-1571)

`cleanSourceDir` apaga todos os `.json` da pasta da fonte antes de gravar; se o processo morrer entre o delete e o `writeFile`, o snapshot da fonte se perde.

**Mudança (mínima):**
- Gravar cada arquivo em caminho temporário (ex.: `<arquivo>.tmp`) e renomear (fs.rename) após escrita completa.
- Inverter a ordem: gravar todos os arquivos novos primeiro, só então remover os arquivos órfãos (que não fazem parte do novo conjunto), em vez de apagar tudo no início.
- Manter o comportamento de "índice da fonte + index.json raiz" idêntico; o diff commitado pelo workflow não deve mudar de formato.

**Critério de aceite:** interromper o script (SIGKILL) no meio não deixa a pasta da fonte vazia; payload inválido em um override não impede o sync das demais fontes.

## L2-6 — Futuro/passado por `startAt` 🟡 (frente C)

**Arquivo:** `src/pages/eventos.tsx` (~linhas 354-368).

**Problema:** a listagem separa "Agenda completa" vs "Histórico" **só por `status`** (`status !== "completed"` → futuro). Evento com `startAt` passado mas status diferente de `completed` fica preso na agenda futura; cancelado futuro também aparece como futuro.

**Mudança (mínima):**
- Manter a separação por status para **excluir** eventos `canceled` de ambas as seções (ou movê-los para o histórico — escolher o comportamento já existente para cancelados e manter).
- Dentro do restante, classificar futuro vs passado também por `startAt` (ex.: `new Date(item.startAt) >= now` → agenda). Um evento passado deve ir para o histórico mesmo que seu `status` não seja `completed` (defesa em profundidade caso o sync atrase ou o status não tenha sido atualizado).
- Não alterar contagens de estatísticas, filtros por fonte, nem a paginação "Carregar mais" do histórico.

**Critério de aceite:** evento com `startAt` ontem e `status: "active"` aparece no Histórico; evento futuro `published` continua na Agenda; cancelados seguem o comportamento atual.

## L2-7 — Validações de DTO 🟡 (frente A)

**Arquivos:** DTOs de eventos em `backend/src/events/dto/` (localizar `CreateEventDto`/`UpdateEventDto` — `imageUrl` ~linha 51, `capacity`).

1. **`imageUrl`:** adicionar `@IsUrl({ require_tld: false })` (ou o decorator equivalente do class-validator já usado no projeto — verificar imports vizinhos) com `@IsOptional()`, permitindo `null`/vazio. Manter mensagens de erro em português seguindo o padrão do arquivo. Atenção: URLs de localhost/IPs podem ser legítimas em dev — por isso `require_tld: false`.
2. **`capacity`:** hoje tem semântica dupla (aplicado só em RSVP gratuito; evento pago é limitado por `quantityTotal` do ticket type). Mudança mínima: adicionar validação/ajuda no DTO — se o evento tiver ticket types pagos, `capacity` deve ser `null` (rejeitar com mensagem clara explicando que o limite do evento pago vem dos lotes). Se a validação cruzada evento↔ticket types não couber no DTO, aplicar no service no momento de salvar ticket type pago / publicar. Documentar a regra no comentário do campo.

**Critério de aceite:** `imageUrl: "não-é-url"` falha na validação com 400; `capacity` com ticket pago é rejeitado ou ignorado com mensagem clara; cenários existentes (imageUrl ausente, RSVP gratuito com capacity) inalterados; `cd backend && npm run build && npx jest --silent` passa.

## L2-8 — Testes do sync para internal/overrides 🟡 (frente B)

**Arquivos:** `scripts/sync-events.mjs` (exports de teste ~linhas 1703-1718) e `scripts/sync-events.test.mjs`.

**Problema:** o teste existente cobre só Sympla; `processInternalSource`, `applyOverride` e a montagem do índice não têm cobertura.

**Mudança:** seguir o runner/padrão do arquivo de teste existente (sem framework, asserts próprios). Exportar (somente para testes) as funções necessárias e adicionar casos:
1. `applyOverride` aplica `extendData` e marca `hasOverride: true` + `_override` meta.
2. `applyOverride` com payload JSON inválido → não lança, não marca `hasOverride` (cobre L2-5a).
3. `processInternalSource` (ou o equivalente puro) monta o item interno com `href`, `platform: "Site Codaqui"`, `source: "internal"`, `sourceId: "codaqui"`.
4. Montagem do índice: eventos ordenados ASC por `startAt`.

**Critério de aceite:** `node scripts/sync-events.test.mjs` (ou o comando que o package.json define) passa com os novos casos.

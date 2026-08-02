<!-- AGENT-INDEX
purpose: Plano de melhorias de UI/UX para o módulo de eventos e administração da Codaqui. Complementa o ADR da plataforma de eventos.
audience: Product owners, designers, devs e AI agents.
sections:
  - Resumo executivo
  - Dores principais mapeadas
  - Melhorias por fluxo (admin, check-in, ingressos, perfil, listagem pública)
  - Roadmap sugerido
  - Critérios de aceitação
  - Riscos e dependências
related-docs:
  - ../adrs/001-event-platform.md — decisões arquiteturais da plataforma de eventos
  - ../modules/events/ROLES.md — matriz de papéis
  - ../modules/events/CODE_MANUAL.md — manual do código
-->

# Plano de Melhorias de UI/UX — Módulo de Eventos

> Status: **em implementação** — Sprints 1–5 concluídas; Sprint 6 (hub unificado) em planejamento.
> Última atualização: 2026-07-31.

## 1. Resumo executivo

As Fases 1 e 2a–2d do módulo de eventos estão implementadas, mas a experiência de organizadores, operadores de check-in e participantes ainda tem atritos significativos. Este plano consolada as principais melhorias de UI/UX levantadas na auditoria dos fluxos existentes, priorizando itens de baixo esforço e alto impacto.

Os temas centrais são:

1. **Clareza de permissões** — separar visualmente role global (`event_organizer`) de ownership de eventos externos (`organizers.json`).
2. **Hub unificado de eventos no admin** — uma única tela para listar, buscar, filtrar e agir sobre eventos internos e externos.
3. **Confiança em ações destrutivas/irreversíveis** — confirmação, feedback e estados de loading em publicação, desativação de ingressos, check-in, reembolso.
4. **Consistência visual e de linguagem** — CTAs, badges, filtros, status, skeletons e empty states.
5. **Recuperação e continuidade de fluxo** — persistir formulário antes do login, sincronizar query string, melhorar feedback de sucesso/erro.

---

## 2. Dores principais mapeadas

| # | Dor | Onde se manifesta | Impacto |
|---|-----|-------------------|---------|
| 1 | **Role vs. ownership confusos** | Admin → Overrides → Organizers; Admin → Membros | Admin adiciona ownership sem saber que a pessoa também precisa da role `event_organizer`; organizer não entende por que não consegue editar evento. |
| 2 | **Hub de eventos fragmentado** | `/admin/eventos` + `/admin/overrides` | Ações de um mesmo evento espalhadas em duas páginas com modelos visuais diferentes (cards vs. accordions). |
| 3 | **Ações irreversíveis sem confirmação** | Publicar evento, desativar ingresso, check-in, reembolso | Cliques acidentais geram estados indesejados; falta de feedback deixa o usuário inseguro. |
| 4 | **Datas/horários com timezone errado** | Formulários de evento e ingressos | Organizer fora do fuso de Brasília pode salvar horário incorreto. |
| 5 | **Falta de busca/filtro/paginação** | Listas de eventos, inscrições, participantes, pedidos, reembolsos | Dificuldade de localizar itens em bases grandes. |
| 6 | **Fluxo de compra perde estado no login** | Página de detalhe do evento | Usuário preenche ingressos, faz login, volta com formulário vazio. |
| 7 | **Pós-pagamento brusco** | Página de detalhe do evento | Redirecionamento imediato para `/membro` sem confirmação na página atual. |
| 8 | **Check-in com feedback fraco** | `/admin/eventos-checkin` | Alerta não some, sem feedback tátil/sonoro, sem atualização de contador entre dispositivos. |
| 9 | **Perfil e histórico mal integrados** | `/membro`, `/membros/perfil` | Aba "Carteira" só mostra reembolsos; histórico de eventos sem link para evento; lista de membros usa URL que dá 404. |
| 10 | **Listagem pública redundante/confusa** | `/eventos` | CTAs duplicados para eventos internos, destaques repetidos, sem busca textual. |

---

## 3. Melhorias por fluxo

### 3.1 Admin — Permissões e papéis

#### 3.1.1 Aviso de role ausente na aba Organizers (observação #1)

**Problema:** ao adicionar uma ownership em `organizers.json`, o admin pode selecionar um membro que não tem a role `event_organizer`. A pessoa terá escopo no arquivo, mas o backend ainda negará acesso porque falta a role global.

**Proposta:**
- Na aba **Organizers** (`/admin/overrides`, tab 1), ao selecionar um membro no dropdown, verificar se ele possui a role `event_organizer`.
- Se não tiver, exibir `Alert` amarelo com texto:
  > "@handle ainda não tem a role **Organizador de eventos**. Vá em **Admin → Membros** e adicione essa role antes de salvar, senão a pessoa não conseguirá editar eventos mesmo com o escopo definido."
- Opcionalmente, exibir um chip/ícone ao lado de cada membro na lista de organizers indicando se a role está ou não atribuída (requer carregar lista de membros).

**Critérios:**
- O alerta aparece antes de o admin clicar em salvar.
- Não bloqueia o salvamento (pode ser intencional adicionar ownership antes da role), mas deixa claro.

#### 3.1.2 Explicar role vs. ownership no modal de confirmação

**Proposta:** no `ModalConfirm` de alteração de roles, quando a role `event_organizer` é adicionada ou removida, incluir texto explicativo:
- Ao adicionar: "Isso habilita o acesso ao módulo de eventos. Para eventos externos, a pessoa ainda precisa de ownership em Admin → Overrides → Organizers."
- Ao remover: "A pessoa perderá acesso ao módulo de eventos. Ownerships em organizers.json não são removidas automaticamente."

#### 3.1.3 Proteção contra auto-remoção de admin

**Problema:** admin pode remover sua própria role de admin acidentalmente.

**Proposta:** no modal de alteração de roles, detectar `roleTarget.member.id === user?.sub` + remoção de `admin` e exibir alerta extra de confirmação, ou desabilitar a ação com tooltip.

#### 3.1.4 Landing page útil para `finance-analyzer`

**Problema:** `/admin` mostra uma página vazia para `finance-analyzer`.

**Proposta:** redirecionar `finance-analyzer` para `/admin/reembolsos` (ou `/admin/lancamento`) ou renderizar cards/links rápidos para os módulos financeiros.

---

### 3.2 Admin — Hub unificado de eventos

#### 3.2.1 Consolidar `/admin/eventos` e `/admin/overrides`

**Problema:** eventos internos e externos vivem em páginas diferentes, com modelos visuais diferentes (accordions vs. cards). Ações comuns (editar, publicar, check-in, pedidos, caixa, reembolsos) estão espalhadas.

**Proposta de curto prazo (dentro da página `/admin/eventos` existente):**
- Usar um único componente de linha/card para todos os eventos, mostrando:
  - Título, data, fonte (badge), comunidade, status (rascunho/publicado/concluído).
  - Badges de features ativas (pagamentos, check-in, certificados).
  - Ações contextuais em menu ou botões: Editar, Publicar, Pedidos, Caixa, Check-in, Relatório, Reembolsos.
- Substituir os toggles independentes "Internos"/"Externos" por um select "Tipo: Todos / Internos / Externos".
- Adicionar busca textual por título, local, comunidade, fonte.
- Paginar ou usar "carregar mais" para eventos passados.

**Proposta de médio prazo:**
- Criar uma nova página `/admin/eventos-hub` com design de tabela/lista unificada.
- Migrar gradualmente as funcionalidades de `/admin/overrides` para actions/modais dentro do hub.
- Manter `/admin/overrides` como legacy até migração completa.

#### 3.2.2 Ações contextuais por evento

**Proposta:** cada linha do hub oferece ações de acordo com o tipo e estado do evento:

| Evento interno | Evento externo (ativo) | Evento externo (não ativo) |
|---|---|---|
| Editar | Override / Gerenciar features | Ativar features |
| Publicar | Pedidos | — |
| Pedidos | Caixa | — |
| Caixa | Check-in | — |
| Check-in | Relatório | — |
| Reembolsos/despesas | Reembolsos/despesas | — |

#### 3.2.3 Confirmação na publicação

**Problema:** publicar evento é irreversível e não pede confirmação.

**Proposta:** adicionar `ModalConfirm` antes de `handlePublish`, explicando que o evento ficará público.

#### 3.2.4 Desabilitar "Ver página pública" para rascunhos

**Problema:** o botão funciona para eventos `draft`, mas a página pública retorna 404/conteúdo vazio.

**Proposta:** trocar por "Pré-visualizar" (modal com preview dos dados) ou desabilitar quando `status === "draft"`.

#### 3.2.5 Edição de tipos de ingresso

**Problema:** só é possível desativar e recriar.

**Proposta:** adicionar modo "edit" no diálogo de ingresso (ou endpoint de PATCH) para corrigir preço/quantidade/nome sem perder histórico.

---

### 3.3 Formulários — Datas, preços e validação

#### 3.3.1 Timezone nos campos de data/hora

**Problema:** `datetime-local` é interpretado no fuso local do navegador; backend espera `America/Sao_Paulo`.

**Proposta:**
- Converter explicitamente entre o timezone do evento e o local do navegador ao popular e ler os inputs.
- Usar `date-fns-tz` ou `Intl.DateTimeFormat` com timezone.
- Exibir ao lado do campo: "Horário de Brasília" (ou do timezone selecionado).

#### 3.3.2 Select de timezone

**Problema:** campo `timezone` é texto livre.

**Proposta:** substituir por `Select` com timezones IANA comuns (America/Sao_Paulo, America/Cuiaba, America/Fortaleza, America/Manaus, America/Recife, America/Buenos_Aires, UTC).

#### 3.3.3 Máscara de moeda para preços

**Problema:** parsing manual `price.replace(",", ".")` quebra com `1.234,56`.

**Proposta:** componente `CurrencyInput` que formata `R$ 1.234,56` e armazena centavos.

#### 3.3.4 Validar `endAt > startAt` e formato de slug no frontend

**Proposta:** validações no `handleSaveEvent` antes de enviar ao backend.

#### 3.3.5 Forçar `priceCents = 0` quando `kind === "free"`

**Proposta:** ao trocar kind para free, zerar o preço no state e no payload.

---

### 3.4 Ingressos e checkout

#### 3.4.1 Persistir formulário antes do login

**Problema:** usuário perde seleção de ingressos ao fazer login.

**Proposta:** salvar estado do formulário no `sessionStorage` antes do redirect OAuth; restaurar no mount.

#### 3.4.2 Pós-pagamento com confirmação na página

**Problema:** redirecionamento imediato para `/membro` sem feedback.

**Proposta:** renderizar `Alert` de sucesso na própria página de detalhe com link "Ver meus ingressos"; redirecionar após alguns segundos ou deixar o usuário clicar.

#### 3.4.3 Unificar CTA de inscrição para eventos externos

**Problema:** botões "Site original" e "Ver detalhes" podem ir para o mesmo lugar em eventos internos; para externos, CTAs competem.

**Proposta:**
- Evento interno: um único botão "Inscrever-se" apontando para a página de detalhe.
- Evento externo ativado para venda: botão primário "Comprar ingresso" (checkout Codaqui) e secundário "Ver na plataforma original".
- Evento externo não ativado: botão "Ver detalhes" + "Inscrever-se na plataforma original".

#### 3.4.4 Inscrição gratuita para outra pessoa

**Problema:** checkbox "Comprar para outra pessoa" não aparece em ingressos gratuitos.

**Proposta:** exibir `AttendeeFields` para gratuitos quando `quantity > 1` ou `buyForOther` estiver marcado.

#### 3.4.5 Bloquear seleção de ingresso durante submit

**Proposta:** desabilitar cards de ingresso quando `submitting === true`.

---

### 3.5 Check-in

#### 3.5.1 Corrigir `event_checker` global

**Problema:** `event_checker` global vê eventos no seletor, mas backend nega leitura da lista.

**Proposta:**
- No frontend, quando `!canUseList`, mostrar apenas scanner + contador local.
- No backend, garantir que `event_checker` global possa fazer check-in via endpoint dedicado sem precisar ler lista completa.

#### 3.5.2 Feedback tátil/sonoro e auto-dismiss

**Proposta:**
- `navigator.vibrate?.([50, 50, 50])` no sucesso.
- Auto-dismiss do alerta após 4–5s.
- Overlay "Presente confirmado" sobre o vídeo por 1s após leitura.

#### 3.5.3 Sincronizar query string

**Proposta:** atualizar URL ao trocar de evento no seletor (`history.replace`).

#### 3.5.4 Loading individual por botão de check-in

**Proposta:** estado de loading por `registrationId`, não global.

#### 3.5.5 Status visual nas inscrições

**Proposta:** chips de status (`confirmed`, `cancelled`, `refunded`, `pending_match`) e desabilitar botão quando aplicável.

---

### 3.6 Perfil do membro

#### 3.6.1 Renomear aba "Carteira" para "Reembolsos"

**Problema:** aba só mostra reembolsos, mas nome gera expectativa de carteira.

**Proposta:** renomear para "Reembolsos" e mover botão "Minha carteira de moedas" para a aba correta.

#### 3.6.2 Corrigir cálculo do valor de reembolso

**Problema:** `Math.round(Number.parseFloat(amount))` não multiplica por 100.

**Proposta:** `Math.round(parseFloat(amount) * 100)`.

#### 3.6.3 Título do evento como link

**Proposta:** transformar título da inscrição em link para `/eventos/detalhe`.

#### 3.6.4 Status real das assinaturas

**Proposta:** mostrar chips para `past_due`, `unpaid`, `canceled` etc.

#### 3.6.5 Resolver `communityId` via `src/data/communities.ts`

**Proposta:** não exibir slugs crus; mostrar nome da comunidade.

#### 3.6.6 Busca/filtro na aba Eventos

**Proposta:** paginação e campo de busca por título/status.

---

### 3.7 Perfil público e lista de membros

#### 3.7.1 Corrigir link da lista de membros

**Problema:** `/membros` aponta para `/@handle`, que dá 404 no GitHub Pages antes de redirecionar.

**Proposta:** usar `/membros/perfil?handle=${member.githubHandle}` diretamente.

#### 3.7.2 Empty state no histórico de eventos

**Problema:** seção some quando vazia.

**Proposta:** mostrar "Nenhuma participação registrada ainda." em vez de `null`.

#### 3.7.3 Link do evento no histórico público

**Proposta:** título do evento leva para `/eventos/detalhe`.

#### 3.7.4 CTA de doação só no próprio perfil

**Proposta:** botão "Apoie a Codaqui" só aparece quando `isOwner === true`.

---

### 3.8 Listagem pública `/eventos`

#### 3.8.1 Corrigir CTAs duplicados para eventos internos

**Proposta:**
```tsx
const isInternal = event.source === "internal";
// ...
{!isInternal && <Button href={event.href}>{event.ctaLabel ?? "Site original"}</Button>}
<Button href={detailHref} variant="contained">
  {isInternal ? (event.ctaLabel ?? "Inscrever-se") : "Ver detalhes"}
</Button>
```

#### 3.8.2 Busca textual

**Proposta:** filtrar por título, summary, tags, location.

#### 3.8.3 Sincronizar filtro com query string

**Proposta:** `?source=meetup:devparana` persistido na URL.

#### 3.8.4 Badge de override na listagem

**Proposta:** reutilizar `<EventOverrideBadge>` nos cards quando `event.override` existir.

#### 3.8.5 Empty states conscientes de filtros

**Proposta:** distinguir "nenhum evento publicado" de "nenhum evento para este filtro" com botão "Limpar filtro".

---

## 4. Roadmap sugerido

### Sprint 1 — Segurança e clareza de permissões ✅
- [x] 3.1.1 Aviso de role ausente na aba Organizers
- [x] 3.1.2 Explicar role vs. ownership no modal de roles
- [x] 3.1.3 Proteção contra auto-remoção de admin
- [x] 3.1.4 Landing page para `finance-analyzer`

### Sprint 2 — Hub de eventos (quick wins) ✅
- [x] Paginação real no endpoint `/events` (usada na aba "Apenas internos")
- [x] Filtro por comunidade e badges de owner/comunidade no hub
- [x] Link "Ver página do evento" após criar/editar evento interno
- [x] Botões "Site original" / "Ver detalhes" na listagem pública
- [x] Badges de features nos cards de evento (via `/events/public/activations`)
- [ ] 3.2.3 Confirmação na publicação (futuro)
- [ ] 3.2.4 Desabilitar "Ver página pública" para rascunhos (futuro)
- [ ] 3.3.2 Select de timezone (futuro)
- [ ] 3.3.3 Máscara de moeda (futuro)

### Sprint 3 — Formulários e checkout ✅
- [x] Validação de data/hora completa no formulário de evento
- [x] Limite padrão de 1 ingresso por pedido (customizável 1–10)
- [x] Checkout embedded + redirect `/membro?purchase=success` após pagamento
- [x] Página de termos de compra já existente (`/termos-de-compra`)
- [ ] 3.3.1 Timezone nos campos de data/hora (futuro)
- [ ] 3.3.4 Validar `endAt > startAt` e slug (parcial — data validada; slug futuro)
- [ ] 3.3.5 Forçar `priceCents = 0` quando free (futuro)
- [ ] 3.4.1 Persistir formulário antes do login (futuro)
- [ ] 3.4.4 Inscrição gratuita para outra pessoa (futuro)

### Sprint 4 — Check-in e operação no dia ✅
- [x] Lista de check-in vinculada a orders/pedidos
- [x] Indicador "comprado por Y para X" na lista
- [x] Modo scanner vs. lista por role (`canUseList`)
- [x] Contador de check-ins no topo
- [ ] 3.5.2 Feedback tátil/sonoro e auto-dismiss (futuro)
- [ ] 3.5.3 Sincronizar query string (futuro)
- [ ] 3.5.4 Loading individual por botão (futuro)

### Sprint 5 — Perfil e listagem pública ✅
- [x] Correção de crash `Cannot read properties of null (reading 'startAt')` na aba Eventos
- [x] Sub-abas Próximos ingressos / Comprei para outros / Histórico
- [x] Título do evento como link na aba Eventos (`/membro`)
- [x] Link do evento no histórico público (`/membros/perfil`)
- [x] Empty state no histórico de eventos
- [x] Correção de `startAt` perdido ao editar ativação externa
- [ ] 3.6.1 Renomear aba "Carteira" (futuro)
- [ ] 3.6.2 Corrigir cálculo do reembolso (futuro)
- [ ] 3.8.2–3.8.5 Melhorias extras na listagem pública (futuro)

### Sprint 6 — Hub unificado (médio prazo) 🟡
- [ ] Prototipar `/admin/eventos-hub`
- [ ] Migrar funcionalidades de `/admin/overrides`
- [ ] Deprecar `/admin/overrides` ou transformar em redirect

---

## 5. Critérios de aceitação gerais

1. Toda ação destrutiva/irreversível possui `ModalConfirm` com texto claro.
2. Toda ação assíncrona possui estado de loading no botão/disparador.
3. Toda lista com mais de 10 itens possui busca, filtro ou paginação.
4. Todos os formulários de data/hora respeitam o timezone do evento.
5. Todos os valores monetários usam máscara/formato brasileiro e armazenam centavos corretamente.
6. Todos os CTAs primários/secundários seguem padrão consistente.
7. Todos os empty states distingem "vazio" de "erro" de "carregando".
8. Query string é usada para estado compartilhável (filtros, abas, evento selecionado).

---

## 6. Riscos e dependências

| Risco | Mitigação |
|---|---|
| Mudança grande na página `/admin/eventos` pode quebrar testes existentes | Fazer em incrementos; manter testes atualizados a cada PR. |
| Timezone exige biblioteca adicional (`date-fns-tz`) | Verificar se já está em `package.json`; se não, avaliar se `Intl` nativo é suficiente. |
| Hub unificado pode conflitar com trabalho em paralelo em `/admin/overrides` | Definir `/admin/eventos` como alvo principal; `/admin/overrides` entra em modo legado. |
| Persistir formulário no `sessionStorage` pode vazar dados sensíveis | Salvar apenas IDs de ingresso, quantidade e flag `buyForOther`; nunca salvar dados de pagamento. |
| Alterações de UI exigem revisão de design | Manter padrão MUI e tokens do tema; não inventar componentes novos sem necessidade. |

---

## 7. Registro de implementação (2026-07-31)

| Sprint | O que foi entregue | Arquivos principais |
|--------|-------------------|---------------------|
| Sprint 1 | Aviso de role ausente em organizers; explicação role vs. ownership; proteção contra auto-remoção de admin; landing page financeira. | `src/pages/admin/overrides.tsx`, `src/pages/admin/index.tsx`, `src/components/ModalConfirm/index.tsx`, `backend/src/events/events.service.ts` |
| Sprint 2 | Paginação real no backend `/events`; filtro por comunidade/owner no hub; link pós-criação; CTAs ajustados na listagem pública; endpoint público de ativações e badges de features. | `backend/src/events/dto/event.dto.ts`, `backend/src/events/events.controller.ts`, `backend/src/events/events.service.ts`, `src/pages/admin/eventos.tsx`, `src/pages/eventos.tsx` |
| Sprint 3 | Validação de data/hora no formulário; limite 1–10 ingressos por pedido; redirect pós-checkout para `/membro?purchase=success`. | `src/pages/admin/eventos.tsx`, `src/pages/eventos/detalhe.tsx` |
| Sprint 4 | Lista de check-in já vinculada a orders; indicador "comprado por"; controle scanner/lista por role; contador de presentes. | `src/pages/admin/eventos-checkin.tsx` (já implementado anteriormente; validado) |
| Sprint 5 | Correção de crash na aba Eventos; links para evento em `/membro` e perfil público; empty state; preservação de `startAt` ao editar ativação externa. | `src/pages/membro/index.tsx`, `src/pages/membros/perfil.tsx`, `backend/src/events/events.service.ts`, `src/pages/admin/overrides.tsx` |

### Pendências conscientes para próximas iterações
- Confirmação em modal antes de publicar evento.
- Select de timezone e máscara de moeda nos formulários.
- Persistir formulário de checkout no `sessionStorage` antes do login.
- Feedback tátil/sonoro no check-in.
- Prototipação do hub unificado `/admin/eventos-hub`.

---

## 8. Notas sobre documentação

- `../adrs/001-event-platform.md` é a fonte de verdade das decisões arquiteturais já implementadas.
- `../modules/events/CODE_MANUAL.md` deve ser atualizado à medida que os itens deste plano forem implementados.
- Este plano deve ser revisado e aprovado antes do início da implementação. Itens podem ser descartados, reordenados ou detalhados em novos documentos menores.

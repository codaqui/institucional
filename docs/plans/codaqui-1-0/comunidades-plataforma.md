<!-- AGENT-INDEX
purpose: Anexo do plano Codaqui 1.0.0 — evolução do subsistema D (ONG e Comunidades) em uma PLATAFORMA OFICIAL de comunidades: criação de comunidades por membros designados, mantenedores (Codaqui ou IES), nível Autônoma com split de doações via Stripe, multi-tenant enxuto e política de saída.
audience: Presidência, mantenedores, AI agents implementando as fases 1a/D2/6b.
status: extensão futura proposta, fora do recorte executável da Fase 1a. A 1a implementa somente Parceira/Integrada, selo e designations; Autônoma, mantenedores, D2 e split 6b exigem comando e plano próprios. RBAC founder @ program('communities') já foi ratificado para quando D2 for aprovada.
sections:
  - Origem — visão da presidência (2026-10-29)
  - Estado atual (o que existe hoje)
  - Níveis de comunidade — Parceira, Integrada, Autônoma
  - Modelo de dados (evolução da tabela communities)
  - Criação de comunidades (proposta → aprovação → nascimento)
  - Mantenedores (maintainerType codaqui | entity)
  - Doações com split — design e recomendação
  - Contabilização mínima e extrato (como NÃO misturar com a caixa da Codaqui)
  - Multi-tenant — onboarding enxuto no build matrix
  - Governança — selo, responsável, validade, política de saída
  - Fases e encaixe (1a / D2 / 6b)
  - Riscos e mitigações
  - Pontos abertos
related-docs:
  - docs/plans/codaqui-1-0/README.md — plano-mãe 1.0.0 (subsistema D, Fase 1a, subsistema H)
  - docs/adrs/004-multisite-communities.md — whitelabel legado (superseda pela ADR 011; permanecem o padrão de segregação Stripe/ledger)
  - docs/adrs/011-frontend-astro-multi-tenant-pages.md — build matrix atual (multi-tenant por tenant no Cloudflare Pages)
  - docs/adrs/003-club-business-pj.md — CLUB Business (Empresa Amiga; padrão de segregação por metadata)
  - docs/plans/multisite/README.md — plano legado substituído (mantido para histórico)
  - backend/src/stripe/stripe.service.ts — checkout + webhook atuais (metadata.communityId)
  - backend/src/ledger/ledger.service.ts — contas por projectKey, community-balances
  - frontend/tenants.config.mjs — fonte estática do build matrix
agent-protocol:
  - Este anexo ESTENDE o subsistema D do plano-mãe — campos novos são acréscimos à entidade communities já aprovada (Fase 1a ainda não implementada), não uma tabela paralela.
  - Princípio invariante: dinheiro de comunidade Autônoma NUNCA é receita da Codaqui — só a taxa de plataforma entra no tesouro-geral. A conta repasse é passivo ("valores de terceiros"), com conciliação por fórmula.
  - Não implementar Stripe Connect sem ADR própria e análise regulatória (ver Riscos).
  - Todo o design segue os padrões do monorepo: TypeORM uuid, audit, roles guard, snapshot estático, paginação padrão (AGENTS.md).
-->

# Plataforma de Comunidades — sistema oficial (evolução do subsistema D)

> **Origem:** visão da presidência (2026-10-29) — hoje as comunidades são **dados estáticos** (config + dados de apoio); a direção é um **sistema oficial**: comunidades podem ser **criadas por membros específicos** (proposta → aprovação da diretoria), têm **mantenedores** (a própria Codaqui OU uma IES cadastrada) e ganham **split de pagamentos via Stripe** no nível **Autônoma** — usam a plataforma e a rede para receber doações mantendo sua própria estrutura jurídica/contábil.
>
> Este anexo estende o [subsistema D do plano-mãe](README.md#d-ong-e-comunidades--níveis--selo-codaqui) e se apoia no [subsistema H](README.md#h-codaqui-universitário-adicionado-2026-10-29). O plano-mãe e [fase-1a.md](fase-1a.md) delimitam o que está autorizado agora; este anexo não autoriza antecipar campos ou fluxos futuros.

## Estado atual (o que existe hoje)

| Camada | Estado | Onde |
|---|---|---|
| Cadastro de comunidades | 6 comunidades **hardcoded no frontend**, sem tabela no banco | `frontend/src/data/communities.ts` |
| Sites whitelabel/portal | 3 tenants no build matrix + CamposTech no portal, com doações e transparência ativas | `frontend/tenants.config.mjs`, `frontend/src-tenants/`, `comunidades/<slug>/` |
| Doações por comunidade | Checkout Stripe com `metadata.communityId` (string livre — qualquer valor é aceito hoje) | `backend/src/stripe/stripe.controller.ts:150` |
| Caixa por comunidade | Conta virtual no ledger por `projectKey` = slug; `/ledger/community-balances` multi-tenant nativo | `backend/src/ledger/ledger.service.ts:54` |
| Selo / níveis / responsável | **Não existem** — previstos apenas no design (subsistema D) | — |
| Eventos de comunidade | Integradas usam `managed_events` + fontes externas no snapshot | `static/events/`, ADR 001 |

**Gap central:** não há entidade `communities` no banco, não há processo de criação/governança, e o dinheiro de qualquer "comunidade" (inclusive uma inexistente) cai no ledger via `metadata.communityId`. A plataforma formaliza isso.

## Níveis de comunidade

O subsistema D aprovou 2 níveis (**Parceira**, **Integrada**). Acrescenta-se o terceiro:

| Privilégio | **Parceira** (default) | **Integrada** | **Autônoma** |
|---|---|---|---|
| Listagem pública em `/comunidades` | ✅ | ✅ | ✅ |
| **Selo Codaqui** elegível | ✅ | ✅ | ✅ |
| Eventos | Listados via fontes externas (hoje) | Eventos próprios na plataforma (`managed_events`, fonte `internal`) | Eventos próprios na plataforma (mesma base) |
| Site whitelabel | ❌ (só card no portal) | ✅ domínio próprio (projeto Pages) | ✅ opcional — **subdomínio `<slug>.codaqui.dev`** ou domínio próprio |
| Caixa / doações | Sem caixa própria — não é alvo de doação direcionada | Caixa **no ledger da Codaqui** (conta virtual separada; Codaqui é agente fiscal — dinheiro no CNPJ da associação, transparência pública) | Doações com **split/repasse**: a doação é da comunidade (estrutura jurídica dela); Codaqui retém **taxa de plataforma configurável %**; o grosso é repassado |
| Responsável (designation `responsible` @ `community`) | Recomendado | Obrigatório para selo/painel; tenants legados podem aguardar mapeamento | Obrigatório + entidade beneficiária (CNPJ) e dados bancários |
| Responsabilidade jurídica | Nenhuma vinculação — parceria pontual | Codaqui responde fiscal/contabilmente pelo caixa movimentado | **A comunidade responde pelos próprios atos e tributos**; Codaqui é mera facilitadora (repasse + taxa). Termo de responsabilidade obrigatório |
| Onboarding de dinheiro | — | Automático (conta criada no 1º webhook) | Só após aceite do termo + validação de beneficiário (KYC próprio — ver Riscos) |

**Regras de transição:** toda comunidade nasce **Parceira**. Evolução de nível é decisão da diretoria (admin), auditada — mesmo padrão do subsistema D ("fila de solicitações de selo, mudança de nível"). Uma comunidade pode ser **Integrada sem selo** e **Autônoma com ou sem site**.

## Modelo de dados

A migration 028 da 1a contém somente o modelo aprovado no plano-mãe: identidade pública completa (`slug`, `name`, `description`, `emoji`, `logoUrl`, `location`, `founded`, `links`, `socialProfiles`, `tags`), `level` Parceira/Integrada, lifecycle, selo e site. Não contém `responsibleMemberId`, `isActive`, `maintainer*`, `payout*` ou `platformFeePct`.

Extensões por fase, quando expressamente autorizadas:

- **D2:** `level='autonoma'` (somente enum, sem split), `proposedById/At`, `approvedById/At`, `maintainerType`, `maintainerEntityId` e trilha de designação. `maintainerEntityId` ganha FK somente depois que `entities` existir.
- **6b:** `platformFeePct`, `payoutData`, aceite do termo e demais campos estritamente necessários ao repasse.

**Sem tabela nova para propostas** — uma comunidade `status='proposed'` já é a proposta. O proponente autorizado terá designation `founder` @ `program('communities')`, não role `fundador_comunidade`; ao ser aprovado, recebe `responsible` @ `community` em vez de uma coluna de vínculo.

**Validação no checkout:** na 1a, `communityId` só é aceito para comunidade `active` e Integrada. Autônoma só passa a receber direcionamento quando a 6b estiver implementada; Parceira nunca recebe direcionamento.

## Criação de comunidades (fluxo)

1. Membro com designation `founder` @ `program('communities')` (ou diretoria) abre a proposta: nome, slug, descrição, nível pretendido, mantenedor proposto, responsável indicado → registro `status='proposed'` (audit).
2. Diretoria avalia no admin (`/admin/comunidades`, fila de propostas — mesmo pattern da fila de selo) → aprova → `status='active'`, `level='parceira'` (sempre), `approvedById` (audit). Reprovação exige motivo (audit).
3. Proponente recebe designation `responsible` @ `community` por default (diretoria pode trocar).
4. Crescimento de nível é sempre por solicitação futura à diretoria — nunca automático.

## Mantenedores (`maintainerType`)

- **`'codaqui'` (default)** — a associação é mantenedora: caixa no ledger da Codaqui (Integrada), selo fiscal implícito. É o único tipo permitido para Parceira/Integrada.
- **`'entity'`** — uma entidade cadastrada é mantenedora: `maintainerEntityId` → `entities.id`. O caso previsto é a **IES** (`instituicao_ensino`, cadastro do subsistema C/H — ponte com o Codaqui Universitário), mas o modelo admite outras entidades (ex.: ONG que abriga a comunidade). A designation é da diretoria (`maintainerDesignatedById`, audit) — **não** é self-service da entidade.
- **Dependência de fase:** `entities` existe só a partir da Fase 4 → campos e seletor de mantenedor entram apenas na migration de D2, com versão backend própria definida no plano dessa fase.
- **Relação com Autônoma:** uma Autônoma tem mantenedor ≠ Codaqui — seja uma IES/entidade (`maintainerType='entity'`), seja a **própria entidade jurídica da comunidade** (cadastrada em `entities` como type `'ong'`/outro, com CNPJ dela, e vinculada como mantenedora). O `payoutData` (beneficiário do repasse) deve ser coerente com essa entidade.

## Doações com split — design e recomendação

### As duas opções

**A. Stripe Connect (destination charges)** — a Codaqui vira plataforma Stripe: cada Autônoma abre uma *connected account* (Express), o checkout da Codaqui cria o charge com `transfer_data.destination` e o split acontece na liquidação.

**B. Split manual ("cota"/repasse programático pós-webhook)** — o fluxo atual não muda: o charge cai na conta Stripe da Codaqui (`metadata.communityId`), o webhook lança no ledger em uma **conta repasse** da comunidade; periodicamente a diretoria transfere o saldo disponível para a conta bancária da comunidade (PIX, fora do Stripe), com comprovante anexado ao lançamento. A taxa de plataforma (%) é retida no ato do webhook.

### Recomendação: **B (split manual) na Fase 6b**, Connect como evolução opcional (1.1.0+)

| Critério | A. Connect | B. Split manual |
|---|---|---|
| Onboarding da comunidade | KYC Stripe Express (documentos, dias–semanas, churn alto) | Conta bancária + CNPJ + termo aceito — dias |
| Mudança no código | Nova integração Connect (contas, transfers, capabilities, webhooks de account) | **Quase zero** — reusa checkout, webhook e ledger atuais |
| Responsabilidade por chargeback | Plataforma (Codaqui) responde junto à Stripe; reservas obrigatórias | Merchant of record continua sendo a Codaqui (charge é na conta dela) — o risco é gerido por reserve + termo (ver Riscos) |
| Risco regulatório (BR) | Facilitação de pagamentos a terceiros pode se aproximar de **subadquirente** (BACEN) — exige análise jurídica prévia | Repasse pontual amparado em termo de cooperação — análise contábil, não de arranjo de pagamento |
| Custo | Taxas por payout de conta Express + possíveis tarifas de plataforma | Custo do PIX (irrisório) |
| Transparência/auditoria | Split visível no Stripe; ledger externo ao financeiro da Codaqui | **Trilha completa no ledger da Codaqui** (valor central da associação) + comprovantes |
| Liquidação | Automática (T+2 na conta da comunidade) | Manual/mensal (diretoria) |

O split manual vence porque o custo do KYC e da conformidade regulatória do Connect não se paga com o volume esperado de Autônomas no 1.0.0, e porque a alternativa reusa 100% da esteira atual — coerente com o princípio "reaproveitar antes de criar". **Critérios de virada para Connect (futuro):** >5 Autônomas ativas com repasses mensais recorrentes, ou demanda por liquidação automática, ou redução do risco de chargeback pós-repasse como prioridade — decisão com ADR própria.

### Fluxo do split manual (Autônoma)

1. **Habilitação:** comunidade `level='autonoma'` + termo de responsabilidade aceito (`payoutAgreementAcceptedAt`) + `payoutData` validado pela diretoria (CNPJ confere com a entidade mantenedora, chave PIX) → flag `payoutEnabled` (implícita no status; audit).
2. **Doação:** checkout normal (`communityId=<slug>`, embedded; regras atuais de login/limite). Descrição no Stripe: "Apoio à Comunidade X" — a doação é juridicamente da comunidade.
3. **Webhook** (`checkout.session.completed` / `invoice.payment_succeeded`) → ledger, **conta repasse** da comunidade:
   - `stripe_income → Comunidade: <slug>` — grosso (referenceId `stripe-pi:<pi>`) — **passivo, não é receita**
   - `Comunidade: <slug> → stripe_fees` — taxa do meio de pagamento (**a comunidade arca** com a taxa Stripe do próprio charge — o fee já sai da conta destino no código atual, sem mudança)
   - `Comunidade: <slug> → tesouro-geral` — **taxa de plataforma** (`platformFeePct`, referenceId `platform-fee:<slug>:<pi>`) — **única receita da Codaqui no fluxo**
4. **Repasse:** admin/finance-analyzer gera o repasse mensal (botão no admin, dupla conferência): saldo disponível = donations − stripe fees − taxa de plataforma − repasses anteriores − chargebacks; transferência PIX para o `payoutData`; lançamento `Comunidade: <slug> → Repasse Externo: <slug>` (conta EXTERNAL) com `referenceId community-payout:<slug>:<n>` + **comprovante URL** (mesmo pattern do `StorageModule` — link externo validado, ex.: Drive).
5. **Chargeback pós-repasse:** lançamento de débito `Comunidade: <slug> → stripe_income`, referenceId `community-chargeback:<slug>:<disputeId>` — a comunidade fica devendo; compensa no próximo repasse (termo garante).
6. **Reserva:** repasse nunca zera a conta — mantém-se saldo mínimo configurável (proposta: maior entre R$ 100 e 10% do arrecadado nos últimos 90 dias) como colchão de chargebacks.
7. **Extrato público:** a transparência da comunidade (`/comunidades/<slug>` + whitelabel) mostra a conta repasse inteira — entradas, taxas, repasses com link de comprovante — reusa `TransactionTable`/`TransactionDetailDialog`; classificação por prefixo ganha `platform-fee:`, `community-payout:` e `community-chargeback:` em `frontend/src/lib/transaction.ts`; R1 (export CSV por datas) já cobre a prestação de contas ao beneficiário.
8. **Assinaturas recorrentes:** funcionam (a invoice paga alimenta a mesma conta repasse); o cancelamento é feito pelo doador no portal da Codaqui (padrão atual). Repasse mensal consolida ciclo fechado.

### Contabilização mínima — como NÃO misturar com a caixa da Codaqui

- **Mesma ledger, contas distintas, natureza distinta.** A conta `Comunidade: <slug>` de uma Autônoma é uma **conta de repasse (passivo — "valores de terceiros a recolher")**, separada das contas de caixa da Codaqui (`tesouro-geral` e carteiras Integradas). Nenhum lançamento dela alimenta receita da associação — exceto a taxa de plataforma (crédito em `tesouro-geral`).
- **Conciliação por fórmula (automática):** saldo repasse = Σ doações − Σ stripe fees − Σ taxa de plataforma − Σ repasses − Σ chargebacks. Um job de reconciliação mensal confere ledger × Stripe balance × extrato bancário; divergência gera alerta no admin financeiro. O dinheiro transita fisicamente pela conta bancária da Codaqui (conta Stripe única), mas contabilmente é **transitório** — procedimento a ser formalizado com o contador da associação **antes da Fase 6b** (gate — ver Riscos 3).
- **O que entra como receita da Codaqui:** apenas `platform-fee:*`. O grosso é passivo até o repasse; após o repasse, sai do patrimônio.
- **Integradas não mudam nada:** caixa no ledger sob guarda da Codaqui, como hoje (decisão 6 do AGENTS.md — dinheiro só na ledger financeira).

## Multi-tenant — onboarding enxuto

Hoje cada tenant exige edição manual em **3 lugares** (`frontend/tenants.config.mjs` + matrix em `deploy-astro.yml` + `pr-check.yml`) + criação do projeto Pages + DNS. Proposta para a plataforma:

1. **`tenants.config.mjs` vira gerado**: novo `frontend/scripts/sync-tenants.mjs` lê o snapshot `static/communities/index.json` (comunidades com `siteEnabled`) e gera o config + matrix JSON, commitado por workflow (mesmo pattern de `sync-event-snapshots.yml`). Matrix dos workflows passa a ser emitida por um job de setup que lê o arquivo gerado — fim do "espelhar em 2 lugares" manual (o anti-pattern já registrado no AGENTS.md passa a ser automatizado).
2. **Projeto Pages** continua sendo criação manual no Cloudflare (1 projeto por tenant — limite generoso) — checklist no runbook; `api_token` do Wrangler já é por projeto.
3. **Domínio:**
   - **Integrada / Autônoma com marca própria:** domínio próprio da comunidade (CNAME/NS — padrão atual, `SITE_URL` por tenant no build).
   - **Autônoma enxuta (default):** **subdomínio `<slug>.codaqui.dev`** — a zona já está na Cloudflare; anexar o subdomínio como custom domain do projeto Pages é operação interna, **zero trabalho de DNS pela comunidade** e selo claro de "comunidade na plataforma" (resolve também o risco 7 — domínio sob zona da Codaqui facilita suspensão).
4. **Conteúdo:** continua versionado em `comunidades/<slug>/` (config/blog/docs — read-only via symlink, decisão 4); o app thin em `frontend/src-tenants/<slug>/` pode partir de um template copiável (`src-tenants/_template/`).
5. **Gates inalterados:** build tenant + `tenant-urls` (R7); og:url/canonical/sitemap corretos por `SITE_URL` (build-time). Community card no portal codaqui sai do snapshot (nível + selo + badges), sem rebuild manual de dados.

**Tempo-alvo de onboarding de uma comunidade com site:** < 1 dia (hoje: 1–2h de trabalho técnico + coordenação de DNS; novo fluxo remove a coordenação de DNS no caso subdomínio).

## Governança

### Selo, responsável e validade (inalterado do subsistema D)

Solicitação pelo responsável logado → diretoria avalia checklist → concede (`sealed`, validade **1 ano**) → renovação por reavaliação. Selo é **reputacional** — independente de nível e de quem mantém a caixa (uma Autônoma pode exibir o Selo Codaqui). Exibição pública: `/comunidades`, cards e OG (snapshot).

### Política de saída (offboarding)

Acionada pela própria comunidade (pedido) ou pela diretoria (descumprimento — via `suspended` primeiro):

1. **Aviso:** notificação com 30 dias de antecedência ao responsável (e-mail transacional, módulo `notifications`).
2. **Efeitos imediatos:** `status='exited'` (audit) → selo revogado; doações direcionadas desligadas (checkout recusa `communityId`); site despublicado no próximo sync (tenant removido do `tenants.config` gerado; domínio/subdomínio destacado); eventos futuros da comunidade congelados/cancelados.
3. **Dinheiro:**
   - **Autônoma:** repasse final é **gate obrigatório** antes do `exited` (conta repasse zera; comprovante arquivado).
   - **Integrada:** saldo remanescente — destino definido **no termo de entrada** (proposta: vira doação ao tesouro-geral, salvo acordo escrito de devolução).
4. **Dados e histórico:** extrato final exportado (R1) e entregue ao responsável; **registros financeiros preservados** no ledger (obrigação legal — a ledger não se desfaz); eventos/certificados já emitidos permanecem válidos e verificáveis; PII de participantes não ligada a obrigação é minimizada; snapshot público removido na próxima geração.
5. **Reversibilidade:** `exited` ≠ delete — reativação pela diretoria restaura nível/selo anterior (audit), exceto selo vencido (reavaliação).

## Fases e encaixe

| Entrega | Conteúdo | Versão backend | Dependências |
|---|---|---|---|
| **Fase 1a** (recorte autorizado) | `communities` com 2 níveis, lifecycle, selo, designations, validação de `communityId`, seed integral e snapshot. Três tenants + CamposTech migram Integradas sem responsável fabricado; CamposTech preserva doações/transparência com `siteEnabled=false`; não há proposta pública, mantenedor ou split | **0.12.0** | plano executável em [fase-1a.md](fase-1a.md) |
| **Fase D2** (futura, comando próprio) | Fluxo proposta→aprovação com designation `founder` + seletor de mantenedor IES + painel do responsável | minor própria, fixada no plano de D2 | entities (Fase 4); E1; P1/P2 |
| **Fase 6b** (futura, comando próprio) | Split manual, conta repasse, taxa, repasses, chargeback, extrato e termo | minor própria, fixada no plano de 6b | 1a + D2; P1/P2; termo jurídico; validação com contador |

**Onde NÃO entra:** Stripe Connect **não** é dependência do 6b (split manual usa a conta Stripe atual) — KYC das comunidades deixa de ser risco de cronograma; se aprovado no futuro, entra como incremento com ADR própria. **C4P continua fechando a 1.0.0** — o 6b é infraestrutura da rede de comunidades, não atrasa a feature mais solicitada; alternativa registrada: se a presidência preferir manter o 1.0.0 mais enxuto, o 6b pode escorar para **1.1.0** sem quebrar nenhuma dependência (decisão da presidência no plano de implementação).

## Riscos e mitigações

| # | Risco | Mitigação |
|---|---|---|
| 1 | **KYC/LGPD** — split manual elimina o KYC Stripe, mas dados bancários do beneficiário são dados pessoais | `payoutData` (jsonb) acessível só a admin; audit log de toda leitura/escrita; inclusão no inventário LGPD (P1/`docs/modules/privacy/`); retenção e exclusão vinculadas ao offboarding. Se um dia houver Connect, o KYC passa a ser da Stripe (compartilhamento formalizado na política) |
| 2 | **Chargebacks em split** — o merchant of record é a Codaqui; chargeback após o repasse deixa a associação no prejuízo se a comunidade desaparecer | Reserva mínima (configurável); repasse mensal (janela de disputa ~120d parcialmente coberta); termo de responsabilidade com direito de débito em repasses futuros (`community-chargeback:*`); limites de valor/velocidade já existentes no checkout; diretoria pode congelar repasses de comunidade de risco |
| 3 | **Impostos** — o repasse mal estruturado pode ser lido como receita bruta da Codaqui (e a associação **não é contadora das Autônomas**) | Termo de responsabilidade: cada Autônoma responde pelos próprios tributos sobre o recebido; formalização do repasse com causa (convênio/termo de cooperação) validada **com o contador da associação antes do 6b (gate)**; lançamentos com descrição e referenceId explícitos (`community-payout:*`) para audição externa |
| 4 | **Custo Connect** (se adotado no futuro) | Taxas por payout de conta Express + reservas Stripe; análise regulatória (arranjo de pagamento/subadquirente — BACEN) **antes** de qualquer implementação; critérios de virada objetivos na seção de split |
| 5 | **Mistura patrimonial** — dinheiro de terceiros transita pela conta bancária da Codaqui | Conta repasse (passivo) com conciliação mensal automática (ledger × Stripe × banco); extrato público por comunidade; procedimento contábil documentado (procedimento do finance-analyzer) |
| 6 | **Multi-tenant em escala** — N projetos Pages/matrix → CI longo; onboarding manual de projeto | `sync-tenants.mjs` remove edição manual; gate de reavaliação a partir de 6+ tenants (consolidação de builds ou conta paga Cloudflare) |
| 7 | **Reputação/conduta** — Autônoma opera sob `codaqui.dev` | Domínio/subdomínio sob zona da Codaqui (suspensão imediata); Código de Conduta aplicável; selo revogável; fluxo `suspended` antes de `exited` |
| 8 | **Gargalo da diretoria** — propostas, selos e repasses dependem de aprovação manual | Filas únicas no admin (`/admin/comunidades`: propostas, selo, nível, repasses) com SLA visível; métricas no dashboard |

## Pontos abertos (decisão da presidência/diretoria)

1. **Taxa de plataforma default** (`platformFeePct`): proposta 10% (piso 0% p/ comunidades apoiadas, teto 20%) — definir antes do 6b.
2. **Política de reserva** dos repasses: valores exatos (proposta: maior entre R$ 100 e 10% dos últimos 90 dias).
3. **Termo de responsabilidade** (texto jurídico) — versão 1.0 + fluxo de aceite; inclui destino do saldo de Integradas na saída.
4. **6b antes ou depois do C4P** — decisão de release; não é dependência do 1.0.0 e a versão backend será definida no plano próprio.
5. **Selo para Autônomas** — confirmar que o Selo Codaqui pode ser exibido por comunidades fora do guarda fiscal da associação (proposta: sim, é reputacional).
6. **Momento de D2** — confirmar o empacotamento após a Fase 4; a criação pública não será absorvida pela 1a.

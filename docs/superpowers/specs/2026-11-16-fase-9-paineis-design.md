<!-- AGENT-INDEX
purpose: Design executável da Fase 9 — UX de /membro e admin, prévia de privacidade, exportação LGPD e solicitação revisada de exclusão de conta.
audience: Presidência, diretoria/canal de privacidade, mantenedores, implementadores e revisores.
status: Concluído e publicado em v1.2.0-backend/migration 051 (PR #654, 2026-11-17); evidência de revisão jurídica/da diretoria não localizada nesta consolidação.
sections:
  - Intenção e evidências
  - Objetivos, não objetivos e restrições
  - Abordagens e decisões de escopo
  - Design de /membro
  - Conta, privacidade e exportação
  - Solicitação de exclusão
  - Navegação admin
  - Deep links e acessibilidade
  - Testes, gates e rollout
related-docs:
  - docs/plans/pos-1-0/README.md — Fase 9 no roadmap.
  - docs/plans/frontend-jornadas/README.md — inventário e backlog de UX.
  - docs/mockups/membro-proposta.html — direção visual escolhida para /membro.
  - docs/mockups/admin-proposta.html — direção visual escolhida para o admin.
  - docs/modules/privacy/README.md — gates de privacidade e revisão jurídica.
  - docs/modules/privacy/treatments.md — inventário de dados e retenção.
  - docs/adrs/011-frontend-astro-multi-tenant-pages.md — arquitetura preservada.
agent-protocol:
  - Preservar framework, layouts, tokens e contratos existentes; somente os endpoints de privacidade explícitos são novos.
  - Após aprovação, gerar plano TDD próprio e atualizar os planos vivos ao implementar.
  - Produzir ADR 019 para exportação e solicitação de exclusão; revisão jurídica/da diretoria é gate antes de main.
-->

# Fase 9 — UX dos painéis e autosserviço de privacidade

## 1. Intenção e por quê

A Fase 9 reduz a carga de navegação dos painéis e completa o autosserviço de privacidade. Em `/membro`, abas e sub-abas com o mesmo peso visual e ações repetidas dificultam encontrar informações. No admin, nove grupos, itens órfãos e nomes divergentes prejudicam a localização das tarefas. Em Conta e privacidade, faltam uma prévia das escolhas públicas, exportação dos dados do titular e uma maneira rastreável de solicitar exclusão.

A presidência escolheu o **recorte completo dos mockups**, com os limites ratificados abaixo. A fase passa a incluir backend de privacidade, migration e ADR; não é mais uma fase exclusivamente de frontend.

## 2. Evidências revalidadas em 2026-11-16

- O rótulo “SortCoins e reembolsos” já foi corrigido para “Reembolsos”; não será retrabalhado.
- `/membro` tem quatro seções, Tabs internas em Participação/Financeiro e um terceiro nível em Eventos.
- A visão geral mostra valores da página corrente de doações/assinaturas e ações que repetem os destinos financeiros.
- Doações e assinaturas têm paginação independente; reembolsos e projetos têm cargas próprias. Não existe API agregada nem paginação global cronológica.
- `MyDataTab` já possui visibilidade por campo, opt-in promocional e reativação confirmada de supressão. Não possui prévia, exportação ou solicitação de exclusão.
- `JwtStrategy` já rejeita membro inativo; a exclusão revisada não altera autenticação nem executa anonimização automática.
- `AppNavIsland` possui nove grupos, com Mentoria/Universitário/C4P fora dos domínios mais claros e os rótulos “VirtualCoins”/“Carteira” divergentes.

## 3. Objetivos, não objetivos e anti-objetivos

### Objetivos

1. Manter somente quatro abas principais em `/membro`; seletores internos usam chips com `aria-pressed`.
2. Reunir Participação e Apoio/financeiro em superfícies únicas com “Tudo” e filtros por tipo.
3. Remover da visão geral resumos/ações financeiras duplicados, sem inventar totais indisponíveis.
4. Adicionar prévia ao vivo da visibilidade, exportação JSON autenticada e solicitação revisada de exclusão.
5. Reorganizar o admin em seis grupos, preservando busca, collapse, item ativo e autorização.
6. Preservar deep links antigos e cobrir navegação, privacidade, permissões e concorrência com testes.

### Não objetivos

- Não construir paginação cronológica global entre tipos de histórico.
- Não alterar Astro, React, MUI, Tailwind, layouts, tokens, logo ou cores do Design System.
- Não incluir “Próximos passos” dinâmicos de mentoria/horas nem contadores numéricos na sidebar.
- Não executar exclusão, anonimização ou desativação automaticamente ao solicitar exclusão.
- Não mudar Stripe, regras financeiras, roles, designations, snapshots ou fluxos de emissão/cancelamento.
- Não exportar segredos, tokens OAuth, dados de terceiros ou logs internos que não sejam necessários ao titular.

### Anti-objetivos

- Não trocar excesso de abas por excesso de cards/chips sem hierarquia.
- Não esconder registros paginados nem apresentar uma página corrente como total geral.
- Não chamar de “exclusão concluída” uma simples solicitação ainda pendente.
- Não refatorar monólitos ou criar abstrações genéricas sem relação com esta fase.

## 4. Abordagens e decisões de escopo

1. **Mockups completos — escolhida.** Um nível de abas, chips, superfícies agregadas, seis grupos admin e privacidade completa.
2. **Hierarquia mínima — rejeitada.** Conservaria sub-abas e redundância.
3. **Fases separadas — rejeitada.** A revisão integrada mantém as jornadas coerentes.

Decisões posteriores ao builder check:

- “Próximos passos” dinâmicos ficam fora; o Início mantém os cards atuais e o reembolso pendente condicional.
- Não há contadores de pendências na sidebar.
- Conta e privacidade recebe o redesign completo.
- A exclusão é uma **solicitação revisada**, não anonimização imediata.
- O valor canônico do filtro Reembolsos passa a ser `tab=reimbursements`; `tab=wallet` permanece como alias legado.

## 5. Design de `/membro`

### 5.1 Abas principais

1. **Início** (`section=overview`);
2. **Participação** (`section=participation`);
3. **Apoio e financeiro** (`section=finance`);
4. **Conta e privacidade** (`section=account`).

Os valores das seções não mudam. As abas continuam `scrollable` no mobile. A aba selecionada usa sublinhado por borda em pseudo-elemento associado a `aria-selected`; cor/background nunca são o único indicador.

### 5.2 Início sem duplicação financeira

- Permanecem o perfil e os atalhos de próximos eventos, certificados e Minhas horas.
- Saem “Doações nesta página” e “Assinaturas ativas nesta página”.
- “Reembolsos pendentes” aparece somente quando há pelo menos uma solicitação pendente.
- “Ver histórico de doações” e “Ver assinaturas recorrentes” viram **Abrir apoio e financeiro** (`section=finance&tab=all`).
- Permanecem “Minha carteira de moedas” e “Solicitar Reembolso”.
- Não se calcula “apoio no ano” nem outro total novo com dados de apenas uma página.

### 5.3 Participação por chips

Filtros: **Tudo**, **Eventos**, **Certificados**, **Projetos**.

- **Tudo** (`tab=all`) apresenta blocos identificados de Eventos, Certificados e Projetos na mesma superfície. É agregação por tipo, não timeline global; cada bloco mantém dados, ações e empty states.
- **Eventos** (`tab=events`) apresenta somente eventos. Outro grupo de chips substitui as sub-abas: **Futuros**, **Comprei para outros**, **Histórico**.
- **Certificados** e **Projetos** isolam o bloco correspondente. O parâmetro `certificate` continua selecionando um certificado.
- Projetos de participante e mentorados permanecem no bloco Projetos, com seus carregamentos atuais.
- “Minhas horas” continua como link próprio.

“Tudo” refere-se aos tipos de participação; o bloco Eventos conserva seu filtro de status selecionado.

### 5.4 Apoio e financeiro por chips

Filtros: **Tudo**, **Doações**, **Assinaturas**, **Reembolsos**.

- O título **Histórico de apoio** explica a reunião dos três tipos.
- **Tudo** (`tab=all`) apresenta blocos identificados de cada tipo, preservando cards, ações, empty states e paginações atuais.
- Cada filtro específico mostra somente seu bloco e sua paginação.
- Reembolsos usa `tab=reimbursements`; `wallet` é aceito como legado e reescrito na forma canônica.
- Não há ordenação global ou paginação entre tipos.
- Cancelamento de assinatura, solicitação de reembolso e atalho admin permanecem nos componentes existentes.

### 5.5 Componentização

- Criar `FilterChipGroup` para Participação, Eventos e Financeiro, com botões/Chips MUI, `aria-pressed` e nome acessível de grupo.
- Reutilizar os componentes atuais de doações, assinaturas, reembolsos, eventos, certificados e projetos, sem duplicar fluxos.
- Extrair blocos apenas para evitar condicionais repetidas ou duplicação no Sonar.

## 6. Conta, privacidade e exportação

### 6.1 Organização visual e prévia ao vivo

`MyDataTab` passa a apresentar:

1. Dados da conta (nome, GitHub e e-mail privado);
2. Visibilidade por campo e botão Salvar;
3. Prévia ao vivo;
4. Preferências de e-mail;
5. Exportar meus dados;
6. Solicitar exclusão.

Em desktop, visibilidade e prévia podem ocupar duas colunas; no mobile ficam empilhados. A prévia usa o usuário autenticado e o estado **ainda não salvo** dos switches, mostrando avatar, nome, handle e a lista dos campos atualmente habilitados. Ela deixa claro que é uma representação das permissões, não uma cópia completa da página pública. Mudanças atualizam a prévia imediatamente; a latência de refresh/build do perfil real permanece explicada.

“Preferências de e-mail” aponta para o card promocional existente. Opt-in, descadastro e reativação confirmada continuam usando `PATCH /members/me/marketing-consent`, sem alterar transacionais.

### 6.2 Exportação dos dados do titular

Nova rota autenticada:

`GET /members/me/export`

- Retorna JSON UTF-8 com `Content-Type: application/json; charset=utf-8` e `Content-Disposition: attachment` com nome `codaqui-dados-<handle>-<data>.json`.
- Rate limit dedicado de 3 exportações por hora por membro.
- O frontend usa `authFetch`, `Blob`, URL temporária e revogação após o download; erro não gera arquivo vazio.
- O documento contém `schemaVersion: 1`, `generatedAt`, `subject` e seções de dados diretamente vinculados ao titular.
- Um audit operacional registra a exportação com actor/target e versão do schema, nunca o conteúdo exportado.

Cobertura do schema 1:

| Seção | Conteúdo do próprio titular |
|---|---|
| `account` | IDs necessários à portabilidade, GitHub ID/handle, nome, e-mails, avatar, bio, LinkedIn, roles, entrada, atividade, visibilidade e consentimentos |
| `designations` | Vínculos, alvos, papéis, vigência e concessão/revogação do próprio membro |
| `events` | Inscrições do próprio participante, presença, concessão e certificados; compras para terceiros aparecem sem nome/e-mail dos terceiros |
| `mentorship` | Disponibilidade/perfil de mentor e sessões; como mentor, omite identidade de mentorandos; como mentorando, inclui os próprios dados |
| `hours` | Entradas, aprovações e declarações do próprio membro |
| `projects` | Participações/mentorias, horas e comprovantes do próprio membro |
| `finance` | Doações, assinaturas, reembolsos e movimentações SortCoins diretamente vinculadas, sem credenciais Stripe |
| `c4p` | Propostas e votos do próprio membro, sem dados de outros palestrantes/avaliadores |
| `communications` | Opt-ins, supressões e metadados de comunicações endereçadas ao titular, sem tokens hash ou conteúdo interno desnecessário |

O JSON inclui listas `coverage` e `exclusions` legíveis. Ficam fora tokens OAuth/JWT, segredos, dados de terceiros, logs técnicos internos, IPs e payloads de auditoria que possam conter dados de outros atores. IDs internos só entram quando necessários para relacionar os registros do próprio titular.

A implementação usa um serviço de privacidade dedicado e repositories TypeORM; não faz dump indiscriminado do banco nem expõe query genérica.

## 7. Solicitação revisada de exclusão

### 7.1 Modelo e invariantes

Migration **051** cria `account_deletion_requests`:

- `id` UUID;
- `memberId` UUID FK;
- `status`: `pending | completed | canceled`;
- `requestedAt`;
- `reviewedByMemberId` UUID nullable;
- `reviewedAt` nullable;
- `reviewNote` texto opcional;
- `createdAt`/`updatedAt`.

Uma constraint parcial impede mais de uma solicitação `pending` por membro. O registro é histórico e não usa delete físico. Solicitar não muda `members.isActive`, dados pessoais, designations ou sessões.

### 7.2 API do membro

- `GET /members/me/deletion-request` — solicitação mais recente ou `null`;
- `POST /members/me/deletion-request` — cria ou retorna a pendente existente (idempotente);
- `POST /members/me/deletion-request/cancel` — cancela somente a própria solicitação pendente.

A UI mostra estado pendente, data e opção de cancelar. O diálogo inicial explica que a diretoria revisará o pedido e que obrigações legais/governança podem exigir preservação de registros. Não usa linguagem de remoção imediata.

### 7.3 Revisão admin

- `GET /admin/members/deletion-requests` — lista paginada no padrão do projeto, com filtro por status;
- `POST /admin/members/deletion-requests/:id/complete` — admin conclui uma pendente após executar o offboarding manual.

A fila fica na página existente de Membros (`/admin`), sem rota ou grupo novo. Cada item mostra solicitante, data, status e nota. Concluir exige `ModalConfirm` com declaração explícita de que o offboarding foi realizado; a conclusão não altera o membro automaticamente.

Mutações gravam audit de governo com antes/depois, ator e alvo. Exportação grava audit operacional. Não há e-mail novo nesta fase.

## 8. Navegação admin

A sidebar mantém identidade, chips de papel, busca, grupos expansíveis, `aria-current`, filtro por role/designation e logout. Admin vê tudo; grupos sem itens visíveis continuam ocultos. Não há badges/contadores.

| Grupo | Itens e destinos |
|---|---|
| **Início** | Painel e pendências `/membro`; Minhas horas `/membro/horas`; Editar perfil `/membro/editar` |
| **Comunidades e eventos** | Minha comunidade `/admin/comunidades`; Eventos `/admin/eventos`; Eventos externos `/admin/overrides`; Check-in `/admin/eventos-checkin`; C4P `/admin/c4p` |
| **Pessoas e aprendizado** | Membros `/admin`; Horas `/admin/horas`; Gestão de mentoria `/admin/mentoria`; Minha mentoria `/membro/mentoria`; Universitário `/admin/universitario` |
| **Apoio e financeiro** | Recebimentos `/admin/recebimentos`; Pagamentos `/admin/pagamentos`; Reembolsos `/admin/reembolsos`; Fornecedores `/admin/fornecedores`; Livro-razão `/admin/lancamento`; Empresas apoiadoras `/admin/empresas`; Clube: sorteios `/admin/sorteios`; Clube: SortCoins `/admin/carteiras` |
| **Governança e transparência** | Diretorias `/admin/diretorias`; Assembleias `/admin/assembleias`; Entidades e parcerias `/admin/entidades`; Projetos de extensão `/admin/projetos`; Ver como o público vê `/transparencia` |
| **Sistema** | Anúncios `/admin/announcements`; E-mails e campanhas `/admin/emails`; Configurações `/admin/configuracoes` |

Regras:

- “Minha mentoria” é o destino do mentor; “Gestão de mentoria” é o destino admin. Permissões não mudam.
- “Ver como o público vê” usa as regras de Diretorias (admin ou diretor ativo).
- “VirtualCoins” desaparece; usa-se somente “SortCoins”.
- Sorteios e SortCoins permanecem links distintos no mesmo grupo.
- Perfis restritos podem ver apenas um item em um grupo, conforme a autorização atual.

## 9. Deep links e compatibilidade

A navegação usa `section`, `tab` e, para o filtro interno, `event`, com `history.replaceState`.

| URL | Resultado |
|---|---|
| `?section=participation` ou `tab=all` | Participação Tudo; Eventos em Futuros |
| `?section=participation&tab=events&event=future` | Eventos futuros |
| `?section=participation&tab=events&event=purchased` | Comprei para outros |
| `?section=participation&tab=events&event=history` | Histórico de eventos |
| `tab=future`, `tab=purchased`, `tab=history` | Aliases legados para os mesmos estados |
| `?section=participation&tab=certificates&certificate=<id>` | Certificado selecionado preservado |
| `?section=finance` ou `tab=all` | Histórico de apoio Tudo |
| `tab=donations`, `tab=subscriptions`, `tab=reimbursements` | Filtros específicos |
| `tab=wallet` | Legado → Reembolsos; reescrita canônica `reimbursements` |
| `?purchase=success` | Participação → Eventos → Futuros, com aviso de compra |

Valores inválidos caem no fallback seguro. A serialização não apaga `certificate`. Chips não criam entradas novas no histórico.

## 10. Acessibilidade e responsividade

- Somente as quatro áreas principais usam tabs/tabpanels; filtros internos usam botões com `aria-pressed`.
- O sublinhado ativo usa borda em pseudo-elemento, não somente cor/background.
- Tabs principais ficam em uma linha com rolagem horizontal; chips podem quebrar linha.
- A prévia tem nome/região acessível sem anunciar repetidamente textos não essenciais.
- Exportação e solicitação têm foco, loading, erro e confirmação visíveis; dialogs mantêm Esc/foco do padrão MUI.
- Busca/collapse da sidebar mantêm `aria-expanded`, `aria-controls` e item ativo.

## 11. Testes e critérios de aceite

### Frontend

- `member-navigation`: defaults, novos estados, aliases, `purchased`, `wallet`, certificado, compra e valores inválidos.
- `FilterChipGroup`: seleção, `aria-pressed`, nome do grupo e callback correto.
- `/membro`: quatro tabs e nenhuma sub-aba; filtros isolam/agregam blocos; ações e paginação continuam.
- Início sem totais da página corrente/ações duplicadas; reembolso pendente condicional.
- Privacidade: prévia acompanha switches não salvos; preferências e latência continuam; exportação baixa o JSON e revoga a URL; erro não baixa arquivo.
- Exclusão: criar/ver/cancelar pedido e confirmação; nenhuma alegação de exclusão imediata.
- Admin: fila paginada/filtrada e conclusão confirmada; sidebar com seis grupos, destinos e permissões.

### Backend

- Migration 051 down/up preserva membros e pedidos; unique parcial impede duas pendências.
- Solicitar é idempotente e concorrência gera um único pedido; cancelamento e conclusão exigem estados/atores corretos.
- Membro não acessa fila admin nem conclui o próprio pedido; admin não altera consentimento.
- Exportação cobre cada seção do schema, omite segredos/terceiros, usa attachment e audit sem conteúdo.
- E2E PostgreSQL cobre exportação real, ciclo da solicitação, concorrência e autorização.

### Gates

1. TDD RED→GREEN em todos os comportamentos novos.
2. `cd backend && npm run build && npx jest --silent`.
3. `make astro-verify` e `make astro-verify-tenants`.
4. `npm run test:scripts` se scripts forem tocados; não há previsão.
5. Sonar sem issues novas e sem duplicação nova.
6. Revisão independente do diff e revisão jurídica/da diretoria dos textos e regras de privacidade antes de `main`.

## 12. Rollout, versionamento e documentação

- Trabalho em `develop`, PR próprio para `main`.
- Backend **1.2.0** (feat) e migration 051; não reutilizar versões anteriores.
- Publicação: release/redeploy backend + migration → validação controlada de exportação/solicitação → frontend.
- Produzir **ADR 019 — Autosserviço de privacidade, exportação e solicitação de exclusão**.
- Atualizar `AGENTS.md`, `docs/README.md`, `docs/plans/pos-1-0/README.md`, `docs/plans/frontend-jornadas/README.md`, `docs/modules/privacy/README.md`, `treatments.md` e a política pública.
- Rollback de frontend por revert; backend/migration seguem o padrão de down/up, preservando o histórico de solicitações.

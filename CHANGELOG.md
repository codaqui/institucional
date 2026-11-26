<!-- AGENT-INDEX
purpose: Changelog consolidado do produto Codaqui desde o marco 1.0.0, com releases, PRs, migrations e pendências operacionais verificáveis.
audience: Mantenedores, presidência, AI agents e operadores de release.
status: Atualizado até 1.14.0 em preparação na develop; 1.13.0 publicada pela PR #673.
sections:
  - Política de versão
  - 1.14.0
  - 1.13.0
  - 1.12.1
  - 1.12.0
  - 1.11.0
  - 1.10.1
  - 1.10.0
  - 1.9.1
  - 1.9.0
  - 1.8.1
  - 1.8.0
  - 1.7.0
  - 1.6.0
  - 1.5.0
  - 1.4.0
  - 1.3.0
  - 1.2.0
  - 1.1.0
  - 1.0.2
  - 1.0.1
  - 1.0.0
  - Baseline do site e próximos marcos
related-docs:
  - AGENTS.md — regra de versionamento compartilhado e gates.
  - docs/plans/README.md — índice e classificação de todos os planos.
  - docs/plans/pos-1-0/README.md — roadmap posterior ao 1.0.0.
agent-protocol:
  - Atualizar este arquivo em toda release e manter frontend/package.json e backend/package.json na mesma versão.
  - Distinguir código publicado de acompanhamento operacional; não declarar validações reais sem evidência.
-->

# Changelog

As mudanças são ordenadas da mais recente para a mais antiga. Até 1.2.0, as tags públicas usam o sufixo histórico `-backend`; a partir desta consolidação, o número de versão representa o produto compartilhado por frontend e backend, ainda que uma mudança toque apenas uma camada.

## Política de versão

- `frontend/package.json` e `backend/package.json`, com seus lockfiles, devem permanecer na mesma versão.
- O `package.json` da raiz coordena scripts e não participa dessa regra.
- Toda release exige entrada neste changelog; features usam bump minor e correções usam bump patch.
- As tags e releases históricas não são reescritas para remover o sufixo `-backend`.

## [1.14.0] — 2026-11-24

**Estado:** implementada em `develop`; release para `main` em preparação. **Migration:** 055.

### Catálogo de projetos

- `extension_projects` passa a distinguir `program`, `extension`, `campaign` e `open_source`, preservando IDs, participantes, horas, certificados e designations existentes. Apenas Extensão mantém inscrições, horas, certificados e a administração operacional atual.
- A migration 055 importa 11 códigos open source, 2 programas e 10 campanhas de forma idempotente. Codaqui Universitário aponta para `/universitario`; Embaixadores do DevParaná aponta para `https://devparana.org/embaixadores`.
- `/projetos` organiza as quatro categorias e os detalhes usam o destino canônico de cada projeto. Extensão pública continua restrita a projetos ativos; as demais categorias aceitam projetos ativos e concluídos.
- O snapshot público é gerado pela API com `npm run sync:projects`; `static/projects/index.json` não deve ser editado manualmente. A resolução do arquivo considera o bundle do Astro e o diretório de trabalho, evitando uma listagem vazia no HTML estático.
- Períodos e inscrições de Extensão usam datas pt-BR ou “A definir”, sem expor `null` ou timestamps crus.

### Correções editoriais

- Remove a referência ao media kit do devpr.org e substitui links de certificados das trilhas pela informação de desenvolvimento no sistema interno.
- A trilha de GitHub passa a usar o curso inicial oficial do GitHub Classroom.

### Verificação

- Scripts: 117 testes aprovados. Backend: build e 1.747 testes aprovados (2 skips preexistentes). Frontend: `astro check` sem erros, build e 1.372 testes aprovados; `make astro-verify` e `make astro-verify-tenants` aprovados para o portal e os três tenants.
- Migration 055 validada em PostgreSQL 18 com dump isolado em up/down/up: 23 projetos importados, nenhum slug duplicado e nenhum projeto remanescente após o down. O snapshot foi gerado pela API real com 2 programas, 11 open source e 10 campanhas.
- Listagem e detalhes das quatro categorias inspecionados em 1440×900 e 390×844, claro e escuro, sem overflow ou `null`; destinos canônicos e participação exclusiva de Extensão confirmados. A Extensão usou fixture temporária porque o dump não possuía projetos públicos dessa categoria; a fixture não foi commitada.

### Rollout obrigatório

- Publicar backend e migration 055, executar o redeploy manual no Coolify, rodar `npm run sync:projects` com a API atualizada e somente então publicar o frontend. O `down` remove somente os projetos importados e os campos novos, preservando as entidades compartilhadas.

## [1.13.0] — 2026-11-24

**Estado:** publicada em `main` pela PR #673. **Migration:** nenhuma.

### Apoiadores e doações

- O carrossel da home embaralha pessoas e empresas na carga e a cada ciclo, mantendo autoplay, controles e pausas acessíveis. A passagem do último para o primeiro evita repetir o apoiador recém-exibido.
- O seletor entre doação única e assinatura empresarial adota os tokens da frequência pessoal: seleção `primary.main` + `primary.contrastText` e hover `primary.dark`, com contraste preservado nos dois temas.
- O resumo de apoio apresenta “Pix · Cartão · Apple Pay · Google Pay (via Stripe)”, alinhando a copy aos métodos disponíveis no checkout sem alterar sua configuração.

### Verificação

- Sorteio, fronteira sem repetição, reset e seletor com contraste têm testes RED→GREEN. Build e `astro check` aprovados; frontend: 167 arquivos e 1.367 testes aprovados. `make astro-verify` e `make astro-verify-tenants` aprovados para o portal e os três tenants.
- Home e doação empresarial inspecionadas em 1440×900 e 390×844, claro e escuro. Playwright confirmou autoplay, nova fila sem repetição imediata, troca de jornada pela URL e cores computadas dos botões; dados do carrossel foram sintéticos apenas na validação visual.

## [1.12.1] — 2026-11-24

**Estado:** publicada em `main` pela PR #672. **Migration:** nenhuma.

### Jornada institucional

- Comunidades, Apoio Institucional e Títulos e Reconhecimentos passam a compartilhar uma navegação logo após o hero, explicando a relação entre as iniciativas, a estrutura da Associação e seus reconhecimentos oficiais.
- Cada destino identifica a página atual com texto e `aria-current="page"`; Títulos e Reconhecimentos também passa a ser descobrível pelo rodapé institucional.

### Publicação do backend

- `publish-backend.yml` publica toda imagem no GHCR e em `endersonmenezes/codaqui-institucional` no Docker Hub, preservando as tags de versão, `latest` e arquitetura. Os dois pushes são tentados em toda execução e o job falha se qualquer registro falhar.

### Verificação

- Frontend: build, `astro check` e 1.361 testes aprovados; `make astro-verify` e `make astro-verify-tenants` aprovados para o portal e os três tenants.
- Scripts: 116 testes aprovados, incluindo publicação dupla e paridade de tags; `actionlint` aprovado para `publish-backend.yml`. A publicação manual nos registros não foi executada nesta validação.
- As três páginas foram inspecionadas em 1440×900 e 390×844, nos temas claro e escuro: um único destino atual por página, nenhum overflow horizontal e um link para Títulos no rodapé.

## [1.12.0] — 2026-11-24

**Estado:** publicada em `main` pela PR #670. **Migration:** 054.

### Agenda do mentor

- Novo editor semanal carrega as regras do próprio mentor, permite múltiplas janelas, remoção/limpeza do dia, fuso IANA por dia e rascunhos independentes com indicação de alterações não salvas.
- `GET /mentorship/availability/mine` isola as regras por ator. O PUT existente mantém array e valida `HH:mm`, fuso, weekday 0–6, duração e sobreposição antes de substituir o dia; `[]` limpa somente o dia autenticado sem alterar sessões.
- Erros de validação/servidor são anunciados no formulário com foco e preservam rascunho. Falha ao carregar regras não produz falso empty state nem permite salvar sobre dados desconhecidos; retry restaura o editor.

### Google Calendar, e-mails e ICS

- Solicitação e confirmação oferecem link persistente da sessão; mentor recebe templates com saudação e corpo próprios. Confirmação envia Google Calendar e o mesmo `.ics` para mentor e mentorado.
- ICS usa UID estável, início/fim UTC, duração, CRLF e escape; Nodemailer recebe anexos opcionais sem alterar envios antigos. Falha de um destinatário não impede o outro nem reverte a sessão.
- Telas de mentor e mentorado mostram “Adicionar ao Google Calendar” somente em sessão confirmada. Lembrete mantém destinatários e ganha links.
- Correção adicional: `meetLink` e `cancelReason` passam a ser interpolados, eliminando tokens literais em e-mails de mentoria.

### Reembolsos com centavos

- Migration 054 converte `reimbursement_requests.amount` de integer para `numeric(10,2)`; entidade preserva número em reais na API, sem mudança de contrato. O `down` restaura integer com arredondamento de centavos e exige backup/avaliação após dados decimais.
- Valores como `0,01`, `10,50` e `1.234,56` permanecem com centavos; parsing pt-BR e persistência têm cobertura de regressão.

### Verificação e rollout

- Backend: build e 1.721 testes aprovados. Frontend: `astro check`, build e 1.359 testes aprovados. Scripts: 114 testes aprovados.
- `make astro-verify` e `make astro-verify-tenants` aprovados para o portal e os três tenants.
- E2E PostgreSQL no dump isolado: 2/2 jornadas, incluindo disponibilidade, validações 400/409, reserva concorrente e confirmação com provider mockado, links e ICS idêntico para ambos; nenhum SMTP real.
- Migration 054 validada up/down/up; inserção real de `10.50` retornou `numeric`. Bancos temporários removidos.
- Editor inspecionado com dados sintéticos em claro/escuro e mobile/desktop, sem overflow.
- Publicar backend/migration antes do frontend. O dump não possui overrides `mentorship-*`; nenhum envio de e-mail real foi executado.

## [1.11.0] — 2026-11-24

**Estado:** em integração na PR #670 para `main`, em draft até a conclusão dos gates. **Migration:** nenhuma.

### Home, apoiadores e aprendizado

- Novo carrossel junto à contagem de apoiadores alterna pessoas e empresas com dados públicos reais, sem valores de doações pessoais. Autoplay de 6 segundos, anterior/próximo, indicadores, pausa por interação/visibilidade/movimento reduzido e novo ciclo após ação manual.
- Empresa Amiga passa a declarar presença no banner rotativo da home entre seus benefícios, ao lado da vitrine, selo ativo e SortCoins.
- Hero da home alinha selo, título, descrição e CTAs ao mesmo eixo central. Estudar remove o cronograma 2026, prioriza mentorias/trilhas e preserva os três cursos históricos com seus posts.

### Navegação, mentorias e administração

- C4P usa diretamente `/eventos?recurso=c4p`; `/c4p` e `/c4p/` permanecem como redirects legados. O splat auto-referente que causava loop em `/assembleias` foi removido e há guarda contra reincidência.
- Slots e acompanhamento de mentoria exibem data no fuso da sessão e status em português, sem timestamp ISO cru ou fuso incorreto.
- Equipe, ONG e Comunidades ganham links contextuais entre estrutura, pessoas e integração.
- Admin de comunidades adota chips pt-BR, menu de ações, `DataTable`, skeleton e retry, preservando permissões, paginação e payloads.

### Conta e privacidade

- O selo de autosserviço sai do perfil público e passa à visão geral do membro; horas públicas zeradas não geram card vazio.
- Ausência de solicitação de exclusão com HTTP 200 e corpo vazio deixa de gerar erro de JSON. Exportação e revisão de exclusão preservam seus contratos.
- “Salvar visibilidade” não transborda mais sobre o card de comunicações promocionais.

### Insights 2026

- `/sobre/insights` apresenta a Codaqui como comunidade de comunidades, com eventos concluídos por ano/fonte, portais e apoio institucional.
- Métricas atuais derivam dos snapshots: eventos realizados, inscrições, usuários mensais somados no site, Discord dinâmico e WhatsApp 519. Rótulos e nota explicam que inscrições e usuários mensais não são pessoas únicas ou presenças verificadas.
- O sync social respeita atualização de baseline manual, permitindo substituir o fallback antigo do WhatsApp sem alterar contagens dinâmicas preservadas.

### Verificação

- Backend: build e 1.676 testes aprovados (2 skips preexistentes). Frontend: `astro check`, build e 1.334 testes aprovados; carrossel com 25 testes focados e admin de comunidades com 17 testes focados.
- Scripts: 114 testes aprovados. `make astro-verify` e `make astro-verify-tenants` aprovados para o portal e os três tenants.
- Testes dirigidos de redirects, navegação, privacidade, perfil, mentorias e agregação de eventos aprovados. Home, Estudar, carrossel, Insights e Conta inspecionados com fixtures nos temas claro/escuro e viewports mobile/desktop, sem overflow ou sobreposição.
- Carrossel: 39/39 verificações reais em Chromium, incluindo autoplay, reset, pausas, teclado, movimento reduzido e links. A ampliação da agenda do mentor permanece na fila documentada e não é apresentada como concluída nesta release.

## [1.10.1] — 2026-11-23

**Estado:** implementada em `develop`; PR #667 aberta para `main`. **Migration:** nenhuma.

### Correções de manutenibilidade

- Simplifica o checkout e os efeitos de ledger das doações empresariais únicas, sem alterar destinos, idempotência ou estados de pagamento; remove um `async` desnecessário do mock da jornada E2E.
- Reduz estado e deriva labels nas ilhas de doação e no suporte ao checkout, preservando retornos, confirmação e cancelamento.
- Centraliza a apresentação de loading dos KPIs de transparência e extrai a resolução do doador no recibo PDF, mantendo loading, erro, valores desconhecidos e dados do recibo.
- Separa a resolução de regras, valores e arquivos ignorados pelo detector Impeccable; normalização de aspas e globs preserva o comportamento anterior.

### Verificação

- Backend: build e 1.676 testes aprovados (2 skips preexistentes). Frontend: `astro check` e 1.298 testes aprovados.
- Jornada PostgreSQL em banco isolado restaurado do dump mais recente: doação empresarial única com Stripe mockado aprovada, sem cobrança real; banco temporário removido após o teste.
- As cinco refatorações possuem testes dirigidos; as regras do detector foram comparadas com a implementação anterior em cinco cenários. `make astro-verify` e `make astro-verify-tenants` aprovados para o portal e os três tenants.
- SonarCloud da PR #667: nenhum achado `OPEN` ou `CONFIRMED` no período de novo código após as correções; Quality Gate aprovado.

## [1.10.0] — 2026-11-23

**Estado:** implementada na branch `feat/company-one-time-donations`; PR #666 aberta para `develop`. **Migration:** nenhuma. **Issue:** #663.

### Doações empresariais únicas

- `POST /stripe/checkout-session/company/one-time` permite que o responsável por empresa `pending` ou `active` doe para Tesouro ou comunidade Integrada ativa, com CNPJ, `mode: payment`, PMC e retorno sanitizado. Demais status são bloqueados.
- O painel PJ oferece Doação única ou Assinatura mensal, preservando deep links e o CLUB Business. `?modo=empresa&apoio=unica` abre o fluxo avulso; retorno hosted confirma ou cancela corretamente.
- Doação pontual não altera status, assinatura, vitrine, selo, badges ou SortCoins. Não usa `recurring`, `subscription_data`, `setSubscriptionAmount` ou `customer_creation`, nem persiste novo customer.
- Ledger e transparência distinguem **Doação empresarial única** de assinatura, com comunidade e responsável. Minhas doações e o recibo PDF apresentam pagamento único corretamente.
- Identidade empresarial é compartilhada entre os fluxos; Tesouro/comunidades usam a mesma fonte de destinos do checkout PF.

### Verificação e rollout

- Backend: build e 1.676 testes aprovados (2 skips preexistentes). Frontend: `astro check` e 1.298 testes aprovados. `make astro-verify` e quatro builds multi-tenant aprovados; paridade de 646 URLs.
- Jornada PostgreSQL com dump isolado: `pending` → checkout → `unpaid` sem ledger → sucesso assíncrono → Tesouro/comunidade → Minhas doações, sem ativação ou patrocínio. Stripe totalmente mockado, sem cobrança real.
- Sete cenários visuais cobrem formulário mobile/desktop nos dois temas, sucesso, cancelamento e assinatura preservada, sem overflow.
- Publicar backend antes do frontend. Após integração em develop, abrir PR para main; nenhuma ativação ou cobrança real foi executada.

## [1.9.1] — 2026-11-23

**Estado:** implementada na branch `fix/frontend-trust-discovery`; PR #664 aberta para `develop`; release/deploy pendentes. **Migration:** nenhuma.

### Confiança e descoberta nas jornadas públicas

- Transparência global e por comunidade diferencia loading, erro, ausência de conta e zero retornado pela API. Falhas não produzem mais `R$ 0,00`: valores desconhecidos usam `—` e cada fonte tem retry independente.
- KPIs deixam de usar headings apenas para apresentação; o título do Discord passa a `h2`, preservando o variant visual.
- Cartões de comunidades usam `bg-action text-on-action` no chip e no CTA, corrigindo o contraste de 1,9:1 encontrado no tema escuro.
- Rodapé inclui **Empresas apoiadoras** (`/empresas`) e **Guia de Regex** (`/regex`), sem ampliar a navegação principal.

### Revisão e verificação

- Revisão Impeccable dual-agent confrontou o inventário com o código, 308 arquivos e 5 páginas em dois viewports; o relatório ficou em `.impeccable/critique/2026-11-23T15-18-16Z__docs-plans-frontend-jornadas-readme-md.md`.
- `astro check`, 160 arquivos/1.281 testes, build do portal, `make astro-verify` e `make astro-verify-tenants` aprovados. Paridade mantida: 646 URLs de referência e 35 extras informativas.
- `/comunidades`, `/eventos` e `/transparencia` verificadas em 390×844 e 1440×900, claro/escuro, sem overflow. O detector não repetiu `low-contrast` nem `skipped-heading` nesses alvos.
- Retries exercitados no build com respostas controladas: uma nova chamada por fonte, preservação das áreas válidas e zero legítimo renderizado. Nenhuma sessão autenticada ou mutação externa foi usada.
- Revisão independente do diff concluída sem achados críticos ou importantes; quatro sugestões menores ficaram registradas para follow-up.

## [1.9.0] — 2026-11-18

**Estado:** implementada em `develop`; integração em `main` e release/deploy pendentes. **Migration:** 053.

### C4P como recurso de atividades

- `POST /events/:id/c4p` e `/events/external/:eventKey/c4p` criam/reutilizam chamadas em rascunho com idempotência, transação e autorização da atividade. Migration 053 adiciona `externalActivationId` e unicidade por evento próprio/ativação externa, preservando campanhas legadas.
- Configurar recursos no admin deriva slug/nome, resume os recursos existentes e abre a curadoria atual. C4P sai do sidebar, mas `/admin/c4p` e a área do avaliador permanecem.
- O activate genérico rejeita alteração direta de C4P e preserva seu flag. A validação de referências usa o mesmo `EntityManager` da criação, evitando activation invisível fora da transação.
- Snapshot adiciona `externalEventKey` sem remover `event:{slug,title}`; atividades exibem submissão/resultado e `/eventos?recurso=c4p` combina com `source`, incluindo resultados públicos históricos. `/c4p` redireciona para essa visão.
- Header híbrido recupera Trilhas/Mentoria em Aprender e Projetos/Blog em Explorar, sem C4P dedicado, com popover/disclosures e `aria-current`.

### Verificação e rollout

- E2E PostgreSQL em dump isolado: migration 053 down/up, ativação própria/externa, repetição, submissão, avaliação, finalização e snapshot sem PII (22 testes).
- Backend: build e 1.645 testes aprovados (2 skips preexistentes). Frontend: `astro check` e 1.239 testes aprovados; scripts: 113 testes.
- `make astro-verify` e quatro builds multi-tenant aprovados. Nenhuma campanha real foi criada ou alterada.
- Publicar backend/migration → sync inicial de C4P → frontend → homologar atividade sintética com C4P antes de remover acesso operacional legado.

## [1.8.1] — 2026-11-18

**Estado:** implementada em `develop`; integração em `main` e release/deploy pendentes. **Migration:** nenhuma.

### Revisão visual dos anúncios institucionais

- Barra pública aproximada do mockup: apresentação compacta sem cartões, conteúdo alinhado ao cabeçalho, badge de severidade e link inline, com quebra natural no mobile e preservação de snapshot, links seguros, temas e estados vazio/erro.
- Validação com 154 arquivos/1.224 testes, `astro check`, gates codaqui e quatro tenants, além de inspeção Playwright em desktop/mobile e claro/escuro. Revisão independente sem achados críticos ou importantes.
- Mudança somente de frontend/documentação; não exige backend, migration ou sync novo.

## [1.8.0] — 2026-11-18

**Estado:** integrada em `main` pela PR #659; deploy e acompanhamento operacional conforme rollout da release. **Migration:** nenhuma.

### Fase 10.1 — Home e navegação por jornadas

- Home posiciona a Codaqui como associação de comunidades, com hero institucional, comunidades do snapshot, funcionamento do guarda-chuva, atividades futuras reais e formas de participação.
- Header, drawer e footer compartilham os links de Comunidades, Atividades, Transparência, Aprender e Apoiar, com CTA de integração, `aria-current` e destinos secundários preservados.
- Nenhum número, pessoa, link ou card ilustrativo dos mockups foi publicado; eventos inválidos/passados/cancelados são filtrados e há empty state real.

### Fase 10.2 — Transparência, perfil e mentoria

- `GET /communities/public/:slug/transparency` agrega eventos próprios/externos por `communityProjectKey`, participações confirmadas, certificados concedidos e somente horas aprovadas de `event_checkin` com visibilidade pública. Filtros anuais seguem o ano do evento.
- Transparência whitelabel coloca atividades e responsáveis antes das finanças, mantém o ledger existente, mostra o vínculo associativo e separa erros/retry das duas fontes. Não inventa atas ou horas comunitárias totais.
- `GET /members/by-handle/:handle/engagement` projeta somente comunidades ativas e mentoria vigente; `profileVisibility.designations=false` oculta pills, comunidades e CTA.
- Perfil conecta comunidades e mentoria; `/participe/mentoria?mentor=` aceita ID público do perfil ou handle, seleciona somente mentor presente no snapshot e fecha o fluxo até `requested`.
- Admin+mentor não é mais desviado da própria disponibilidade; `/admin/mentoria` oferece link ao painel pessoal e só busca membros ao abrir a edição de mentor.

### Fase 10.3 — Robustez administrativa

- `GET /companies/admin/members/:memberId/companies` consulta diretamente as empresas do responsável, sem depender das primeiras 100 da listagem geral.
- Stripe Search segue todos os cursores; cursor ausente/repetido, erro do provider ou excesso de 1.000 registros gera erro explícito em vez de lista parcial. Datas do painel usam pt-BR.
- Ilhas admin revisadas usam `resolveApiUrl`, `PaginationControls`, skeleton e retry, preservando filtros, envelopes e seleção de linhas por página.
- Jornada isolada com provider totalmente mockado validou empresa fora das primeiras 100, duas páginas, `converted` → `already_converted`, uma conversão/wallet e uma atualização de metadados. Nenhuma conversão real ocorreu.

### Verificação e limites operacionais

- Gates completos, builds multi-tenant, Playwright e jornadas PostgreSQL em dump isolado estão registrados nos planos da Fase 10.
- A conta `financeiromaringapost` possui empresa ativa sem customer/subscription/conversão vinculada. Os pagamentos mensais localizados no dump são doações avulsas por Checkout Session, não renovações de assinatura; portanto não são elegíveis à conversão. Não houve acesso Stripe autenticado nesta sessão nem alteração externa.
- Rollout: backend antes do frontend para as novas projeções; não há migration nem sync novo. Validar comunidade, perfil e disponibilidade reais após deploy, sem conversões não autorizadas.

**Estado:** implementada em `develop`; integração em `main` e release ainda pendentes. **Migration:** 052.

### Conversão de assinatura pessoal em apoio empresarial

- Admin converte uma assinatura pessoal mensal ativa sem novo checkout, cancelamento, refund, alteração de preço ou crédito retroativo.
- A mesma assinatura Stripe, customer, invoices, histórico e wallet pessoal são preservados; somente eventos futuros seguem os metadados empresariais.
- `GET /companies/admin/personal-subscriptions` lista candidatos mensais sem PII e `POST /companies/admin/subscription-conversions` executa a conversão com idempotência e recuperação.
- Migration 052 cria `company_subscription_conversions` com unique/lock por assinatura e estados `pending`/`completed`.
- Empresa existente preserva status; empresa nova permanece pendente, sem vitrine, selo ou badge automático.
- Wallet empresarial é criada sem transferir moedas pessoais.

### Configuração da empresa pelo admin

- Admin revisa nome legal, nome fantasia, logo e website e salva separadamente antes da conversão; empresa nova também informa CNPJ.
- `PATCH /companies/:id` aceita admin sem remover o acesso do responsável atual, usando update parcial para não sobrescrever vínculos Stripe.
- Logo e website usam HTTPS por URL compartilhada entre cadastro/edição/conversão, sem upload.
- Auditoria `company.profile_updated` e `company.subscription_converted` registra as ações de governo.

### Verificação

- Testes cobrem migration, candidatos, validações, empresa nova/existente, recuperação pós-Stripe, concorrência, UI e repetição idempotente.
- Jornada real em dump isolado: migration down/up, `converted` → `already_converted`, mesma assinatura, wallet criada, empresa pendente e somente uma atualização Stripe.
- Gates completos e revisão independente acompanham a entrega; conversão real depende de autorização e deploy.
- A revisão levou à omissão de campos opcionais vazios no PATCH de perfil e à rejeição explícita de requisições que misturam empresa existente e dados de empresa nova.

## [1.6.0] — 2026-11-17

**Estado:** implementada em `develop`; integração em `main` e release ainda pendentes. **Migration:** nenhuma.

### Importação manual da vitrine open source

- `/admin/projetos` permite escolher um item de `frontend/src/data/projects.ts` e abrir o formulário com nome/resumo e link de origem.
- A importação usa o `POST /projects` existente, sem backend ou migration nova; nenhum request ocorre antes de salvar.
- A URL GitHub é somente referência visual, nunca anexo. Entidade, ODS, datas, mentor e demais obrigações institucionais permanecem obrigatórios.
- A origem open source não é removida nem alterada; a extensão só se torna pública após ativação.

### Diagnóstico de disponibilidade de mentoria

- A página pública distingue mentor sem regra semanal de regras sem slots livres nas próximas quatro semanas.
- A área do mentor orienta que ao menos um horário semanal é necessário para oferecer sessões.
- Nenhuma regra é criada automaticamente; configurar a agenda real continua sendo ação operacional do mentor.
- Jornada isolada com fixtures sintéticas validou regra → slot → solicitação `requested` → slot ocupado.

### Verificação

- Testes cobrem helper, picker, importação manual, reset de estado, validação de proposta e diagnóstico de disponibilidade.
- Revisão e gates completos acompanham esta entrega.

## [1.5.0] — 2026-11-17

**Estado:** implementada em `develop`; integração em `main` e release ainda pendentes. **Migration:** nenhuma.

### Cadastro assistido de projetos de extensão

- Enriquece `GET /projects` com mentor principal e co-mentores atuais em lote e sem dados privados, reutilizando a busca pública de membros no formulário.
- Substitui UUIDs digitados por seleção por nome/handle, preservando vínculos e membros históricos na edição.
- Nomeia as 17 ODS, inicia metodologia `PjBL`, adiciona parceiros de apoio, orçamento calculado em centavos e anexos HTTPS.
- Valida campos obrigatórios, datas, ODS e cronograma no cliente antes do envio, preservando o rascunho mínimo.
- Sincroniza mentores somente por delta, sem fechar/recriar vínculos ou reenviar e-mail em edições idênticas; somente novo/trocado principal é notificado.
- Converte rejeição de anexo fora da allowlist em HTTP 400 com a mensagem do StorageService.

### Verificação

- Testes backend/frontend e `astro check` cobrem projeção, no-op, deltas, busca histórica, rascunho, centavos e erros de anexos.
- Jornada real em banco isolado com fixtures sintéticas: rascunho → proposta → edição idêntica sem churn/e-mail → mudança de co-mentor → ativação.
- Revisão independente concluída com correção do contrato HTTP da allowlist.
- Revisão SonarCloud do PR #656: nove achados resolvidos com chaves estáveis nas linhas dinâmicas, validação decomposta, operadores simplificados e fechamento de participantes em lote.

## [1.4.0] — 2026-11-17

**Estado:** integrada em `main` pelo PR #655; release e deploy ainda pendentes. **Migration:** nenhuma.

### Reconciliação financeira

- Adiciona `POST /stripe/reconcile-fee`, restrito a administradores, para consultar um PaymentIntent e criar somente a taxa Stripe ausente no ledger.
- Mantém idempotência por `stripe-fee:<balanceTransactionId>`, inclusive em chamadas repetidas ou concorrentes, e distingue `created`, `already_exists` e `no_fee`.
- Adiciona a aba **Taxas Stripe** em `/admin/lancamento`, com feedback de criação, taxa existente, ausência de taxa e falhas sem falso sucesso.
- Registra auditoria de governo `stripe.fee_reconciled` somente quando uma taxa é efetivamente criada.

### Documentação para agentes

- Reduz `AGENTS.md` a um ponto de entrada com comandos, invariantes e links, movendo as convenções detalhadas para `docs/modules/MONOREPO_OPERATIONS.md`.
- Atualiza os índices técnico e de planos e alinha a documentação das doações ao `referenceId` real com PaymentIntent puro (`pi_...`).

### Acompanhamento

- A doação live investigada possui taxa de R$ 8,37 confirmada no Stripe e ausente no dump. A correção do ledger de produção depende de deploy e execução manual da reconciliação; não foi realizada no branch.

## [1.3.0] — 2026-11-17

**Estado:** integrada em `main` pelo PR #655; release e deploy ainda pendentes. **Migration:** nenhuma.

### Páginas públicas

- `/sobre/equipe` mantém a curadoria institucional e enriquece perfis somente por URL/handle GitHub válido, sem associação por nome ou criação de placeholders no banco.
- A seção de mentores passa a usar o snapshot público ativo/vigente, com perfil `/@handle` somente quando disponível no mesmo build e empty state sem lista histórica.
- `/sobre/ong` consome o snapshot público de comunidades, exibe nível/selo efetivo e data de geração, e deriva portais da interseção entre comunidades elegíveis e `TENANTS`.
- As atas atuais apontam para `/assembleias`; o Drive permanece identificado como arquivo histórico.
- O loader de mentores passa a localizar o snapshot também pelo diretório de trabalho do build, corrigindo o empty state causado pelo bundling do Astro.

## [1.2.0] — 2026-11-17

**Release:** [v1.2.0-backend](https://github.com/codaqui/institucional/releases/tag/v1.2.0-backend) · **Integração:** [PR #654](https://github.com/codaqui/institucional/pull/654) · **Migration:** 051.

### Painéis e navegação

- `/membro` passa a usar quatro seções principais, filtros por chips e deep links compatíveis com aliases antigos.
- Participação e Apoio/financeiro consolidam blocos por tipo; o Início remove resumos financeiros duplicados e não apresenta a página corrente como total geral.
- A navegação administrativa é reorganizada em seis grupos, preservando autorização, busca, recolhimento e destinos existentes.
- “Próximos passos” dinâmicos e contadores de pendências não entraram nesta release; suas dependências estão registradas no roadmap 1.5.

### Privacidade

- Adiciona prévia local da visibilidade do perfil e exportação JSON autenticada, com rate limit por membro e projeções que excluem tokens e dados de terceiros.
- Adiciona solicitação revisada de exclusão de conta, com fila administrativa, histórico e única pendência por membro.
- Criar, cancelar ou concluir uma solicitação não desativa, anonimiza ou exclui a conta automaticamente.

### Acompanhamento

- A publicação do código e da migration está confirmada. Evidência de revisão jurídica/da diretoria não foi localizada nesta consolidação; esse acompanhamento não deve ser presumido.

## [1.1.0] — 2026-11-16

**Release:** [v1.1.0-backend](https://github.com/codaqui/institucional/releases/tag/v1.1.0-backend) · **Integração:** [PR #652](https://github.com/codaqui/institucional/pull/652) · **Migration:** 050.

### Mentoria

- Sincroniza `member_designations` e `mentor_profiles` na mesma transação, inclusive confirmação, revogação, vigência e recandidatura.
- Torna a candidatura atômica e reconcilia perfis existentes sem apagar histórico.
- Filtra o diretório público por designation ativa e vigente, corrigindo mentores aprovados que não apareciam no frontend.
- Melhora datas, fusos e status das sessões e permite ao mentor/admin vincular participantes a contas da plataforma por busca pública de membros.
- Preserva nome, e-mail, consentimento, status e horas históricas ao vincular uma conta.

### Eventos e blog

- Limita resumos de cards de eventos e normaliza descrições do Discord para evitar texto sem contenção.
- Exibe thumbnails decorativas nas listagens do blog quando o frontmatter ou o conteúdo já fornece imagem, sem alterar slugs ou Markdown canônico.

## [1.0.2] — 2026-11-16

**Release:** [v1.0.2-backend](https://github.com/codaqui/institucional/releases/tag/v1.0.2-backend) · **Integração:** [PR #650](https://github.com/codaqui/institucional/pull/650).

- Entrega a Onda 1 de UX: semântica de headings/landmarks, contraste, variante dark, filtros de eventos, deep links e acessibilidade de abas e botões.
- Padroniza confirmações destrutivas e guards/feedback no admin do C4P.
- Corrige aceite de avaliador, escape de busca, votos de avaliadores removidos, paginação da finalização, cálculo de progresso e filtro da vitrine/snapshot pela janela de submissão.
- Integra contribuições comuns com atribuição de coautoria preservada no histórico do Git.

## [1.0.1] — 2026-11-13

**Release:** [v1.0.1-backend](https://github.com/codaqui/institucional/releases/tag/v1.0.1-backend).

- Hotfix do crash-loop de produção: `C4pModule` importa `TurnstileModule` para resolver a dependência de `TurnstileGuard` durante o boot do NestJS.
- Permanece como follow-up de processo um teste de boot real na CI, sem overrides de guards, para cobrir essa classe de falha.

## [1.0.0] — 2026-11-13

**Release:** [v1.0.0-backend](https://github.com/codaqui/institucional/releases/tag/v1.0.0-backend) · **Integração:** [PR #639](https://github.com/codaqui/institucional/pull/639) · **Migration:** 049.

- Conclui o plano Codaqui 1.0.0 com o C4P integrado: campanhas, submissão pública com consentimento e Turnstile, importação CSV, avaliadores por designation, votos por critérios, dashboard, finalização, PDF e resultado público opt-in.
- Adiciona snapshot público do C4P, páginas de submissão/resultado/avaliação e gestão administrativa.
- Mantém notas, comentários e dados privados fora das projeções públicas.
- A campanha piloto real continua como acompanhamento operacional, separada da entrega técnica.

## Baseline do site e próximos marcos

- A release [v1.0.0 do site Astro](https://github.com/codaqui/institucional/releases/tag/v1.0.0), publicada em 2026-10-29, é a baseline anterior ao C4P; ela não é a mesma tag que `v1.0.0-backend`.
- **Fase 8 — páginas públicas conectadas ao banco:** próxima fase preparada em spec/plano, ainda não implementada.
- **Fase 8 — páginas públicas conectadas ao banco:** implementada em develop/1.3.0; integração em main pendente.
- **Fase 8b — projetos de extensão e patrocínio PJ:** candidata posterior, sem escopo aprovado.
- **Roadmap 1.5:** documento de propostas, não uma versão comprometida; reúne agregações de painéis que exigem novos contratos de backend.
- **Real Network:** visão exploratória de longo prazo, fora do backlog operacional e sem revisão nesta consolidação.

[1.3.0]: https://github.com/codaqui/institucional/tree/develop
[1.2.0]: https://github.com/codaqui/institucional/releases/tag/v1.2.0-backend
[1.1.0]: https://github.com/codaqui/institucional/releases/tag/v1.1.0-backend
[1.0.2]: https://github.com/codaqui/institucional/releases/tag/v1.0.2-backend
[1.0.1]: https://github.com/codaqui/institucional/releases/tag/v1.0.1-backend
[1.0.0]: https://github.com/codaqui/institucional/releases/tag/v1.0.0-backend

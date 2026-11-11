<!-- AGENT-INDEX
purpose: Design da fase de experiência do membro — /membro, /@handle, certificados e selos compartilháveis.
audience: Mantenedores, designers, implementers e revisores.
status: Integrada em develop pela PR #630; PR para main e validação visual/produção pendentes.
sections:
  - Evidências e princípios
  - Arquitetura de /membro
  - Perfil público e selo
  - Certificados por persona
  - Acessibilidade, privacidade e testes
related-docs:
  - docs/superpowers/specs/2026-11-09-checkin-certificate-decoupling-design.md — identidade e regras operacionais preservadas
  - docs/adrs/016-certificate-invite-queue.md — fila de convites preservada
  - docs/plans/codaqui-1-0/README.md — sequência das fases
agent-protocol:
  - Não alterar regras de identidade, verificação por e-mails GitHub, autorização ou conteúdo dos certificados.
  - Não expor novos dados públicos nem usar HTML no texto do selo.
  - Implementar depois da PR de patches e antes de Announcements, salvo repriorização explícita.
-->

# Experiência do Membro — Design

## Evidências e princípios

A revisão encontrou três problemas relacionados:

- `/membro` apresenta sete abas que misturam doações, assinaturas, carteira, eventos, projetos e privacidade, com cabeçalho grande e ações duplicadas. Certificados ficam escondidos no histórico.
- `/@handle` repete essa fragmentação: horas, eventos, doações e carteiras disputam espaço mesmo quando vazios. O selo aparece como imagem isolada, sem orientação de uso.
- A Central de certificados mistura filtros, seleção, concessão, convites e acompanhamento. O participante chega ao `/membro` genérico após vincular sua participação, sem um destino claro para o certificado.

A abordagem proposta é **reorganização progressiva**, preservando APIs, autorização e componentes sempre que possível. Não haverá nova migração ou alteração obrigatória de backend nesta fase.

Princípios:

1. Conteúdo e próxima ação antes de navegação secundária.
2. Uma área clara por intenção, sem nomes ambíguos como “Carteira” para conceitos diferentes.
3. Disclosures para detalhes, não modais para operações recorrentes.
4. Deep links preservados e estados vazios que orientam, sem dominar a página.
5. Identidade, privacidade, impressão e verificação pública permanecem semanticamente iguais.

## Arquitetura de `/membro`

Reduzir o `MemberProfileCard` a uma identidade compacta com avatar, nome, handle e ações primárias. Mover QR, logout e ações administrativas para os destinos apropriados, sem duplicá-las na Visão geral.

Substituir as sete abas por quatro seções:

1. **Visão geral** — próximos eventos, certificados disponíveis/pendentes, horas e atalhos contextuais.
2. **Participação** — eventos, certificados, projetos de extensão, horas e mentoria.
3. **Financeiro** — doações, assinaturas, SortCoins e reembolsos, cada um com nome explícito.
4. **Conta e privacidade** — edição de perfil, dados da conta e visibilidade pública.

A Visão geral reutiliza dados já carregados e não cria métricas globais falsas. Se um total representar somente a página atual, o rótulo deve dizer isso. Cards são links para a seção real, não botões duplicados para a mesma ação.

Deep links seguem `?section=<overview|participation|finance|account>&tab=<subtab>`. O retorno de compra abre Participação/Eventos futuros; o aceite de certificado abre Participação/Certificados. Parâmetros antigos são normalizados em vez de quebrar.

## Perfil público `/@handle`

A ordem passa a ser:

1. Identidade, bio, papéis e links sociais.
2. Resumo de contribuições com horas e eventos.
3. Selo e guia de compartilhamento.
4. Linha do tempo/eventos/certificados.
5. Doações e vínculos somente quando existirem e forem públicos.

Seções vazias de doações/carteiras não dominam a experiência de visitantes. Uma chamada para apoiar a Codaqui fica em contexto secundário, não no lugar do conteúdo principal. A rota estática e o fallback dinâmico compartilham a mesma ordem e componentes, evitando divergência visual.

### Guia do selo compartilhável

`ProfileBadges` mantém a imagem atual e passa a apresentar “Compartilhe seu selo”, com texto curto: “Copie o Markdown e insira no README do seu perfil ou projeto.”

Oferecer duas variantes geradas no cliente a partir de dados já públicos:

```md
[![Selo Codaqui](https://codaqui.dev/badges/<handle>.svg)](https://codaqui.dev/@<handle>)
```

```html
<a href="https://codaqui.dev/@<handle>"><img src="https://codaqui.dev/badges/<handle>.svg" alt="Selo Codaqui"></a>
```

O domínio real vem de `window.location.origin`; o handle continua validado por `MEMBER_HANDLE_REGEX`. O alt fixo “Selo Codaqui” evita injeção de markup pelo nome. Exibir o código em bloco rolável, sem editá-lo.

Botões **Copiar Markdown** e **Copiar HTML** usam Async Clipboard API, mantêm foco e apresentam sucesso/erro em uma região `role="status"` fora do botão. Se a API estiver ausente ou for negada, usar o fallback síncrono com textarea temporária apenas no gesto do usuário. Repetir cópia reinicia a mensagem sem desabilitar o botão.

A imagem continua sendo exibida apenas quando o selo existe e é público; nenhum dado adicional é incluído no SVG ou no snippet.

## Certificados por persona

### Correções prévias incluídas na PR #628

Antes desta fase, a PR de patches corrige rupturas comprovadas: `/my-registrations` e o perfil público passam a projetar concessão sem presença, o membro abre “Ver certificado” por `certificateGrantedAt`, a data de emissão permanece estável, lote com `total=0` não inicia polling e a impressão isola somente o certificado. Essas correções não serão reabertas nesta fase.

### Participante

Criar um destino explícito **Participação → Certificados**, reutilizando as inscrições existentes. Cada item apresenta evento, presença/concessão, disponibilidade, pendência e ação correspondente:

- disponível: abrir prévia, imprimir e verificar;
- pendente de conta: orientar o vínculo GitHub com o e-mail verificado;
- indisponível: explicar a condição sem prometer emissão;
- convite recém-vinculado: abrir o item correspondente por deep link.

`AccountClaimResult` deixa de apontar para `/membro` genérico e usa o deep link de certificados. Prévia, QR e verificação pública mantêm os mesmos dados e regras de privacidade. Não haverá download alternativo que altere o certificado canônico.

O fluxo de OAuth explica as etapas: verificar o e-mail no GitHub, voltar ao convite e confirmar a associação. O aceite explícito permanece obrigatório. Erro de rede oferece retry; e-mail divergente orienta verificar o endereço ou trocar de conta sem flexibilizar o match.

A impressão usa o botão “Imprimir / salvar PDF” e uma folha A4 sem navegação/backdrop/ações. Complementos: **Copiar código**, **Copiar link de verificação** e **Abrir verificação**. A verificação pública usa copy neutra para qualquer `{valid:false}` — “Não foi possível validar este código. Confira a digitação; se o problema persistir, fale com o participante ou com a organização.” — sem alterar a privacidade da resposta. Um link público de verificação entra no rodapé.

### Concessor

Reorganizar a Central em três regiões progressivas, sem wizard obrigatório:

1. **Filtrar e selecionar** — filtro, busca, página e escopo da seleção sempre explícitos.
2. **Agir** — concessão individual ou convite em lote, com contagem e resumo antes do envio.
3. **Acompanhar** — progresso global, processados, falhas, retries e conclusão em região de status.

Disclosures ocultam detalhes técnicos e histórico do lote. Concessão individual não exige confirmação extra; erro fica no item. Convite em lote mostra a quantidade de IDs e a página de origem, sem sugerir seleção global. A fila persistente e o lock global da PR #627 são preservados.

O relatório de importação distingue sucesso de **Importação concluída com pendências** e oferece **Abrir Central de certificados** com deep link para evento/aba/filtro. O atalho existe para `certificates` mesmo sem `checkin` ou `payments`.

Os estados por participante diferenciam elegível, concedido aguardando cadastro, cadastro pendente sem concessão e convite aguardando aceite. Quando o convite não inclui concessão, a copy explica que ele vincula a participação, não o certificado. Pode existir ação explícita **Conceder e depois convidar**, executando as duas operações existentes, nunca uma concessão implícita.

O acompanhamento aceita `batch=<uuid>` na URL para reload/retomada, sempre com autorização do admin/solicitante. `total=0` informa que nenhum convite novo foi enfileirado. O resumo final separa enviados, retry, falhas e ignorados por SMTP ausente. Os itens do lote mostram erro técnico e tentativas, vinculados à inscrição sem acrescentar nome/e-mail à fila. **Selecionar falhas para um novo lote** é ação explícita, sem reprocessamento automático nem repetição de quem já recebeu convite.

O trabalho da PR de patches — escopo por feature, staff local e paginação — é pré-requisito e não será redesenhado.

## Acessibilidade, privacidade e testes

- Hierarquia correta de headings, landmarks e links nativos.
- `details` para conteúdo secundário; `hidden="until-found"` somente se necessário e com fallback.
- `progress` nativo com rótulo; regiões de status para fila e cópia, sem foco automático.
- Contraste por tokens `--cq-*` nos dois temas e indicadores que não dependem apenas de cor.
- Nenhum e-mail, UUID de membro, autor de admin ou dado privado é acrescentado ao perfil/selo público.

Cobertura exigida:

- `/membro`: quatro seções, deep links novos/antigos, compra, horas e carregamento sob demanda.
- `/@handle`: ordem, seções vazias, fallback, selo ausente e snippets com origem/handle corretos.
- Clipboard: Markdown, HTML, sucesso, falha e repetição com região de status.
- Certificados: membro, convidado, vínculo GitHub, concessão individual, lote, erro, retry, impressão e verificação.
- Gates: backend build/Jest quando houver regressão de contrato, frontend check/Vitest, scripts, `make astro-verify`, tenants e SonarCloud.

## Sequência

Concluir PR #628 e fila #627 → implementar esta fase com TDD → validar as três jornadas no dump → integrar `develop` → PR para `main` → validar `/membro`, `/@endersonmenezes`, convite e guia do selo em produção.

Announcements permanece preparado para a fase seguinte, sem misturar seu CRUD com esta revisão de experiência.

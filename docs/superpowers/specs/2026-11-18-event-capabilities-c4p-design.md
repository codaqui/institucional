<!-- AGENT-INDEX
purpose: Design da navegação híbrida e do C4P como recurso opcional de atividades próprias e externas.
audience: Mantenedores, implementers, revisores de arquitetura, frontend e operadores de release.
status: Aprovado pelo usuário em 2026-11-18 após builder check; implementação TDD na develop.
sections:
  - Intenção e resultados
  - Objetivos, não objetivos e anti-objetivos
  - Estado atual e restrições
  - Abordagens consideradas
  - Navegação pública
  - Modelo de recursos de atividades
  - Jornadas administrativa e pública
  - Compatibilidade, segurança e privacidade
  - Entrega incremental e verificação
  - Decisões deixadas ao builder
related-docs:
  - ../../adrs/001-event-platform.md — eventos próprios, externos e features existentes
  - ../../adrs/012-c4p.md — modelo, autorização, snapshot e jornada C4P atual
  - ../plans/2026-11-18-home-journeys.md — reorganização anterior da navegação
  - ../../mockups/home-jornadas.html — referência da navegação enxuta atual
agent-protocol:
  - Não implementar antes da aprovação final deste design e de um plano derivado.
  - Não criar framework genérico de plugins, apagar campanhas ou quebrar URLs de avaliação/submissão/resultado.
  - Notas, comentários e dados privados de propostas continuam fora de qualquer projeção pública.
-->

# Navegação por descoberta e C4P como recurso de atividades — Design

## Intenção e resultados

O footer reúne os destinos do portal, mas o header atual limitou demais a descoberta de Projetos, Blog, Trilhas e Mentoria. Ao mesmo tempo, o C4P aparece como produto separado, embora sua jornada natural comece em uma atividade que decide receber propostas de palestras.

A fase pretende restaurar a exploração global sem inflar o header e unificar a gestão de C4P às atividades, reutilizando o módulo já implementado. O resultado esperado é que uma pessoa encontre o conteúdo principal pelo header e que um organizador crie uma atividade primeiro e ative somente os recursos necessários depois.

## Objetivos, não objetivos e anti-objetivos

### Objetivos

- Manter o header compacto e tornar Projetos, Blog, Trilhas e Mentoria globalmente descobríveis.
- Retirar C4P do menu institucional principal e apresentá-lo como capacidade de atividades.
- Permitir C4P em eventos próprios e externos sem migrar eventos externos para `managed_events`.
- Iniciar a criação de C4P pela atividade, derivando identidade e escopo sempre que possível.
- Preservar campanhas, avaliadores, scoring, curadoria, e-mails, permissões atuais e URLs públicas/de avaliação.

### Não objetivos

- Criar SDK, marketplace, registry dinâmico ou framework genérico de plugins.
- Transformar palestras selecionadas automaticamente em programação, inscrições ou certificados.
- Reescrever scoring, dashboard, importação CSV, curadoria ou área do avaliador.
- Remover `/admin/c4p`, `/c4p/<slug>/submeter`, `/c4p/<slug>/resultado` ou `/c4p/avaliar` na primeira fase.
- Vincular campanhas legadas automaticamente sem evidência ou apagar campanhas standalone existentes.
- Alterar o modelo de tenants ou criar uma segunda arquitetura de navegação para comunidades.

### Anti-objetivos

- Um formulário de criação de evento ainda maior, com todas as configurações opcionais abertas ao mesmo tempo.
- Duas fontes editáveis para comunidade, título ou ownership da mesma campanha vinculada.
- Um menu com todos os destinos do footer repetidos no topo.
- Migrações destrutivas, URLs antigas quebradas ou exposição de dados privados de propostas.

## Estado atual e restrições

- `c4p_calls.managedEventId` já existe e a API já valida essa referência, mas a UI de criação usa somente slug e nome.
- Eventos externos já possuem `external_event_activations.features` com `checkin`, `certificates` e `payments`.
- O formulário de evento concentra dados básicos e não possui uma etapa de recursos.
- `/admin/c4p` continua útil como visão operacional, mas não precisa de item próprio no sidebar ou no header público.
- Eventos e C4P possuem snapshots estáticos e workflows próprios. A leitura pública não pode depender de chamada ao backend em runtime.
- Slugs de C4P são únicos e imutáveis; finalizar/reabrir continua exclusivo de admin.
- Turnstile, consentimento, proteção de PII e as regras atuais de auditoria são invariantes.

## Abordagens consideradas

1. **Somente restaurar links no header:** resolve a descoberta, mas mantém C4P e evento como jornadas paralelas. Rejeitada por atacar apenas o sintoma.
2. **Navegação híbrida + C4P como capacidade da atividade (escolhida):** mantém o topo compacto, aproveita `managedEventId` e o modelo de features externas e preserva o módulo C4P. Exige uma migration pequena e mudanças coordenadas de backend/frontend.
3. **Framework genérico de plugins:** permitiria extensões futuras, mas adiciona abstração e contratos sem um segundo caso que os justifique. Rejeitada por custo e antecipação desnecessária.
4. **Todos os links diretos no header:** elimina submenus, mas repete a poluição visual anterior e reduz a adaptação em telas menores. Rejeitada em favor de dois grupos de descoberta.

## Navegação pública

O header do portal passa a oferecer:

- **Comunidades** → `/comunidades`;
- **Atividades** → `/eventos`;
- **Aprender** → grupo com Visão geral (`/participe/estudar`), Trilhas (`/trilhas`) e Mentoria (`/participe/mentoria`);
- **Explorar** → grupo com Projetos (`/projetos`) e Blog (`/blog`);
- **Transparência** → `/transparencia`;
- **Apoiar** → `/participe/apoiar`;
- **Integrar minha comunidade** → CTA para `/sobre/ong`.

A logo continua sendo o atalho de Início e o item textual redundante não volta. Busca, tema e autenticação permanecem. O CTA de integração não é removido sem substituto porque `/comunidades` ainda não oferece essa ação de forma destacada.

Desktop e mobile compartilham a mesma hierarquia de navegação. Grupos usam botões com `aria-expanded`/`aria-controls`, popover no desktop e disclosures inline no drawer mobile; não se restaura `<details>/<summary>` para navegação aninhada. `aria-current` considera os filhos do grupo e o indicador não depende somente de cor.

O footer permanece completo. C4P deixa de ter link institucional dedicado no header; sua descoberta acontece nas atividades. `/c4p` redireciona para `/eventos?recurso=c4p`, uma visão filtrada das atividades com chamada aberta ou resultado público.

## Modelo de recursos de atividades

### Princípio

“Recurso” é o nome de produto para capacidades opcionais como inscrições, pagamentos, check-in, certificados e C4P. Não haverá carregamento dinâmico ou interface genérica de plugin.

### Eventos próprios

A existência de uma `c4p_call` vinculada por `managedEventId` indica que o recurso existe. Um evento pode ter no máximo uma chamada na nova jornada; trilhas e níveis continuam modelados nas propostas, não em campanhas adicionais.

### Eventos externos

`EXTERNAL_EVENT_FEATURES` passa a admitir `c4p`. `c4p_calls` recebe `externalActivationId` UUID nullable, referenciando `external_event_activations`. A ativação de C4P em um evento ainda sem activation cria a activation e a chamada em transação.

O endpoint genérico de ativação externa usa substituição do array de features e, por isso, não poderá adicionar nem remover `c4p`: tentativas de alterá-lo por esse endpoint retornam 400 com orientação para o endpoint específico; ao atualizar as demais features, o backend preserva o estado de `c4p` derivado da chamada existente. O painel genérico não apresenta C4P como um toggle independente. Enquanto a chamada existir, o flag permanece coerente com ela, inclusive depois de encerrada.

Índices únicos parciais impedem duas chamadas vinculadas ao mesmo `managedEventId` ou `externalActivationId`. Antes da migration, uma consulta read-only deve identificar duplicidades já existentes; divergências são resolvidas manualmente, sem deduplicação automática.

### Compatibilidade de registros

Campanhas legadas podem continuar com `managedEventId`, `communityId` ou nenhum desses vínculos. A exigência de atividade vale para os novos endpoints da jornada de recursos, sem reescrever o histórico. O endpoint standalone atual permanece compatível nesta fase, mas deixa de ser oferecido pela UI nova.

### Identidade e escopo

Os novos fluxos derivam da atividade o nome sugerido, slug sugerido e escopo de comunidade. O nome sugerido é `C4P — <título da atividade>`; o slug é validado como único antes da criação e continua imutável depois.

A comunidade de uma campanha vinculada não é editada separadamente. Permissões atuais de admin, diretor e responsável da comunidade permanecem; ownership/staff da atividade pode autorizar o mesmo escopo operacional já permitido pelo evento, sem ampliar finalização/reabertura para não-admin.

## Jornadas administrativa e pública

### Criar e configurar uma atividade

1. O organizador cria a atividade com os campos essenciais atuais.
2. Após salvar, a interface oferece **Configurar recursos**; edições posteriores usam a mesma entrada.
3. Um painel unificado mostra os recursos aplicáveis à origem da atividade e seus estados. Ele oferece deep links para os fluxos já existentes de ingressos, staff, check-in e certificados, sem reconstruí-los; somente a ativação/configuração inicial de C4P é uma jornada nova nesta fase.
4. Ativar C4P cria uma chamada em rascunho por endpoint específico da atividade:
   - `POST /events/:id/c4p`;
   - `POST /events/external/:eventKey/c4p`.
5. Para um evento externo ainda sem activation, o payload inclui os mesmos dados exigidos pela ativação atual (`communityProjectKey`, além de título/início quando necessários ao snapshot). Com activation existente, o backend reutiliza seus dados e não exige reenvio.
6. A configuração detalhada e a curadoria continuam usando o módulo existente, acessível pelo recurso. Não se duplicam propostas, avaliadores, dashboard ou relatório no módulo de eventos.
7. Encerrar uma chamada não apaga histórico. Não haverá “desativar” destrutivo nem remoção em cascata da atividade nesta fase.

`/admin/c4p` permanece como visão operacional acessível por URL, mas seu item dedicado sai do sidebar depois que os acessos por atividade estiverem cobertos. O item de perfil “Avaliar propostas (C4P)” permanece.

### Experiência pública

A página da atividade recebe uma seção de C4P apenas quando houver chamada associada:

- aberta e dentro da janela: CTA **Submeter palestra**;
- fechada sem resultado público: estado textual, sem propostas privadas;
- resultado público: resumo das palestras selecionadas e link para o resultado completo.

As páginas `/c4p/<slug>/submeter` e `/c4p/<slug>/resultado` continuam canônicas nesta fase. Isso evita quebrar links compartilhados e mantém o formulário/Turnstile já testados. A atividade é a entrada principal; não é necessário duplicar o formulário em duas rotas.

A projeção pública atual `event: {slug,title}` é preservada para eventos próprios e usada pelo build para associação às páginas estáticas, sem expor o UUID interno. Para eventos externos, o snapshot recebe de forma aditiva `externalEventKey` no formato já validado `<source>:<sourceId>:<eventId>`. Nenhum campo público existente é substituído; sync e loaders mantêm compatibilidade durante o rollout.

O build cruza esse snapshot com os eventos para filtrar e decorar as páginas estáticas. `/eventos?recurso=c4p` inclui chamadas abertas dentro da janela e resultados públicos, inclusive de atividades passadas. O parâmetro combina com `fonte` por AND; destaques, próximas/passadas, estatísticas e paginação continuam seguindo a mesma estrutura, calculada sobre o subconjunto filtrado. O sync de C4P continua independente nesta fase; nenhum fetch ao backend é introduzido no runtime público.

## Compatibilidade, segurança e privacidade

- Nenhuma projeção pública inclui e-mail, telefone, bio não selecionada, notas, comentários, votos, IDs de avaliadores ou dados de autores.
- As regras de seleção pública continuam limitadas a `{title, speakerName, track, level}`.
- Criação por atividade é idempotente: repetir a ativação retorna a chamada existente em vez de duplicá-la; falha parcial não deixa activation sem chamada ou vice-versa no fluxo externo.
- Slugs e URLs antigos não são reescritos. O redirect de `/c4p` é adicionado pelo mecanismo versionado de redirects, sem página-sombra.
- Proxy, roles e auditoria seguem os contratos atuais; novas mutações registram antes/depois sem IP de governo.
- Nenhuma campanha real é criada, vinculada, aberta ou finalizada durante desenvolvimento ou validação.

## Entrega incremental e verificação

1. **Fundação:** migration para `externalActivationId`, constraints após preflight, endpoints por atividade, idempotência, permissões e projeção pública do vínculo.
2. **Jornada administrativa:** entrada Configurar recursos, ativação própria/externa, estado e deep link para curadoria; retirada do item dedicado somente após cobertura dos acessos.
3. **Descoberta pública:** header híbrido, seção de C4P na atividade, filtro `/eventos?recurso=c4p` e redirect da vitrine antiga.

Verificação mínima:

- testes de migration down/up com campanhas legadas e preflight de duplicidades;
- ativação própria e externa, repetição idempotente, concorrência e rollback transacional;
- autorização de owner/staff/comunidade e finalização exclusiva de admin;
- snapshot sem PII e associação correta por identificador público;
- jornada sintética completa: atividade → C4P → submissão → avaliação → finalização → resultado;
- testes de teclado, `aria-current`, desktop/mobile e dark mode para a navegação;
- gates de backend, scripts, `make astro-verify`, tenants e revisão independente.

Rollout: backend/migration → sync inicial de C4P → frontend. A remoção do menu operacional e o redirect público só entram depois de validada a jornada por atividade em homologação.

Documentação viva a sincronizar durante implementação: ADR 001, ADR 012, manual de eventos, mapa de papéis, `AGENTS.md`, índice de planos e changelog da release correspondente.

## Decisões do autor após o builder check

Estas decisões fecham dúvidas técnicas sem alterar a direção aprovada pelo usuário:

- O endpoint genérico de features externas preserva C4P e não pode alterá-lo; somente o endpoint específico o gerencia, evitando dessincronização com `c4p_calls`.
- Configurar recursos é uma visão unificada com deep links para fluxos existentes; não há redesenho de ingressos, staff, check-in ou certificados nesta fase.
- A primeira ativação externa exige `communityProjectKey` e os dados mínimos já usados pela ativação genérica; ativações existentes são reutilizadas.
- `recurso=c4p` combina com `fonte` por AND e mantém a estrutura atual da listagem, incluindo resultados públicos de atividades passadas.
- A associação pública é aditiva e compatível: `event: {slug,title}` permanece para eventos próprios e `externalEventKey` é incluído para externos; UUID interno não se torna público.

## Decisões deixadas ao builder

- Decomposição dos componentes React/Astro e dos helpers de navegação, seguindo os padrões existentes.
- Implementação específica de popover/disclosure e posicionamento responsivo, sem dependência nova.
- Nomes internos de DTOs/services adicionais e organização dos testes, preservando os endpoints e contratos deste design.
- Forma visual dos cartões de recursos e da seção pública de C4P, usando tokens `--cq-*` e os mockups como referência, sem novas jornadas.

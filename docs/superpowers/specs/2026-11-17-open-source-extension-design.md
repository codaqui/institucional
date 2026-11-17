<!-- AGENT-INDEX
purpose: Desenho da Fase 8b.2 — conversão manual e assistida de projetos open source da vitrine em projetos de extensão.
audience: AI agents, mantenedores, diretoria e revisores de produto
status: ratificada para implementação em develop, incluindo diagnóstico de disponibilidade de mentoria
sections:
  - Contexto
  - Objetivos e limites
  - Abordagens
  - Fluxo e contratos
  - Verificação e rollout
related-docs:
  - ../../adrs/008-entities-extension-projects.md — lifecycle e autorização
  - ../specs/2026-11-17-extension-project-assisted-design.md — cadastro assistido da Fase 8b.1
  - ../../plans/pos-1-0/README.md — P6/P7
agent-protocol: Não implementar antes de ratificação; nenhuma conversão automática ou remoção da vitrine.
-->

# Fase 8b.2 — Vitrine open source para extensão, com conversão manual

## Contexto

`frontend/src/data/projects.ts` mantém onze projetos públicos com `title`, `description`, `href` e emoji. Eles são conteúdo da vitrine, não registros de `extension_projects`. A ADR 008 exige entidade jurídica, ODS, cronograma, mentor e demais campos para completar uma proposta; portanto, não existe conversão automática válida.

A Fase 8b.1 já entrega formulário assistido, validações e criação via `POST /projects`, com autorização de admin/diretor. P6 pode reutilizar esse fluxo sem backend ou migration nova.

## Objetivos e limites

### Objetivos

- Permitir que admin/diretor escolha um projeto da vitrine dentro de `/admin/projetos`.
- Pré-preencher nome e resumo a partir de `title`/`description`.
- Exibir a URL pública de origem como referência clicável.
- Exigir todos os dados institucionais antes de propor e preservar o rascunho mínimo.
- Criar um registro novo pelo endpoint atual e permitir ativação pelo lifecycle existente.

### Não objetivos e anti-objetivos

- Não remover, editar ou ocultar automaticamente o projeto open source original.
- Não importar em lote, não converter ao abrir a página e não criar vínculo implícito no banco.
- Não usar a URL GitHub como anexo: ela não pertence à allowlist do `StorageService`.
- Não alterar snapshot público, DTO, entidade, lifecycle, autorização ou conteúdo de `projects.ts`.
- Não implementar P7, Stripe, empresas ou CNPq.
- Não usar dados reais do dump em fixtures/documentação.

## Abordagens

- **Escolhida — seletor local + formulário existente:** um picker lê `projects.ts` no cliente e passa a origem ao `ProjectFormDialog`. A criação continua sendo `POST /projects`; nenhum backend novo.
- **Importação server-side pelo href:** criaria uma transição automática sem dados obrigatórios e exigiria deduplicação/vínculo novo. Contradiz a ADR e o objetivo manual.
- **Converter a vitrine inteira para extensão:** misturaria conteúdo open source com governança de extensão e apagaria o contexto original. Rejeitada.

## Fluxo e contratos

1. `/admin/projetos` mostra **Importar da vitrine** junto de **Novo projeto**.
2. `OpenSourceProjectPicker` lista os itens locais com título, descrição e link externo seguro. Uma busca local opcional filtra por título/descrição, sem chamadas HTTP.
3. Ao escolher, o picker fecha e abre o formulário com `project=null` e `sourceProject` selecionado.
4. `createProjectFormFromOpenSource(source, defaultEntityId)` parte dos defaults atuais e altera somente `name=title.trim()` e `summary=description.trim()`. Entidade e demais campos permanecem defaults/vazios; mentores e recursos começam vazios.
5. O diálogo mostra a origem com `target="_blank" rel="noopener noreferrer"`. O link não entra no payload.
6. **Salvar rascunho/proposta** usa exatamente o contrato atual. Erros de validação e API permanecem no diálogo.
7. Após salvar, a listagem recarrega. A origem open source continua intacta; a extensão só aparece publicamente depois de ativação.

O estado de origem deve ser limpo ao abrir **Novo projeto**, ao editar um registro e ao fechar/concluir uma importação, evitando contaminação entre formulários.

## Verificação e rollout

- Testes puros: defaults, nome/resumo e ausência de mentores/recursos; URL de origem não entra no payload.
- Testes React: selecionar origem, abrir formulário preenchido, salvar draft com `POST /projects`, validar proposta sem campos institucionais, erro de API visível e reset entre importar/editar/novo.
- Teste de permanência: a seleção não chama mutação alguma antes do usuário salvar.
- Gates: frontend Vitest/check, `make astro-verify` e `make astro-verify-tenants`; backend sem mudança, mas build/Jest completos no gate final.
- Rollout somente após a entrega anterior estar publicada: backend não precisa de mudança; frontend e jornada controlada de importar → rascunho → completar proposta → ativar.

A implementação usa bump minor e atualiza changelog, roadmap e ADR 008 somente quando o código estiver verificado.

## Diagnóstico associado — disponibilidade pública de mentoria

A página pública recebe um mentor com `availability=[]`; `/mentorship/availability` também retorna zero slots. O problema não é falha de fetch: não há regra semanal configurada. A fase deve tornar essa causa visível sem prometer uma correção automática de produção.

- Se o mentor não tem regras, mostrar **disponibilidade não cadastrada** e explicar que não há horários a solicitar.
- Se há regras, mas nenhum slot livre, manter a mensagem de ausência de horário nas próximas quatro semanas.
- Na área do mentor, orientar que ao menos um horário semanal é necessário para oferecer sessões na página pública.
- Provar em banco isolado, com fixtures sintéticas, a sequência regra → slots → solicitação de sessão, preservando consentimento e ocupação de slots.
- Configurar a disponibilidade real é ação operacional posterior, não efeito colateral do código.

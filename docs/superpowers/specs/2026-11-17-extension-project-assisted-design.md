<!-- AGENT-INDEX
purpose: Desenho da Fase 8b.1 — cadastro assistido de projetos de extensão, com mentores pesquisáveis, ODS nomeadas, campos já modelados e validação no admin.
audience: AI agents, mantenedores, diretoria e revisores de produto
status: ratificada para implementação em develop
sections:
  - Contexto e evidências
  - Objetivos e limites
  - Abordagens
  - Desenho escolhido
  - Contratos e validações
  - Verificação e rollout
related-docs:
  - ../../adrs/008-entities-extension-projects.md — modelo e autorização atuais
  - ../../plans/pos-1-0/README.md — candidatos P12, P6 e P7
  - ../../../backend/src/projects/projects.service.ts
  - ../../../frontend/src/components/islands/admin/projects/ProjectsAdminApp.tsx
agent-protocol: Não implementar antes de revisão/ratificação; P6, P7 e CNPq exigem specs próprias.
-->

# Fase 8b.1 — Cadastro assistido de projetos de extensão

## Contexto e evidências

O modelo `extension_projects` e os DTOs já aceitam mentor principal, co-mentores, ODS, cronograma, parceiros de apoio, orçamento e anexos. A criação/edição transacional e as validações de completude já existem no backend.

O admin atual apresenta três lacunas:

1. mentor e co-mentores são UUIDs digitados; ao editar, os campos ficam vazios e o mentor precisa ser informado novamente;
2. ODS aparecem como números, metodologia começa vazia e a validação acontece principalmente depois do envio;
3. `supportPartners`, `budget` e `attachments` existem na entidade/DTO, mas não no formulário.

`GET /mentorship/member-options` já pesquisa até dez membros ativos por nome/handle com escape de wildcards e retorna somente `{id,name,githubHandle,avatarUrl}`. Não há necessidade de outra busca nem de migration.

## Objetivos e limites

### Objetivos

- Selecionar mentor principal e co-mentores por nome/handle, preservando e exibindo os vínculos atuais na edição.
- Nomear as 17 ODS, manter ODS 4 como default e impedir duplicidade com a principal.
- Iniciar metodologia com `PjBL`, mantendo o texto editável.
- Expor parceiros de apoio, orçamento e anexos no formulário.
- Validar no cliente os mesmos contratos essenciais do backend antes de enviar, sem esconder erros retornados pela API.
- Manter rascunho mínimo com nome + entidade e proposta completa com os campos obrigatórios.

### Não objetivos e anti-objetivos

- Não implementar P6, não converter repositórios open source automaticamente e não alterar a vitrine pública.
- Não implementar P7 nem alterar assinaturas, empresas, Stripe ou histórico financeiro.
- Não criar campo CNPq antes de uma decisão de produto/backend.
- Não criar migration, novas designations, novos papéis ou uma segunda busca de membros.
- Não alterar snapshots públicos, lifecycle, inscrições, horas, comprovantes ou autorização.
- Não usar dados reais do dump em fixtures ou documentação.

## Abordagens

- **Escolhida — enriquecer `GET /projects` administrativo e decompor o formulário:** a resposta paginada passa a incluir opções públicas dos mentores atuais. A UI reutiliza a busca de mentoria e separa estado/validação, mentores, recursos e diálogo. Resolve criação e edição com pequeno contrato aditivo.
- **Endpoint `/projects/:id/mentors`:** evita ampliar a listagem, mas adiciona uma chamada por edição e outro contrato para o mesmo dado. Não oferece vantagem proporcional.
- **Somente frontend:** tornaria o formulário novo melhor, mas não recuperaria os vínculos existentes e repetiria busca/membros. Rejeitada.

## Desenho escolhido

### Backend

`ProjectsService.listManage()` preserva filtro, paginação e envelope, enriquecendo apenas os projetos da página com:

```ts
interface ProjectMemberOption {
  id: string;
  name: string;
  githubHandle: string;
  avatarUrl: string | null;
}

{
  mentor: ProjectMemberOption | null;
  coMentors: ProjectMemberOption[];
}
```

O mentor vem da designation ativa `mentor @ extension_project`. Co-mentores vêm de `project_participants` com `role='mentor'` e `leftAt IS NULL`, excluindo o principal. Consultas usam `In(projectIds)` e `In(memberIds)`, sem N+1 e sem e-mails/PII adicional. Membros históricos inativos continuam exibíveis na edição; somente a busca de novos membros exige ativo.

### Sincronização idempotente de mentores

A edição não pode causar e-mail ou churn quando o conjunto permanece igual. `syncMentorAndCoMentors` compara principal e participantes ativos antes/depois e retorna `principalChanged`/`membershipChanged`:

- conjunto idêntico: nenhuma escrita, auditoria ou notificação;
- mudança somente de co-mentores: fecha somente vínculos removidos, insere somente os novos, preserva IDs das linhas inalteradas e não envia e-mail ao principal;
- mudança de principal: atualiza a designation, aplica os deltas de participantes e envia uma única notificação ao novo principal;
- auditoria de mudança de mentores somente quando `membershipChanged`, com antes/depois.

O `update` usa `principalChanged` para decidir `notifyMentor`; criação com mentor continua notificando uma vez. Somente omitir campos no frontend seria insuficiente, pois uma alteração legítima de co-mentor também deve evitar notificação do principal inalterado.

### Busca e seleção de mentores

`ProjectMentorFields` usa MUI `Autocomplete` simples e múltiplo. Busca `/mentorship/member-options?search=<valor>` com debounce de 300 ms e mantém as opções selecionadas mesmo quando saem do resultado. O principal é obrigatório somente para proposta e não pode aparecer entre co-mentores. A seleção é convertida para `mentorMemberId` e `coMentors` somente no payload.

### ODS e recursos

`project-form.ts` concentra tipos, default, as 17 ODS em português, conversões e validações puras. ODS principal usa seleção nomeada; secundárias usam seleção múltipla com chips.

`ProjectResourcesFields` adiciona:

- linhas de parceiros `{nome,cnpj?}`, exigindo nome somente quando a linha é usada;
- itens de orçamento com quantidade, unidade, valor unitário e totais calculados em centavos; `valorTotalItem` e `totalGeral` são derivados, não digitados;
- linhas de anexos HTTPS, deixando a allowlist de host para o `StorageService` no backend;
- remoção de linhas vazias opcionais do payload.

### Diálogo e compatibilidade

`ProjectFormDialog` recebe projeto atual, entidades e callbacks, concentrando o formulário. `ProjectsAdminApp` continua responsável por listagem, filtros, ativação/cancelamento e finalização. Rascunho continua enviando somente `{name,entityId,status:'draft'}`. Edição preenche todos os campos atuais e envia os mentores exibidos, evitando apagar vínculos por omissão.

## Contratos e validações

Antes de salvar uma proposta, o cliente verifica:

- campos textuais obrigatórios, entidade, datas, mentor, horas e vagas;
- `startsAt < endsAt`, `registrationStartsAt < registrationEndsAt` e `registrationEndsAt <= startsAt`;
- ODS entre 1–17, secundárias únicas e diferentes da principal;
- ao menos um encontro com descrição/carga positiva e soma igual a `totalHours`, comparando em centavos;
- totais do orçamento calculados por quantidade × valor unitário e soma dos itens;
- anexos com URL HTTPS válida; hostname e demais regras permanecem no backend.

Erros de validação aparecem no diálogo sem chamada HTTP. Erros da API continuam visíveis por `extractErrorMessage`.

## Verificação e rollout

- Testes backend: mentor/co-mentores na página, exclusão do principal, históricos inativos, projetos sem vínculos e ausência de PII/N+1 por mocks em lote.
- Testes backend de sincronização: edição idêntica sem escrita/auditoria/e-mail, delta de co-mentor preservando linhas e notificação somente na mudança real do principal.
- Testes puros: defaults, ODS, datas, cronograma, centavos, parceiros, orçamento, anexos e payload draft/proposed.
- Testes React: busca/seleção, preservação na edição, principal fora dos co-mentores, recursos e bloqueio de envio inválido.
- Gates: backend build/Jest; `make astro-verify`; `make astro-verify-tenants` por alterar ilha compartilhada.
- Verificação integrada em banco isolado com fixtures sintéticas, sem dados reais. Publicação segue backend, frontend e então uma jornada controlada: criar rascunho, completar proposta, editar preservando mentores e ativar.

A versão de produto e o changelog recebem bump minor somente na implementação, junto com esta documentação viva e a ADR 008.

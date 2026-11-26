<!-- AGENT-INDEX
purpose: Desenho aprovável para hotfixes, Admin unificado de projetos, consistência operacional e validação dos fluxos críticos.
audience: Mantenedores, diretoria, AI agents e revisores.
status: Aprovado em 2026-11-26; R1 detalhada para implementação.
sections:
  - Intenção
  - Objetivos e limites
  - Abordagens
  - Direção escolhida
  - Releases e entregas
  - Estados e permissões
  - Verificação e rollout
related-docs:
  - 2026-11-24-projects-catalog-design.md — catálogo público e categorias.
  - ../plans/2026-11-24-projects-catalog.md — implementação da migration 055.
  - ../../adrs/008-entities-extension-projects.md — entidades e Extensão.
agent-protocol:
  - Não implementar antes da aprovação explícita deste desenho.
  - Cada release exige plano TDD próprio, gates e PR; nenhum deploy sem autorização.
-->

# Melhorias operacionais do Admin — desenho

## 1. Intenção

Tornar o Admin confiável para administração e diretoria, eliminando perda de dados e dúvidas sobre o que foi salvo, o que está público e quem pode executar cada ação. O trabalho cobre todas as sugestões aprovadas na conversa, em releases pequenas e verificáveis, sem transformar a revisão em uma reescrita do Admin.

## 2. Objetivos

- Impedir perda de dados ao salvar disponibilidade ou rascunho de projeto.
- Permitir que admin e diretores gerenciem Programas, Extensão, Campanhas comunitárias e Open Source sem chamadas manuais à API.
- Usar uma única fonte de dados para o catálogo e a importação open source.
- Tornar explícita a diferença entre salvar na API e publicar no portal por snapshot.
- Padronizar acesso, confirmações, tabelas, loading, erro, retry, empty states e datas.
- Validar os fluxos de maior risco: membros/roles, privacidade, financeiro, eventos, mentoria e comunidades.

## 3. Não objetivos e anti-objetivos

- Não criar novas categorias, tabelas paralelas ou papéis globais.
- Não permitir participantes, horas ou certificados fora de Extensão.
- Não alterar a categoria de um projeto depois da criação.
- Não substituir o ledger de dupla partida nem regras de autorização existentes.
- Não disparar deploy, workflow de produção ou exclusão de dados sem autorização específica.
- Não redesenhar o portal público ou trocar o mundo visual do Admin.
- Não tratar melhorias cosméticas como pré-requisito para corrigir perda de dados.

## 4. Restrições

- `extension_projects` e a migration 055 permanecem como fonte do catálogo.
- `GET /projects` sem filtro de categoria deve preservar o comportamento anterior, retornando somente Extensão; o novo Admin pedirá categorias explicitamente.
- `kind` não vira categoria. Extensão mantém formulário, mentores e operações atuais.
- `canonicalUrl` aceita somente caminho interno ou HTTPS.
- Permissões efetivas continuam no backend; guards do frontend são experiência, não segurança.
- Todo snapshot continua gerado por scripts/workflows, nunca editado manualmente.
- O trabalho já validado de disponibilidade em `MentorDashboardIsland` entra no primeiro hotfix.
- Novas ações sobre GitHub workflows exigem desenho de segurança separado e não entram no CRUD inicial.

## 5. Abordagens consideradas

### A. Releases incrementais — escolhida

Hotfix primeiro, Admin unificado depois, seguido de consistência/publicação e validação dos fluxos críticos. Cada etapa tem testes e PR próprios. Reduz risco e permite levar correções rapidamente sem esperar a revisão inteira.

### B. Uma única revisão ampla

Entregar Admin de Projetos, snapshots, padrões e E2E em uma única release. Diminui o número de PRs, mas mistura muitas áreas, alonga o tempo até o hotfix e aumenta o risco de regressão.

### C. Somente Admin de Projetos

Resolve a dor mais visível, mas deixa perda de dados, inconsistências de acesso e dúvidas de publicação nos demais módulos. Não atende ao escopo aprovado de revisar todas as sugestões.

## 6. Direção escolhida

Manter o modo Operate: padrões conhecidos, densidade útil, hierarquia previsível e cópia explícita. A inovação fica na clareza dos estados e na consolidação dos dados, não em novos componentes visuais.

### Admin de Projetos

- Uma rota `/admin/projetos`, intitulada **Projetos**.
- Filtros por categoria, status e entidade; categorias funcionam como filtros da mesma tarefa, não como páginas separadas.
- `GET /projects?category=extension|program|campaign|open_source|all`; omissão continua equivalente a `extension`.
- Listagem com `DataTable`, paginação, skeleton, retry e empty state orientado.
- Campos editoriais comuns: nome, entidade, resumo, categoria, URL canônica e visibilidade.
- Somente Extensão mostra o formulário completo com mentores, encontros, ODS, orçamento e participantes.
- Ações seguem a máquina de status existente; finalização exige a URL de relatório quando aplicável.
- Datas em pt-BR e nenhum `null` ou ISO cru.
- A importação open source deixa a lista local duplicada e usa o mesmo catálogo público da API. Na unificação, os registros `open_source` existentes são abertos para edição, nunca clonados. A ação antiga “Importar da vitrine” é removida; criar Extensão a partir de um repositório exigiria nome/slug e vínculo próprios e fica fora do escopo.

### Publicação por snapshot

- O Admin informa quando o registro foi salvo na API e apresenta `generatedAt` como **data do conteúdo do catálogo**, nunca como data da última execução do sync, pois o timestamp é preservado quando o conteúdo não muda.
- Feedback distingue “salvo” de “publicado”; não promete atualização imediata. Após editar, orienta executar o sync para incluir a alteração.
- O workflow manual/diário é apresentado como parte da operação. Um botão “Sincronizar portal” com workflow dispatch fica para spec de segurança própria.

### Consistência transversal

- Substituir `window.confirm` por `ModalConfirm` nos fluxos identificados.
- Acesso direto a Anúncios ganha redirect/aviso de acesso negado coerente com os demais módulos. A autorização permanece `admin`-only; nenhuma role de diretor é adicionada ao backend de Anúncios.
- Entidades usam carregamento completo ou busca paginada, sem limitar silenciosamente a primeira página.
- Reutilizar `AdminLoadFeedback`, `DataTable` e padrões existentes antes de criar novos componentes.
- Revisar rótulos em português e estados de erro/sucesso sem alterar contratos da API.

## 7. Releases e entregas

### R1 — Hotfix 1.14.1

- Incluir a correção já validada de disponibilidade: `weekday` somente na URL; payload com horários e fuso.
- Salvar rascunho de projeto com todos os campos preenchidos, inclusive sem mentor, sem exigir validação de proposta.
- Reabrir rascunhos completos ou incompletos e permitir transição posterior sem perda.
- Corrigir datas e `null` na tabela de Projetos.
- Testes RED→GREEN, jornada real de disponibilidade e testes de payload do rascunho.

### R2 — Admin unificado 1.15.0

- Filtro de categoria na API administrativa, preservando o default de Extensão.
- Listagem e editor unificados das quatro categorias.
- Ações específicas por categoria e validação coerente com backend.
- Importação open source pela fonte pública única.
- Entidades sem corte silencioso da primeira página.
- E2E admin/diretor e prova de que participantes, horas e certificados continuam exclusivos de Extensão.

### R3 — Consistência e publicação 1.16.0

- Padronizar confirmações, acesso em Anúncios, loading, retry e empty states nos fluxos mapeados.
- Apresentar estado de publicação por snapshot nos módulos aplicáveis, começando por Projetos e Anúncios.
- Exibir última sincronização disponível sem inventar dados quando o snapshot estiver ausente ou antigo.
- Documentar a operação manual dos workflows e o que ainda não é automático.

### R4 — Fluxos críticos, versão conforme o conteúdo

- Membros/roles/designations: revogação, desativação, autopreservação e atualização imediata de permissões.
- Privacidade: exportação, revisão e conclusão de exclusão com confirmação e feedback.
- Financeiro: centavos, reenvio, transferências, recibos e ledger.
- Eventos: organizer/host/checker/finance, check-in manual/scanner e certificados.
- Mentoria: reatribuição, candidaturas, agenda e sessões.
- Comunidades: responsible, selo, integração e publicação.
- Correções encontradas usam patch; comportamento novo usa minor. Nenhuma versão é atribuída antes do diagnóstico.

## 8. Estados e permissões

Cada fluxo alterado deve cobrir, quando aplicável: loading, erro com retry, vazio orientado, sucesso, falha de validação, falha de rede, acesso negado, alteração não salva e sincronização pendente. Testes devem incluir admin, diretor autorizado e ator sem permissão, provando que o backend rejeita mesmo quando o frontend apresenta a ação incorretamente.

## 9. Verificação

- TDD para cada correção ou comportamento novo.
- Gates das camadas alteradas: backend build/Jest, scripts, `astro check`, frontend testes, `make astro-verify` e `make astro-verify-tenants`.
- E2E usa as ferramentas já presentes: Supertest/Jest com PostgreSQL descartável para API, React Testing Library para as ilhas e Playwright para jornadas/inspeção no browser. Nenhuma dependência de teste ou novo job de CI é necessário.
- PostgreSQL descartável para disponibilidade, ciclo de projetos, permissões, privacidade, finanças e eventos que exigirem dados reais.
- UI em desktop/mobile e claro/escuro nas telas alteradas; fixtures temporárias não podem ser commitadas.
- Revisão independente por release; somente achados críticos/importantes entram na correção obrigatória.
- SonarCloud e CI verdes antes de apresentar cada PR como pronta.

## 10. Rollout

A 1.14.0 foi integrada pela PR #674 e publicada, portanto R1 começa em `develop` como 1.14.1. Cada etapa é commitada na `develop`, validada no branch deployment do Pages e recebe PR própria de `develop` para `main`, sem merge ou deploy automático por este trabalho. A ordem operacional continua: backend/migrations quando houver → Coolify → sync dos snapshots afetados → frontend. R4 não executa exclusões, conversões, cobranças ou publicações reais sem autorização específica.

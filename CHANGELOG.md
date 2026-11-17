<!-- AGENT-INDEX
purpose: Changelog consolidado do produto Codaqui desde o marco 1.0.0, com releases, PRs, migrations e pendências operacionais verificáveis.
audience: Mantenedores, presidência, AI agents e operadores de release.
status: Atualizado até a release v1.2.0-backend de 2026-11-17; propostas futuras não são releases.
sections:
  - Política de versão
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

## [1.3.0] — 2026-11-17

**Estado:** implementada em `develop`; integração em `main` e release ainda pendentes. **Migration:** nenhuma.

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

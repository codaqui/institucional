<!-- AGENT-INDEX
purpose: Fila operacional de UX, conteúdo e correções solicitada em 2026-11-23, com escopo e rastreio por jornada.
audience: Mantenedores, presidência e AI agents executando a fila.
status: Em execução; causas e entregas serão marcadas somente após evidência.
sections:
  - Regras
  - Em execução
  - Fila priorizada
related-docs:
  - docs/plans/frontend-jornadas/README.md
  - docs/superpowers/plans/2026-11-23-home-supporters-carousel.md
agent-protocol:
  - Revalidar código e dados antes de marcar concluído; bugs e melhorias não são tratados como equivalentes.
  - Não inventar métricas, mentores, integrações ou dados de impacto.
-->

# Fila UX e operação — 2026-11-23

## Regras

- Preservar Astro, ilhas atuais, tokens, autorização, privacidade e contratos públicos.
- TDD para comportamento novo e correções; inspeção visual claro/escuro e mobile/desktop para alterações de UI.
- Nenhuma métrica ou integração é declarada sem fonte verificável.
- Cada item tem entrega própria e não autoriza mudanças fora de seu escopo.

## Em execução

| Item | Entrega | Estado |
|---|---|---|
| Carrossel de apoiadores | Alternar pessoa/patrocinador junto à contagem da home, com autoplay acessível e benefício Empresa Amiga documentado | Spec/plano aprovados; Task 1 em implementação |

## Fila priorizada

| Prioridade | Jornada | Problema a verificar | Entrega esperada | Estado |
|---|---|---|---|---|
| P0 | Assembleias | `/assembleias` com too many redirects | Redirect único e página acessível, com teste de fluxo | Investigação |
| P0 | Conta e privacidade | Exportação/revisão de exclusão tenta ler resposta vazia como JSON | Resposta tratada sem erro falso e confirmação clara | Investigação |
| P1 | C4P | Footer pode apontar para landing obsoleta | Confirmar recurso de eventos e alinhar destino sem remover acesso necessário | Investigação |
| P1 | Insights | Conteúdo 2026 não comunica associação de comunidades nem impacto atual | Reescrita com eventos, alcance verificável, 519 WhatsApp e 772 Discord | Investigação de dados |
| P1 | Mentoria pública/admin | Datas ausentes na seleção e hierarquia fraca | Corrigir datas e melhorar escolha de mentor/horário sem quebrar fuso | Investigação |
| P1 | Equipe e comunidades | `/sobre/equipe` desconectada de ONG/comunidades | Links naturais entre estrutura, pessoas e comunidades | Investigação |
| P1 | Perfil/membro | Card público inadequado em `/@handle` e conteúdo pertencente à visão geral | Separar apresentação pública de dados da conta logada | Investigação |
| P1 | Conta | “Salvar visibilidade” sobrepõe card seguinte | Layout sem sobreposição em todos os tamanhos | Investigação |
| P1 | Admin/comunidades | Tabela crua e pouco escaneável | Reuso dos padrões admin, responsividade e estados preservados | Investigação |
| P1 | Agenda do mentor | Criar/administrar janelas é confuso | Revisar fluxo e integração Google Calendar/e-mail/ICS existente antes de mudar contratos | Investigação |

## Sequência de integração

1. Corrigir quebras funcionais (redirects e privacidade).
2. Entregar carrossel e conteúdos com dados verificáveis.
3. Corrigir mentorias e conta/membro com testes de fluxo.
4. Melhorar jornadas equipe/admin e revisar a integração de calendário sem assumir nova dependência.

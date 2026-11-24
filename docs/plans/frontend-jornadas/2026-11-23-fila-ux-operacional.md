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

## Entrega concluída neste ciclo

| Item | Entrega | Estado |
|---|---|---|
| Carrossel de apoiadores | Alternância pessoa/patrocinador junto à contagem da home, com autoplay acessível e benefício Empresa Amiga documentado | Implementado, revisado e verificado com 39/39 checks em navegador |

## Fila priorizada

| Prioridade | Jornada | Problema a verificar | Entrega esperada | Estado |
|---|---|---|---|---|
| P0 | Assembleias | `/assembleias` com too many redirects | Redirect único e página acessível, com teste de fluxo | Corrigido em `1bf36d8b53ae` |
| P0 | Conta e privacidade | Exportação/revisão de exclusão tenta ler resposta vazia como JSON | Resposta tratada sem erro falso e confirmação clara | Corrigido em `ffdee7f4a56a` |
| P1 | C4P | Footer pode apontar para landing obsoleta | Confirmar recurso de eventos e alinhar destino sem remover acesso necessário | Footer canônico e legados corrigidos em `1bf36d8b53ae` |
| P1 | Insights | Conteúdo 2026 não comunica associação de comunidades nem impacto atual | Reescrita com eventos, alcance verificável, 519 WhatsApp e Discord dinâmico | Implementado com agregação do snapshot e ressalvas metodológicas |
| P1 | Mentoria pública/admin | Datas ausentes na seleção e hierarquia fraca | Corrigir datas e melhorar escolha de mentor/horário sem quebrar fuso | Datas/fuso corrigidos em `1fd8aa5490d1` e `480e59f152f1`; painel admin pendente |
| P1 | Equipe e comunidades | `/sobre/equipe` desconectada de ONG/comunidades | Links naturais entre estrutura, pessoas e comunidades | Links e CTAs em `108fc6043103` |
| P1 | Perfil/membro | Card público inadequado em `/@handle` e conteúdo pertencente à visão geral | Separar apresentação pública de dados da conta logada | Selo movido ao overview e horas zeradas ocultas em `d02eae819583` |
| P1 | Conta | “Salvar visibilidade” sobrepõe card seguinte | Layout sem sobreposição em todos os tamanhos | Corrigido e verificado em Chromium com dados sintéticos |
| P1 | Admin/comunidades | Tabela crua e pouco escaneável | Reuso dos padrões admin, responsividade e estados preservados | Chips, menu, DataTable e retry em `3266ae9e1461` |
| P1 | Agenda do mentor | Criar/administrar janelas é confuso | Revisar fluxo e integração Google Calendar/e-mail/ICS existente antes de mudar contratos | Em implementação na 1.12.0: múltiplas janelas, fuso, validações, e-mails e ICS |

## Evidências e limites da investigação

- O loop de assembleias vinha de `/assembleias/* → /assembleias/codaqui/:splat`, destino recapturado pela origem. O snapshot não contém URLs legadas a preservar; a regra foi removida e há guarda contra novos redirects auto-referentes.
- `/c4p` agora é recurso da agenda. O footer usa `/eventos?recurso=c4p`; `/c4p` e `/c4p/` permanecem como redirects legados para a agenda filtrada.
- O erro de privacidade ocorria no GET sem solicitação: HTTP 200 com corpo vazio, não uma falha da exportação ou do POST. O frontend agora distingue corpo vazio de JSON presente.
- O card “Compartilhe seu selo” é autosserviço e saiu da página pública. O SVG público permanece; o overview do dono mantém os snippets. Horas públicas zeradas deixam de gerar card vazio.
- Mentoria: a API já retorna datas completas. Slots e acompanhamento agora usam `formatMentorshipDate` com o fuso da sessão e status pt-BR. O painel ainda precisa listar/editar múltiplas regras e revisar fuso, validação e recuperação de sessão.
- Não existe integração Google Calendar/ICS implementada hoje. A etapa recomendada é adicionar link de acompanhamento e, depois, link Google Calendar; anexos ICS exigem extensão do provider de e-mail e não devem ser presumidos.
- Insights: 413 eventos concluídos e 13.234 inscrições estão no snapshot atual. `userCount` é RSVP, não presença nem pessoa única; GA4 soma usuários mensais. Discord usa o snapshot automático (774 na investigação), enquanto 519 WhatsApp é baseline manual sem API.

## Sequência de integração

1. Corrigir quebras funcionais (redirects e privacidade).
2. Entregar carrossel e conteúdos com dados verificáveis.
3. Corrigir mentorias e conta/membro com testes de fluxo.
4. Melhorar jornadas equipe/admin e revisar a integração de calendário sem assumir nova dependência.

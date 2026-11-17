<!-- AGENT-INDEX
purpose: Roadmap proposto para capacidades posteriores ao 1.0 que exigem novas agregações de backend e fluxos completos, começando pelos painéis deliberadamente omitidos da Fase 9.
audience: Presidência, mantenedores e AI agents planejando trabalho futuro.
status: Proposta não aprovada, sem data ou compromisso semver; nenhum item está implementado por este documento.
sections:
  - Limite do roadmap
  - Painéis adiados da Fase 9
  - Dependências de backend e produto
  - Relação com outras fases
related-docs:
  - ../pos-1-0/README.md — roadmap vivo e fases 8/8b.
  - ../../superpowers/specs/2026-11-16-fase-9-paineis-design.md — exclusões ratificadas da Fase 9.
  - ../../adrs/019-privacy-self-service.md — escopo publicado em 1.2.0.
agent-protocol:
  - Não implementar estes itens sem spec, modelo de autorização, contratos de API e plano próprios.
  - “1.5” é rótulo organizacional, não promessa de versão; o semver segue a mudança efetivamente entregue.
-->

# Roadmap proposto 1.5 — painéis orientados a pendências

## Limite do roadmap

A Fase 9 simplificou `/membro` e o admin sem criar consultas agregadas. Portanto, o rótulo “Painel e pendências” descreve uma direção futura, não uma capacidade já existente. Esta proposta registra o que ficou de fora e por quê; não autoriza implementação nem estabelece uma release 1.5.

## Painéis adiados da Fase 9

| Capacidade ausente | O que o usuário veria | Por que não existe hoje |
|---|---|---|
| **Próximos passos dinâmicos no Início do membro** | Ações priorizadas a partir de eventos, mentorias, horas, projetos e conta, com links para resolver cada pendência. | Não há API que agregue esses domínios, nem regras compartilhadas de prioridade, deduplicação, expiração ou ordenação. Buscar cada módulo no cliente recriaria over-information e não produziria um total confiável. |
| **Contadores de pendências na sidebar/admin** | Badges numéricos por item e papel, atualizados sem abrir cada página. | Não existe projeção autorizada de contagens por papel nem política de cache/polling. Cada item possui escopo e regras diferentes; contadores locais de página não representam o total. |
| **Dashboard de pendências por papel** | Fila unificada para admin, diretor, mentor, organizador e demais papéis, com filtros e navegação para a ação. | Exige um fluxo completo de agregação, autorização, paginação, estados vazios/parciais e consistência entre módulos, não apenas um novo card ou menu. |

## Dependências de backend e produto

Antes de uma spec executável, a fase precisa decidir e testar:

1. **Catálogo de pendências:** quais eventos, mentorias, horas, projetos, certificados, solicitações e tarefas financeiras entram; quais transições encerram cada item.
2. **Autorização por papel:** como roles globais, designations, ownership e escopo por comunidade/evento produzem exatamente os mesmos limites das APIs atuais.
3. **Contrato agregado:** envelope paginado, contadores e links de ação; distinção entre indisponibilidade parcial e zero pendências.
4. **Atualização e desempenho:** cache, invalidação, polling somente com visibilidade da aba, limites de consultas e ausência de N+1 entre domínios.
5. **Privacidade:** somente metadados necessários à ação; nenhum e-mail, nota ou dado de terceiros na agregação.
6. **Jornada completa:** resolver a pendência no módulo de origem, atualizar o painel e preservar deep links; contador sem ação não é entrega suficiente.

## Relação com outras fases

- A **Fase 8** (páginas públicas) é a próxima fase preparada e não depende deste roadmap.
- A **Fase 8b** (projetos/patrocínio) permanece no roadmap pós-1.0 e não é automaticamente absorvida aqui.
- As ondas restantes de frontend devem ser revalidadas individualmente; refatorações visuais não substituem os contratos de backend acima.
- Real Network continua fora do backlog operacional.

<!-- AGENT-INDEX
purpose: Design curto da revisão visual da barra pública de anúncios institucionais.
audience: Mantenedores, implementers e revisores do frontend.
status: Implementado na develop em 2026-11-18; integração em main e deploy pendentes.
sections:
  - Intenção
  - Abordagens
  - Desenho aprovado
  - Restrições e verificação
related-docs:
  - docs/superpowers/specs/2026-11-11-announcements-design.md — desenho funcional original
  - docs/adrs/017-announcements.md — decisão arquitetural do módulo
  - docs/mockups/main-proposta.html — referência visual aprovada
agent-protocol:
  - Não alterar APIs, snapshot, ordenação, persistência ou regras de exibição.
  - Não adicionar dismiss, toast, carrossel ou comportamento sticky.
-->

# Revisão visual da barra de anúncios — Design

## Intenção

Aproximar os anúncios institucionais do mockup aprovado: uma barra fina, fluida e integrada ao cabeçalho, sem o peso visual dos cartões atuais. A mudança atende visitantes do portal em desktop e mobile e preserva todo o comportamento funcional já publicado.

## Abordagens

- **Ajustar a barra existente (escolhida):** alterar somente marcação e CSS da `AnnouncementsBarIsland`. Mantém o contrato atual, tem baixo risco e reproduz o mockup.
- **Adotar notificações toast:** descartada por introduzir sobreposição, dispensamento e uma jornada diferente da referência.
- **Criar carrossel ou dismiss por visitante:** descartada por esconder conteúdo, exigir estado novo e contrariar o desenho funcional do módulo.

## Desenho aprovado

- Cada anúncio ocupa a largura disponível, com fundo semântico e somente separador horizontal.
- O conteúdo fica centralizado na mesma largura máxima do cabeçalho (`72rem`) e usa o mesmo espaçamento lateral.
- Badge de severidade, texto e link formam uma linha fluida no desktop; o link permanece inline com a mensagem.
- No mobile, a mensagem quebra naturalmente, sem truncamento, altura fixa ou transbordo horizontal.
- Múltiplos anúncios continuam na ordem recebida e são separados por bordas finas, sem margens externas ou espaço entre cartões.
- Não há comportamento sticky, animação, toast, carrossel ou botão de dispensar.

## Restrições e verificação

Manter snapshot, segurança dos links, escape de texto, severidades textuais, foco visível, temas claro/escuro e ausência de espaço em snapshot vazio ou erro. Usar somente tokens `--cq-*`, sem nova dependência.

A implementação deve manter os testes comportamentais existentes, acrescentar cobertura para a estrutura inline quando útil e passar por Vitest, `astro check`, build codaqui e builds dos tenants. A revisão visual deve cobrir desktop, mobile, múltiplas severidades e os dois temas.

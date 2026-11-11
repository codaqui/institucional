<!-- AGENT-INDEX
purpose: ADR das barras de anúncio institucional administráveis por admin e publicadas por snapshot.
audience: AI agents, mantenedores e operadores de release.
status: Implementado e verificado; integração e publicação pendentes.
sections:
  - Contexto e decisão
  - Modelo e autorização
  - Snapshot e frontend
  - Privacidade e acessibilidade
  - Verificação e rollout
related-docs:
  - ../superpowers/specs/2026-11-11-announcements-design.md — design aprovado
  - ../superpowers/plans/2026-11-11-announcements.md — implementação e evidências
  - 011-frontend-astro-multi-tenant-pages.md — arquitetura do portal e snapshots
agent-protocol:
  - Não incluir autores, tracking, dismiss, segmentação ou campanhas de e-mail nesta fase.
  - Publicar backend/migration antes do sync inicial e do frontend.
-->

# ADR 017 — Announcements

- **Data da decisão:** 2026-11-11
- **Status:** Implementado e verificado; integração e publicação pendentes
- **Escopo:** Backend 0.26.0, migration 047, CRUD admin, snapshot público e barra no BaseLayout

## Contexto e decisão

A associação precisava comunicar manutenções e canais de suporte sem editar código nem criar posts. O recorte adotado é uma entidade `announcements` administrada somente por `admin`, com texto simples, severidade, link opcional, janela e ativação lógica. Não é CMS, campanha de e-mail, notificação pessoal ou C4P.

Criar, editar e desativar exige admin inclusive no service, não apenas no guard do controller. DELETE faz somente `active=false`, preservando histórico e auditoria antes/depois. A projeção pública aceita somente itens ativos dentro da janela e ordena `error`, `warning`, `info`, `success`, depois `createdAt DESC`.

## Modelo e autorização

`text` tem 3–280 caracteres e rejeita HTML/Markdown. Links internos começam por `/` sem `//`; externos exigem HTTPS, sem credenciais. Todo link exige rótulo de até 60 caracteres. `endsAt` deve ser posterior a `startsAt` quando ambos existem.

APIs:
- `GET /announcements/admin` pagina com `{data,total,page,totalPages,limit}`;
- `POST /announcements/admin`;
- `PATCH /announcements/admin/:id`;
- `DELETE /announcements/admin/:id` desativa logicamente;
- `GET /announcements/public` retorna somente `id`, `text`, `severity`, `linkUrl`, `linkLabel`, `startsAt` e `endsAt`.

## Snapshot e frontend

`npm run sync:announcements` consulta `/announcements/public`, valida todos os itens e grava `static/announcements/index.json` com temp + rename atômico. Erros HTTP, JSON, dados privados, texto inseguro, links ou janela inválida preservam o arquivo anterior. Conteúdo igual não regrava nem altera o timestamp.

O workflow `sync-announcements.yml` roda diariamente às 06:31 UTC e por dispatch. O prebuild copia o snapshot para `frontend/public/announcements/index.json`; esse path é excluído do proxy, enquanto `/announcements/` encaminha API admin/pública.

`BaseLayout.astro` inclui `AnnouncementsBarIsland` antes do conteúdo. A ilha consulta o snapshot em runtime e renderiza uma região nomeada com cada anúncio como artigo, severidade textual, texto escapado e links seguros. Vazio ou erro não reserva espaço. O admin em `/admin/announcements` oferece listagem paginada, Dialog com prévia, validação e confirmação de desativação na seção Comunicação.

## Privacidade e acessibilidade

O snapshot não contém autores, notas internas, IP nem dados de membros. Não há cookies, tracking, segmentação ou persistência por visitante. Links externos usam `target="_blank" rel="noopener noreferrer"`. As cores vêm dos tokens `--cq-*` nos dois temas e a severidade não depende somente de cor.

## Verificação e rollout

- Backend: 108 suites/1.368 testes, incluindo validação, autorização, janela, CRUD e projeção pública; E2E PostgreSQL de criação → público → encerramento → desativação e migration down/up preservando dados.
- Sync: 5 testes de escrita completa, preservação em erro, validação, rollback e conteúdo inalterado; proxy com 126 testes.
- Frontend: 118 arquivos/1.011 testes, cobrindo admin, snapshot vazio/erro, múltiplas severidades, links e texto escapado.
- Gates: backend build, frontend `astro check`, scripts 99/99, `make astro-verify` e quatro builds multi-tenant.

Publicação: integrar `develop`, abrir PR para `main`, publicar backend 0.26.0/migration 047, executar o sync inicial e então publicar o frontend. A validação real deve criar aviso de manutenção com link para `https://github.com/codaqui/institucional/issues` e verificar texto/link em claro/escuro sem expor autores.

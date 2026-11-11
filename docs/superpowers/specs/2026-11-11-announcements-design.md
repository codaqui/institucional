<!-- AGENT-INDEX
purpose: Design da fase Announcements — barras de aviso administráveis no portal Codaqui.
audience: Mantenedores, implementers e revisores da fase posterior à PR de patches operacionais.
status: Preparado para revisão; implementação ainda não iniciada.
sections:
  - Contexto e objetivo
  - Modelo e APIs
  - Snapshot e frontend
  - Segurança, privacidade e acessibilidade
  - Testes, rollout e sequência
related-docs:
  - docs/plans/codaqui-1-0/README.md — sequência das fases
  - docs/adrs/016-certificate-invite-queue.md — operação assíncrona de e-mails, escopo separado
agent-protocol:
  - Não implementar nesta fase campanhas de e-mail, C4P ou mudanças de check-in.
  - Não expor dados de autor/admin no snapshot público.
  - Não iniciar a migration 047 antes de integrar a PR de patches e confirmar a versão seguinte.
-->

# Announcements — Design

## Contexto e objetivo

A associação precisa comunicar manutenções, melhorias e canais de suporte sem editar o código nem publicar um post. A fase entrega barras de anúncio administráveis no portal, começando pelo aviso de correções em andamento e pelo link para reportar bugs no GitHub.

O recorte é deliberadamente pequeno: não é campanha de e-mail, CMS, sistema de notificações pessoais nem C4P. Anúncios são institucionais, públicos e iguais para todos os visitantes.

## Modelo e APIs

Criar a entidade `announcements` na migration **047**, após a sequência atual 046 e somente quando a versão de backend da PR anterior estiver confirmada. Estimativa de escopo: backend **0.25.0**, após fila global 0.23.0 e patches 0.24.0.

Campos:

- `id` UUID;
- `text` texto simples, 3–280 caracteres, sem HTML/Markdown;
- `severity`: `info`, `success`, `warning` ou `error`;
- `linkUrl` opcional: caminho interno iniciado por `/` (exceto `//`) ou URL HTTPS;
- `linkLabel` opcional, até 60 caracteres, obrigatório quando houver link;
- `startsAt` e `endsAt` opcionais em `timestamptz`, com fim posterior ao início;
- `active` booleano;
- `createdById`, `updatedById`, `createdAt`, `updatedAt`.

Não há posição manual nem dismiss por visitante no MVP. Múltiplos anúncios ativos aparecem em ordem de severidade (`error`, `warning`, `info`, `success`) e depois `createdAt DESC`. Desativar ou encerrar a janela remove o anúncio da projeção pública sem apagar o histórico.

Rotas de gestão, fora do prefixo `/admin/` para preservar a allow-list estreita do proxy:

- `GET /announcements/admin?page=&limit=` com envelope `{data,total,page,totalPages,limit}`;
- `POST /announcements/admin`;
- `PATCH /announcements/admin/:id`;
- `DELETE /announcements/admin/:id` somente como desativação lógica (`active=false`), preservando histórico e auditoria;
- `GET /announcements/public`, usado pelo sync, retorna somente anúncios ativos dentro da janela e apenas campos públicos.

Somente `admin` gerencia. Criar, editar e desativar registram auditoria antes/depois, sem IP em ações de governança. Validar link e janela no backend, mesmo com validação complementar no formulário.

## Snapshot e frontend

O sync dedicado gera `static/announcements/index.json` atomicamente a partir de `/announcements/public`, preservando o arquivo anterior em erro e evitando escrita quando o conteúdo não muda. O prebuild copia o snapshot para `frontend/public/announcements/index.json`; `/announcements/index.json` é excluído do proxy para entregar o asset estático.

`BaseLayout.astro` inclui `AnnouncementsBarIsland` antes do slot principal. A ilha consulta o snapshot em runtime, sem exigir rebuild imediato após o próximo sync, e renderiza uma região nomeada com cada anúncio como artigo. Texto é escapado pelo React; nenhum HTML é aceito. Links internos usam navegação normal; links externos usam `target="_blank" rel="noopener noreferrer"`.

A barra usa tokens `--cq-*`, funciona nos temas claro/escuro, não depende somente de cor e mantém foco visível. Erro ou snapshot vazio não deixa esqueleto nem reserva espaço. A página continua íntegra sem JavaScript, exceto pela ausência do aviso complementar.

Admin recebe `/admin/announcements` com listagem paginada, formulário em Dialog, prévia do anúncio, estados de carregamento/erro/sucesso e confirmação de desativação. O item entra na seção Comunicação do app shell.

## Segurança, privacidade e acessibilidade

O snapshot contém somente `id`, `text`, `severity`, `linkUrl`, `linkLabel`, `startsAt` e `endsAt`. Não inclui autores, notas internas, IP nem dados de membros. Não há cookies, segmentação, tracking ou persistência por visitante.

A validação impede javascript:, URLs com credenciais e links sem rótulo. O texto não recebe HTML, evitando XSS por construção. O endpoint público não aceita parâmetros de busca arbitrários.

## Testes, rollout e sequência

- Unitários: validações, janela, ordenação, autorização, CRUD/desativação e projeção pública sem autores.
- E2E PostgreSQL: criar anúncio com link de suporte, consultar público, encerrar janela e confirmar remoção; migration down/up preservando dados de produção.
- Sync: escrita atômica, payload completo, preservação em erro e conteúdo inalterado byte a byte.
- Frontend: vazio, múltiplas severidades, links seguros, formulário, desativação, paginação e dark mode sem regressão.
- Gates: backend build/Jest, frontend check/Vitest, scripts, `make astro-verify`, tenants e SonarCloud.

Sequência: concluir PR de patches e fila global → implementar Experiência do Membro → implementar esta fase em TDD → `develop` → PR para `main` → release/migration → sync inicial → validar um aviso real de manutenção com link para issues do GitHub.

Announcements não depende de C4P. A Fase 7 permanece como fechamento do 1.0.0; esta fase operacional pode antecedê-la sem alterar seu escopo.

<!-- AGENT-INDEX
purpose: Desenho da agenda do mentor com múltiplas janelas, fuso, e-mails acionáveis, Google Calendar e ICS.
audience: Implementadores, revisores, mantenedores de mentoria e notificações.
status: Implementado na 1.12.0 com TDD, revisões por task, E2E PostgreSQL e gates aprovados; PR #670.
sections:
  - Intenção e escopo
  - Abordagens
  - Contratos
  - Experiência do mentor
  - Calendário e e-mails
  - Verificação e rollout
related-docs:
  - docs/adrs/009-mentorship.md
  - docs/plans/frontend-jornadas/2026-11-23-fila-ux-operacional.md
agent-protocol:
  - Preservar o array do PUT de disponibilidade e o ciclo de sessões; anexos e campos de contexto são opcionais.
  - Não enviar e-mails reais nem integrar serviço externo durante testes.
-->

# Agenda do mentor e calendário

## Intenção e escopo

Permitir que o mentor entenda, cadastre e remova suas janelas semanais sem adivinhar o estado atual. Mentor e mentorado recebem acesso persistente à sessão e um convite de calendário correto após a confirmação.

Entregas:

- Listar regras atuais por dia; adicionar múltiplas janelas, remover individualmente e salvar um dia por vez.
- Fuso IANA explícito por dia, default do navegador com fallback `America/Sao_Paulo`.
- Validar `HH:mm`, fuso, weekday 0–6, início anterior ao fim e sobreposição, preservando o array atual do PUT.
- Links de acompanhamento nos e-mails de solicitação/confirmação/lembrete e link Google Calendar na confirmação.
- `.ics` para mentor e mentorado na confirmação, com UID estável, início/fim UTC, duração, link da sessão e link de videoconferência.
- E-mails de solicitação e confirmação ao mentor com saudação e corpo próprios, sem reutilizar texto dirigido ao mentorando.
- Links Google Calendar também nas telas de sessão confirmada, sem novo serviço externo.

Não incluir reagendamento, Cal.com/Calendly, OAuth Google, exceções de feriados/férias ou migração de schema.

## Abordagens

1. **Agenda + ICS completo — escolhido.** Estende o provider SMTP com anexos opcionais e gera ICS localmente. Mais arquivos e testes, mas entrega o fluxo pedido sem dependência nova.
2. Agenda + link Google Calendar: evita mudanças no provider, mas não entrega o anexo escolhido.
3. Somente painel: menor escopo, sem recuperação por e-mail/calendário.

## Contratos

### Disponibilidade

`GET /mentorship/availability/mine` autenticado retorna as regras do mentor ativo ordenadas por dia/hora:

```ts
Array<{ weekday: number; startTime: string; endTime: string; timeZone: string }>
```

`PUT /mentorship/availability/:weekday` mantém o body atual `AvailabilityRuleDto[]`. Um array vazio limpa somente o dia do mentor autenticado, sem tocar sessões. `ParseArrayPipe` valida cada item; `startTime`/`endTime` usam `^([01]\\d|2[0-3]):[0-5]\\d$`, `timeZone` usa IANA. O serviço rejeita weekday fora de 0–6, duração não positiva e sobreposição antes de substituir o dia.

Nenhuma sessão reservada é apagada ou alterada ao mudar regras.

### Notificações

`EmailMessage` aceita `attachments?: Array<{ filename: string; content: string; contentType: string }>` e o provider os encaminha ao Nodemailer. `EmailService.sendTemplate` recebe um quinto argumento opcional com anexos; chamadas existentes permanecem inalteradas.

`EmailTemplateContext` ganha `sessionUrl?: string` e `calendarUrl?: string`. Templates renderizam esses links somente quando presentes.

## Experiência do mentor

O painel carrega perfil, sessões e regras em paralelo. Um seletor de dia mostra as janelas daquele dia, inclusive estado vazio. “Adicionar janela” cria uma linha local; cada linha tem início, fim e remover. Um seletor de fuso se aplica somente ao dia editado. “Salvar disponibilidade de <dia>” envia todas as janelas daquele dia.

Edições locais por dia são preservadas ao trocar de dia; dias alterados ficam visualmente identificados. Salvar desabilita durante a mutação e, em sucesso, recarrega o estado canônico. Erros mantêm o rascunho. O texto explica que a regra é semanal e não muda sessões já reservadas.

## Calendário e e-mails

Um helper puro de mentoria gera `sessionUrl`, `calendarUrl` e conteúdo ICS. O evento usa `UID=<session.id>@codaqui.dev`, `DTSTART`/`DTEND` em UTC com formato `YYYYMMDDTHHMMSSZ`, duração da sessão e CRLF. Textos escapam barra, ponto e vírgula, vírgula e quebras de linha.

Na solicitação, mentor e mentorado recebem `sessionUrl`; o mentor usa `mentorship-requested-mentor`, com saudação ao mentor e texto orientando a revisão da solicitação. Na confirmação, ambos recebem `sessionUrl`, `calendarUrl` e o mesmo evento ICS; o mentor usa `mentorship-confirmed-mentor`, com seu nome e os dados do mentorando. Esses dois templates entram na listagem administrativa padrão. Falha de SMTP continua não revertendo sessão. O lembrete mantém seu comportamento atual e ganha os links, sem ampliar destinatários.

Antes do rollout, consultar `email_templates` no dump/ambiente. O dump `pg-dump-codaqui_db-1795461558-80fbrnvxqv4vqw2no3npjmvd.dmp` não possui overrides `mentorship-*`; portanto nenhum registro precisa ser alterado para esta entrega. Overrides futuros têm precedência e precisam incluir os novos links conscientemente; nenhum override será apagado automaticamente.

## Verificação e rollout

- Testes de serviço/controller/DTO para regras válidas, formato/fuso inválido, weekday, sobreposição e isolamento por mentor.
- Testes do painel para carregar, adicionar múltiplas janelas, remover, trocar dia, fuso, sucesso e erro preservando rascunho.
- Testes de ICS/Google URL com duração, escape, UID e URLs; provider e EmailService encaminham anexos sem afetar templates antigos.
- Confirmação envia para ambos com ICS e não reverte em falha; E2E PostgreSQL com provider mockado.
- Build/testes backend/frontend/scripts, gates codaqui/tenants e inspeção claro/escuro mobile/desktop.
- Nenhum envio real. Publicar backend antes do frontend; release minor 1.12.0 na PR #670.

## Status de implementação

Implementado em 2026-11-24 na release 1.12.0, na PR #670.

- Tasks 1–4 revisadas sem Critical/Important aberto; disponibilidade, editor, calendário/ICS e links/E2E entregues.
- Backend: build e 1.721 testes. Frontend: `astro check` e 1.359 testes. Scripts: 114 testes.
- E2E PostgreSQL 2/2 com dump isolado e provider SMTP mockado; links e ICS idêntico para mentor/mentorado. Bancos temporários removidos.
- Migration 054 de reembolsos validada up/down/up com inserção real de 10.50 como numeric.
- `make astro-verify` e `make astro-verify-tenants` aprovados; editor inspecionado em claro/escuro e mobile/desktop sem overflow.

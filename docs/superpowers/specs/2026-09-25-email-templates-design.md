<!-- AGENT-INDEX
purpose: Design spec para tornar os templates de e-mail transacionais editáveis via painel admin (override em PostgreSQL com fallback para templates padrão em código), com edição em Markdown, renderização para HTML sanitizado, preview e envio de teste.
audience: AI agents, mantenedores
status: Implementado
sections:
  - Contexto e estado atual
  - Decisões de design (escolhas do brainstorming)
  - Schema (migration)
  - Pipeline de renderização (backend)
  - API admin
  - UI admin
  - Segurança e tratamento de erros
  - Testes
  - Dependências e entrega
  - Fora de escopo
related-docs:
  - AGENTS.md — módulo notifications (e-mails transacionais, email_logs, crons)
  - docs/adrs/001-event-platform.md — plataforma de eventos
  - docs/superpowers/specs/2026-08-17-devparana-community-site-design.md — formato de spec
agent-protocol:
  - Este é um design spec; a implementação deve ser precedida do skill writing-plans.
  - Os 3 templates padrão hardcoded em email.service.ts devem ser mantidos como fallback — nunca removê-los.
  - Qualquer e-mail novo deve seguir o mesmo contrato (id estável + contexto tipado).
-->

# Design Spec — Templates de E-mail Editáveis

## 1. Contexto e estado atual

O backend NestJS (`backend/src/notifications/`) envia 3 e-mails transacionais de eventos:

| Template (id) | Subject padrão | Disparo |
|---|---|---|
| `event-registration-confirmation` | `Inscrição confirmada — {evento}` | Inscrição gratuita (`events.service.ts`) e ingresso pago (webhook Stripe) |
| `event-reminder-d1` | `Lembrete: {evento} é amanhã` | Cron diário 09:00 (eventos +12h..+36h) |
| `event-post-event` | `Obrigado por participar de {evento}` | Cron diário 09:15 (exige opt-in do membro) |

Estado atual (investigado em 2026-09-25):

- Templates são **strings de texto puro hardcoded** num `switch/case` no `EmailService.render()` (`backend/src/notifications/email.service.ts:89-143`). Template desconhecido lança `BadRequestException`.
- O contrato `EmailMessage` (`backend/src/notifications/email.provider.ts:4-8`) suporta apenas `{ to, subject, text }` — **não há campo `html`**.
- Não existe tabela de templates, engine de templates, nem interface de edição. O painel frontend `src/pages/admin/emails.tsx` é somente leitura (logs + analytics de `email_logs`).
- Envio é síncrono via SMTP (nodemailer); falha de SMTP nunca derruba a operação — é capturada e gravada em `email_logs` com `status=failed` (permitindo reenvio manual pelo admin).
- `email_logs.template` é string livre com índice `(template, status)` — já suporta ids de templates arbitrários.
- O reenvio (`email.service.ts:383-426`) re-renderiza com o template atual no momento do reenvio.

## 2. Decisões de design (escolhas validadas no brainstorming)

| Decisão | Escolha |
|---|---|
| Onde editar | Painel admin (`/admin/emails`), persistido em PostgreSQL — padrão `event_overrides` |
| Formato de edição | Markdown, renderizado para HTML no envio (multipart com `text/plain` fallback) |
| Versionamento | **Não** — um registro por template; edição substitui |
| Preview / teste | Preview renderizado com variáveis de exemplo + envio de teste para o e-mail do admin logado |
| Fallback | Sempre: sem registro no BD (ou erro no render) → template padrão hardcoded |

## 3. Schema (migration)

Nova migration (número sequencial após Migration012), tabela `email_templates`:

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | varchar PK | Id estável do template; mesmos ids dos hardcoded (ver §1) |
| `subject` | varchar | Subject com placeholders `{{var}}` |
| `body_markdown` | text | Corpo em Markdown com placeholders `{{var}}` |
| `updated_at` | timestamptz | Atualizado no upsert |

Sem registro para um id = usa o padrão em código. Um registro = override completo (subject e corpo são substituídos integralmente; não há merge parcial na v1).

## 4. Pipeline de renderização (backend)

### 4.1 Provider

- `EmailMessage` ganha campo opcional `html?: string` (`email.provider.ts`).
- `SmtpEmailProvider.send()` passa `html` ao nodemailer — multipart `text/plain` + `text/html` automático.

### 4.2 Render

**Pipeline único.** Os 3 templates padrão deixam de ser `case` de um `switch` e passam a ser **constantes Markdown em código** (o texto puro atual já é Markdown válido; os corpos são migrados para constantes com formatação mínima). O `EmailService.render()` é substituído por uma função de render no novo `EmailTemplateService` (`backend/src/notifications/`), na ordem:

1. Lookup do template em `email_templates` por id.
2. Seleciona a fonte: override do BD se existir; **fallback imediato para a constante padrão** se não existir ou se o lookup falhar (erro de BD não derruba o envio).
3. Interpola placeholders `{{key}}` contra o contexto tipado **na fonte Markdown** (antes da conversão, para que o conteúdo das variáveis não quebre a renderização).
4. Converte Markdown → HTML (`marked`).
5. Sanitiza o HTML (`sanitize-html` com allowlist restrita).
6. Deriva `text/plain` do HTML sanitizado (`html-to-text`).

Erro em qualquer etapa (Markdown malformado, falha de sanitize): log + fallback para a constante padrão renderizada pelo mesmo pipeline — **nunca derruba o envio**, preservando o contrato atual (falha → `email_logs failed`, sem throw além do `BadRequestException` de template desconhecido, que se mantém). Todos os e-mails (padrão ou personalizado) saem multipart (`text/plain` + `text/html`).

Interpolação: substituição literal de `{{key}}` por `context[key]`; chave desconhecida permanece visível no texto final (ajuda a depurar template com variável errada).

Allowlist de sanitize (exaustiva): `p, br, hr, strong, em, u, s, a[href], ul, ol, li, h1, h2, h3, h4, blockquote, code, pre, table, thead, tbody, tr, th, td`. Links com `target="_blank" rel="noopener noreferrer"`; esquemas de URL restritos a `http, https, mailto`.

### 4.3 Contexto ampliado

`EmailTemplateContext` e `contextFor()` passam a incluir, além das atuais (`attendeeName`, `eventTitle`, `eventStartAt`, `eventTimeZone`, `ticketTypeName?`, `checkinToken?`):

| Variável | Origem |
|---|---|
| `eventLocation` | `managed_event.location*` (quando preenchido) |
| `checkinUrl` | `FRONTEND_URL` + rota pública de check-in com `checkinToken` |

Os callers (`events.service.ts`, `stripe.service.ts`, crons) passam a fornecer os novos campos. Os 3 templates padrão são atualizados para usar as novas variáveis onde fizer sentido (ex.: link de check-in clicável no e-mail de confirmação).

## 5. API admin

Endpoints novos em `notifications.controller.ts` (mesmo padrão de guard existente: `JwtAuthGuard + RolesGuard + @Roles('admin')`):

| Método | Rota | Descrição |
|---|---|---|
| GET | `/notifications/templates` | Lista dos templates disponíveis: id, subject efetivo, `isOverride`, `updatedAt` |
| GET | `/notifications/templates/:id` | Subject + `bodyMarkdown` efetivos (override se existir, senão padrão) + `isOverride` |
| PUT | `/notifications/templates/:id` | Upsert do override (`subject` obrigatório, `bodyMarkdown` obrigatório) |
| DELETE | `/notifications/templates/:id` | Remove o override (restaura padrão) |
| POST | `/notifications/templates/:id/preview` | Body `{ subject, bodyMarkdown }` → `{ html, text }` renderizados com variáveis de exemplo (mockadas por template) |
| POST | `/notifications/templates/:id/test` | Envia o template efetivo (override ou padrão) para o e-mail do membro logado (do JWT), via `EmailService.sendTemplate` com refs vazias; retorna o `emailLogId` |

Validação com `class-validator` (DTOs em `backend/src/notifications/dto/`). Edições (PUT/DELETE) registram entrada no módulo `audit`.

Variáveis de exemplo para preview/teste: objeto fixo por template (ex.: `attendeeName: "Maria Silva"`, `eventTitle: "Meetup de Exemplo"`, data futura fixa em pt-BR etc.), documentado no código.

## 6. UI admin

`src/pages/admin/emails.tsx` ganha aba **"Templates"** (Tabs do MUI, convivendo com a visão atual de logs):

- **Lista:** os 3 templates com chip de estado — "Personalizado" (override ativo) ou "Padrão".
- **Editor:** `TextField` para subject + `TextField` multiline para Markdown (monoespaçada).
- **Dica de variáveis:** bloco listando as placeholders disponíveis do template selecionado (ex.: `{{attendeeName}}`, `{{eventTitle}}`, `{{checkinUrl}}`).
- **Preview:** painel lado a lado renderizado via `POST /preview` — subject interpolado + HTML sanitizado exibido em container isolado. Atualiza em debounce após edição.
- **Ações:** Salvar (PUT), Restaurar padrão (DELETE, com `ModalConfirm` — componente já existente), Enviar teste (POST `/test` + feedback do `emailLogId`).

Padrões de tela admin preservados: guard de login/`authFetch`, `parseAuthJson`/`extractErrorMessage`, `Alert` de erro no header, feedback de ação.

## 7. Segurança e tratamento de erros

- Sanitização server-side obrigatória antes de **enviar** e antes de **retornar preview** (o HTML do preview já sai sanitizado).
- Endpoints de escrita/preview/teste só para `admin` (guard existente).
- Envio transacional nunca falha por causa de template: fallback em cascata (override → padrão), preservando `email_logs failed` + reenvio manual como recovery.
- Separacão transacional × marketing preservada: templates editáveis não alteram as regras de opt-in dos crons (D-1 ignora opt-in; pós-evento exige).
- Sem upload de arquivo, sem execução de código em template — apenas Markdown restrito + interpolação literal.

## 8. Testes

**Backend (jest, `backend/test/` + specs ao lado do código):**

- `EmailTemplateService`: interpolação de variáveis conhecidas; placeholder desconhecido permanece; override presente/ausente; sanitização remove `script`/`onerror`/`javascript:`; erro no Markdown → fallback para padrão; `text/plain` derivado do HTML.
- Endpoints: guard de roles (rejeita não-admin); GET lista com `isOverride`; PUT upsert + validação (subject vazio → 400); DELETE remove override; `/preview` retorna HTML sanitizado; `/test` envia para o e-mail do JWT e retorna `emailLogId`.
- Contratos atuais de `email.service.spec.ts` mantidos: falha SMTP → log `failed` sem throw; template desconhecido → `BadRequestException`.
- Dedupe dos crons e reenvio: comportamento inalterado (re-renderiza com template efetivo no momento do envio).

**Frontend (jest + Testing Library, `src/pages/admin/__tests__/`):**

- Aba Templates: lista com chips de estado; edição salva via PUT; restaurar chama DELETE com confirmação; preview renderiza retorno do endpoint; envio de teste exibe feedback.
- Seguir o padrão de `src/pages/admin/__tests__/eventos.test.tsx` (mock de `useAuth`, `jsonResponse`).

**Validação manual:** subir backend local, editar template de confirmação, usar "Enviar teste", verificar multipart em cliente de e-mail; inscrever-se em evento interno e conferir e-mail com link de check-in.

## 9. Dependências e entrega

Dependências novas do backend: `marked` (Markdown → HTML), `sanitize-html` (sanitização) + `@types/sanitize-html`, `html-to-text` (fallback text/plain).

- Bump **minor** de `version` em `backend/package.json` (regra da AGENTS.md para feat — usado pela tag da imagem Docker/release).
- `cd backend && npm run build && npx jest --silent` antes de commitar.
- `npm run typecheck` + testes frontend antes de commitar a parte do admin.

## 10. Fora de escopo

- Versionamento/histórico de templates e rollback de versões (v1 = um registro por template).
- Novos tipos de e-mail (reembolso, boas-vindas CLUB etc.) — o design os suporta, mas não os cria.
- i18n (tudo continua pt-BR).
- Fila assíncrona de envio (envio continua síncrono via SMTP).
- Editor rich-text WYSIWYG (v1 = Markdown puro com preview).
- Testes A/B de assunto.

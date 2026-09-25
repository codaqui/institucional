<!-- AGENT-INDEX
purpose: Plano de implementação passo a passo (TDD) para tornar os templates de e-mail transacionais editáveis via painel admin — tabela email_templates, pipeline Markdown→HTML sanitizado com fallback, API admin e aba Templates em /admin/emails.
audience: AI agents, mantenedores
status: Pronto para execução
sections:
  - Contexto e goal
  - Estrutura de arquivos
  - Constraints globais
  - Task 1 a Task 11 (infra, migration, defaults, render, integração, contexto, CRUD, controller, preview/test-send, frontend, docs/validação)
related-docs:
  - docs/superpowers/specs/2026-09-25-email-templates-design.md — spec aprovado (este plano o implementa)
  - AGENTS.md — convenções do monorepo (version bump obrigatório, padrões MUI, testes)
agent-protocol:
  - Executar com superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans.
  - Passos usam checkbox (- [ ]) para tracking.
  - Os 3 templates padrão NUNCA devem ser removidos — são o fallback.
-->

# Templates de E-mail Editáveis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que admins editem todos os templates de e-mail transacionais (subject + corpo em Markdown) via painel `/admin/emails`, com renderização Markdown→HTML sanitizado, multipart (`text/plain` + `text/html`), preview e envio de teste — sem nunca quebrar o envio (fallback para templates padrão em código).

**Architecture:** Override em PostgreSQL (tabela `email_templates`, padrão `event_overrides`): um registro por template; ausência de registro = template padrão hardcoded. Pipeline único de render: interpolação `{{var}}` na fonte Markdown → `marked` → `sanitize-html` (allowlist restrita) → `html-to-text`. `EmailService` delega o render ao novo `EmailTemplateService` e envia multipart via `SmtpEmailProvider`. API admin REST em `NotificationsController`; aba "Templates" no frontend reutilizando padrões de tela admin.

**Tech Stack:** NestJS 11, TypeORM 0.3 (PostgreSQL), class-validator, marked, sanitize-html, html-to-text, nodemailer; frontend Docusaurus 3 + React 19 + MUI v7 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-25-email-templates-design.md` (leia antes de executar — o plano argumenta a partir dele)

## Global Constraints

- **Version bump obrigatório:** `backend/package.json` `0.8.1` → `0.9.0` (feat → minor; `publish-backend.yml` usa a versão para tag/release).
- Backend: antes de commitar, `cd backend && npm run build && npx jest --silent` deve estar 100% verde.
- Frontend: antes de commitar, `npm run typecheck` (raiz) e `npx jest --config jest.config.ts` verdes.
- MUI v7: Grid usa `size={{ xs: 12 }}` — NUNCA `item xs={}`.
- Frontend admin: sempre `authFetch` (de `useAuth`), `parseAuthJson`/`extractErrorMessage` de `src/hooks/authFetchHelpers.ts`, `Alert` de erro no header. URLs de API relativas (`/notifications/...`).
- Contratos que não podem quebrar: falha de SMTP → `email_logs` com `status=failed` e **sem throw**; template desconhecido → `BadRequestException`.
- Idioma pt-BR em toda UI e e-mail; linguagem inclusiva ("participantes", não "alunos").
- Sem cores hex hardcoded — tokens MUI.
- Commit convention: `feat:`, `fix:`, `docs:`, `chore:` (AGENTS.md). Commits por task.
- Criar branch `feat/email-templates` a partir de `develop`.
- **Atenção:** o working tree atual contém um fix não commitado do QR Code (`src/pages/eventos/detalhe.tsx`, `src/components/RegistrationConfirmedCard/`). NÃO commitar esses arquivos nas tasks deste plano — são trabalho separado.

## Estrutura de arquivos

**Backend (criados):**
- `backend/src/notifications/entities/email-template.entity.ts` — entidade TypeORM `email_templates`
- `backend/src/migrations/1790294400000-Migration024_EmailTemplates.ts` — migration da tabela
- `backend/src/notifications/default-templates.ts` — catálogo dos 3 templates padrão (subject/body em Markdown, variáveis, contexto de exemplo)
- `backend/src/notifications/email-template.service.ts` — pipeline de render + CRUD + preview/sample
- `backend/src/notifications/dto/email-template-content.dto.ts` — DTO de validação
- Specs: `default-templates.spec.ts`, `email-template.service.spec.ts`

**Backend (modificados):**
- `backend/src/notifications/email.provider.ts` — `EmailMessage` ganha `html?`
- `backend/src/notifications/email.service.ts` — delega render ao `EmailTemplateService`; `contextFor` amplia contexto
- `backend/src/notifications/notifications.controller.ts` — endpoints de templates
- `backend/src/notifications/notifications.module.ts` — registra entidade + serviços + `AuditModule`
- `backend/src/audit/entities/audit-log.entity.ts` — 2 novos `AuditAction`
- `backend/src/notifications/email.service.spec.ts` — ajustes p/ render delegado + html
- `backend/src/notifications/notifications.controller.spec.ts` — endpoints novos
- `backend/package.json` — deps novas + version bump

**Frontend:**
- `src/components/EmailsTemplatesTab/index.tsx` — aba Templates (criado)
- `src/components/EmailsTemplatesTab/__tests__/index.test.tsx` — testes (criado)
- `src/pages/admin/emails.tsx` — Tabs "Logs" / "Templates" (modificado)

**Docs:**
- `AGENTS.md` — entrada de `notifications/` atualizada (modificado)

---

### Task 1: Infra — dependências, version bump e AuditAction

**Files:**
- Modify: `backend/package.json`

**Interfaces:**
- Produces: `AuditAction.EMAIL_TEMPLATE_UPSERTED` (`'email.template_upserted'`) e `AuditAction.EMAIL_TEMPLATE_DELETED` (`'email.template_deleted'`) — usados na Task 7; pacotes `marked`, `sanitize-html`, `html-to-text` disponíveis nas Tasks 4+.

- [ ] **Step 1: Instalar dependências**

```bash
cd backend && npm install marked sanitize-html html-to-text && npm install --save-dev @types/sanitize-html
```

- [ ] **Step 2: Bump de versão (0.8.1 → 0.9.0)**

Em `backend/package.json`, linha 3: `"version": "0.8.1"` → `"version": "0.9.0"`.

- [ ] **Step 3: Adicionar valores ao enum AuditAction**

Em `backend/src/audit/entities/audit-log.entity.ts`, dentro do `export enum AuditAction`, após a linha `EVENT_INTERNAL_SYNCED = 'event.internal_synced',` (ou no fim do bloco de eventos), adicionar:

```ts
  // E-mail
  EMAIL_TEMPLATE_UPSERTED = 'email.template_upserted',
  EMAIL_TEMPLATE_DELETED = 'email.template_deleted',
```

- [ ] **Step 4: Verificar build**

Run: `cd backend && npm run build`
Expected: compila sem erros.

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/audit/entities/audit-log.entity.ts
git commit -m "chore: deps de templates de e-mail (marked, sanitize-html, html-to-text) e bump 0.9.0"
```

---

### Task 2: Migration024 e entidade EmailTemplate

**Files:**
- Create: `backend/src/notifications/entities/email-template.entity.ts`
- Create: `backend/src/migrations/1790294400000-Migration024_EmailTemplates.ts`
- Modify: `backend/src/notifications/notifications.module.ts`

**Interfaces:**
- Produces: `EmailTemplate` (entity, `@Entity('email_templates')`, PK `id: string`) — usada nas Tasks 4 e 7 via `@InjectRepository(EmailTemplate)`.

- [ ] **Step 1: Criar a entidade**

`backend/src/notifications/entities/email-template.entity.ts`:

```ts
import {
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Override de template de e-mail persistido no banco.
 * Um registro por template (id estável). Ausência de registro =
 * template padrão em código (fallback garantido).
 */
@Entity('email_templates')
export class EmailTemplate {
  /** Id estável do template (ex.: 'event-registration-confirmation'). */
  @PrimaryColumn()
  id: string;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  bodyMarkdown: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
```

- [ ] **Step 2: Criar a migration**

`backend/src/migrations/1790294400000-Migration024_EmailTemplates.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration024EmailTemplates1790294400000
  implements MigrationInterface
{
  name = 'Migration024EmailTemplates1790294400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "email_templates" (
        "id" character varying NOT NULL,
        "subject" character varying NOT NULL,
        "bodyMarkdown" text NOT NULL,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_templates" PRIMARY KEY ("id")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "email_templates"`);
  }
}
```

- [ ] **Step 3: Registrar a entidade no módulo**

Em `backend/src/notifications/notifications.module.ts`:
- Adicionar import: `import { EmailTemplate } from './entities/email-template.entity';`
- No array de `TypeOrmModule.forFeature([...])`, adicionar `EmailTemplate` após `EmailLog`.

- [ ] **Step 4: Verificar**

Run: `cd backend && npm run build && npx jest --silent 2>&1 | tail -4`
Expected: build OK; suíte jest existente verde (entidade/migration não têm unit test — convenção do repo).

- [ ] **Step 5: Commit**

```bash
git add backend/src/notifications/entities/email-template.entity.ts backend/src/migrations/1790294400000-Migration024_EmailTemplates.ts backend/src/notifications/notifications.module.ts
git commit -m "feat(backend): tabela email_templates para overrides de templates de e-mail"
```

---

### Task 3: default-templates.ts — catálogo e defaults em Markdown

**Files:**
- Test: `backend/src/notifications/default-templates.spec.ts`
- Create: `backend/src/notifications/default-templates.ts`

**Interfaces:**
- Produces:
  - `TEMPLATE_IDS: string[]` (3 ids)
  - `DEFAULT_TEMPLATES: Record<string, DefaultTemplateDefinition>` onde `DefaultTemplateDefinition = { subject: string; bodyMarkdown: string; variables: string[]; sample: () => EmailTemplateContext }`
  - `isKnownTemplate(id: string): boolean`
  - `EmailTemplateContext` permanece exportado de `email.service.ts`; `default-templates.ts` o importa como type.
- Consumes: ids de `backend/src/notifications/email.service.ts` (`EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION`, `EMAIL_TEMPLATE_REMINDER_D1`, `EMAIL_TEMPLATE_POST_EVENT`).

- [ ] **Step 1: Escrever o teste que falha**

`backend/src/notifications/default-templates.spec.ts`:

```ts
import {
  DEFAULT_TEMPLATES,
  isKnownTemplate,
  TEMPLATE_IDS,
} from './default-templates';

describe('default-templates', () => {
  it('cataloga exatamente os 3 templates de e-mail conhecidos', () => {
    expect(TEMPLATE_IDS).toEqual([
      'event-registration-confirmation',
      'event-reminder-d1',
      'event-post-event',
    ]);
    expect(isKnownTemplate('event-registration-confirmation')).toBe(true);
    expect(isKnownTemplate('template-inexistente')).toBe(false);
  });

  it('cada template tem subject, corpo e variáveis resolvidas pelo contexto de exemplo', () => {
    for (const id of TEMPLATE_IDS) {
      const def = DEFAULT_TEMPLATES[id];
      expect(def.subject.length).toBeGreaterThan(0);
      expect(def.bodyMarkdown.length).toBeGreaterThan(0);
      const sample = def.sample();
      for (const variable of def.variables) {
        expect(
          Object.prototype.hasOwnProperty.call(sample, variable),
          `${id}: variável "${variable}" ausente no sample`,
        ).toBe(true);
      }
      // nenhuma variável solta no markdown
      const leftovers = (def.bodyMarkdown + def.subject).match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) ?? [];
      for (const token of leftovers) {
        const key = token.replace(/\{\{\s*|\s*\}\}/g, '');
        expect(def.variables, `${id}: {{${key}}} usada mas não declarada`).toContain(key);
      }
    }
  });
});
```

- [ ] **Step 2: Rodar e verificar falha**

Run: `cd backend && npx jest default-templates --silent`
Expected: FAIL — `Cannot find module './default-templates'`.

- [ ] **Step 3: Implementar o módulo**

`backend/src/notifications/default-templates.ts`:

```ts
import type { EmailTemplateContext } from './email.service';
import {
  EMAIL_TEMPLATE_POST_EVENT,
  EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
  EMAIL_TEMPLATE_REMINDER_D1,
} from './email.service';

export interface DefaultTemplateDefinition {
  subject: string;
  bodyMarkdown: string;
  /** Variáveis interpoláveis documentadas para o editor. */
  variables: string[];
  /** Contexto de exemplo para preview e envio de teste. */
  sample: () => EmailTemplateContext;
}

const SAMPLE: Omit<EmailTemplateContext, 'eventStartAt'> & {
  eventStartAt: () => Date;
} = {
  attendeeName: 'Maria Silva',
  eventTitle: 'Meetup de Exemplo',
  eventTimeZone: 'America/Sao_Paulo',
  ticketTypeName: 'Gratuito',
  checkinToken: 'token-de-exemplo-123',
  eventLocation: 'Maringá, PR',
  eventStartAt: () =>
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
};

function sampleContext(): EmailTemplateContext {
  return {
    attendeeName: SAMPLE.attendeeName,
    eventTitle: SAMPLE.eventTitle,
    eventStartAt: SAMPLE.eventStartAt(),
    eventTimeZone: SAMPLE.eventTimeZone,
    ticketTypeName: SAMPLE.ticketTypeName,
    checkinToken: SAMPLE.checkinToken,
    eventLocation: SAMPLE.eventLocation,
  };
}

export const DEFAULT_TEMPLATES: Record<string, DefaultTemplateDefinition> = {
  [EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION]: {
    subject: 'Inscrição confirmada — {{eventTitle}}',
    variables: [
      'attendeeName',
      'eventTitle',
      'eventStartAt',
      'eventLocation',
      'ticketTypeName',
      'checkinToken',
      'checkinUrl',
    ],
    sample: sampleContext,
    bodyMarkdown: [
      'Olá, {{attendeeName}}!',
      '',
      'Sua inscrição em **{{eventTitle}}** está confirmada.',
      '',
      '- Data: {{eventStartAt}}',
      '- Local: {{eventLocation}}',
      '- Ingresso: {{ticketTypeName}}',
      '',
      'Seu código de check-in: `{{checkinToken}}`',
      '',
      'Apresente o [QR Code da sua inscrição]({{checkinUrl}}) na entrada do evento.',
      '',
      'Acompanhe suas inscrições e certificados em {{checkinUrl}}.',
      '',
      '— Equipe Codaqui',
    ].join('\n'),
  },
  [EMAIL_TEMPLATE_REMINDER_D1]: {
    subject: 'Lembrete: {{eventTitle}} é amanhã',
    variables: ['attendeeName', 'eventTitle', 'eventStartAt', 'eventLocation'],
    sample: sampleContext,
    bodyMarkdown: [
      'Olá, {{attendeeName}}!',
      '',
      'Lembrete: **{{eventTitle}}** acontece amanhã, {{eventStartAt}}.',
      '',
      '- Local: {{eventLocation}}',
      '',
      'Nos vemos lá! Qualquer dúvida, fale com a equipe Codaqui.',
      '',
      '— Equipe Codaqui',
    ].join('\n'),
  },
  [EMAIL_TEMPLATE_POST_EVENT]: {
    subject: 'Obrigado por participar de {{eventTitle}}',
    variables: ['attendeeName', 'eventTitle', 'checkinUrl'],
    sample: sampleContext,
    bodyMarkdown: [
      'Olá, {{attendeeName}}!',
      '',
      'Obrigado por participar de **{{eventTitle}}**!',
      '',
      'Seus certificados e inscrições ficam disponíveis em {{checkinUrl}}.',
      '',
      '— Equipe Codaqui',
    ].join('\n'),
  },
};

export const TEMPLATE_IDS: string[] = Object.keys(DEFAULT_TEMPLATES);

export function isKnownTemplate(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(DEFAULT_TEMPLATES, id);
}
```

> **Nota:** o teste da Task 3 falhará de propósito em `tsc`/jest neste passo porque `EmailTemplateContext` ainda não tem `eventLocation` — ela é adicionada na Task 6. Para manter o ciclo verde por task, adicione **já neste Step** o campo opcional `eventLocation?: string | null;` na interface `EmailTemplateContext` (em `email.service.ts:28-35`) sem usá-lo ainda (uso chega na Task 6). Rode `npx jest default-templates --silent` e prossiga apenas quando PASS.

- [ ] **Step 4: Rodar e verificar sucesso**

Run: `cd backend && npx jest default-templates --silent`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/notifications/default-templates.ts backend/src/notifications/default-templates.spec.ts backend/src/notifications/email.service.ts
git commit -m "feat(backend): templates padrão de e-mail em Markdown com variáveis documentadas"
```

---

### Task 4: EmailTemplateService — pipeline de render com fallback

**Files:**
- Test: `backend/src/notifications/email-template.service.spec.ts`
- Create: `backend/src/notifications/email-template.service.ts`

**Interfaces:**
- Consumes: `EmailTemplate` (Task 2), `DEFAULT_TEMPLATES`/`isKnownTemplate`/`TEMPLATE_IDS` (Task 3), `EmailTemplateContext` (type, `email.service.ts`).
- Produces:
  - `RenderedEmail { subject: string; text: string; html: string }`
  - `@Injectable() EmailTemplateService` com método `render(templateId: string, ctx: EmailTemplateContext): Promise<RenderedEmail>` — usado pela Task 5.
  - Constructor: `constructor(@InjectRepository(EmailTemplate) repo, audit: AuditService)` — o `audit` entra na Task 7; para não quebrar a task, o constructor da Task 4 recebe só o repo (Task 7 adiciona `AuditService`).

- [ ] **Step 1: Escrever os testes que falham**

`backend/src/notifications/email-template.service.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { EmailTemplateService } from './email-template.service';
import { EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION } from './email.service';

const makeOverride = (overrides: Record<string, unknown> = {}) => ({
  id: EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
  subject: 'Inscrição ok — {{eventTitle}}',
  bodyMarkdown: 'Oi **{{attendeeName}}**, te esperamos em {{eventTitle}}!',
  updatedAt: new Date('2026-09-01T00:00:00Z'),
  ...overrides,
});

const makeCtx = (overrides: Record<string, unknown> = {}) => ({
  attendeeName: 'Ana',
  eventTitle: 'Evento X',
  eventStartAt: new Date('2026-08-10T13:00:00Z'),
  eventTimeZone: 'America/Sao_Paulo',
  ...overrides,
});

describe('EmailTemplateService.render', () => {
  let repo: Record<string, jest.Mock>;
  let service: EmailTemplateService;

  beforeEach(() => {
    repo = { findOneBy: jest.fn().mockResolvedValue(null) };
    service = new EmailTemplateService(repo as any);
  });

  it('renderiza o template padrão quando não há override', async () => {
    const r = await service.render(EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION, makeCtx());
    expect(r.subject).toBe('Inscrição confirmada — Evento X');
    expect(r.html).toContain('<strong>Evento X</strong>');
    expect(r.text).toContain('Sua inscrição em');
    expect(r.html).toContain('token-de-exemplo') === false;
  });

  it('usa subject e Markdown do override quando existe', async () => {
    repo.findOneBy.mockResolvedValue(makeOverride());
    const r = await service.render(EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION, makeCtx());
    expect(r.subject).toBe('Inscrição ok — Evento X');
    expect(r.html).toContain('<strong>Ana</strong>');
  });

  it('rejeita template desconhecido com BadRequestException', async () => {
    await expect(service.render('nope', makeCtx())).rejects.toThrow(BadRequestException);
  });

  it('mantém placeholder desconhecido visível no output', async () => {
    repo.findOneBy.mockResolvedValue(
      makeOverride({ bodyMarkdown: 'Olá {{naoExiste}}!' }),
    );
    const r = await service.render(EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION, makeCtx());
    expect(r.text).toContain('{{naoExiste}}');
  });

  it('remove script e links javascript do HTML sanitizado', async () => {
    repo.findOneBy.mockResolvedValue(
      makeOverride({
        bodyMarkdown:
          'Olá [clique](javascript:alert(1))<script>alert(2)</script><img src=x onerror=alert(3)>',
      }),
    );
    const r = await service.render(EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION, makeCtx());
    expect(r.html).not.toContain('<script>');
    expect(r.html).not.toContain('javascript:');
    expect(r.html).not.toContain('onerror');
  });

  it('cai no template padrão quando o lookup do banco falha', async () => {
    repo.findOneBy.mockRejectedValue(new Error('connection lost'));
    const r = await service.render(EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION, makeCtx());
    expect(r.subject).toBe('Inscrição confirmada — Evento X');
  });
});
```

> Ajuste fino esperado no teste 1: o assert `expect(r.html).toContain('token-de-exemplo') === false` é intencionalmente estranho — substitua por `expect(r.html).not.toContain('token-de-exemplo');` ao escrever o arquivo.

- [ ] **Step 2: Rodar e verificar falha**

Run: `cd backend && npx jest email-template.service --silent`
Expected: FAIL — `Cannot find module './email-template.service'`.

- [ ] **Step 3: Implementar o serviço**

`backend/src/notifications/email-template.service.ts`:

```ts
import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { convert } from 'html-to-text';
import { EmailTemplate } from './entities/email-template.entity';
import type { EmailTemplateContext } from './email.service';
import {
  DEFAULT_TEMPLATES,
  isKnownTemplate,
} from './default-templates';

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr', 'strong', 'em', 'u', 's', 'a',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4',
    'blockquote', 'code', 'pre',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      target: '_blank',
      rel: 'noopener noreferrer',
    }),
  },
};

@Injectable()
export class EmailTemplateService {
  private readonly logger = new Logger(EmailTemplateService.name);
  private readonly frontendUrl: string;

  constructor(
    @InjectRepository(EmailTemplate)
    private readonly repo: Repository<EmailTemplate>,
  ) {
    this.frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  }

  private formatDate(date: Date, timeZone: string): string {
    return date.toLocaleString('pt-BR', {
      timeZone,
      dateStyle: 'full',
      timeStyle: 'short',
    });
  }

  interpolate(source: string, values: Record<string, string>): string {
    return source.replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      (raw, key: string) =>
        Object.prototype.hasOwnProperty.call(values, key) ? values[key] : raw,
    );
  }

  private contextValues(ctx: EmailTemplateContext): Record<string, string> {
    return {
      attendeeName: ctx.attendeeName,
      eventTitle: ctx.eventTitle,
      eventStartAt: this.formatDate(ctx.eventStartAt, ctx.eventTimeZone),
      eventTimeZone: ctx.eventTimeZone,
      ticketTypeName: ctx.ticketTypeName ?? '',
      checkinToken: ctx.checkinToken ?? '',
      eventLocation: ctx.eventLocation ?? '',
      checkinUrl: `${this.frontendUrl}/membro`,
    };
  }

  private markdownToHtml(markdown: string): string {
    const raw = marked.parse(markdown, { async: false }) as string;
    return sanitizeHtml(raw, SANITIZE_OPTIONS);
  }

  private renderSource(
    subject: string,
    bodyMarkdown: string,
    values: Record<string, string>,
  ): RenderedEmail {
    const interpolatedBody = this.interpolate(bodyMarkdown, values);
    const html = this.markdownToHtml(interpolatedBody);
    return {
      subject: this.interpolate(subject, values),
      text: convert(html, { wordwrap: 100 }),
      html,
    };
  }

  async render(
    templateId: string,
    ctx: EmailTemplateContext,
  ): Promise<RenderedEmail> {
    if (!isKnownTemplate(templateId)) {
      throw new BadRequestException(`Template desconhecido: ${templateId}`);
    }
    let source = DEFAULT_TEMPLATES[templateId];
    try {
      const override = await this.repo.findOneBy({ id: templateId });
      if (override) {
        source = {
          ...source,
          subject: override.subject,
          bodyMarkdown: override.bodyMarkdown,
        };
      }
    } catch (err) {
      this.logger.warn(
        `Falha ao carregar override de ${templateId}; usando padrão: ${(err as Error).message}`,
      );
    }
    return this.renderSource(source.subject, source.bodyMarkdown, this.contextValues(ctx));
  }
}
```

- [ ] **Step 4: Rodar e verificar sucesso**

Run: `cd backend && npx jest email-template.service --silent`
Expected: PASS (6 testes). Se houver erro de tipos do `marked`/`sanitize-html`, ajuste os casts (`as string`) — não adicione `@ts-ignore`.

- [ ] **Step 5: Registrar o serviço no módulo**

Em `backend/src/notifications/notifications.module.ts`: importar `EmailTemplateService` e adicioná-lo ao array `providers` (após `EmailService`); manter `exports: [EmailService]` (Task 8 exporta o template service para o controller — na verdade o controller está no mesmo módulo, então provider local basta).

- [ ] **Step 6: Commit**

```bash
git add backend/src/notifications/email-template.service.ts backend/src/notifications/email-template.service.spec.ts backend/src/notifications/notifications.module.ts
git commit -m "feat(backend): pipeline de render de templates de e-mail com fallback e sanitização"
```

---

### Task 5: EmailService delega render + provider multipart

**Files:**
- Modify: `backend/src/notifications/email.provider.ts`
- Modify: `backend/src/notifications/email.service.ts`
- Test: `backend/src/notifications/email.service.spec.ts`

**Interfaces:**
- Consumes: `EmailTemplateService.render` (Task 4).
- Produces: `provider.send` agora recebe `{ to, subject, text, html }`; `EmailService` constructor ganha 6º parâmetro `templateService: EmailTemplateService`.

- [ ] **Step 1: Ajustar o teste existente (RED)**

Em `backend/src/notifications/email.service.spec.ts`:

1. Adicionar imports:
```ts
import { EmailTemplateService } from './email-template.service';
```
2. No `beforeEach`, criar o serviço real de templates com repo mockado (fallback para padrões) e injetar no `EmailService`:
```ts
let templateService: EmailTemplateService;
// dentro do beforeEach, antes de construir `service`:
const templateRepo = { findOneBy: jest.fn().mockResolvedValue(null) };
templateService = new EmailTemplateService(templateRepo as any);
service = new EmailService(
  emailLogRepo as any,
  eventRepo as any,
  registrationRepo as any,
  ticketTypeRepo as any,
  provider as any,
  templateService as any,
);
```
3. No teste `'grava log sent quando o SMTP envia com sucesso'`, adicionar asserts de multipart após `expect(provider.send).toHaveBeenCalledTimes(1);`:
```ts
      const sentMessage = provider.send.mock.calls[0][0];
      expect(sentMessage.html).toContain('<strong>Evento X</strong>');
      expect(sentMessage.text).toContain('Sua inscrição em');
```
4. No teste `'rejeita template desconhecido'`, manter como está — o `BadRequestException` agora vem do `EmailTemplateService.render` (comportamento idêntico).

- [ ] **Step 2: Rodar e verificar falha**

Run: `cd backend && npx jest email.service --silent`
Expected: FAIL — `EmailService` constructor ainda recebe 5 args (TS/runtime) e/ou `sentMessage.html` é `undefined`.

- [ ] **Step 3: Implementar**

`backend/src/notifications/email.provider.ts`:
- Na interface `EmailMessage`, adicionar após `text: string;`:
```ts
  /** HTML sanitizado — enviado como multipart junto com text. */
  html?: string;
```
- Em `send()`, adicionar `html: message.html,` após `text: message.text,` no objeto de `sendMail`.

`backend/src/notifications/email.service.ts`:
1. Importar: `import { EmailTemplateService } from './email-template.service';` e `import type { RenderedEmail } from './email-template.service';`
2. Remover a interface local `RenderedEmail` (linhas 37-40) — agora vem do template service. Manter o tipo local como re-export se algum consumidor externo importar de `email.service`: adicione `export type { RenderedEmail } from './email-template.service';`
3. Remover o método privado `render()` inteiro (linhas 89-143, o `switch`). **Os 3 templates padrão NÃO são perdidos — já foram migrados para `default-templates.ts` na Task 3.**
4. Constructor: adicionar parâmetro final `private readonly templateService: EmailTemplateService,`.
5. Em `sendTemplate()`: trocar `const rendered = this.render(template, ctx);` por `const rendered = await this.templateService.render(template, ctx);` e em `provider.send` adicionar `html: rendered.html,`.
6. Em `resend()`: trocar `const rendered = this.render(...)` por `const rendered = await this.templateService.render(log.template, this.contextFor(registration, event, names.get(registration.ticketTypeId) ?? null));` e adicionar `html: rendered.html,` no `provider.send`.
7. `formatDate` private em `email.service.ts` pode ser removido se ficar sem uso (o format agora vive no template service). Remova e rode o typecheck/build para confirmar nenhum uso restante.

- [ ] **Step 4: Rodar e verificar sucesso**

Run: `cd backend && npx jest email.service email-template.service default-templates --silent && npm run build`
Expected: todas as suítes PASS; build OK.

- [ ] **Step 5: Commit**

```bash
git add backend/src/notifications/email.provider.ts backend/src/notifications/email.service.ts backend/src/notifications/email.service.spec.ts
git commit -m "feat(backend): envio multipart (text+html) com render delegado ao EmailTemplateService"
```

---

### Task 6: Contexto ampliado — eventLocation e checkinUrl

**Files:**
- Modify: `backend/src/notifications/email.service.ts` (`EmailTemplateContext`, `contextFor`)
- Modify: `backend/src/notifications/email.service.spec.ts` (factory `makeEvent`)
- Test: `backend/src/notifications/email-template.service.spec.ts` (novo caso)

**Interfaces:**
- Produces: `EmailTemplateContext` com `eventLocation?: string | null` (já parcialmente adicionada na Task 3 — aqui passa a ser populada) — consumido por todos os callers existentes sem mudança de assinatura.

- [ ] **Step 1: Escrever o teste que falha**

No `describe('EmailTemplateService.render')` de `backend/src/notifications/email-template.service.spec.ts`, adicionar:

```ts
  it('interpola eventLocation e monta checkinUrl apontando para /membro', async () => {
    const r = await service.render(
      EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
      makeCtx({ eventLocation: 'Maringá, PR' }),
    );
    expect(r.text).toContain('Local: Maringá, PR');
    expect(r.html).toContain('http://localhost:3000/membro');
  });
```

Em `backend/src/notifications/email.service.spec.ts`, atualizar o factory para o novo campo:
```ts
const makeEvent = () => ({
  id: uuid(10),
  title: 'Evento X',
  startAt: new Date('2026-08-10T13:00:00Z'),
  timezone: 'America/Sao_Paulo',
  location: 'Maringá, PR',
});
```

- [ ] **Step 2: Rodar e verificar falha**

Run: `cd backend && npx jest notifications --silent 2>&1 | tail -6`
Expected: FAIL — `r.text` não contém 'Local: Maringá, PR' (contexto não popula `eventLocation`).

- [ ] **Step 3: Implementar**

Em `backend/src/notifications/email.service.ts`:
1. Na interface `EmailTemplateContext`, garantir o campo (adicione se a Task 3 não o fez):
```ts
  eventLocation?: string | null;
```
2. Em `contextFor()`, adicionar no objeto retornado:
```ts
      eventLocation: event.location,
```

- [ ] **Step 4: Rodar e verificar sucesso**

Run: `cd backend && npx jest notifications --silent 2>&1 | tail -4`
Expected: PASS em todas as suítes de notifications.

- [ ] **Step 5: Commit**

```bash
git add backend/src/notifications/email.service.ts backend/src/notifications/email.service.spec.ts backend/src/notifications/email-template.service.spec.ts
git commit -m "feat(backend): contexto de templates ganha eventLocation e checkinUrl"
```

---

### Task 7: CRUD de templates (service) com audit

**Files:**
- Test: `backend/src/notifications/email-template.service.spec.ts`
- Modify: `backend/src/notifications/email-template.service.ts`
- Modify: `backend/src/notifications/notifications.module.ts`

**Interfaces:**
- Produces (todos usados pelo controller na Task 8):
  - `TemplateSummary { id: string; subject: string; isOverride: boolean; updatedAt: Date | null }`
  - `TemplateDetail extends TemplateSummary { bodyMarkdown: string; variables: string[] }`
  - `listTemplates(): Promise<TemplateSummary[]>`
  - `getTemplate(id): Promise<TemplateDetail>` (BadRequest se desconhecido)
  - `upsertTemplate(id, dto: {subject, bodyMarkdown}, actor: {actorId, actorHandle}): Promise<TemplateDetail>`
  - `removeTemplate(id, actor): Promise<void>` (NotFoundException se não há override)
  - `sampleContext(id): EmailTemplateContext`
  - `previewTemplate(id, dto): Promise<RenderedEmail>` — Task 9; pode ser implementado aqui já (mesmo `renderSource`), deixando a Task 9 só com o endpoint.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar novo describe em `backend/src/notifications/email-template.service.spec.ts`:

```ts
describe('EmailTemplateService CRUD', () => {
  let repo: Record<string, jest.Mock>;
  let audit: Record<string, jest.Mock>;
  let service: EmailTemplateService;

  beforeEach(() => {
    repo = {
      findOneBy: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((t) => Promise.resolve({ ...t, updatedAt: new Date() })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new EmailTemplateService(repo as any, audit as any);
  });

  const actor = { actorId: 'm1', actorHandle: 'octocat' };

  it('lista os 3 templates com isOverride=false quando não há overrides', async () => {
    const list = await service.listTemplates();
    expect(list).toHaveLength(3);
    expect(list.every((t) => t.isOverride === false)).toBe(true);
  });

  it('getTemplate retorna o padrão com isOverride=false e variáveis documentadas', async () => {
    const detail = await service.getTemplate('event-registration-confirmation');
    expect(detail.isOverride).toBe(false);
    expect(detail.variables).toContain('checkinUrl');
    expect(detail.bodyMarkdown).toContain('{{attendeeName}}');
  });

  it('upsertTemplate persiste override e audita', async () => {
    const dto = { subject: 'Novo subject', bodyMarkdown: 'Novo **corpo**' };
    const detail = await service.upsertTemplate(
      'event-registration-confirmation',
      dto,
      actor,
    );
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'event-registration-confirmation', ...dto }),
    );
    expect(detail.isOverride).toBe(true);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'email.template_upserted',
        actorId: 'm1',
        targetId: 'event-registration-confirmation',
      }),
    );
  });

  it('upsertTemplate rejeita id desconhecido', async () => {
    await expect(
      service.upsertTemplate('nope', { subject: 's', bodyMarkdown: 'b' }, actor),
    ).rejects.toThrow(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('removeTemplate exclui o override e audita', async () => {
    await service.removeTemplate('event-registration-confirmation', actor);
    expect(repo.delete).toHaveBeenCalledWith({ id: 'event-registration-confirmation' });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'email.template_deleted' }),
    );
  });

  it('removeTemplate lança NotFound quando não há override', async () => {
    repo.delete.mockResolvedValue({ affected: 0 });
    await expect(
      service.removeTemplate('event-registration-confirmation', actor),
    ).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Rodar e verificar falha**

Run: `cd backend && npx jest email-template.service --silent`
Expected: FAIL — métodos `listTemplates`/`getTemplate`/etc. não existem (`service.x is not a function`).

- [ ] **Step 3: Implementar**

Em `backend/src/notifications/email-template.service.ts`:
1. Imports: `NotFoundException` (join ao import do `@nestjs/common`), `AuditService` e `AuditAction` (`../audit/audit.service`, `../audit/entities/audit-log.entity`), `TEMPLATE_IDS`.
2. Adicionar interfaces exportadas `TemplateSummary` / `TemplateDetail` (conforme "Produces" acima).
3. Constructor ganha 2º parâmetro: `private readonly audit: AuditService,`.
4. Implementar os métodos:

```ts
  async listTemplates(): Promise<TemplateSummary[]> {
    let overrides: EmailTemplate[] = [];
    try {
      overrides = await this.repo.find();
    } catch (err) {
      this.logger.warn(`Falha ao listar overrides: ${(err as Error).message}`);
    }
    const byId = new Map(overrides.map((o) => [o.id, o]));
    return TEMPLATE_IDS.map((id) => {
      const def = DEFAULT_TEMPLATES[id];
      const override = byId.get(id);
      return {
        id,
        subject: override?.subject ?? def.subject,
        isOverride: !!override,
        updatedAt: override?.updatedAt ?? null,
      };
    });
  }

  async getTemplate(id: string): Promise<TemplateDetail> {
    if (!isKnownTemplate(id)) {
      throw new BadRequestException(`Template desconhecido: ${id}`);
    }
    const override = await this.repo.findOneBy({ id }).catch(() => null);
    const def = DEFAULT_TEMPLATES[id];
    return {
      id,
      subject: override?.subject ?? def.subject,
      bodyMarkdown: override?.bodyMarkdown ?? def.bodyMarkdown,
      isOverride: !!override,
      updatedAt: override?.updatedAt ?? null,
      variables: def.variables,
    };
  }

  async upsertTemplate(
    id: string,
    dto: { subject: string; bodyMarkdown: string },
    actor: { actorId: string; actorHandle: string },
  ): Promise<TemplateDetail> {
    if (!isKnownTemplate(id)) {
      throw new BadRequestException(`Template desconhecido: ${id}`);
    }
    await this.repo.save({ id, subject: dto.subject, bodyMarkdown: dto.bodyMarkdown });
    await this.audit.log({
      action: AuditAction.EMAIL_TEMPLATE_UPSERTED,
      actorId: actor.actorId,
      actorHandle: actor.actorHandle,
      targetId: id,
      targetType: 'email_template',
    });
    return this.getTemplate(id);
  }

  async removeTemplate(
    id: string,
    actor: { actorId: string; actorHandle: string },
  ): Promise<void> {
    if (!isKnownTemplate(id)) {
      throw new BadRequestException(`Template desconhecido: ${id}`);
    }
    const result = await this.repo.delete({ id });
    if (!result.affected) {
      throw new NotFoundException(`Template ${id} não possui override.`);
    }
    await this.audit.log({
      action: AuditAction.EMAIL_TEMPLATE_DELETED,
      actorId: actor.actorId,
      actorHandle: actor.actorHandle,
      targetId: id,
      targetType: 'email_template',
    });
  }

  sampleContext(id: string): EmailTemplateContext {
    if (!isKnownTemplate(id)) {
      throw new BadRequestException(`Template desconhecido: ${id}`);
    }
    return DEFAULT_TEMPLATES[id].sample();
  }

  async previewTemplate(
    id: string,
    dto: { subject: string; bodyMarkdown: string },
  ): Promise<RenderedEmail> {
    if (!isKnownTemplate(id)) {
      throw new BadRequestException(`Template desconhecido: ${id}`);
    }
    return this.renderSource(
      dto.subject,
      dto.bodyMarkdown,
      this.contextValues(this.sampleContext(id)),
    );
  }
```

- [ ] **Step 4: Registrar AuditModule e o serviço**

Em `backend/src/notifications/notifications.module.ts`: importar `AuditModule` de `../audit/audit.module`, adicionar `AuditModule` ao array `imports`, e garantir `EmailTemplateService` nos `providers`.

- [ ] **Step 5: Rodar e verificar sucesso**

Run: `cd backend && npx jest email-template.service --silent && npm run build`
Expected: PASS (todos); build OK.

- [ ] **Step 6: Commit**

```bash
git add backend/src/notifications/email-template.service.ts backend/src/notifications/email-template.service.spec.ts backend/src/notifications/notifications.module.ts
git commit -m "feat(backend): CRUD de overrides de templates com audit log"
```

---

### Task 8: Controller — endpoints CRUD + DTO + spec

**Files:**
- Create: `backend/src/notifications/dto/email-template-content.dto.ts`
- Modify: `backend/src/notifications/notifications.controller.ts`
- Test: `backend/src/notifications/notifications.controller.spec.ts`

**Interfaces:**
- Consumes: métodos CRUD de `EmailTemplateService` (Task 7).
- Produces (rotas, todas sob guard admin existente):
  - `GET /notifications/templates` → `TemplateSummary[]`
  - `GET /notifications/templates/:id` → `TemplateDetail`
  - `PUT /notifications/templates/:id` → `TemplateDetail`
  - `DELETE /notifications/templates/:id` → `204` (use `@HttpCode(HttpStatus.NO_CONTENT)`)
- `JwtPayload` vem de `../auth/jwt.strategy` (campos `sub`, `handle`, `email`).

- [ ] **Step 1: Escrever os testes que falham**

Em `backend/src/notifications/notifications.controller.spec.ts`:

1. Estender o mock do service no `beforeEach`:
```ts
    emailService = {
      listLogs: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      resend: jest.fn().mockResolvedValue({ success: true }),
    };
    templateService = {
      listTemplates: jest.fn().mockResolvedValue([]),
      getTemplate: jest.fn().mockResolvedValue({ id: 'event-registration-confirmation' }),
      upsertTemplate: jest.fn().mockResolvedValue({ id: 'event-registration-confirmation' }),
      removeTemplate: jest.fn().mockResolvedValue(undefined),
      previewTemplate: jest.fn(),
      sampleContext: jest.fn(),
    };
```
   e adicionar provider ao TestingModule:
```ts
      providers: [
        { provide: EmailService, useValue: emailService },
        { provide: EmailTemplateService, useValue: templateService },
      ],
```
   (com `import { EmailTemplateService } from './email-template.service';` no topo; declarar `let templateService: Record<string, jest.Mock>;`)

2. Adicionar os testes:
```ts
  it('lista templates', async () => {
    templateService.listTemplates.mockResolvedValue([{ id: 'event-registration-confirmation' }]);
    const result = await controller.listTemplates();
    expect(templateService.listTemplates).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 'event-registration-confirmation' }]);
  });

  it('detalha template por id', async () => {
    await controller.getTemplate('event-reminder-d1');
    expect(templateService.getTemplate).toHaveBeenCalledWith('event-reminder-d1');
  });

  it('faz upsert do template com o ator do JWT', async () => {
    const dto = { subject: 's', bodyMarkdown: 'b' };
    const req = { user: { sub: 'm1', handle: 'octocat', email: 'o@c.dev' } };
    await controller.upsertTemplate('event-post-event', dto, req);
    expect(templateService.upsertTemplate).toHaveBeenCalledWith(
      'event-post-event',
      dto,
      { actorId: 'm1', actorHandle: 'octocat' },
    );
  });

  it('remove override do template', async () => {
    const req = { user: { sub: 'm1', handle: 'octocat', email: 'o@c.dev' } };
    await controller.removeTemplate('event-post-event', req);
    expect(templateService.removeTemplate).toHaveBeenCalledWith(
      'event-post-event',
      { actorId: 'm1', actorHandle: 'octocat' },
    );
  });
```

- [ ] **Step 2: Rodar e verificar falha**

Run: `cd backend && npx jest notifications.controller --silent`
Expected: FAIL — `controller.listTemplates is not a function`.

- [ ] **Step 3: Implementar o DTO e o controller**

`backend/src/notifications/dto/email-template-content.dto.ts` (criar o diretório `dto/`):

```ts
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EmailTemplateContentDto {
  @ApiProperty({ example: 'Inscrição confirmada — {{eventTitle}}' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @ApiProperty({ example: 'Olá, {{attendeeName}}!' })
  @IsString()
  @IsNotEmpty()
  bodyMarkdown: string;
}
```

`backend/src/notifications/notifications.controller.ts`:
1. Imports: `Body, Delete, HttpCode, HttpStatus, Put, Req` (juntar aos existentes do `@nestjs/common`); `EmailTemplateContentDto`; `EmailTemplateService`; `JwtPayload` de `../auth/jwt.strategy`; `Request`-like typing local: usar `req: { user: JwtPayload }` (padrão do `events.controller.ts`).
2. Constructor: `constructor(private readonly emailService: EmailService, private readonly templateService: EmailTemplateService) {}`
3. Adicionar ao corpo da classe (antes do fechamento):

```ts
  @Get('templates')
  @ApiOperation({ summary: '🔒 Lista templates de e-mail (override ou padrão) [admin]' })
  listTemplates() {
    return this.templateService.listTemplates();
  }

  @Get('templates/:id')
  @ApiOperation({ summary: '🔒 Detalha um template de e-mail [admin]' })
  getTemplate(@Param('id') id: string) {
    return this.templateService.getTemplate(id);
  }

  @Put('templates/:id')
  @ApiOperation({ summary: '🔒 Cria/atualiza override de template [admin]' })
  upsertTemplate(
    @Param('id') id: string,
    @Body() dto: EmailTemplateContentDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.templateService.upsertTemplate(id, dto, {
      actorId: req.user.sub,
      actorHandle: req.user.handle,
    });
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '🔒 Remove override e restaura o padrão [admin]' })
  async removeTemplate(@Param('id') id: string, @Req() req: { user: JwtPayload }) {
    await this.templateService.removeTemplate(id, {
      actorId: req.user.sub,
      actorHandle: req.user.handle,
    });
  }
```

- [ ] **Step 4: Rodar e verificar sucesso**

Run: `cd backend && npx jest notifications.controller --silent && npm run build`
Expected: PASS; build OK.

- [ ] **Step 5: Commit**

```bash
git add backend/src/notifications/dto/ backend/src/notifications/notifications.controller.ts backend/src/notifications/notifications.controller.spec.ts
git commit -m "feat(backend): endpoints admin de CRUD de templates de e-mail"
```

---

### Task 9: Endpoints de preview e envio de teste

**Files:**
- Modify: `backend/src/notifications/notifications.controller.ts`
- Test: `backend/src/notifications/notifications.controller.spec.ts`

**Interfaces:**
- Consumes: `EmailTemplateService.previewTemplate(id, dto)` e `sampleContext(id)` (Task 7); `EmailService.sendTemplate(template, to, ctx)` existente.
- Produces:
  - `POST /notifications/templates/:id/preview` body `EmailTemplateContentDto` → `RenderedEmail` (`{subject, text, html}`)
  - `POST /notifications/templates/:id/test` → `{ emailLogId: string }` (envia para `req.user.email`)

- [ ] **Step 1: Escrever os testes que falham**

Em `backend/src/notifications/notifications.controller.spec.ts`:

```ts
  it('renderiza preview com o DTO enviado', async () => {
    templateService.previewTemplate.mockResolvedValue({
      subject: 's',
      text: 't',
      html: '<p>t</p>',
    });
    const dto = { subject: 's', bodyMarkdown: 'b' };
    const result = await controller.previewTemplate('event-reminder-d1', dto);
    expect(templateService.previewTemplate).toHaveBeenCalledWith('event-reminder-d1', dto);
    expect(result.html).toBe('<p>t</p>');
  });

  it('envia e-mail de teste para o e-mail do admin logado', async () => {
    templateService.sampleContext.mockReturnValue({ attendeeName: 'Maria' });
    emailService.sendTemplate.mockResolvedValue({ id: 'log-123' });
    const req = { user: { sub: 'm1', handle: 'octocat', email: 'octo@c.dev' } };
    const result = await controller.sendTestTemplate('event-reminder-d1', req);
    expect(templateService.sampleContext).toHaveBeenCalledWith('event-reminder-d1');
    expect(emailService.sendTemplate).toHaveBeenCalledWith(
      'event-reminder-d1',
      'octo@c.dev',
      { attendeeName: 'Maria' },
    );
    expect(result).toEqual({ emailLogId: 'log-123' });
  });
```

- [ ] **Step 2: Rodar e verificar falha**

Run: `cd backend && npx jest notifications.controller --silent`
Expected: FAIL — `controller.previewTemplate is not a function`.

- [ ] **Step 3: Implementar**

Em `backend/src/notifications/notifications.controller.ts`, adicionar:

```ts
  @Post('templates/:id/preview')
  @ApiOperation({
    summary: '🔒 Renderiza preview do template com variáveis de exemplo [admin]',
  })
  previewTemplate(@Param('id') id: string, @Body() dto: EmailTemplateContentDto) {
    return this.templateService.previewTemplate(id, dto);
  }

  @Post('templates/:id/test')
  @ApiOperation({
    summary: '🔒 Envia e-mail de teste do template para o admin logado [admin]',
  })
  async sendTestTemplate(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
  ) {
    const log = await this.emailService.sendTemplate(
      id,
      req.user.email,
      this.templateService.sampleContext(id),
    );
    return { emailLogId: log.id };
  }
```

- [ ] **Step 4: Rodar e verificar sucesso**

Run: `cd backend && npx jest notifications.controller email-template.service --silent && npm run build`
Expected: PASS; build OK.

- [ ] **Step 5: Rodar a suíte completa do backend**

Run: `cd backend && npx jest --silent 2>&1 | tail -4`
Expected: todas as suítes PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/notifications/notifications.controller.ts backend/src/notifications/notifications.controller.spec.ts
git commit -m "feat(backend): preview renderizado e envio de teste de templates de e-mail"
```

---

### Task 10: Frontend — aba "Templates" em /admin/emails

**Files:**
- Create: `src/components/EmailsTemplatesTab/index.tsx`
- Create: `src/components/EmailsTemplatesTab/__tests__/index.test.tsx`
- Modify: `src/pages/admin/emails.tsx`

**Interfaces:**
- Consumes: rotas da Task 8/9 via `authFetch` (relativas): `GET /notifications/templates`, `GET /notifications/templates/:id`, `PUT /notifications/templates/:id`, `DELETE /notifications/templates/:id`, `POST /notifications/templates/:id/preview`, `POST /notifications/templates/:id/test`.
- Produces: componente default `<EmailsTemplatesTab />` sem props; `emails.tsx` renderiza Tabs com dois painéis montados (`hidden`), mantendo o conteúdo atual de logs intacto.

- [ ] **Step 1: Escrever os testes que falham**

`src/components/EmailsTemplatesTab/__tests__/index.test.tsx`:

```tsx
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EmailsTemplatesTab from "..";
import { buildAuthState, mockUseAuth } from "../../../test-utils/auth";
import { jsonResponse } from "../../../test-utils/http";

jest.mock("../../../hooks/useAuth");

const LIST = [
  { id: "event-registration-confirmation", subject: "Inscrição confirmada — {{eventTitle}}", isOverride: false, updatedAt: null },
  { id: "event-reminder-d1", subject: "Lembrete: {{eventTitle}} é amanhã", isOverride: true, updatedAt: "2026-09-20T00:00:00.000Z" },
  { id: "event-post-event", subject: "Obrigado por participar de {{eventTitle}}", isOverride: false, updatedAt: null },
];

const DETAIL = {
  id: "event-registration-confirmation",
  subject: "Inscrição confirmada — {{eventTitle}}",
  bodyMarkdown: "Olá, {{attendeeName}}!",
  isOverride: false,
  updatedAt: null,
  variables: ["attendeeName", "eventTitle"],
};

function mockFetch(handlers: Record<string, unknown>) {
  const authFetch = jest.fn(async (url: string, init?: { method?: string }) => {
    const method = init?.method ?? "GET";
    const key = `${method} ${url}`;
    if (handlers[key]) return jsonResponse(handlers[key]);
    return jsonResponse({ error: "not mocked" }, { ok: false, status: 404 });
  });
  mockUseAuth.mockReturnValue(buildAuthState({ authFetch: authFetch as any }));
  return authFetch;
}

describe("EmailsTemplatesTab", () => {
  it("lista templates com chip de estado e carrega o editor ao selecionar", async () => {
    mockFetch({
      "GET /notifications/templates": LIST,
      "GET /notifications/templates/event-registration-confirmation": DETAIL,
    });
    render(<EmailsTemplatesTab />);

    expect(await screen.findByText("Personalizado")).toBeInTheDocument();
    expect(screen.getAllByText("Padrão").length).toBe(2);

    fireEvent.click(screen.getByText("event-registration-confirmation"));
    expect(await screen.findByDisplayValue("Olá, {{attendeeName}}!")).toBeInTheDocument();
    expect(screen.getByText("{{checkinUrl}}")).toBeInTheDocument();
  });

  it("salva o template editado via PUT", async () => {
    const authFetch = mockFetch({
      "GET /notifications/templates": LIST,
      "GET /notifications/templates/event-registration-confirmation": DETAIL,
    });
    render(<EmailsTemplatesTab />);

    fireEvent.click(await screen.findByText("event-registration-confirmation"));
    const body = await screen.findByDisplayValue("Olá, {{attendeeName}}!");
    fireEvent.change(body, { target: { value: "Olá, **{{attendeeName}}**!" } });
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        "/notifications/templates/event-registration-confirmation",
        expect.objectContaining({ method: "PUT" }),
      );
    });
  });

  it("envia e-mail de teste e exibe feedback", async () => {
    mockFetch({
      "GET /notifications/templates": LIST,
      "GET /notifications/templates/event-registration-confirmation": DETAIL,
      "POST /notifications/templates/event-registration-confirmation/test": { emailLogId: "log-1" },
    });
    render(<EmailsTemplatesTab />);

    fireEvent.click(await screen.findByText("event-registration-confirmation"));
    fireEvent.click(await screen.findByRole("button", { name: /enviar teste/i }));

    expect(await screen.findByText(/E-mail de teste enviado/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e verificar falha**

Run: `npx jest --config jest.config.ts EmailsTemplatesTab --silent`
Expected: FAIL — `Cannot find module '..'` (o componente não existe).

- [ ] **Step 3: Implementar o componente**

`src/components/EmailsTemplatesTab/index.tsx` (estrutura completa; ajustes finos de layout são bem-vindos, mantendo os contratos de teste):

```tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useAuth } from "../../hooks/useAuth";
import { parseAuthJson, extractErrorMessage } from "../../hooks/authFetchHelpers";
import ModalConfirm from "../ModalConfirm";

interface TemplateSummary {
  id: string;
  subject: string;
  isOverride: boolean;
  updatedAt: string | null;
}

interface TemplateDetail extends TemplateSummary {
  bodyMarkdown: string;
  variables: string[];
}

const TEMPLATE_LABELS: Record<string, string> = {
  "event-registration-confirmation": "Confirmação de inscrição",
  "event-reminder-d1": "Lembrete D-1",
  "event-post-event": "Pós-evento",
};

export default function EmailsTemplatesTab(): React.JSX.Element {
  const { authFetch } = useAuth();
  const [list, setList] = useState<TemplateSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<{ html: string; text: string } | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadList = useCallback(async () => {
    const res = await authFetch("/notifications/templates");
    const data = await parseAuthJson<TemplateSummary[]>(res, () => setError("Falha ao carregar templates."));
    if (data) setList(data);
  }, [authFetch]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const select = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setError("");
      setFeedback("");
      setPreview(null);
      const res = await authFetch(`/notifications/templates/${id}`);
      const data = await parseAuthJson<TemplateDetail>(res, () => setError("Falha ao carregar o template."));
      if (!data) return;
      setDetail(data);
      setSubject(data.subject);
      setBody(data.bodyMarkdown);
    },
    [authFetch],
  );

  const requestPreview = useCallback(
    (nextSubject: string, nextBody: string) => {
      if (!selectedId) return;
      if (previewTimer.current) clearTimeout(previewTimer.current);
      previewTimer.current = setTimeout(async () => {
        const res = await authFetch(`/notifications/templates/${selectedId}/preview`, {
          method: "POST",
          body: JSON.stringify({ subject: nextSubject, bodyMarkdown: nextBody }),
        });
        const data = await parseAuthJson<{ html: string; text: string }>(res, () => {});
        if (data) setPreview(data);
      }, 400);
    },
    [authFetch, selectedId],
  );

  const save = async (): Promise<void> => {
    if (!selectedId) return;
    setSaving(true);
    setError("");
    setFeedback("");
    const res = await authFetch(`/notifications/templates/${selectedId}`, {
      method: "PUT",
      body: JSON.stringify({ subject, bodyMarkdown: body }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await extractErrorMessage(res, "Falha ao salvar."));
      return;
    }
    setFeedback("Template salvo.");
    await loadList();
  };

  const restore = async (): Promise<void> => {
    if (!selectedId) return;
    setConfirmRestore(false);
    const res = await authFetch(`/notifications/templates/${selectedId}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      setError(await extractErrorMessage(res, "Falha ao restaurar o padrão."));
      return;
    }
    setFeedback("Template restaurado para o padrão.");
    await loadList();
    await select(selectedId);
  };

  const sendTest = async (): Promise<void> => {
    if (!selectedId) return;
    setFeedback("");
    setError("");
    const res = await authFetch(`/notifications/templates/${selectedId}/test`, { method: "POST" });
    if (!res.ok) {
      setError(await extractErrorMessage(res, "Falha ao enviar o teste."));
      return;
    }
    const data = await parseAuthJson<{ emailLogId: string }>(res, () => null);
    setFeedback(`E-mail de teste enviado (log ${data?.emailLogId ?? ""}).`);
  };

  if (!list) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Stack spacing={1}>
          {list.map((t) => (
            <Button
              key={t.id}
              variant={selectedId === t.id ? "contained" : "outlined"}
              onClick={() => select(t.id)}
              sx={{ justifyContent: "space-between", textTransform: "none" }}
            >
              <span>{TEMPLATE_LABELS[t.id] ?? t.id}</span>
              <Chip
                size="small"
                label={t.isOverride ? "Personalizado" : "Padrão"}
                color={t.isOverride ? "success" : "default"}
              />
            </Button>
          ))}
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, md: 8 }}>
        {!detail ? (
          <Typography color="text.secondary">Selecione um template para editar.</Typography>
        ) : (
          <Stack spacing={2}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {feedback ? <Alert severity="success">{feedback}</Alert> : null}
            <TextField
              label="Assunto"
              value={subject}
              fullWidth
              onChange={(e) => {
                setSubject(e.target.value);
                requestPreview(e.target.value, body);
              }}
            />
            <TextField
              label="Corpo (Markdown)"
              value={body}
              fullWidth
              multiline
              minRows={10}
              inputProps={{ sx: { fontFamily: "monospace" } }}
              onChange={(e) => {
                setBody(e.target.value);
                requestPreview(subject, e.target.value);
              }}
            />
            <Box>
              <Typography variant="caption" color="text.secondary">
                Variáveis: {detail.variables.map((v) => `{{${v}}}`).join("  ")}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={save} disabled={saving}>
                Salvar
              </Button>
              <Button variant="outlined" onClick={() => setConfirmRestore(true)} disabled={!detail.isOverride}>
                Restaurar padrão
              </Button>
              <Button variant="outlined" onClick={sendTest}>
                Enviar teste
              </Button>
            </Stack>
            {preview ? (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Preview (HTML)
                  </Typography>
                  {/* HTML já sanitizado server-side (sanitize-html no backend) */}
                  <Box
                    variant="outlined"
                    component="div"
                    sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 2 }}
                    dangerouslySetInnerHTML={{ __html: preview.html }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Versão texto
                  </Typography>
                  <Box
                    component="pre"
                    sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 2, whiteSpace: "pre-wrap", m: 0 }}
                  >
                    {preview.text}
                  </Box>
                </Grid>
              </Grid>
            ) : null}
          </Stack>
        )}
      </Grid>
      <ModalConfirm
        open={confirmRestore}
        title="Restaurar template padrão"
        message="O override personalizado será removido e o template padrão voltará a ser usado. Continuar?"
        onConfirm={restore}
        onCancel={() => setConfirmRestore(false)}
      />
    </Grid>
  );
}
```

> Verifique a API real do `ModalConfirm` (`src/components/ModalConfirm/index.tsx`) e ajuste as props (`open`/`title`/`message`/`onConfirm`/`onCancel`) para corresponder — algumas versões usam `isOpen`/`description`. O teste não cobre o modal; o contrato coberto é o fluxo de restore via DELETE.

- [ ] **Step 4: Integrar a aba em emails.tsx (RED)**

Em `src/pages/admin/emails.tsx`:
1. Imports: `import Tabs from "@mui/material/Tabs"; import Tab from "@mui/material/Tab"; import EmailsTemplatesTab from "../../components/EmailsTemplatesTab";` e `import { useState } from "react";` (já importado).
2. No componente `EmailsAdminPage`, adicionar estado `const [tab, setTab] = useState<0 | 1>(0);`.
3. Logo após o cabeçalho da página (antes do conteúdo atual), renderizar:
```tsx
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Logs" />
        <Tab label="Templates" />
      </Tabs>
      <Box hidden={tab !== 0}>{/* conteúdo atual de logs permanece aqui, sem alterações */}</Box>
      <Box hidden={tab !== 1}>
        <EmailsTemplatesTab />
      </Box>
```
   Envolver o conteúdo atual de logs no `<Box hidden={tab !== 0}>` — **manter todo o JSX de logs dentro dele, sem mudanças**. Os dois painéis ficam montados (padrão MUI `hidden`) para não quebrar testes existentes que consultam a tabela de logs.

- [ ] **Step 5: Rodar testes (novos + existentes)**

Run: `npx jest --config jest.config.ts EmailsTemplatesTab src/pages/admin/__tests__/emails.test.tsx --silent`
Expected: PASS nos dois arquivos. (Se o teste antigo de emails falhar por causa das Tabs, ajuste para clicar na aba "Logs" antes de assertions — mas o painel montado com `hidden` deve manter compatibilidade.)

- [ ] **Step 6: Typecheck e commit**

Run: `npm run typecheck`
Expected: sem erros.

```bash
git add src/components/EmailsTemplatesTab/ src/pages/admin/emails.tsx
git commit -m "feat: aba Templates no painel de e-mails admin"
```

---

### Task 11: Docs e validação final

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-09-25-email-templates-design.md` (status)

**Interfaces:**
- Consumes: tudo das Tasks 1-10.

- [ ] **Step 1: Atualizar AGENTS.md**

Em `AGENTS.md`, na seção "Directory Structure", na entrada `│   │   ├── notifications/`, substituir a descrição:

de: `# ⭐ E-mails transacionais de eventos (nodemailer SMTP Gmail + email_logs + crons D-1/pós-evento)`
para: `# ⭐ E-mails transacionais de eventos (nodemailer SMTP Gmail + email_logs + crons D-1/pós-evento + templates editáveis via /admin/emails — tabela email_templates, pipeline Markdown→HTML sanitizado com fallback p/ padrões)`

- [ ] **Step 2: Atualizar status do spec**

Em `docs/superpowers/specs/2026-09-25-email-templates-design.md`, no AGENT-INDEX: `status: Aprovado (brainstorming) / aguardando plano de implementação` → `status: Implementado`.

- [ ] **Step 3: Validação completa**

Run:
```bash
cd backend && npm run build && npx jest --silent 2>&1 | tail -3
cd .. && npm run typecheck && npx jest --config jest.config.ts --silent 2>&1 | tail -3 && npm run build 2>&1 | tail -3
```
Expected: backend build+jest OK; frontend typecheck OK; jest 54+ suítes verdes; `npm run build` `[SUCCESS]`.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md docs/superpowers/specs/2026-09-25-email-templates-design.md
git commit -m "docs: templates de e-mail editáveis implementados"
```

---

## Self-Review do plano (executado na escrita)

- **Cobertura do spec:** schema §3 → Task 2; pipeline §4.1-4.2 → Tasks 4-5; contexto §4.3 → Task 6; API §5 → Tasks 7-9; UI §6 → Task 10; segurança §7 → sanitize/fallback/roles nas Tasks 4/5/7/8; testes §8 → TDD em cada task; deps/bump §9 → Task 1; docs → Task 11. ✓
- **Placeholders:** nenhum "TBD"; todos os steps de código têm conteúdo real ou referência exata de arquivo/linha. ✓
- **Consistência de tipos:** `RenderedEmail {subject, text, html}` definido na Task 4 e consumido idêntico nas Tasks 5/7/9; `EmailTemplateContext` ganha `eventLocation` na Task 3 (campo) e Task 6 (população); nomes de métodos do service (`render`, `listTemplates`, `getTemplate`, `upsertTemplate`, `removeTemplate`, `previewTemplate`, `sampleContext`) idênticos entre service/controller/specs. ✓

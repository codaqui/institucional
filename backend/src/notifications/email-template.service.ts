import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { EmailTemplate } from './entities/email-template.entity';
import type { EmailTemplateContext } from './email.service';
import {
  DEFAULT_TEMPLATES,
  isKnownTemplate,
  TEMPLATE_IDS,
} from './default-templates';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

// html-to-text v10 não embarca tipos (e @types/html-to-text cobre só a
// v8/v9), então carregamos via require com tipagem local da superfície usada.
const { convert } = require('html-to-text') as {
  convert: (html: string, options?: { wordwrap?: number | string | false }) => string;
};

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export interface TemplateSummary {
  id: string;
  subject: string;
  isOverride: boolean;
  updatedAt: Date | null;
}

export interface TemplateDetail extends TemplateSummary {
  bodyMarkdown: string;
  variables: string[];
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
    private readonly audit: AuditService,
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
    try {
      return this.renderSource(source.subject, source.bodyMarkdown, this.contextValues(ctx));
    } catch (err) {
      const fallback = DEFAULT_TEMPLATES[templateId];
      this.logger.warn(
        `Falha ao renderizar ${templateId} (${(err as Error).message}); usando padrão`,
      );
      return this.renderSource(
        fallback.subject,
        fallback.bodyMarkdown,
        this.contextValues(ctx),
      );
    }
  }

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
    const saved = await this.repo.save({
      id,
      subject: dto.subject,
      bodyMarkdown: dto.bodyMarkdown,
    });
    await this.audit.log({
      action: AuditAction.EMAIL_TEMPLATE_UPSERTED,
      actorId: actor.actorId,
      actorHandle: actor.actorHandle,
      targetType: 'email_template',
      details: { templateId: id },
    });
    return {
      id,
      subject: saved.subject,
      bodyMarkdown: saved.bodyMarkdown,
      isOverride: true,
      updatedAt: saved.updatedAt ?? null,
      variables: DEFAULT_TEMPLATES[id].variables,
    };
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
      targetType: 'email_template',
      details: { templateId: id },
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
}

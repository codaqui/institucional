import {
  BadRequestException,
  Injectable,
  Logger,
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
} from './default-templates';

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

import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Adapter SMTP (Gmail por padrão) — implementação inicial do provider de
 * e-mail. Migrar para SES/Resend no futuro = trocar só esta classe.
 *
 * Sem credenciais (SMTP_USER/SMTP_PASS), o provider fica desconfigurado e o
 * EmailService registra o log com erro 'SMTP_NOT_CONFIGURED' — a app sobe
 * normalmente.
 */
@Injectable()
export class SmtpEmailProvider {
  private readonly logger = new Logger(SmtpEmailProvider.name);
  private readonly transporter: Transporter | null = null;
  private readonly from: string | null = null;

  constructor() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number.parseInt(process.env.SMTP_PORT || '465', 10);
    const secure = (process.env.SMTP_SECURE ?? 'true') !== 'false';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    this.from = process.env.EMAIL_FROM || user || null;

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });
    } else {
      this.logger.warn(
        'SMTP_USER/SMTP_PASS não definidos — envios serão registrados como failed (SMTP_NOT_CONFIGURED).',
      );
    }
  }

  isConfigured(): boolean {
    return this.transporter !== null && !!this.from;
  }

  async send(message: EmailMessage): Promise<void> {
    if (!this.transporter || !this.from) {
      throw new Error('SMTP_NOT_CONFIGURED');
    }
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}

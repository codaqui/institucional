import type { EmailTemplateContext } from './email.service';

// Os IDs dos templates vivem aqui (e não no email.service) para que este
// módulo não precise importar valores de runtime de email.service — isso
// quebraria o ciclo de requires email.service → email-template.service →
// default-templates → email.service e deixaria DEFAULT_TEMPLATES com chaves
// undefined quando email.service é carregado primeiro.
export const EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION =
  'event-registration-confirmation';
export const EMAIL_TEMPLATE_REMINDER_D1 = 'event-reminder-d1';
export const EMAIL_TEMPLATE_POST_EVENT = 'event-post-event';

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

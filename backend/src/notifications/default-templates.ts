import type { EmailTemplateContext } from './email.service';

// Os IDs dos templates vivem aqui (e não no email.service) para que este
// módulo não precise importar valores de runtime de email.service — isso
// quebraria o ciclo de requires email.service → email-template.service →
// default-templates → email.service e deixaria DEFAULT_TEMPLATES com chaves
// undefined quando email.service é carregado primeiro.
export const EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION =
  'event-registration-confirmation';
export const EMAIL_TEMPLATE_REGISTRATION_CANCELLED =
  'event-registration-cancelled';
export const EMAIL_TEMPLATE_REMINDER_D1 = 'event-reminder-d1';
export const EMAIL_TEMPLATE_POST_EVENT = 'event-post-event';
export const EMAIL_TEMPLATE_CERTIFICATE_PENDING = 'certificate-pending-registration';

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
    meetLink: 'https://meet.example.test/mentoria',
    cancelReason: 'Conflito de agenda',
  };
}

function mentorshipBody(...content: string[]): string {
  return ['Olá, {{attendeeName}}!', '', ...content, '', '— Equipe Codaqui'].join('\n');
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
  [EMAIL_TEMPLATE_REGISTRATION_CANCELLED]: {
    subject: 'Inscrição cancelada — {{eventTitle}}',
    variables: [
      'attendeeName',
      'eventTitle',
      'eventStartAt',
      'eventTimeZone',
    ],
    sample: sampleContext,
    bodyMarkdown: [
      'Olá, {{attendeeName}}!',
      '',
      'A inscrição em **{{eventTitle}}** foi cancelada. Se houve pagamento, o estorno foi processado pela plataforma.',
      '',
      '- Data prevista: {{eventStartAt}}',
      '- Fuso horário: {{eventTimeZone}}',
      '',
      'Em caso de dúvidas, fale com a equipe Codaqui.',
      '',
      '— Equipe Codaqui',
    ].join('\n'),
  },
  [EMAIL_TEMPLATE_REMINDER_D1]: {
    subject: 'Lembrete: {{eventTitle}} é amanhã',
    variables: [
      'attendeeName',
      'eventTitle',
      'eventStartAt',
      'eventLocation',
      'checkinUrl',
    ],
    sample: sampleContext,
    bodyMarkdown: [
      'Olá, {{attendeeName}}!',
      '',
      'Lembrete: **{{eventTitle}}** acontece amanhã, {{eventStartAt}}.',
      '',
      '- Local: {{eventLocation}}',
      '',
      'Recupere o [QR Code da sua inscrição]({{checkinUrl}}) para apresentar na entrada.',
      '',
      'Nos vemos lá! Qualquer dúvida, fale com a equipe Codaqui.',
      '',
      '— Equipe Codaqui',
    ].join('\n'),
  },
  [EMAIL_TEMPLATE_CERTIFICATE_PENDING]: {
    subject: 'Certificado pendente de cadastro — {{eventTitle}}',
    variables: ['attendeeName', 'eventTitle', 'eventStartAt', 'eventLocation', 'checkinToken', 'checkinUrl'],
    sample: sampleContext,
    bodyMarkdown: [
      'Olá, {{attendeeName}}!',
      '',
      'Seu certificado de participação em **{{eventTitle}}** está pendente de cadastro.',
      '',
      'Para associar sua participação e acessar o certificado, [aceite o convite]({{checkinUrl}}).',
      '',
      'Entre ou crie sua conta Codaqui com GitHub. O e-mail deste convite precisa estar verificado na sua conta GitHub.',
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
  'mentorship-requested': {
    subject: 'Sessão de mentoria solicitada',
    variables: ['attendeeName', 'eventStartAt', 'eventTimeZone'],
    sample: sampleContext,
    bodyMarkdown: mentorshipBody(
      'Sua sessão de mentoria foi solicitada para {{eventStartAt}} ({{eventTimeZone}}).',
      '',
      'O mentor revisará o pedido e enviará a confirmação com o link.',
    ),
  },
  'mentorship-confirmed': {
    subject: 'Sessão de mentoria confirmada',
    variables: ['attendeeName', 'eventStartAt', 'eventTimeZone', 'meetLink'],
    sample: sampleContext,
    bodyMarkdown: mentorshipBody(
      'Sua sessão de mentoria está confirmada para {{eventStartAt}} ({{eventTimeZone}}).',
      '',
      'Acesse: {{meetLink}}',
    ),
  },
  'mentorship-reminder-d1': {
    subject: 'Lembrete: sua mentoria é amanhã',
    variables: ['attendeeName', 'eventStartAt', 'eventTimeZone', 'meetLink'],
    sample: sampleContext,
    bodyMarkdown: mentorshipBody(
      'Lembrete: sua mentoria acontece amanhã, {{eventStartAt}} ({{eventTimeZone}}).',
      '',
      'Acesse: {{meetLink}}',
    ),
  },
  'mentorship-cancelled': {
    subject: 'Sessão de mentoria cancelada',
    variables: ['attendeeName', 'eventStartAt', 'eventTimeZone', 'cancelReason'],
    sample: sampleContext,
    bodyMarkdown: mentorshipBody(
      'Sua sessão de mentoria prevista para {{eventStartAt}} ({{eventTimeZone}}) foi cancelada.',
      '',
      'Motivo: {{cancelReason}}',
      '',
      'Você pode escolher um novo horário na página do programa.',
    ),
  },
};

export const TEMPLATE_IDS: string[] = Object.keys(DEFAULT_TEMPLATES);

export function isKnownTemplate(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(DEFAULT_TEMPLATES, id);
}

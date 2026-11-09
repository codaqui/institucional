import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export type ProjectEmailTemplate = 'project_mentor_assigned' | 'project_registration_confirmed' | 'project_hours_approved' | 'project_hours_rejected' | 'project_finished';

export interface ProjectEmailInput {
  template: ProjectEmailTemplate;
  to: string;
  memberName: string;
  projectName: string;
  projectId: string;
  hours?: number;
  reason?: string;
}

export function renderProjectEmail(input: ProjectEmailInput): { subject: string; text: string; html: string } {
  const details = [
    `Olá, ${input.memberName}!`,
    `Projeto: ${input.projectName}`,
    input.hours === undefined ? null : `Horas: ${input.hours}`,
    input.reason ? `Motivo: ${input.reason}` : null,
  ].filter(Boolean).join('\n\n');
  const messages: Record<ProjectEmailTemplate, { subject: string; body: string }> = {
    project_mentor_assigned: { subject: `Mentoria atribuída: ${input.projectName}`, body: 'Você foi designado como mentor principal deste projeto.' },
    project_registration_confirmed: { subject: `Inscrição confirmada: ${input.projectName}`, body: 'Sua inscrição no projeto foi confirmada.' },
    project_hours_approved: { subject: `Horas aprovadas: ${input.projectName}`, body: 'Suas horas no projeto foram aprovadas.' },
    project_hours_rejected: { subject: `Horas rejeitadas: ${input.projectName}`, body: 'Suas horas no projeto foram rejeitadas.' },
    project_finished: { subject: `Projeto finalizado: ${input.projectName}`, body: 'O projeto foi finalizado e seus comprovantes estão disponíveis.' },
  };
  const message = messages[input.template];
  const text = `${message.body}\n\n${details}`;
  return {
    subject: message.subject,
    text,
    html: sanitizeHtml(marked.parse(text, { async: false }) as string),
  };
}

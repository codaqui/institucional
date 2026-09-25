import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EmailTemplateService } from './email-template.service';
import { EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION } from './email.service';

// Os mocks de 'marked' e 'sanitize-html/node_modules/htmlparser2' (ESM-only
// sob Jest CJS) vivem em test/jest-setup.ts, carregado via setupFiles do Jest.
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
  let audit: Record<string, jest.Mock>;
  let service: EmailTemplateService;

  beforeEach(() => {
    repo = { findOneBy: jest.fn().mockResolvedValue(null) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new EmailTemplateService(repo as any, audit as any);
  });

  it('renderiza o template padrão quando não há override', async () => {
    const r = await service.render(EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION, makeCtx());
    expect(r.subject).toBe('Inscrição confirmada — Evento X');
    expect(r.html).toContain('<strong>Evento X</strong>');
    expect(r.text).toContain('Sua inscrição em');
    expect(r.html).not.toContain('token-de-exemplo');
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

  it('cai no template padrão quando o pipeline de renderização falha', async () => {
    repo.findOneBy.mockResolvedValue(makeOverride());
    const spy = jest
      .spyOn(service as any, 'markdownToHtml')
      .mockImplementationOnce(() => {
        throw new Error('boom');
      });
    try {
      const r = await service.render(
        EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
        makeCtx(),
      );
      expect(r.subject).toBe('Inscrição confirmada — Evento X');
      expect(r.html).not.toContain('te esperamos');
      expect(r.text).toContain('Sua inscrição em');
    } finally {
      spy.mockRestore();
    }
  });

  it('interpola eventLocation e monta checkinUrl apontando para /membro', async () => {
    const r = await service.render(
      EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
      makeCtx({ eventLocation: 'Maringá, PR' }),
    );
    expect(r.text).toContain('Local: Maringá, PR');
    expect(r.html).toContain('http://localhost:3000/membro');
  });
});

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
        targetType: 'email_template',
        details: expect.objectContaining({
          templateId: 'event-registration-confirmation',
        }),
      }),
    );
    const upsertCallArg = audit.log.mock.calls[0][0];
    expect(upsertCallArg.targetId).toBeUndefined();
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
      expect.objectContaining({
        action: 'email.template_deleted',
        targetType: 'email_template',
        details: expect.objectContaining({
          templateId: 'event-registration-confirmation',
        }),
      }),
    );
    const deleteCallArg = audit.log.mock.calls[0][0];
    expect(deleteCallArg.targetId).toBeUndefined();
  });

  it('removeTemplate lança NotFound quando não há override', async () => {
    repo.delete.mockResolvedValue({ affected: 0 });
    await expect(
      service.removeTemplate('event-registration-confirmation', actor),
    ).rejects.toThrow(NotFoundException);
  });
});

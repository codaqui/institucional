import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { EmailService } from './email.service';
import { EmailTemplateService } from './email-template.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let emailService: Record<string, jest.Mock>;
  let templateService: Record<string, jest.Mock>;

  beforeEach(async () => {
    emailService = {
      listLogs: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      resend: jest.fn().mockResolvedValue({ success: true }),
    };
    templateService = {
      listTemplates: jest.fn().mockResolvedValue([]),
      getTemplate: jest
        .fn()
        .mockResolvedValue({ id: 'event-registration-confirmation' }),
      upsertTemplate: jest
        .fn()
        .mockResolvedValue({ id: 'event-registration-confirmation' }),
      removeTemplate: jest.fn().mockResolvedValue(undefined),
      previewTemplate: jest.fn(),
      sampleContext: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: EmailService, useValue: emailService },
        { provide: EmailTemplateService, useValue: templateService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('lista logs de e-mail com filtros e paginação', async () => {
    const result = await controller.listEmails(
      'sent',
      'event-registration-confirmation',
      2,
      50,
    );

    expect(emailService.listLogs).toHaveBeenCalledWith({
      status: 'sent',
      template: 'event-registration-confirmation',
      page: 2,
      pageSize: 50,
    });
    expect(result).toEqual({ data: [], total: 0 });
  });

  it('reenvia e-mail por id', async () => {
    const result = await controller.resendEmail(
      '550e8400-e29b-41d4-a716-446655440000',
    );

    expect(emailService.resend).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
    );
    expect(result).toEqual({ success: true });
  });

  it('lista templates', async () => {
    templateService.listTemplates.mockResolvedValue([
      { id: 'event-registration-confirmation' },
    ]);
    const result = await controller.listTemplates();
    expect(templateService.listTemplates).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 'event-registration-confirmation' }]);
  });

  it('detalha template por id', async () => {
    await controller.getTemplate('event-reminder-d1');
    expect(templateService.getTemplate).toHaveBeenCalledWith(
      'event-reminder-d1',
    );
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
});

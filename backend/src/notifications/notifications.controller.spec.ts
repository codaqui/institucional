import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let emailService: Record<string, jest.Mock>;

  beforeEach(async () => {
    emailService = {
      listLogs: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      resend: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: EmailService, useValue: emailService }],
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
});

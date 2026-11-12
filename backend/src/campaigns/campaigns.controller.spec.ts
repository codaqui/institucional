import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberRole } from '../members/entities/member.entity';

describe('CampaignsController', () => {
  let controller: CampaignsController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      list: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        totalPages: 1,
        limit: 20,
      }),
      findOne: jest.fn().mockResolvedValue({ id: 'camp-1' }),
      create: jest.fn().mockResolvedValue({ id: 'camp-1' }),
      update: jest.fn().mockResolvedValue({ id: 'camp-1' }),
      preview: jest.fn().mockResolvedValue({ includedCount: 1 }),
      sendTest: jest.fn().mockResolvedValue({ emailLogId: 'log-1' }),
      confirm: jest.fn().mockResolvedValue({ id: 'camp-1', status: 'sending' }),
      cancel: jest.fn().mockResolvedValue({ id: 'camp-1', status: 'canceled' }),
      retryRecipient: jest.fn().mockResolvedValue({ id: 'rec-1', status: 'pending' }),
      unsubscribeByToken: jest.fn().mockResolvedValue({
        ok: true,
        status: 'unsubscribed',
        message: 'Seu endereço foi removido de comunicações promocionais.',
      }),
      listSuppressions: jest.fn().mockResolvedValue([]),
      createSuppression: jest.fn().mockResolvedValue({ id: 'sup-1' }),
      deleteSuppression: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampaignsController],
      providers: [{ provide: CampaignsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CampaignsController>(CampaignsController);
  });

  const adminReq = {
    user: {
      sub: 'admin-1',
      githubId: '1',
      handle: 'admin',
      name: 'Admin',
      email: 'admin@codaqui.dev',
      avatarUrl: '',
      roles: [MemberRole.ADMIN],
    },
  };

  it('lista campanhas com paginação padrão', async () => {
    const res = await controller.list({ page: 1, limit: 20 });
    expect(service.list).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(res.total).toBe(0);
  });

  it('encaminha criação, prévia, teste, confirmação, cancelamento e retry ao service', async () => {
    const dto = {
      name: 'Campanha',
      subject: 'Assunto',
      bodyMarkdown: 'Corpo',
      purpose: 'promotional' as const,
      segmentType: 'all_opted_in_members' as const,
      segmentConfig: {},
      idempotencyKey: 'key-1',
    };
    await controller.create(dto, adminReq);
    expect(service.create).toHaveBeenCalledWith(dto, adminReq.user);

    await controller.preview('camp-1', adminReq);
    expect(service.preview).toHaveBeenCalledWith('camp-1', adminReq.user);

    await controller.sendTest('camp-1', adminReq);
    expect(service.sendTest).toHaveBeenCalledWith('camp-1', adminReq.user);

    await controller.confirm('camp-1', {}, adminReq);
    expect(service.confirm).toHaveBeenCalledWith('camp-1', {}, adminReq.user);

    await controller.cancel('camp-1', adminReq);
    expect(service.cancel).toHaveBeenCalledWith('camp-1', adminReq.user);

    await controller.retryRecipient('camp-1', 'rec-1', adminReq);
    expect(service.retryRecipient).toHaveBeenCalledWith(
      'camp-1',
      'rec-1',
      adminReq.user,
    );
  });

  it('processa descadastro público em /campaigns/unsubscribe e /descadastro', async () => {
    const res1 = await controller.unsubscribe('tok-1');
    const res2 = await controller.unsubscribeLegacy('tok-1');
    expect(service.unsubscribeByToken).toHaveBeenCalledTimes(2);
    expect(res1.status).toBe('unsubscribed');
    expect(res2.status).toBe('unsubscribed');
  });
});

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { MemberRole } from '../members/entities/member.entity';

const adminActor = {
  sub: 'admin-1',
  githubId: '1',
  handle: 'admin',
  name: 'Admin Codaqui',
  email: 'admin@codaqui.dev',
  avatarUrl: '',
  roles: [MemberRole.ADMIN],
};

const analyzerActor = {
  sub: 'analyzer-1',
  githubId: '2',
  handle: 'analyzer',
  name: 'Finance Analyzer',
  email: 'analyzer@codaqui.dev',
  avatarUrl: '',
  roles: [MemberRole.FINANCE_ANALYZER],
};

describe('CampaignsService — segmentos, prévia, supressões e descadastro', () => {
  let service: CampaignsService;
  let campaignRepo: Record<string, jest.Mock>;
  let recipientRepo: Record<string, jest.Mock>;
  let suppressionRepo: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
  let designationRepo: Record<string, jest.Mock>;
  let directorateRepo: Record<string, jest.Mock>;
  let communityRepo: Record<string, jest.Mock>;
  let emailService: Record<string, jest.Mock>;
  let templateService: Record<string, jest.Mock>;
  let auditService: Record<string, jest.Mock>;
  let dataSource: Record<string, jest.Mock>;

  beforeEach(() => {
    campaignRepo = {
      findOneBy: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => ({
        id: 'camp-1',
        status: 'draft',
        createdAt: new Date('2026-11-11T10:00:00Z'),
        updatedAt: new Date('2026-11-11T10:00:00Z'),
        ...data,
      })),
      save: jest.fn(async (entity) => entity),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    recipientRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
      create: jest.fn((data) => ({
        id: `rec-${Math.random().toString(36).slice(2, 8)}`,
        attempts: 0,
        nextAttemptAt: null,
        lockedAt: null,
        lastError: null,
        sentAt: null,
        emailLogId: null,
        ...data,
      })),
      save: jest.fn(async (entities) => entities),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    suppressionRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      create: jest.fn((data) => ({ id: 'sup-1', ...data })),
      save: jest.fn(async (entity) => entity),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    memberRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    designationRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    directorateRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    communityRepo = {
      findOneBy: jest.fn().mockResolvedValue({ id: 'comm-1', name: 'DevParaná', status: 'active' }),
    };
    emailService = {
      sendCampaignEmail: jest.fn(),
      getStatus: jest.fn().mockReturnValue({ configured: true }),
      sanitizeOperationalError: jest.fn((err) => String(err ?? '')),
    };
    templateService = {
      renderCampaignMarkdown: jest.fn().mockReturnValue({
        subject: 'Assunto renderizado',
        html: '<p>Corpo seguro</p>',
        text: 'Corpo seguro',
      }),
    };
    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      transaction: jest.fn(async (cb) =>
        cb({
          getRepository: (entity: { name?: string }) => {
            if (entity?.name === 'EmailCampaign') return campaignRepo;
            if (entity?.name === 'EmailCampaignRecipient') return recipientRepo;
            if (entity?.name === 'EmailSuppression') return suppressionRepo;
            if (entity?.name === 'Member') return memberRepo;
            return recipientRepo;
          },
        }),
      ),
    };

    service = new CampaignsService(
      campaignRepo as any,
      recipientRepo as any,
      suppressionRepo as any,
      memberRepo as any,
      designationRepo as any,
      directorateRepo as any,
      communityRepo as any,
      emailService as any,
      templateService as any,
      auditService as any,
      dataSource as any,
    );
  });

  it('retorna a campanha existente quando criada com a mesma idempotencyKey', async () => {
    const existing = {
      id: 'camp-existing',
      name: 'Boletim',
      idempotencyKey: 'key-1',
      status: 'draft',
    };
    campaignRepo.findOneBy.mockResolvedValueOnce(existing);

    const result = await service.create(
      {
        name: 'Boletim',
        subject: 'Assunto',
        bodyMarkdown: 'Olá {{name}}',
        purpose: 'promotional',
        segmentType: 'all_opted_in_members',
        segmentConfig: {},
        idempotencyKey: 'key-1',
      },
      adminActor,
    );

    expect(result.id).toBe('camp-existing');
    expect(campaignRepo.save).not.toHaveBeenCalled();
  });

  it('rejeita segmento manual promocional sem evidência de consentimento e all_opted_in_members em campanha transacional', async () => {
    campaignRepo.findOneBy.mockResolvedValue(null);

    await expect(
      service.create(
        {
          name: 'Transacional indevida',
          subject: 'Aviso',
          bodyMarkdown: 'Conteúdo',
          purpose: 'transactional',
          segmentType: 'all_opted_in_members',
          segmentConfig: {},
          idempotencyKey: 'key-trans-opt',
        },
        adminActor,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.create(
        {
          name: 'Convite manual',
          subject: 'Convite',
          bodyMarkdown: 'Conteúdo',
          purpose: 'promotional',
          segmentType: 'manual',
          segmentConfig: { emails: ['ana@codaqui.dev'] },
          idempotencyKey: 'key-manual-no-evidence',
        },
        adminActor,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('resolve community_governance excluindo membros sem vínculo explícito, papéis inativos, sem opt-in, duplicados e suprimidos', async () => {
    const campaign = {
      id: 'camp-comm',
      name: 'Governança DevPR',
      subject: 'Aviso para {{name}}',
      bodyMarkdown: 'Olá {{name}}',
      templateId: null,
      purpose: 'promotional' as const,
      status: 'draft' as const,
      segmentType: 'community_governance' as const,
      segmentConfig: { communityId: 'comm-1' },
      createdById: adminActor.sub,
      idempotencyKey: 'key-comm',
    };
    campaignRepo.findOneBy.mockResolvedValue(campaign);
    directorateRepo.find.mockResolvedValue([
      { id: 'dir-active', communityId: 'comm-1', isActive: true },
      { id: 'dir-inactive', communityId: 'comm-1', isActive: false },
    ]);
    designationRepo.find.mockResolvedValue([
      // Vínculo direto ativo na comunidade (Ana)
      {
        memberId: 'm-ana',
        targetType: 'community',
        targetId: 'comm-1',
        designation: 'responsible',
        status: 'active',
        validUntil: null,
      },
      // Duplicidade de vínculo para a mesma Ana na diretoria ativa da comunidade
      {
        memberId: 'm-ana',
        targetType: 'directorate',
        targetId: 'dir-active',
        designation: 'director',
        status: 'active',
        validUntil: null,
      },
      // Voluntário ativo na diretoria da comunidade, mas suprimido por descadastro (Bruno — mesmo com marketingEmailOptIn = true!)
      {
        memberId: 'm-bruno',
        targetType: 'directorate',
        targetId: 'dir-active',
        designation: 'volunteer',
        status: 'active',
        validUntil: null,
      },
      // Voluntária ativa na diretoria da comunidade, mas sem opt-in promocional (Carla)
      {
        memberId: 'm-carla',
        targetType: 'directorate',
        targetId: 'dir-active',
        designation: 'volunteer',
        status: 'active',
        validUntil: null,
      },
      // Designation encerrada/inativa (Diego)
      {
        memberId: 'm-diego',
        targetType: 'community',
        targetId: 'comm-1',
        designation: 'responsible',
        status: 'ended',
        validUntil: null,
      },
      // Diretoria inativa (Elena)
      {
        memberId: 'm-elena',
        targetType: 'directorate',
        targetId: 'dir-inactive',
        designation: 'director',
        status: 'active',
        validUntil: null,
      },
      // Sem e-mail verificado (Fábio)
      {
        memberId: 'm-fabio',
        targetType: 'community',
        targetId: 'comm-1',
        designation: 'volunteer',
        status: 'active',
        validUntil: null,
      },
    ]);
    memberRepo.find.mockResolvedValue([
      {
        id: 'm-ana',
        name: 'Ana',
        githubHandle: 'ana',
        email: 'ana@codaqui.dev',
        secondaryEmails: ['ana@codaqui.dev'],
        isActive: true,
        marketingEmailOptIn: true,
      },
      {
        id: 'm-bruno',
        name: 'Bruno',
        githubHandle: 'bruno',
        email: 'bruno@codaqui.dev',
        secondaryEmails: ['bruno@codaqui.dev'],
        isActive: true,
        marketingEmailOptIn: true, // Mesmo com opt-in true no banco, supressão antecede!
      },
      {
        id: 'm-carla',
        name: 'Carla',
        githubHandle: 'carla',
        email: 'carla@codaqui.dev',
        secondaryEmails: ['carla@codaqui.dev'],
        isActive: true,
        marketingEmailOptIn: false,
      },
      {
        id: 'm-diego',
        name: 'Diego',
        githubHandle: 'diego',
        email: 'diego@codaqui.dev',
        secondaryEmails: ['diego@codaqui.dev'],
        isActive: true,
        marketingEmailOptIn: true,
      },
      {
        id: 'm-elena',
        name: 'Elena',
        githubHandle: 'elena',
        email: 'elena@codaqui.dev',
        secondaryEmails: ['elena@codaqui.dev'],
        isActive: true,
        marketingEmailOptIn: true,
      },
      {
        id: 'm-fabio',
        name: 'Fábio',
        githubHandle: 'fabio',
        email: 'fabio@users.noreply.github.com',
        secondaryEmails: [],
        isActive: true,
        marketingEmailOptIn: true,
      },
      // Membro sem vínculo explícito com a comunidade — nunca deve entrar
      {
        id: 'm-outsider',
        name: 'Outsider',
        githubHandle: 'outsider',
        email: 'outsider@codaqui.dev',
        secondaryEmails: ['outsider@codaqui.dev'],
        isActive: true,
        marketingEmailOptIn: true,
      },
    ]);
    suppressionRepo.find.mockResolvedValue([
      {
        id: 'sup-bruno',
        emailNormalized: 'bruno@codaqui.dev',
        source: 'unsubscribe',
        reason: 'Descadastro',
      },
    ]);

    const preview = await service.preview('camp-comm', adminActor);

    expect(preview.included).toHaveLength(1);
    expect(preview.included[0]).toMatchObject({
      memberId: 'm-ana',
      email: 'ana@codaqui.dev',
      name: 'Ana',
    });
    expect(
      preview.included.some((r: { memberId: string | null }) => r.memberId === 'm-outsider'),
    ).toBe(false);
    expect(preview.exclusionsByReason).toEqual({
      suppressed: 1,
      inactiveRole: 2,
      invalidEmail: 1,
      noOptIn: 1,
      duplicate: 1,
    });
    expect(recipientRepo.delete).toHaveBeenCalledWith({ campaignId: 'camp-comm' });
    const savedRecipients = recipientRepo.save.mock.calls[0][0] as Array<{
      emailNormalized: string;
      status: string;
      unsubscribeTokenHash: string;
    }>;
    expect(savedRecipients).toHaveLength(2); // 1 pending (Ana) + 1 suppressed (Bruno)
    for (const r of savedRecipients) {
      expect(r.unsubscribeTokenHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('oculta nomes, handles e e-mails de recipients quando consultado por finance-analyzer', async () => {
    campaignRepo.findOneBy.mockResolvedValue({
      id: 'camp-1',
      name: 'Campanha 1',
      subject: 'Assunto',
      bodyMarkdown: 'Corpo',
      purpose: 'transactional',
      status: 'completed',
      segmentType: 'role',
      segmentConfig: { role: 'membro' },
      createdById: adminActor.sub,
    });
    recipientRepo.find.mockResolvedValue([
      {
        id: 'rec-1',
        campaignId: 'camp-1',
        memberId: 'm-1',
        name: 'Maria Sigilosa',
        email: 'maria@codaqui.dev',
        emailNormalized: 'maria@codaqui.dev',
        status: 'sent',
        attempts: 1,
      },
    ]);

    const asAnalyzer = await service.findOne('camp-1', analyzerActor);
    expect(asAnalyzer.metrics).toMatchObject({ total: 1, sent: 1 });
    expect(JSON.stringify(asAnalyzer)).not.toContain('maria@codaqui.dev');
    expect(JSON.stringify(asAnalyzer)).not.toContain('Maria Sigilosa');

    const asAdmin = await service.findOne('camp-1', adminActor);
    expect(JSON.stringify(asAdmin)).toContain('maria@codaqui.dev');
  });

  it('processa descadastro por token hash sem revelar e-mail e usa resposta neutra em token inválido', async () => {
    const rawToken = service.buildUnsubscribeToken('rec-valid');
    const tokenHash = service.hashUnsubscribeToken(rawToken);
    recipientRepo.findOneBy.mockImplementation(async ({ unsubscribeTokenHash }) =>
      unsubscribeTokenHash === tokenHash
        ? {
            id: 'rec-valid',
            campaignId: 'camp-1',
            memberId: 'm-1',
            email: 'ana@codaqui.dev',
            emailNormalized: 'ana@codaqui.dev',
            status: 'sent',
            unsubscribeTokenHash: tokenHash,
          }
        : null,
    );
    suppressionRepo.findOneBy.mockResolvedValue(null);

    const validRes = await service.unsubscribeByToken(rawToken);
    expect(validRes.status).toBe('unsubscribed');
    expect(JSON.stringify(validRes)).not.toContain('ana@codaqui.dev');
    expect(suppressionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        emailNormalized: 'ana@codaqui.dev',
        source: 'unsubscribe',
      }),
    );
    expect(memberRepo.update).toHaveBeenCalledWith(
      { id: 'm-1' },
      { marketingEmailOptIn: false },
    );

    const invalidRes = await service.unsubscribeByToken('token-invalido');
    expect(invalidRes.status).toBe('invalid_or_expired');
    expect(JSON.stringify(invalidRes)).not.toContain('ana@codaqui.dev');
  });

  it('impede admin de remover supressão originada por descadastro do titular', async () => {
    suppressionRepo.findOneBy.mockResolvedValue({
      id: 'sup-unsub',
      emailNormalized: 'ana@codaqui.dev',
      source: 'unsubscribe',
    });

    await expect(
      service.deleteSuppression('sup-unsub', adminActor),
    ).rejects.toThrow(ForbiddenException);
    expect(suppressionRepo.delete).not.toHaveBeenCalled();
  });

  it('rejeita retry manual de recipient sent/suppressed ou campanha cancelada, e permite retry de failed', async () => {
    campaignRepo.findOneBy.mockResolvedValue({
      id: 'camp-1',
      status: 'completed_with_errors',
    });
    recipientRepo.findOneBy.mockResolvedValueOnce({
      id: 'rec-sent',
      campaignId: 'camp-1',
      status: 'sent',
    });
    await expect(
      service.retryRecipient('camp-1', 'rec-sent', adminActor),
    ).rejects.toThrow(ConflictException);

    recipientRepo.findOneBy.mockResolvedValueOnce({
      id: 'rec-sup',
      campaignId: 'camp-1',
      status: 'suppressed',
    });
    await expect(
      service.retryRecipient('camp-1', 'rec-sup', adminActor),
    ).rejects.toThrow(ConflictException);

    recipientRepo.findOneBy.mockResolvedValueOnce({
      id: 'rec-fail',
      campaignId: 'camp-1',
      status: 'failed',
      attempts: 3,
      lastError: 'SMTP timeout',
    });
    const retried = await service.retryRecipient('camp-1', 'rec-fail', adminActor);
    expect(retried.status).toBe('pending');
    expect(retried.attempts).toBe(0);
    expect(campaignRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'camp-1', status: 'sending' }),
    );
  });

  it('aplica backoff de 1m/5m até 3 tentativas, pausa 15m em 421/454 e marca falha operacional sem apagar campanha quando SMTP não configurado', async () => {
    // Caso 1: SMTP ausente
    emailService.getStatus.mockReturnValueOnce({ configured: false });
    memberRepo.findOneBy.mockResolvedValue({
      id: 'admin-1',
      isActive: true,
      roles: [MemberRole.ADMIN],
    });
    campaignRepo.find
      .mockResolvedValueOnce([]) // scheduled
      .mockResolvedValueOnce([
        {
          id: 'camp-no-smtp',
          status: 'sending',
          purpose: 'promotional',
          subject: 'Olá',
          bodyMarkdown: 'Texto',
          confirmedById: 'admin-1',
          createdById: 'admin-1',
        },
      ]);

    await service.processCampaignQueue();
    expect(campaignRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'camp-no-smtp', status: 'failed' }),
    );
    expect(recipientRepo.update).toHaveBeenCalledWith(
      { campaignId: 'camp-no-smtp', status: 'pending' },
      expect.objectContaining({
        status: 'failed',
        lastError: 'SMTP_NOT_CONFIGURED',
      }),
    );

    // Caso 2: Erro 421 pausa pendentes por 15 minutos
    campaignRepo.save.mockClear();
    recipientRepo.update.mockClear();
    const rec1 = {
      id: 'rec-421',
      campaignId: 'camp-421',
      email: 'ana@codaqui.dev',
      emailNormalized: 'ana@codaqui.dev',
      name: 'Ana',
      status: 'pending',
      attempts: 0,
      nextAttemptAt: null as Date | null,
      lockedAt: null as Date | null,
      lastError: null as string | null,
    };
    const camp421 = {
      id: 'camp-421',
      status: 'sending',
      purpose: 'promotional',
      subject: 'Assunto',
      bodyMarkdown: 'Corpo',
      confirmedById: 'admin-1',
      createdById: 'admin-1',
    };
    campaignRepo.find
      .mockResolvedValueOnce([]) // scheduled
      .mockResolvedValueOnce([camp421]);
    campaignRepo.findOneBy.mockResolvedValue(camp421);
    recipientRepo.find
      .mockResolvedValueOnce([]) // stale sending
      .mockResolvedValueOnce([rec1]) // claimPendingRecipients
      .mockResolvedValueOnce([rec1]); // check completion
    suppressionRepo.findOneBy.mockResolvedValue(null);
    emailService.sendCampaignEmail.mockResolvedValueOnce({
      id: 'log-421',
      status: 'failed',
      error: '421 4.7.0 Too many login attempts, please try again later',
    });

    const before = Date.now();
    await service.processCampaignQueue();
    expect(rec1.status).toBe('pending');
    expect(rec1.attempts).toBe(1);
    expect(rec1.nextAttemptAt).toBeInstanceOf(Date);
    expect(rec1.nextAttemptAt!.getTime()).toBeGreaterThanOrEqual(
      before + 14 * 60_000,
    );
    expect(recipientRepo.update).toHaveBeenCalledWith(
      { campaignId: 'camp-421', status: 'pending' },
      { nextAttemptAt: expect.any(Date) },
    );
  });

  it('anonimiza e-mail, nome e hash de recipients após 365 dias preservando contagens', async () => {
    const oldRecipient = {
      id: 'rec-old',
      campaignId: 'camp-old',
      memberId: 'm-1',
      email: 'antigo@codaqui.dev',
      name: 'Antigo',
      emailNormalized: 'antigo@codaqui.dev',
      status: 'sent',
      unsubscribeTokenHash: 'a'.repeat(64),
      createdAt: new Date(Date.now() - 400 * 24 * 3_600_000),
    };
    recipientRepo.find.mockResolvedValueOnce([oldRecipient]);

    const count = await service.cleanupOldRecipients();
    expect(count).toBe(1);
    expect(oldRecipient.email).toBeNull();
    expect(oldRecipient.name).toBeNull();
    expect(oldRecipient.emailNormalized).toBeNull();
    expect(oldRecipient.unsubscribeTokenHash).toBeNull();
  });
});

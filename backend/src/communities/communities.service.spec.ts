import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { Community } from './entities/community.entity';
import { CommunitiesService } from './communities.service';

const admin = {
  sub: 'admin-1',
  handle: 'admin',
  roles: ['admin'],
} as JwtPayload;

const communityFixture = (): Community =>
  Object.assign(new Community(), {
    id: 'community-1',
    slug: 'devparana',
    name: 'DevParaná',
    description: 'Comunidade de tecnologia',
    emoji: '👥',
    logoUrl: '/logo.svg',
    location: 'Maringá, PR',
    founded: 2015,
    links: [{ type: 'website', label: 'Site', url: 'https://devparana.org' }],
    socialProfiles: [],
    tags: ['developers'],
    level: 'integrada' as const,
    status: 'active' as const,
    sealStatus: 'none' as const,
    sealGrantedAt: null,
    sealGrantedById: null,
    sealValidUntil: null,
    sealNotes: null,
    siteEnabled: true,
    siteDomain: 'devparana.org',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  });

describe('CommunitiesService', () => {
  let service: CommunitiesService;
  let repo: Record<string, jest.Mock>;
  let designationRepo: Record<string, jest.Mock>;
  let membersRepo: Record<string, jest.Mock>;
  let designations: { hasDesignation: jest.Mock };
  let audit: { log: jest.Mock };
  let community: Community;
  const responsible = {
    sub: 'member-1',
    handle: 'responsible',
    roles: ['membro'],
  } as JwtPayload;

  beforeEach(() => {
    community = communityFixture();
    repo = {
      find: jest.fn().mockResolvedValue([community]),
      findAndCount: jest.fn().mockResolvedValue([[community], 1]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((value) => ({ ...value })),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    designationRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    membersRepo = { findOne: jest.fn().mockResolvedValue(null) };
    designations = { hasDesignation: jest.fn().mockResolvedValue(false) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new CommunitiesService(
      repo as any,
      designationRepo as any,
      membersRepo as any,
      designations as any,
      audit as any,
    );
  });

  it('rejects a duplicate slug before creating', async () => {
    repo.findOne.mockResolvedValue(community);

    await expect(
      service.create({ slug: 'devparana', name: 'Duplicada' }, admin),
    ).rejects.toThrow(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('reserves the general treasury slug during creation', async () => {
    await expect(
      service.create({ slug: 'tesouro-geral', name: 'Tesouro' }, admin),
    ).rejects.toThrow(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('creates a partner community without inventing future fields and audits the actor', async () => {
    const created = await service.create(
      {
        slug: 'nova-comunidade',
        name: 'Nova Comunidade',
      },
      admin,
    );

    expect(created).toMatchObject({
      slug: 'nova-comunidade',
      level: 'parceira',
      status: 'active',
      sealStatus: 'none',
      siteEnabled: false,
    });
    expect(created).not.toHaveProperty('responsibleMemberId');
    expect(created).not.toHaveProperty('maintainerId');
    expect(created).not.toHaveProperty('payoutAccountId');
    expect(created).not.toHaveProperty('platformFeePct');
    expect(created).not.toHaveProperty('isActive');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'community.created',
        actorId: 'admin-1',
        details: expect.objectContaining({
          after: expect.objectContaining({ slug: 'nova-comunidade' }),
        }),
      }),
    );
  });

  it('returns the standard management pagination envelope', async () => {
    repo.findAndCount.mockResolvedValue([[community], 101]);

    const result = await service.listManage({ page: 2, limit: 50 }, admin);

    expect(result).toEqual({
      data: [community],
      total: 101,
      page: 2,
      totalPages: 3,
      limit: 50,
    });
    expect(repo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 50, take: 50 }),
    );
  });

  it('lists only communities assigned to a non-admin responsible', async () => {
    designationRepo.find.mockResolvedValue([
      { targetId: 'community-1' },
      { targetId: 'community-2' },
    ]);

    await service.listManage({ page: 1, limit: 50, search: 'dev' }, responsible);

    expect(designationRepo.find).toHaveBeenCalledWith({
      where: {
        memberId: 'member-1',
        status: 'active',
        targetType: 'community',
        designation: 'responsible',
      },
    });
    expect(repo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.arrayContaining([
          expect.objectContaining({ id: expect.anything() }),
        ]),
      }),
    );
  });

  it('returns an empty scoped page when the member has no responsible designation', async () => {
    const result = await service.listManage({ page: 1, limit: 50 }, responsible);

    expect(result).toEqual({ data: [], total: 0, page: 1, totalPages: 0, limit: 50 });
    expect(repo.findAndCount).not.toHaveBeenCalled();
  });

  it('rejects changing the slug of an existing community', async () => {
    repo.findOne.mockResolvedValue(community);

    await expect(
      service.update('community-1', { slug: 'devpr', name: 'DevPR' }, admin),
    ).rejects.toThrow(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
    expect(community.slug).toBe('devparana');
  });

  it('lets a responsible edit only profile data and audits level changes with before and after', async () => {
    repo.findOne.mockResolvedValue(community);
    designations.hasDesignation.mockResolvedValue(true);

    await service.update('community-1', { name: 'DevPR' }, responsible);
    expect(designations.hasDesignation).toHaveBeenCalledWith('member-1', {
      targetType: 'community',
      targetId: 'community-1',
      designation: 'responsible',
    });
    await expect(
      service.update('community-1', { level: 'parceira' }, responsible),
    ).rejects.toThrow(BadRequestException);

    await service.update('community-1', { level: 'parceira' }, admin);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'community.updated',
        actorId: 'admin-1',
        details: expect.objectContaining({
          before: expect.objectContaining({ level: 'integrada' }),
          after: expect.objectContaining({ level: 'parceira' }),
        }),
      }),
    );
  });

  it('rejects a non-admin update outside the responsible community scope', async () => {
    repo.findOne.mockResolvedValue(community);

    await expect(
      service.update('community-1', { name: 'DevPR' }, responsible),
    ).rejects.toThrow('próprias comunidades');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it.each(['javascript:alert(1)', 'http://insecure.example', '//external.example']) (
    'rejects unsafe community link %s in the service',
    async (url) => {
      await expect(
        service.create(
          {
            slug: 'nova-comunidade',
            name: 'Nova Comunidade',
            links: [{ label: 'Link', url }],
          },
          admin,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    },
  );

  it('lists only active integrated communities as donation destinations', async () => {
    repo.findOne.mockResolvedValue(community);

    await expect(service.findActiveForDonations('devparana')).resolves.toBe(
      community,
    );
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { slug: 'devparana', status: 'active', level: 'integrada' },
    });
  });

  it('preserves the legacy public shape and resolves the responsible member', async () => {
    designationRepo.findOne.mockResolvedValue({ memberId: 'member-1' });
    designations.hasDesignation.mockResolvedValue(true);
    membersRepo.findOne.mockResolvedValue({
      id: 'member-1',
      name: 'Responsável',
      githubHandle: 'responsavel',
      avatarUrl: 'avatar.png',
    });

    const result = await service.listPublic();

    expect(result).toEqual([
      expect.objectContaining({
        id: 'devparana',
        slug: 'devparana',
        name: 'DevParaná',
        emoji: '👥',
        logo: '/logo.svg',
        description: 'Comunidade de tecnologia',
        location: 'Maringá, PR',
        founded: 2015,
        links: community.links,
        socialProfiles: [],
        tags: ['developers'],
        level: 'integrada',
        status: 'active',
        sealStatus: 'none',
        siteEnabled: true,
        siteDomain: 'devparana.org',
        responsible: {
          id: 'member-1',
          name: 'Responsável',
          githubHandle: 'responsavel',
          avatarUrl: 'avatar.png',
        },
      }),
    ]);
    expect(repo.find).toHaveBeenCalledWith({
      where: { status: 'active' },
      order: { name: 'ASC' },
    });
  });

  it('does not display an expired seal as effective and preserves its history', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-03T12:00:00Z'));
    community.sealStatus = 'sealed';
    community.sealGrantedAt = new Date('2025-11-01T12:00:00Z');
    community.sealValidUntil = new Date('2026-11-01T12:00:00Z');

    const [result] = await service.listPublic();

    expect(result).toMatchObject({
      sealStatus: 'none',
      sealEffective: false,
      sealGrantedAt: community.sealGrantedAt,
      sealValidUntil: community.sealValidUntil,
    });
    expect(community.sealStatus).toBe('sealed');
  });

  it('allows a responsible member to request a seal and audits the transition', async () => {
    repo.findOne.mockResolvedValue(community);
    designations.hasDesignation.mockResolvedValue(true);

    await expect(
      service.requestSeal('community-1', responsible),
    ).resolves.toMatchObject({ sealStatus: 'applied' });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'community.seal_requested',
        actorId: 'member-1',
        details: expect.objectContaining({
          before: expect.objectContaining({ sealStatus: 'none' }),
          after: expect.objectContaining({ sealStatus: 'applied' }),
        }),
      }),
    );
  });

  it('rejects a new request while a seal is still effective', async () => {
    repo.findOne.mockResolvedValue(community);
    designations.hasDesignation.mockResolvedValue(true);
    community.sealStatus = 'sealed';
    community.sealValidUntil = new Date(Date.now() + 86_400_000);

    await expect(
      service.requestSeal('community-1', responsible),
    ).rejects.toThrow(ConflictException);
    expect(community.sealStatus).toBe('sealed');
  });

  it('allows an expired seal to enter the explicit renewal flow', async () => {
    repo.findOne.mockResolvedValue(community);
    designations.hasDesignation.mockResolvedValue(true);
    community.sealStatus = 'sealed';
    community.sealValidUntil = new Date(Date.now() - 86_400_000);
    const grantedAt = new Date('2025-01-01T00:00:00Z');
    community.sealGrantedAt = grantedAt;

    await expect(
      service.requestSeal('community-1', responsible),
    ).resolves.toMatchObject({
      sealStatus: 'applied',
      sealGrantedAt: grantedAt,
    });
  });

  it('rejects seal without an active responsible designation', async () => {
    designationRepo.findOne.mockResolvedValue({ memberId: 'member-1' });
    designations.hasDesignation.mockResolvedValue(false);
    repo.findOne.mockResolvedValue(community);

    await expect(
      service.grantSeal(
        'community-1',
        { validUntil: '2027-10-29', notes: 'Avaliação manual aprovada.' },
        admin,
      ),
    ).rejects.toThrow('responsável ativo');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('grants a one-year seal with an active responsible and records governance audit', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-02T12:00:00Z'));
    repo.findOne.mockResolvedValue(community);
    designationRepo.findOne.mockResolvedValue({ memberId: 'member-1' });
    designations.hasDesignation.mockResolvedValue(true);

    const sealed = await service.grantSeal(
      'community-1',
      { notes: 'Diretoria avaliou conduta e atividades.' },
      admin,
    );

    expect(sealed.sealStatus).toBe('sealed');
    expect(sealed.sealGrantedAt).toEqual(new Date('2026-11-02T12:00:00Z'));
    expect(sealed.sealGrantedById).toBe('admin-1');
    expect(sealed.sealValidUntil).toEqual(new Date('2027-11-02T12:00:00Z'));
    expect(sealed.sealNotes).toBe('Diretoria avaliou conduta e atividades.');
    expect(designations.hasDesignation).toHaveBeenCalledWith('member-1', {
      targetType: 'community',
      targetId: 'community-1',
      designation: 'responsible',
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'community.seal_granted',
        actorId: 'admin-1',
        targetId: 'community-1',
        targetType: 'community',
      }),
    );
    jest.useRealTimers();
  });

  it('accepts an explicit future seal validity', async () => {
    repo.findOne.mockResolvedValue(community);
    designationRepo.findOne.mockResolvedValue({ memberId: 'member-1' });
    designations.hasDesignation.mockResolvedValue(true);

    const sealed = await service.grantSeal(
      'community-1',
      { validUntil: '2028-01-15', notes: 'Renovação manual.' },
      admin,
    );

    expect(sealed.sealValidUntil).toEqual(new Date('2028-01-15T00:00:00.000Z'));
  });

  it('rejects a seal validity that is not in the future', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-02T12:00:00Z'));
    repo.findOne.mockResolvedValue(community);
    designationRepo.findOne.mockResolvedValue({ memberId: 'member-1' });
    designations.hasDesignation.mockResolvedValue(true);

    await expect(
      service.grantSeal(
        'community-1',
        { validUntil: '2026-11-02', notes: 'Data sem validade futura.' },
        admin,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('throws when granting a seal to an unknown community', async () => {
    await expect(
      service.grantSeal('missing', { notes: 'Avaliação manual.' }, admin),
    ).rejects.toThrow(NotFoundException);
  });

  afterEach(() => {
    jest.useRealTimers();
  });
});

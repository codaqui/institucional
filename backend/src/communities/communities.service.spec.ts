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

  beforeEach(() => {
    community = communityFixture();
    repo = {
      find: jest.fn().mockResolvedValue([community]),
      findAndCount: jest.fn().mockResolvedValue([[community], 1]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((value) => ({ ...value })),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    designationRepo = { findOne: jest.fn().mockResolvedValue(null) };
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
      service.create({ slug: 'devparana', name: 'Duplicada' }),
    ).rejects.toThrow(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('creates a partner community without inventing future fields', async () => {
    const created = await service.create({
      slug: 'nova-comunidade',
      name: 'Nova Comunidade',
    });

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
  });

  it('returns the standard management pagination envelope', async () => {
    repo.findAndCount.mockResolvedValue([[community], 101]);

    const result = await service.listManage({ page: 2, limit: 50 });

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

  it('updates a community profile and protects a changed slug', async () => {
    repo.findOne.mockResolvedValueOnce(community).mockResolvedValueOnce(null);

    await expect(
      service.update('community-1', {
        slug: 'devpr',
        name: 'DevPR',
      }),
    ).resolves.toMatchObject({ slug: 'devpr', name: 'DevPR' });
  });

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

  it('allows a responsible member to request a seal', async () => {
    repo.findOne.mockResolvedValue(community);

    await expect(service.requestSeal('community-1')).resolves.toMatchObject({
      sealStatus: 'applied',
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

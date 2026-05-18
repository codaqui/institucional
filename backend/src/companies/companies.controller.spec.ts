import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { MemberRole } from '../members/entities/member.entity';

describe('CompaniesController', () => {
  let controller: CompaniesController;
  let service: Record<string, jest.Mock>;

  const req = (overrides: Partial<any> = {}) => ({
    user: {
      sub: 'member-1',
      role: MemberRole.MEMBER,
      ...overrides,
    },
  });

  beforeEach(async () => {
    service = {
      isMemberOfCompany: jest.fn().mockResolvedValue(true),
      register: jest.fn(),
      findCollaborations: jest.fn(),
      findByMember: jest.fn(),
      listSponsorsPaginated: jest.fn(),
      listBusinessMemberIds: jest.fn(),
      findPublicAffiliationByHandle: jest.fn(),
      findPublicInfo: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      getOrCreateWallet: jest.fn(),
      getSupportSummary: jest.fn(),
      getTransactions: jest.fn(),
      distributeCoins: jest.fn(),
      getCollaborators: jest.fn(),
      addCollaborator: jest.fn(),
      removeCollaborator: jest.fn(),
      findAllAdminPaginated: jest.fn(),
      updateStatus: jest.fn(),
      manualAdjust: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompaniesController],
      providers: [{ provide: CompaniesService, useValue: service }],
    }).compile();

    controller = module.get<CompaniesController>(CompaniesController);
  });

  it('registers company with authenticated user id', async () => {
    await controller.register({ cnpj: '11222333000181', name: 'Acme' } as any, req());
    expect(service.register).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Acme' }),
      'member-1',
    );
  });

  it('gets my collaborations and my company', async () => {
    await controller.getMyCollaborations(req());
    await controller.getMyCompany(req());
    expect(service.findCollaborations).toHaveBeenCalledWith('member-1');
    expect(service.findByMember).toHaveBeenCalledWith('member-1');
  });

  it('lists public sponsors and business members', async () => {
    await controller.listSponsors();
    await controller.listBusinessMembers();
    expect(service.listSponsorsPaginated).toHaveBeenCalledWith(1, 20);
    expect(service.listBusinessMemberIds).toHaveBeenCalled();
  });

  it('gets company public info', async () => {
    await controller.getPublicAffiliationByHandle('octocat');
    await controller.getCompanyPublicInfo('company-1');
    expect(service.findPublicAffiliationByHandle).toHaveBeenCalledWith('octocat');
    expect(service.findPublicInfo).toHaveBeenCalledWith('company-1');
  });

  it('throws forbidden when member has no access to company', async () => {
    service.isMemberOfCompany.mockResolvedValue(false);
    await expect(controller.getCompany('company-1', req())).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows admin to access company without membership check', async () => {
    await controller.getCompany('company-1', req({ role: MemberRole.ADMIN }));
    expect(service.isMemberOfCompany).not.toHaveBeenCalled();
    expect(service.findById).toHaveBeenCalledWith('company-1');
  });

  it('delegates wallet transaction pagination parsing page and limit', async () => {
    await controller.getTransactions('company-1', req(), '2', '15');
    expect(service.getTransactions).toHaveBeenCalledWith('company-1', 2, 15);
  });

  it('delegates wallet transaction pagination defaults', async () => {
    await controller.getTransactions('company-1', req(), undefined as any, undefined as any);
    expect(service.getTransactions).toHaveBeenCalledWith('company-1', 1, 20);
  });

  it('updates company with requester id', async () => {
    const dto = { name: 'Updated Co' };
    await controller.update('company-1', dto as any, req());
    expect(service.update).toHaveBeenCalledWith('company-1', dto, 'member-1');
  });

  it('gets wallet and collaborators for allowed member', async () => {
    await controller.getWallet('company-1', req());
    await controller.getSupportSummary('company-1', req());
    await controller.getCollaborators('company-1', req());
    expect(service.getOrCreateWallet).toHaveBeenCalledWith('company-1');
    expect(service.getSupportSummary).toHaveBeenCalledWith('company-1');
    expect(service.getCollaborators).toHaveBeenCalledWith('company-1');
  });

  it('adds collaborator with requester id', async () => {
    await controller.addCollaborator(
      'company-1',
      { githubHandle: 'octocat' },
      req(),
    );
    expect(service.addCollaborator).toHaveBeenCalledWith(
      'company-1',
      'octocat',
      'member-1',
    );
  });

  it('delegates distribution using authenticated user', async () => {
    const body = { distributions: [{ githubHandle: 'octocat', amount: 10 }] };
    await controller.distributeCoins('company-1', body as any, req());
    expect(service.distributeCoins).toHaveBeenCalledWith(
      'company-1',
      body.distributions,
      'member-1',
    );
  });

  it('removes collaborator and returns ok', async () => {
    await expect(
      controller.removeCollaborator('company-1', 'collab-1', req()),
    ).resolves.toEqual({ ok: true });
    expect(service.removeCollaborator).toHaveBeenCalledWith(
      'company-1',
      'collab-1',
      'member-1',
    );
  });

  it('delegates admin wallet adjust', async () => {
    await controller.adminAdjust({
      companyId: 'company-1',
      amount: 100,
      coinType: 'sort_coin',
      description: 'bonus',
    } as any);
    expect(service.manualAdjust).toHaveBeenCalledWith(
      'company-1',
      100,
      'sort_coin',
      'bonus',
    );
  });

  it('delegates admin list and status update', async () => {
    await controller.adminList();
    await controller.adminUpdateStatus('company-1', { status: 'active' });
    expect(service.findAllAdminPaginated).toHaveBeenCalledWith(1, 20);
    expect(service.updateStatus).toHaveBeenCalledWith('company-1', 'active');
  });
});

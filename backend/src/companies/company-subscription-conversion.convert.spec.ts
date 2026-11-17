import { ConflictException } from '@nestjs/common';
import { CompanySubscriptionConversionService } from './company-subscription-conversion.service';
import { Company } from './entities/company.entity';
import { CompanyWallet } from './entities/company-wallet.entity';
import { CompanySubscriptionConversion } from './entities/company-subscription-conversion.entity';
import { Member } from '../members/entities/member.entity';
import { AuditAction } from '../audit/entities/audit-log.entity';

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    subscriptions: {
      search: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
    },
  })),
);

const memberId = '00000000-0000-4000-8000-000000000001';
const companyId = '00000000-0000-4000-8000-000000000002';
const actor = {
  sub: '00000000-0000-4000-8000-000000000003',
  handle: 'admin',
  roles: ['admin'],
} as any;
const dto = {
  memberId,
  subscriptionId: 'sub_convert',
  name: 'Empresa Sintética',
  cnpj: '11222333000181',
  tradeName: 'Sintética',
  logoUrl: 'https://cdn.example.test/logo.png',
  websiteUrl: 'https://example.test',
};

function setup(
  options: {
    subscription?: Record<string, unknown>;
    conversion?: Record<string, unknown> | null;
    company?: Record<string, unknown> | null;
  } = {},
) {
  let storedConversion = options.conversion ?? null;
  const conversionRepo = {
    findOneBy: jest.fn().mockImplementation(async () => storedConversion),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => {
      storedConversion = { id: 'conversion-1', ...storedConversion, ...value };
      return storedConversion;
    }),
  };
  let storedCompany = options.company ?? null;
  const companyRepo = {
    findOne: jest.fn().mockImplementation(async () => storedCompany),
    findOneBy: jest.fn().mockResolvedValue(null),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => {
      storedCompany = { id: companyId, ...storedCompany, ...value };
      return storedCompany;
    }),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const memberRepo = {
    findOneBy: jest.fn().mockResolvedValue({ id: memberId, isActive: true }),
  };
  const walletRepo = {
    findOneBy: jest.fn().mockResolvedValue(null),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const repositories = new Map<unknown, unknown>([
    [CompanySubscriptionConversion, conversionRepo],
    [Company, companyRepo],
    [Member, memberRepo],
    [CompanyWallet, walletRepo],
  ]);
  const manager = {
    getRepository: jest.fn((entity) => repositories.get(entity)),
    query: jest.fn().mockResolvedValue(undefined),
  };
  const dataSource = { transaction: jest.fn(async (work) => work(manager)) };
  const service = new CompanySubscriptionConversionService(
    conversionRepo as any,
    companyRepo as any,
    memberRepo as any,
    walletRepo as any,
    dataSource as any,
    audit as any,
  );
  const stripe = (service as any).stripe;
  stripe.subscriptions.retrieve.mockResolvedValue({
    id: 'sub_convert',
    status: 'active',
    customer: 'cus_convert',
    metadata: { memberId },
    items: {
      data: [
        {
          price: { unit_amount: 20000, recurring: { interval: 'month' } },
          current_period_end: 1796000000,
        },
      ],
    },
    ...options.subscription,
  });
  return {
    service,
    stripe,
    conversionRepo,
    companyRepo,
    memberRepo,
    walletRepo,
    audit,
    manager,
  };
}

describe('CompanySubscriptionConversionService conversion', () => {
  it('converts the same subscription into a new pending company and wallet', async () => {
    const {
      service,
      stripe,
      conversionRepo,
      companyRepo,
      walletRepo,
      audit,
      manager,
    } = setup();
    const result = await service.convert(dto, actor);

    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['sub_convert'],
    );
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_convert', {
      metadata: {
        entityType: 'business',
        companyId,
        memberId,
        isSubscription: 'true',
      },
    });
    expect(companyRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: dto.name,
        cnpj: dto.cnpj,
        tradeName: dto.tradeName,
        logoUrl: dto.logoUrl,
        websiteUrl: dto.websiteUrl,
        responsibleMemberId: memberId,
        status: 'pending',
      }),
    );
    expect(companyRepo.update).toHaveBeenCalledWith(companyId, {
      stripeCustomerId: 'cus_convert',
      stripeSubscriptionId: 'sub_convert',
      subscriptionAmountCents: 20000,
    });
    expect(walletRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ companyId }),
    );
    expect(conversionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.COMPANY_SUBSCRIPTION_CONVERTED,
      }),
    );
    expect(result).toMatchObject({
      companyId,
      subscriptionId: 'sub_convert',
      status: 'converted',
    });
  });

  it('returns already_converted without external or company writes', async () => {
    const { service, stripe, companyRepo } = setup({
      conversion: {
        id: 'conversion-1',
        companyId,
        memberId,
        status: 'completed',
      },
    });
    const result = await service.convert({ ...dto, companyId }, actor);

    expect(result.status).toBe('already_converted');
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    expect(companyRepo.update).not.toHaveBeenCalled();
  });

  it('recovers a pending conversion after Stripe succeeded without updating it again', async () => {
    const existingCompany = {
      id: companyId,
      responsibleMemberId: memberId,
      status: 'pending',
      stripeSubscriptionId: 'sub_convert',
    };
    const { service, stripe, conversionRepo, companyRepo } = setup({
      conversion: {
        id: 'conversion-1',
        companyId,
        memberId,
        status: 'pending',
      },
      company: existingCompany,
      subscription: {
        metadata: {
          memberId,
          entityType: 'business',
          companyId,
          isSubscription: 'true',
        },
      },
    });
    const result = await service.convert({ ...dto, companyId }, actor);

    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    expect(companyRepo.update).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({ stripeSubscriptionId: 'sub_convert' }),
    );
    expect(conversionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    );
    expect(result.status).toBe('converted');
  });

  it.each([
    { status: 'past_due' },
    {
      items: {
        data: [
          { price: { unit_amount: 20000, recurring: { interval: 'year' } } },
        ],
      },
    },
    { metadata: { memberId: 'other-member' } },
    { metadata: { memberId, entityType: 'business' } },
  ])(
    'rejects an ineligible subscription without writing %#',
    async (subscription) => {
      const { service, stripe, conversionRepo, companyRepo } = setup({
        subscription,
      });
      await expect(service.convert(dto, actor)).rejects.toThrow(
        ConflictException,
      );
      expect(stripe.subscriptions.update).not.toHaveBeenCalled();
      expect(conversionRepo.save).not.toHaveBeenCalled();
      expect(companyRepo.update).not.toHaveBeenCalled();
    },
  );

  it('rejects a company owned by another member before writing', async () => {
    const { service, stripe, conversionRepo } = setup({
      company: {
        id: companyId,
        responsibleMemberId: 'other-member',
        stripeSubscriptionId: null,
      },
    });
    await expect(service.convert({ ...dto, companyId }, actor)).rejects.toThrow(
      ConflictException,
    );
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    expect(conversionRepo.save).not.toHaveBeenCalled();
  });
});

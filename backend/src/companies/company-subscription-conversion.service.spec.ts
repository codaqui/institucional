import { BadRequestException } from '@nestjs/common';
import { CompanySubscriptionConversionService } from './company-subscription-conversion.service';

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    subscriptions: {
      search: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
    },
  })),
);

describe('CompanySubscriptionConversionService candidates', () => {
  const memberId = '00000000-0000-4000-8000-000000000001';
  let service: CompanySubscriptionConversionService;
  let stripe: any;

  beforeEach(() => {
    service = new CompanySubscriptionConversionService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    stripe = (service as any).stripe;
  });

  it('lists only active personal monthly subscriptions with public-safe fields', async () => {
    stripe.subscriptions.search.mockResolvedValue({
      data: [
        {
          id: 'sub_month',
          metadata: { memberId },
          items: {
            data: [
              {
                price: { unit_amount: 5000, recurring: { interval: 'month' } },
                current_period_end: 1796000000,
              },
            ],
          },
        },
        {
          id: 'sub_year',
          metadata: { memberId },
          items: {
            data: [
              {
                price: { unit_amount: 50000, recurring: { interval: 'year' } },
                current_period_end: 1796000000,
              },
            ],
          },
        },
        {
          id: 'sub_business',
          metadata: { memberId, entityType: 'business' },
          items: {
            data: [
              {
                price: { unit_amount: 20000, recurring: { interval: 'month' } },
                current_period_end: 1796000000,
              },
            ],
          },
        },
      ],
    });

    const result = await service.listPersonalSubscriptions(memberId);

    expect(stripe.subscriptions.search).toHaveBeenCalledWith({
      query: `status:'active' AND metadata['memberId']:'${memberId}'`,
      limit: 100,
    });
    expect(result).toEqual([
      {
        id: 'sub_month',
        amountCents: 5000,
        interval: 'month',
        currentPeriodEnd: new Date(1796000000 * 1000).toISOString(),
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('customer');
  });

  it('rejects invalid member IDs before calling Stripe', async () => {
    await expect(service.listPersonalSubscriptions('invalid')).rejects.toThrow(
      BadRequestException,
    );
    expect(stripe.subscriptions.search).not.toHaveBeenCalled();
  });
});

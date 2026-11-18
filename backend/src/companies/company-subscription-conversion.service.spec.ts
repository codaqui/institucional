import { BadGatewayException, BadRequestException } from '@nestjs/common';
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

  it('follows every Stripe search cursor before applying the monthly filter', async () => {
    const subscription = (id: string, interval = 'month') => ({
      id,
      metadata: { memberId },
      items: { data: [{ price: { unit_amount: 1000, recurring: { interval } }, current_period_end: null }] },
    });
    stripe.subscriptions.search
      .mockResolvedValueOnce({
        data: [subscription('sub_1'), subscription('sub_year', 'year')],
        has_more: true,
        next_page: 'cursor-2',
      })
      .mockResolvedValueOnce({
        data: [subscription('sub_2')],
        has_more: false,
        next_page: null,
      });

    const result = await service.listPersonalSubscriptions(memberId);
    expect(result.map((item) => item.id)).toEqual(['sub_1', 'sub_2']);
    expect(stripe.subscriptions.search).toHaveBeenNthCalledWith(2, {
      query: `status:'active' AND metadata['memberId']:'${memberId}'`,
      limit: 100,
      page: 'cursor-2',
    });
  });

  it('fails explicitly when Stripe omits or repeats the next cursor', async () => {
    stripe.subscriptions.search.mockResolvedValue({
      data: [], has_more: true, next_page: null,
    });
    await expect(service.listPersonalSubscriptions(memberId)).rejects.toThrow(BadGatewayException);

    stripe.subscriptions.search
      .mockResolvedValueOnce({ data: [], has_more: true, next_page: 'same' })
      .mockResolvedValueOnce({ data: [], has_more: true, next_page: 'same' });
    await expect(service.listPersonalSubscriptions(memberId)).rejects.toThrow(BadGatewayException);
    expect(stripe.subscriptions.search).toHaveBeenCalledTimes(3);
  });

  it('fails instead of returning a partial list after provider errors or 1000 records', async () => {
    stripe.subscriptions.search
      .mockResolvedValueOnce({ data: [], has_more: true, next_page: 'cursor-2' })
      .mockRejectedValueOnce(new Error('provider unavailable'));
    await expect(service.listPersonalSubscriptions(memberId)).rejects.toThrow('provider unavailable');

    stripe.subscriptions.search.mockReset();
    stripe.subscriptions.search.mockImplementation(({ page }) => ({
      data: Array.from({ length: 100 }, () => ({})),
      has_more: true,
      next_page: page ? `${page}-next` : 'page-2',
    }));
    await expect(service.listPersonalSubscriptions(memberId)).rejects.toThrow(BadGatewayException);
    expect(stripe.subscriptions.search).toHaveBeenCalledTimes(10);
  });
});

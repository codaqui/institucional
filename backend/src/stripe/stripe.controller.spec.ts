import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';

const uuid = (n: number) =>
  `${String(n).padStart(8, '0')}-0000-0000-0000-000000000000`;

describe('StripeController', () => {
  let controller: StripeController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      createCheckoutSession: jest.fn(),
      handleWebhookEvent: jest.fn(),
      getMyDonations: jest.fn(),
      getMySubscriptions: jest.fn(),
      cancelSubscription: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StripeController],
      providers: [{ provide: StripeService, useValue: service }],
    }).compile();

    controller = module.get<StripeController>(StripeController);
  });

  const authedReq = {
    user: {
      sub: uuid(5),
      githubId: '55',
      handle: 'donor',
      name: 'Donor',
      email: 'd@d.com',
      avatarUrl: '',
      role: 'membro',
    },
  };

  describe('getMyDonations', () => {
    it('should return donations for authenticated user', async () => {
      service.getMyDonations.mockResolvedValue([]);
      const result = await controller.getMyDonations(authedReq);
      expect(result).toEqual([]);
      expect(service.getMyDonations).toHaveBeenCalledWith(uuid(5));
    });
  });

  describe('getMySubscriptions', () => {
    it('should return subscriptions', async () => {
      service.getMySubscriptions.mockResolvedValue([]);
      const result = await controller.getMySubscriptions(authedReq);
      expect(result).toEqual([]);
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription', async () => {
      service.cancelSubscription.mockResolvedValue({
        cancelAtPeriodEnd: true,
        currentPeriodEnd: 123,
      });
      const result = await controller.cancelSubscription('sub_1', authedReq);
      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(service.cancelSubscription).toHaveBeenCalledWith('sub_1', uuid(5));
    });
  });

  describe('createCheckoutSession', () => {
    it('should throw when amount is missing', async () => {
      await expect(
        controller.createCheckoutSession(
          { user: undefined, headers: {} },
          undefined,
          undefined,
          { amount: 0, communityId: 'test' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when communityId is missing', async () => {
      await expect(
        controller.createCheckoutSession(
          { user: undefined, headers: {} },
          undefined,
          undefined,
          { amount: 1000, communityId: '' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when amount is negative', async () => {
      await expect(
        controller.createCheckoutSession(
          { user: undefined, headers: {} },
          undefined,
          undefined,
          { amount: -100, communityId: 'test' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when amount exceeds max (R$ 50.000)', async () => {
      await expect(
        controller.createCheckoutSession(
          { ...authedReq, headers: {} },
          undefined,
          undefined,
          {
            amount: 5_000_001,
            communityId: 'test',
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException for anonymous donation > R$100', async () => {
      await expect(
        controller.createCheckoutSession(
          { user: undefined, headers: {} },
          undefined,
          undefined,
          { amount: 10_001, communityId: 'test' },
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should allow anonymous donation ≤ R$100', async () => {
      service.createCheckoutSession.mockResolvedValue({
        clientSecret: 'cs_test',
      });

      const result = await controller.createCheckoutSession(
        { user: undefined, headers: {} },
        undefined,
        undefined,
        { amount: 10_000, communityId: 'test' },
      );

      expect(result).toEqual({ clientSecret: 'cs_test' });
      expect(service.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: undefined,
          githubHandle: undefined,
        }),
      );
    });

    it('should pass memberId for authenticated user', async () => {
      service.createCheckoutSession.mockResolvedValue({
        clientSecret: 'cs_test',
      });

      await controller.createCheckoutSession(
        { ...authedReq, headers: {} },
        undefined,
        undefined,
        {
          amount: 50_000,
          communityId: 'devparana',
        },
      );

      expect(service.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ memberId: uuid(5), githubHandle: 'donor' }),
      );
    });
  });

  describe('handleWebhook', () => {
    it('should throw when signature header is missing', async () => {
      await expect(
        controller.handleWebhook(undefined as any, {
          rawBody: Buffer.from('body'),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when rawBody is missing', async () => {
      await expect(
        controller.handleWebhook('sig', { rawBody: undefined }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should process valid webhook', async () => {
      service.handleWebhookEvent.mockResolvedValue({ received: true });

      const result = await controller.handleWebhook('sig_valid', {
        rawBody: Buffer.from('body'),
      });

      expect(result).toEqual({ received: true });
    });
  });
});

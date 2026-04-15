import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { LedgerService } from '../ledger/ledger.service';
import { Transaction } from '../ledger/entities/transaction.entity';

// Mock the stripe module
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
    subscriptions: {
      retrieve: jest.fn(),
      search: jest.fn(),
      update: jest.fn(),
    },
  }));
});

const uuid = (n: number) => `${String(n).padStart(8, '0')}-0000-0000-0000-000000000000`;

describe('StripeService', () => {
  let service: StripeService;
  let ledgerService: Record<string, jest.Mock>;
  let txRepo: Record<string, jest.Mock>;
  let stripeInstance: any;

  beforeEach(async () => {
    ledgerService = {
      recordTransaction: jest.fn().mockResolvedValue({}),
      getOrCreateCommunityAccount: jest.fn().mockResolvedValue({ id: uuid(1) }),
    };

    txRepo = {
      findOneBy: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        { provide: LedgerService, useValue: ledgerService },
        { provide: getRepositoryToken(Transaction), useValue: txRepo },
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);
    // Access the stripe instance created in the constructor
    stripeInstance = (service as any).stripe;
  });

  // ─── createCheckoutSession ────────────────────────────────────────────────

  describe('createCheckoutSession', () => {
    it('should create an embedded checkout session', async () => {
      stripeInstance.checkout.sessions.create.mockResolvedValue({
        client_secret: 'cs_test_secret',
      });

      const result = await service.createCheckoutSession({
        amountCents: 5000,
        communityId: 'tesouro-geral',
        uiMode: 'embedded_page',
      });

      expect(result).toEqual({ clientSecret: 'cs_test_secret' });
      expect(stripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          ui_mode: 'embedded_page',
        }),
      );
    });

    it('should create a hosted checkout session', async () => {
      stripeInstance.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_id',
        url: 'https://checkout.stripe.com/pay/cs_test_id',
      });

      const result = await service.createCheckoutSession({
        amountCents: 5000,
        communityId: 'tesouro-geral',
        uiMode: 'hosted',
      });

      expect(result).toEqual({
        sessionId: 'cs_test_id',
        url: 'https://checkout.stripe.com/pay/cs_test_id',
      });
    });

    it('should create a subscription checkout', async () => {
      stripeInstance.checkout.sessions.create.mockResolvedValue({
        client_secret: 'cs_sub_secret',
      });

      const result = await service.createCheckoutSession({
        amountCents: 2500,
        communityId: 'devparana',
        recurring: { interval: 'month' },
      });

      expect(result).toEqual({ clientSecret: 'cs_sub_secret' });
      expect(stripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'subscription' }),
      );
    });

    it('should throw for non-positive amount', async () => {
      await expect(
        service.createCheckoutSession({
          amountCents: 0,
          communityId: 'test',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should include memberId and githubHandle in metadata', async () => {
      stripeInstance.checkout.sessions.create.mockResolvedValue({ client_secret: 'x' });

      await service.createCheckoutSession({
        amountCents: 1000,
        communityId: 'test',
        memberId: uuid(5),
        githubHandle: 'user1',
      });

      expect(stripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            memberId: uuid(5),
            githubHandle: 'user1',
          }),
        }),
      );
    });
  });

  // ─── handleWebhookEvent ───────────────────────────────────────────────────

  describe('handleWebhookEvent', () => {
    beforeEach(() => {
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    });

    afterEach(() => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    });

    it('should throw when signature verification fails', async () => {
      stripeInstance.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Signature mismatch');
      });

      await expect(
        service.handleWebhookEvent('bad_sig', Buffer.from('body')),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when webhook secret is not configured', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      await expect(
        service.handleWebhookEvent('sig', Buffer.from('body')),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle checkout.session.completed for one-time payment', async () => {
      txRepo.findOneBy.mockResolvedValue(null); // no duplicate

      stripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            metadata: {
              communityId: 'tesouro-geral',
              memberId: uuid(5),
              githubHandle: 'donor',
              isSubscription: 'false',
            },
            amount_total: 5000,
            payment_intent: 'pi_test_123',
          },
        },
      });

      const result = await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(result).toEqual({ received: true });
      expect(ledgerService.recordTransaction).toHaveBeenCalled();
    });

    it('should skip ledger for subscription checkout (handled by invoice)', async () => {
      stripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_sub_123',
            metadata: { isSubscription: 'true', communityId: 'test' },
            amount_total: 2500,
            payment_intent: 'pi_sub_123',
          },
        },
      });

      const result = await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(result).toEqual({ received: true });
      expect(ledgerService.recordTransaction).not.toHaveBeenCalled();
    });

    it('should handle idempotent duplicate webhooks', async () => {
      txRepo.findOneBy.mockResolvedValue({ id: 'existing' }); // duplicate found

      stripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_dup',
            metadata: { communityId: 'test', isSubscription: 'false' },
            amount_total: 1000,
            payment_intent: 'pi_dup',
          },
        },
      });

      await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(ledgerService.recordTransaction).not.toHaveBeenCalled();
    });

    it('should ignore unhandled event types', async () => {
      stripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.created',
        data: { object: {} },
      });

      const result = await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(result).toEqual({ received: true });
    });
  });

  // ─── getMyDonations ───────────────────────────────────────────────────────

  describe('getMyDonations', () => {
    it('should return mapped donation list', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'tx-1',
            amount: 50,
            description: 'Doação de @user [member-id]',
            referenceId: 'pi_123',
            createdAt: new Date(),
            sourceAccount: { name: 'Stripe' },
            destinationAccount: { name: 'DevParaná' },
          },
        ]),
      };
      txRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getMyDonations('member-id');

      expect(result).toHaveLength(1);
      expect(result[0].community).toBe('DevParaná');
      expect(result[0].amount).toBe(50);
    });
  });

  // ─── getMySubscriptions ───────────────────────────────────────────────────

  describe('getMySubscriptions', () => {
    it('should return active and past_due subscriptions', async () => {
      stripeInstance.subscriptions.search
        .mockResolvedValueOnce({
          data: [
            {
              id: 'sub_1',
              status: 'active',
              cancel_at_period_end: false,
              metadata: { communityId: 'tesouro-geral' },
              items: {
                data: [
                  {
                    price: { recurring: { interval: 'month' }, unit_amount: 2500, currency: 'brl' },
                    current_period_end: 1700000000,
                  },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce({ data: [] });

      const result = await service.getMySubscriptions(uuid(5));

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sub_1');
      expect(result[0].interval).toBe('month');
    });

    it('should throw for invalid memberId', async () => {
      await expect(service.getMySubscriptions('not-a-uuid')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── cancelSubscription ───────────────────────────────────────────────────

  describe('cancelSubscription', () => {
    it('should cancel at period end', async () => {
      stripeInstance.subscriptions.retrieve.mockResolvedValue({
        metadata: { memberId: uuid(5) },
        status: 'active',
      });
      stripeInstance.subscriptions.update.mockResolvedValue({
        cancel_at_period_end: true,
        items: { data: [{ current_period_end: 1700000000 }] },
      });

      const result = await service.cancelSubscription('sub_1', uuid(5));

      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(stripeInstance.subscriptions.update).toHaveBeenCalledWith('sub_1', {
        cancel_at_period_end: true,
      });
    });

    it('should throw if subscription does not belong to member', async () => {
      stripeInstance.subscriptions.retrieve.mockResolvedValue({
        metadata: { memberId: uuid(99) },
        status: 'active',
      });

      await expect(
        service.cancelSubscription('sub_1', uuid(5)),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if subscription is already canceled', async () => {
      stripeInstance.subscriptions.retrieve.mockResolvedValue({
        metadata: { memberId: uuid(5) },
        status: 'canceled',
      });

      await expect(
        service.cancelSubscription('sub_1', uuid(5)),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

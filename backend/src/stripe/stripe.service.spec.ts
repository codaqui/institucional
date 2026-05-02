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
    paymentIntents: {
      retrieve: jest.fn(),
    },
    balanceTransactions: {
      retrieve: jest.fn(),
    },
  }));
});

const uuid = (n: number) =>
  `${String(n).padStart(8, '0')}-0000-0000-0000-000000000000`;

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
      findOne: jest.fn(),
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
      stripeInstance.checkout.sessions.create.mockResolvedValue({
        client_secret: 'x',
      });

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

      const result = await service.handleWebhookEvent(
        'sig',
        Buffer.from('body'),
      );

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

      const result = await service.handleWebhookEvent(
        'sig',
        Buffer.from('body'),
      );

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

      const result = await service.handleWebhookEvent(
        'sig',
        Buffer.from('body'),
      );

      expect(result).toEqual({ received: true });
    });

    it('should handle charge.refunded creating reverse transaction', async () => {
      const originalTx = {
        id: 'tx-original',
        referenceId: 'pi_3TSH3JFtPCSoiGky1wUsFOJy',
        sourceAccount: { id: 'acc-stripe', name: 'Stripe Income' },
        destinationAccount: {
          id: 'acc-community',
          name: 'Comunidade: ti-social',
        },
      };
      txRepo.findOne.mockResolvedValue(originalTx);
      txRepo.findOneBy.mockResolvedValue(null); // refund not yet recorded

      stripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'charge.refunded',
        data: {
          object: {
            id: 'ch_3TSH3JFtPCSoiGky1bnkoUn8',
            payment_intent: 'pi_3TSH3JFtPCSoiGky1wUsFOJy',
            refunds: {
              data: [
                {
                  id: 're_3TSH3JFtPCSoiGky18dl80ut',
                  amount: 10000,
                },
              ],
            },
          },
        },
      });

      const result = await service.handleWebhookEvent(
        'sig',
        Buffer.from('body'),
      );

      expect(result).toEqual({ received: true });
      // Reverse direction: source = community, destination = stripe income
      expect(ledgerService.recordTransaction).toHaveBeenCalledWith(
        'acc-community',
        'acc-stripe',
        100,
        expect.stringContaining('Estorno de doação'),
        're_3TSH3JFtPCSoiGky18dl80ut',
      );
    });

    it('should be idempotent on duplicate charge.refunded events', async () => {
      txRepo.findOne.mockResolvedValue({
        id: 'tx-original',
        referenceId: 'pi_xxx',
        sourceAccount: { id: 'acc-stripe', name: 'Stripe' },
        destinationAccount: { id: 'acc-community', name: 'Comunidade' },
      });
      txRepo.findOneBy.mockResolvedValue({ id: 'existing-refund' }); // already recorded

      stripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'charge.refunded',
        data: {
          object: {
            id: 'ch_xxx',
            payment_intent: 'pi_xxx',
            refunds: { data: [{ id: 're_xxx', amount: 5000 }] },
          },
        },
      });

      await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(ledgerService.recordTransaction).not.toHaveBeenCalled();
    });

    it('should warn and skip when original donation not found on refund', async () => {
      txRepo.findOne.mockResolvedValue(null); // original tx missing

      stripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'charge.refunded',
        data: {
          object: {
            id: 'ch_orphan',
            payment_intent: 'pi_orphan',
            refunds: { data: [{ id: 're_orphan', amount: 1000 }] },
          },
        },
      });

      const result = await service.handleWebhookEvent(
        'sig',
        Buffer.from('body'),
      );

      expect(result).toEqual({ received: true });
      expect(ledgerService.recordTransaction).not.toHaveBeenCalled();
    });
  });

  // ─── Stripe fee capture (charge.succeeded / charge.updated / inline) ─────

  describe('Stripe fee capture', () => {
    const STRIPE_FEES_ACCOUNT_ID = uuid(99);
    const COMMUNITY_ACCOUNT_ID = 'acc-community';
    const STRIPE_INCOME_ACCOUNT_ID = 'acc-stripe-income';

    beforeEach(() => {
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    });

    afterEach(() => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    });

    const buildOriginalDonation = (paymentIntentId = 'pi_test_main') => ({
      id: 'tx-original',
      referenceId: paymentIntentId,
      sourceAccount: { id: STRIPE_INCOME_ACCOUNT_ID, name: 'Stripe Income' },
      destinationAccount: {
        id: COMMUNITY_ACCOUNT_ID,
        name: 'Comunidade: tesouro-geral',
      },
    });

    const buildBalanceTransaction = (overrides: Record<string, unknown> = {}) => ({
      id: 'txn_test_bt_1',
      fee: 199,
      net: 4801,
      amount: 5000,
      ...overrides,
    });

    const buildChargeUpdatedEvent = (
      charge: Record<string, unknown>,
      previous: Record<string, unknown> | null = { balance_transaction: null },
    ) => ({
      type: 'charge.updated',
      data: {
        object: {
          id: 'ch_test_main',
          payment_intent: 'pi_test_main',
          ...charge,
        },
        previous_attributes: previous,
      },
    });

    const buildChargeSucceededEvent = (charge: Record<string, unknown>) => ({
      type: 'charge.succeeded',
      data: {
        object: {
          id: 'ch_test_main',
          payment_intent: 'pi_test_main',
          ...charge,
        },
      },
    });

    // --- Shared assertion helpers (DRY) ---------------------------------------

    /** Asserts a "Stripe fee" ledger transaction was recorded with the given fee/charge/bt. */
    const expectFeeRecorded = (opts: {
      amount: number;
      chargeId?: string;
      btId: string;
    }) => {
      expect(ledgerService.recordTransaction).toHaveBeenCalledWith(
        COMMUNITY_ACCOUNT_ID,
        STRIPE_FEES_ACCOUNT_ID,
        opts.amount,
        opts.chargeId
          ? expect.stringContaining(`Charge ${opts.chargeId}`)
          : expect.stringContaining('Charge'),
        `stripe-fee:${opts.btId}`,
      );
    };

    /** Asserts no fee was recorded (donation may still be recorded). */
    const expectNoFeeRecorded = () => {
      const feeCalls = ledgerService.recordTransaction.mock.calls.filter(
        (call: unknown[]) =>
          typeof call[4] === 'string' &&
          (call[4] as string).startsWith('stripe-fee:'),
      );
      expect(feeCalls).toHaveLength(0);
    };

    /** Mocks idempotency checks: 1st = donation (none), 2nd = fee (none). */
    const mockNoExisting = () => {
      txRepo.findOneBy
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
    };

    /** Stubs PI retrieve with an expanded latest_charge containing the BT. */
    const mockExpandedPI = (
      piId: string,
      chargeId: string,
      bt: ReturnType<typeof buildBalanceTransaction>,
    ) => {
      stripeInstance.paymentIntents.retrieve.mockResolvedValue({
        id: piId,
        latest_charge: { id: chargeId, balance_transaction: bt },
      });
    };

    beforeEach(() => {
      // Default: stripe_fees account creation returns a stable id
      ledgerService.getOrCreateCommunityAccount.mockImplementation(
        async (key: string) =>
          key === 'stripe_fees'
            ? { id: STRIPE_FEES_ACCOUNT_ID }
            : { id: COMMUNITY_ACCOUNT_ID },
      );
    });

    // --- charge.updated path (one-time payments) -----------------------------

    it('captures fee on charge.updated when BT transitions null → txn', async () => {
      const bt = buildBalanceTransaction();
      stripeInstance.balanceTransactions.retrieve.mockResolvedValue(bt);
      txRepo.findOneBy.mockResolvedValue(null);
      txRepo.findOne.mockResolvedValue(buildOriginalDonation());

      stripeInstance.webhooks.constructEvent.mockReturnValue(
        buildChargeUpdatedEvent({ balance_transaction: bt.id }),
      );

      await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(ledgerService.getOrCreateCommunityAccount).toHaveBeenCalledWith(
        'stripe_fees',
        'Stripe Fees (External)',
        'EXTERNAL',
      );
      expectFeeRecorded({ amount: 1.99, chargeId: 'ch_test_main', btId: bt.id });
    });

    it('skips silently on charge.updated when balance_transaction is still null', async () => {
      stripeInstance.webhooks.constructEvent.mockReturnValue(
        buildChargeUpdatedEvent({ balance_transaction: null }),
      );

      await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(stripeInstance.balanceTransactions.retrieve).not.toHaveBeenCalled();
      expect(ledgerService.recordTransaction).not.toHaveBeenCalled();
    });

    // --- charge.succeeded path (subscriptions, BT already populated) ---------

    it('captures fee on charge.succeeded when BT is already populated (subscription)', async () => {
      const bt = buildBalanceTransaction({ id: 'txn_sub_1', fee: 538 });
      stripeInstance.balanceTransactions.retrieve.mockResolvedValue(bt);
      txRepo.findOneBy.mockResolvedValue(null);
      txRepo.findOne.mockResolvedValue(buildOriginalDonation('pi_sub_main'));

      stripeInstance.webhooks.constructEvent.mockReturnValue(
        buildChargeSucceededEvent({
          id: 'ch_sub_main',
          payment_intent: 'pi_sub_main',
          balance_transaction: 'txn_sub_1',
        }),
      );

      await service.handleWebhookEvent('sig', Buffer.from('body'));

      expectFeeRecorded({ amount: 5.38, chargeId: 'ch_sub_main', btId: 'txn_sub_1' });
    });

    // --- Idempotency ---------------------------------------------------------

    it('is idempotent: skips fee when stripe-fee:<bt> already recorded', async () => {
      txRepo.findOneBy.mockResolvedValue({ id: 'existing-fee-tx' });

      stripeInstance.webhooks.constructEvent.mockReturnValue(
        buildChargeUpdatedEvent({ balance_transaction: 'txn_dup' }),
      );

      await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(stripeInstance.balanceTransactions.retrieve).not.toHaveBeenCalled();
      expect(ledgerService.recordTransaction).not.toHaveBeenCalled();
    });

    it('does not double-record when both charge.succeeded and charge.updated arrive', async () => {
      const bt = buildBalanceTransaction({ id: 'txn_race' });
      stripeInstance.balanceTransactions.retrieve.mockResolvedValue(bt);
      txRepo.findOne.mockResolvedValue(buildOriginalDonation());

      // 1st webhook: charge.succeeded — no existing fee, records it
      txRepo.findOneBy.mockResolvedValueOnce(null);
      stripeInstance.webhooks.constructEvent.mockReturnValueOnce(
        buildChargeSucceededEvent({ balance_transaction: 'txn_race' }),
      );
      await service.handleWebhookEvent('sig', Buffer.from('body'));

      // 2nd webhook: charge.updated — finds existing fee, skips
      txRepo.findOneBy.mockResolvedValueOnce({ id: 'existing-fee' });
      stripeInstance.webhooks.constructEvent.mockReturnValueOnce(
        buildChargeUpdatedEvent({ balance_transaction: 'txn_race' }),
      );
      await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(ledgerService.recordTransaction).toHaveBeenCalledTimes(1);
    });

    // --- Edge cases / error handling ----------------------------------------

    it('warns and skips when original donation cannot be located', async () => {
      stripeInstance.balanceTransactions.retrieve.mockResolvedValue(
        buildBalanceTransaction(),
      );
      txRepo.findOneBy.mockResolvedValue(null);
      txRepo.findOne.mockResolvedValue(null);

      stripeInstance.webhooks.constructEvent.mockReturnValue(
        buildChargeUpdatedEvent({
          balance_transaction: 'txn_orphan',
          payment_intent: 'pi_orphan',
        }),
      );

      await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(ledgerService.recordTransaction).not.toHaveBeenCalled();
    });

    it('skips when fee is zero (test mode with some test cards)', async () => {
      stripeInstance.balanceTransactions.retrieve.mockResolvedValue(
        buildBalanceTransaction({ fee: 0 }),
      );
      txRepo.findOneBy.mockResolvedValue(null);
      txRepo.findOne.mockResolvedValue(buildOriginalDonation());

      stripeInstance.webhooks.constructEvent.mockReturnValue(
        buildChargeUpdatedEvent({ balance_transaction: 'txn_no_fee' }),
      );

      await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(ledgerService.recordTransaction).not.toHaveBeenCalled();
    });

    it('skips when balanceTransactions.retrieve throws (does not crash webhook)', async () => {
      stripeInstance.balanceTransactions.retrieve.mockRejectedValue(
        new Error('Stripe API error'),
      );
      txRepo.findOneBy.mockResolvedValue(null);

      stripeInstance.webhooks.constructEvent.mockReturnValue(
        buildChargeUpdatedEvent({ balance_transaction: 'txn_api_err' }),
      );

      const result = await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(result).toEqual({ received: true });
      expect(ledgerService.recordTransaction).not.toHaveBeenCalled();
    });

    it('skips when charge.payment_intent is missing', async () => {
      stripeInstance.webhooks.constructEvent.mockReturnValue(
        buildChargeUpdatedEvent({
          balance_transaction: 'txn_no_pi',
          payment_intent: null,
        }),
      );

      await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(stripeInstance.balanceTransactions.retrieve).not.toHaveBeenCalled();
      expect(ledgerService.recordTransaction).not.toHaveBeenCalled();
    });

    // --- Inline capture (resolves race condition) ----------------------------

    it('captures fee inline after checkout.session.completed (one-time)', async () => {
      const bt = buildBalanceTransaction({ id: 'txn_inline_oneshot' });
      mockExpandedPI('pi_inline_oneshot', 'ch_inline_oneshot', bt);
      mockNoExisting();
      txRepo.findOne.mockResolvedValue(buildOriginalDonation('pi_inline_oneshot'));

      stripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_inline',
            metadata: {
              communityId: 'tesouro-geral',
              memberId: uuid(7),
              isSubscription: 'false',
            },
            amount_total: 5000,
            payment_intent: 'pi_inline_oneshot',
          },
        },
      });

      await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(ledgerService.recordTransaction).toHaveBeenCalledWith(
        expect.any(String),
        COMMUNITY_ACCOUNT_ID,
        50,
        expect.stringContaining('Doação'),
        'pi_inline_oneshot',
      );
      expectFeeRecorded({
        amount: 1.99,
        chargeId: 'ch_inline_oneshot',
        btId: 'txn_inline_oneshot',
      });
    });

    it('captures fee inline after invoice.payment_succeeded (subscription, fixes race)', async () => {
      const bt = buildBalanceTransaction({ id: 'txn_inline_sub', fee: 412 });
      stripeInstance.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_inline',
        metadata: { communityId: 'tesouro-geral', memberId: uuid(8) },
      });
      mockExpandedPI('pi_inline_sub', 'ch_inline_sub', bt);
      mockNoExisting();
      txRepo.findOne.mockResolvedValue(buildOriginalDonation('pi_inline_sub'));

      stripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_inline_sub',
            subscription: 'sub_inline',
            amount_paid: 20000,
            payment_intent: 'pi_inline_sub',
          },
        },
      });

      await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(ledgerService.recordTransaction).toHaveBeenCalledWith(
        expect.any(String),
        COMMUNITY_ACCOUNT_ID,
        200,
        expect.stringContaining('Assinatura'),
        'pi_inline_sub',
      );
      expectFeeRecorded({
        amount: 4.12,
        chargeId: 'ch_inline_sub',
        btId: 'txn_inline_sub',
      });
    });

    it('inline capture is best-effort: does not crash if PI retrieve fails', async () => {
      stripeInstance.paymentIntents.retrieve.mockRejectedValue(
        new Error('Stripe API down'),
      );
      txRepo.findOneBy.mockResolvedValue(null);

      stripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_pi_fail',
            metadata: { communityId: 'tesouro-geral', isSubscription: 'false' },
            amount_total: 1000,
            payment_intent: 'pi_pi_fail',
          },
        },
      });

      const result = await service.handleWebhookEvent(
        'sig',
        Buffer.from('body'),
      );

      expect(result).toEqual({ received: true });
      expect(ledgerService.recordTransaction).toHaveBeenCalledTimes(1);
      expectNoFeeRecorded();
    });

    it('inline capture: logs and continues when latest_charge is not expanded', async () => {
      stripeInstance.paymentIntents.retrieve.mockResolvedValue({
        id: 'pi_no_expand',
        latest_charge: 'ch_string_only',
      });
      txRepo.findOneBy.mockResolvedValue(null);

      stripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_no_expand',
            metadata: { communityId: 'tesouro-geral', isSubscription: 'false' },
            amount_total: 1000,
            payment_intent: 'pi_no_expand',
          },
        },
      });

      await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(ledgerService.recordTransaction).toHaveBeenCalledTimes(1);
      expectNoFeeRecorded();
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
                    price: {
                      recurring: { interval: 'month' },
                      unit_amount: 2500,
                      currency: 'brl',
                    },
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
      await expect(service.getMySubscriptions('not-a-uuid')).rejects.toThrow(
        BadRequestException,
      );
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
      expect(stripeInstance.subscriptions.update).toHaveBeenCalledWith(
        'sub_1',
        {
          cancel_at_period_end: true,
        },
      );
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

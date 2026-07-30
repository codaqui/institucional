import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { LedgerService } from '../ledger/ledger.service';
import { Transaction } from '../ledger/entities/transaction.entity';
import { ClubService } from '../club/club.service';
import { CompaniesService } from '../companies/companies.service';
import { EventOrder } from '../events/entities/event-order.entity';
import { EventRegistration } from '../events/entities/event-registration.entity';
import { TicketType } from '../events/entities/ticket-type.entity';
import { ManagedEvent } from '../events/entities/managed-event.entity';
import { ExternalEventActivation } from '../events/entities/external-event-activation.entity';
import { Member } from '../members/entities/member.entity';
import { EmailService } from '../notifications/email.service';

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
      list: jest.fn(),
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
    refunds: {
      create: jest.fn(),
    },
  }));
});

const uuid = (n: number) =>
  `${String(n).padStart(8, '0')}-0000-0000-0000-000000000000`;

describe('StripeService', () => {
  let service: StripeService;
  let ledgerService: Record<string, jest.Mock>;
  let txRepo: Record<string, jest.Mock>;
  let eventOrderRepo: Record<string, jest.Mock>;
  let eventRegistrationRepo: Record<string, jest.Mock>;
  let ticketTypeRepo: Record<string, jest.Mock>;
  let managedEventRepo: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
  let stripeInstance: any;

  beforeEach(async () => {
    ledgerService = {
      recordTransaction: jest.fn().mockResolvedValue({}),
      getOrCreateCommunityAccount: jest.fn().mockResolvedValue({ id: uuid(1) }),
    };

    txRepo = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(),
    };

    eventOrderRepo = {
      findOneBy: jest.fn(),
      save: jest.fn((o) => Promise.resolve(o)),
    };
    eventRegistrationRepo = {
      create: jest.fn((data) => data),
      save: jest.fn((r) => Promise.resolve(r)),
      findBy: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    ticketTypeRepo = {
      query: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn().mockResolvedValue({
        id: uuid(21),
        name: 'Lote 1',
        price: 10000,
        currency: 'BRL',
      }),
    };
    managedEventRepo = {
      findOneBy: jest.fn().mockResolvedValue({
        id: uuid(50),
        title: 'Evento Teste',
        communityProjectKey: 'devparana',
      }),
    };
    memberRepo = {
      findOneBy: jest.fn().mockResolvedValue({
        id: uuid(9),
        name: 'Comprador',
        email: 'buyer@example.com',
        githubHandle: 'buyer',
      }),
      findOne: jest.fn().mockResolvedValue({
        id: uuid(9),
        name: 'Comprador',
        email: 'buyer@example.com',
      }),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    const clubServiceMock = {
      creditCoins: jest.fn().mockResolvedValue({}),
      creditFromInvoice: jest.fn().mockResolvedValue({}),
      freezeCoin: jest.fn().mockResolvedValue({}),
    };

    const companiesServiceMock = {
      findById: jest.fn().mockResolvedValue(null),
      listBusinessMembersForCompanyIds: jest.fn().mockResolvedValue([]),
      creditToWallet: jest.fn().mockResolvedValue({}),
      setStripeCustomer: jest.fn().mockResolvedValue(undefined),
      setStripeSubscription: jest.fn().mockResolvedValue(undefined),
      setSubscriptionAmount: jest.fn().mockResolvedValue(undefined),
      activateFromInvoice: jest.fn().mockResolvedValue(undefined),
      suspendFromSubscriptionDeleted: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        { provide: LedgerService, useValue: ledgerService },
        { provide: getRepositoryToken(Transaction), useValue: txRepo },
        { provide: ClubService, useValue: clubServiceMock },
        { provide: CompaniesService, useValue: companiesServiceMock },
        { provide: getRepositoryToken(EventOrder), useValue: eventOrderRepo },
        {
          provide: getRepositoryToken(EventRegistration),
          useValue: eventRegistrationRepo,
        },
        { provide: getRepositoryToken(TicketType), useValue: ticketTypeRepo },
        {
          provide: getRepositoryToken(ManagedEvent),
          useValue: managedEventRepo,
        },
        {
          provide: getRepositoryToken(ExternalEventActivation),
          useValue: {
            findOneBy: jest.fn().mockResolvedValue(null),
          },
        },
        { provide: getRepositoryToken(Member), useValue: memberRepo },
        {
          provide: EmailService,
          useValue: {
            sendRegistrationConfirmation: jest.fn().mockResolvedValue(undefined),
          },
        },
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

      const clubService = (service as any).clubService;
      expect(clubService.creditFromInvoice).toHaveBeenCalledWith(
        uuid(8),
        200,
        'stripe-pi:pi_inline_sub',
      );
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
      const rowsQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
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
      const countQb = {
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
      };
      txRepo.createQueryBuilder
        .mockReturnValueOnce(rowsQb)
        .mockReturnValueOnce(countQb);

      const result = await service.getMyDonations('member-id');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].community).toBe('DevParaná');
      expect(result.items[0].amount).toBe(50);
      expect(result.total).toBe(1);
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

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('sub_1');
      expect(result.items[0].interval).toBe('month');
    });

    it('should throw for invalid memberId', async () => {
      await expect(service.getMySubscriptions('not-a-uuid')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── getClubMembers ───────────────────────────────────────────────────────

  describe('getClubMembers', () => {
    it('should return active monthly club members only', async () => {
      stripeInstance.subscriptions.list
        .mockResolvedValueOnce({
          data: [
            {
              id: 'sub_member_active',
              status: 'active',
              metadata: {
                memberId: uuid(1),
                githubHandle: 'member-one',
              },
              items: {
                data: [
                  {
                    price: {
                      recurring: { interval: 'month' },
                    },
                  },
                ],
              },
            },
            {
              id: 'sub_business_active',
              status: 'active',
              metadata: {
                memberId: uuid(2),
                githubHandle: 'biz-user',
                companyId: uuid(3),
                entityType: 'business',
              },
              items: {
                data: [
                  {
                    price: {
                      recurring: { interval: 'month' },
                    },
                  },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          data: [
            {
              id: 'sub_member_past_due',
              status: 'past_due',
              metadata: {
                memberId: uuid(1),
                githubHandle: 'member-one',
              },
              items: {
                data: [
                  {
                    price: {
                      recurring: { interval: 'month' },
                    },
                  },
                ],
              },
            },
            {
              id: 'sub_member_annual',
              status: 'past_due',
              metadata: {
                memberId: uuid(3),
                githubHandle: 'annual-user',
              },
              items: {
                data: [
                  {
                    price: {
                      recurring: { interval: 'year' },
                    },
                  },
                ],
              },
            },
          ],
        });

      const result = await service.getClubMembers();

      expect(result.total).toBe(1);
      expect(result.items).toEqual([
        expect.objectContaining({
          memberId: uuid(1),
          githubHandle: 'member-one',
        }),
      ]);
      expect(stripeInstance.subscriptions.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' }),
      );
      expect(stripeInstance.subscriptions.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'past_due' }),
      );
    });
  });

  // ─── getBusinessMembers ───────────────────────────────────────────────────

  describe('getBusinessMembers', () => {
    it('should return active business club members only', async () => {
      const companiesService = (service as any).companiesService;
      companiesService.listBusinessMembersForCompanyIds.mockResolvedValueOnce([
        { memberId: uuid(2), role: 'owner' },
        { memberId: uuid(9), role: 'collaborator' },
      ]);

      stripeInstance.subscriptions.list
        .mockResolvedValueOnce({
          data: [
            {
              id: 'sub_business_active',
              status: 'active',
              metadata: {
                memberId: uuid(2),
                githubHandle: 'biz-user',
                companyId: uuid(3),
                entityType: 'business',
              },
              items: {
                data: [
                  {
                    price: {
                      recurring: { interval: 'month' },
                    },
                  },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          data: [
            {
              id: 'sub_business_past_due',
              status: 'past_due',
              metadata: {
                memberId: uuid(2),
                githubHandle: 'biz-user',
                companyId: uuid(3),
                entityType: 'business',
              },
              items: {
                data: [
                  {
                    price: {
                      recurring: { interval: 'month' },
                    },
                  },
                ],
              },
            },
          ],
        });

      const result = await service.getBusinessMembers();

      expect(result.total).toBe(2);
      expect(result.items).toEqual([
        expect.objectContaining({
          memberId: uuid(2),
          githubHandle: 'biz-user',
          membershipType: 'owner',
        }),
        expect.objectContaining({
          memberId: uuid(9),
          membershipType: 'collaborator',
        }),
      ]);
      expect(stripeInstance.subscriptions.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' }),
      );
      expect(stripeInstance.subscriptions.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'past_due' }),
      );
      expect(companiesService.listBusinessMembersForCompanyIds).toHaveBeenCalledWith([
        uuid(3),
      ]);
    });

    it('should keep business member even when githubHandle is missing in metadata', async () => {
      const companiesService = (service as any).companiesService;
      companiesService.listBusinessMembersForCompanyIds.mockResolvedValueOnce([
        { memberId: uuid(7), role: 'owner' },
      ]);

      stripeInstance.subscriptions.list
        .mockResolvedValueOnce({
          data: [
            {
              id: 'sub_business_active_no_handle',
              status: 'active',
              metadata: {
                memberId: uuid(7),
                companyId: uuid(8),
                entityType: 'business',
              },
              items: {
                data: [
                  {
                    price: {
                      recurring: { interval: 'month' },
                    },
                  },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce({ data: [] });

      const result = await service.getBusinessMembers();

      expect(result.total).toBe(1);
      expect(result.items).toEqual([
        {
          memberId: uuid(7),
          githubHandle: '',
          membershipType: 'owner',
        },
      ]);
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

  // ─── Event tickets (Fase 2) ─────────────────────────────────────────────

  describe('event ticket checkout.session.completed', () => {
    beforeEach(() => {
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    });

    afterEach(() => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    });

    const order = () => ({
      id: uuid(60),
      eventId: uuid(50),
      ticketTypeId: uuid(51),
      quantity: 2,
      memberId: uuid(9),
      payerMemberId: uuid(9),
      attendees: JSON.stringify([
        { name: 'X', email: 'x@x.dev' },
        { name: 'Y', email: 'y@x.dev' },
      ]),
      totalCents: 10000,
      status: 'pending',
      stripeSessionId: 'cs_evt_123',
      stripePaymentIntentId: null,
      paidAt: null,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      termsVersion: '2026-07-v1',
    });

    const sessionEvent = () => ({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_evt_123',
          metadata: {
            entityType: 'event-ticket',
            eventId: uuid(50),
            orderId: uuid(60),
            communityId: 'devparana',
          },
          amount_total: 10000,
          payment_intent: 'pi_evt_123',
          customer_details: { name: 'X', email: 'x@x.dev' },
        },
      },
    });

    it('marks order paid, creates N registrations and records ledger', async () => {
      eventOrderRepo.findOneBy.mockResolvedValue(order());
      txRepo.findOneBy.mockResolvedValue(null);
      stripeInstance.webhooks.constructEvent.mockReturnValue(sessionEvent());

      await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(eventOrderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'paid',
          stripePaymentIntentId: 'pi_evt_123',
        }),
      );
      // 2 ingressos → 2 registrations
      expect(eventRegistrationRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ orderId: uuid(60), status: 'confirmed' }),
        ]),
      );
      const savedRegs = eventRegistrationRepo.save.mock.calls[0][0];
      expect(savedRegs).toHaveLength(2);
      expect(savedRegs[0].checkinToken).not.toBe(savedRegs[1].checkinToken);

      expect(ledgerService.recordTransaction).toHaveBeenCalledWith(
        uuid(1), // stripe_income (mock getOrCreateCommunityAccount)
        uuid(1),
        100, // R$ 100,00
        'Ingresso: Lote 1 — Evento Teste (comprador: Comprador (@buyer))',
        `event-ticket:${uuid(60)}`,
        expect.objectContaining({
          eventId: uuid(50),
          eventTitle: 'Evento Teste',
          ticketTypeId: uuid(51),
          ticketName: 'Lote 1',
          orderId: uuid(60),
          payerMemberId: uuid(9),
          payerHandle: 'buyer',
          communityProjectKey: 'devparana',
          externalActivationId: undefined,
        }),
      );
    });

    it('creates registrations with memberId=null when attendee has no site account', async () => {
      const orderNoAccount = order();
      eventOrderRepo.findOneBy.mockResolvedValue(orderNoAccount);
      txRepo.findOneBy.mockResolvedValue(null);
      stripeInstance.webhooks.constructEvent.mockReturnValue(sessionEvent());
      // Nenhum membro bate com os e-mails dos participantes
      memberRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(eventRegistrationRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            orderId: uuid(60),
            status: 'confirmed',
            memberId: null,
            attendeeEmail: 'x@x.dev',
          }),
        ]),
      );
      expect(ledgerService.recordTransaction).toHaveBeenCalled();
    });

    it('is idempotent: 2× completed → 1 order paid, 1 ledger transaction', async () => {
      const pendingOrder = order();
      eventOrderRepo.findOneBy
        .mockResolvedValueOnce(pendingOrder) // 1ª entrega: pending
        .mockResolvedValueOnce({ ...pendingOrder, status: 'paid' }); // 2ª: já paga
      txRepo.findOneBy.mockResolvedValue(null);
      stripeInstance.webhooks.constructEvent.mockReturnValue(sessionEvent());

      await service.handleWebhookEvent('sig', Buffer.from('body'));
      await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(eventOrderRepo.save).toHaveBeenCalledTimes(1);
      expect(eventRegistrationRepo.save).toHaveBeenCalledTimes(1);
      expect(ledgerService.recordTransaction).toHaveBeenCalledTimes(1);
    });

    it('skips ledger when event-ticket referenceId already exists', async () => {
      eventOrderRepo.findOneBy.mockResolvedValue(order());
      txRepo.findOneBy.mockResolvedValue({ id: uuid(70) }); // já registrado
      stripeInstance.webhooks.constructEvent.mockReturnValue(sessionEvent());

      await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(ledgerService.recordTransaction).not.toHaveBeenCalled();
    });

    it('ignores when the order does not exist', async () => {
      eventOrderRepo.findOneBy.mockResolvedValue(null);
      stripeInstance.webhooks.constructEvent.mockReturnValue(sessionEvent());

      await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(eventOrderRepo.save).not.toHaveBeenCalled();
      expect(ledgerService.recordTransaction).not.toHaveBeenCalled();
    });
  });

  describe('event ticket charge.refunded', () => {
    beforeEach(() => {
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    });

    afterEach(() => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    });

    const paidOrder = () => ({
      id: uuid(60),
      eventId: uuid(50),
      ticketTypeId: uuid(51),
      quantity: 2,
      memberId: uuid(9),
      totalCents: 10000,
      status: 'paid',
      stripePaymentIntentId: 'pi_evt_123',
    });

    const refundEvent = (amountRefunded: number) => ({
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_evt_123',
          payment_intent: 'pi_evt_123',
          amount_refunded: amountRefunded,
          refunds: {
            data: [{ id: 're_evt_1', amount: amountRefunded }],
          },
        },
      },
    });

    it('full refund: order → refunded, registrations refunded, quota returned, ledger reversal', async () => {
      eventOrderRepo.findOneBy.mockResolvedValue(paidOrder());
      eventRegistrationRepo.findBy.mockResolvedValue([
        { id: uuid(61) },
        { id: uuid(62) },
      ]);
      txRepo.find.mockResolvedValue([]); // nenhum reversal lançado ainda
      stripeInstance.webhooks.constructEvent.mockReturnValue(
        refundEvent(10000),
      );

      await service.handleWebhookEvent('sig', Buffer.from('body'));

      expect(eventOrderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'refunded' }),
      );
      expect(eventRegistrationRepo.update).toHaveBeenCalledWith(
        { orderId: uuid(60), status: 'confirmed' },
        { status: 'refunded' },
      );
      // quota devolvida com GREATEST (nunca negativo)
      expect(ticketTypeRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('GREATEST'),
        [2, uuid(51)],
      );
      // reversal da diferença (10000 - 0 já lançados)
      expect(ledgerService.recordTransaction).toHaveBeenCalledWith(
        uuid(1),
        uuid(1),
        100,
        expect.stringContaining('Estorno de ingressos'),
        expect.stringMatching(/^event-ticket-refund:/),
        expect.objectContaining({
          eventId: uuid(50),
          ticketTypeId: uuid(51),
          orderId: uuid(60),
          communityProjectKey: 'devparana',
          externalActivationId: undefined,
        }),
      );
    });

    it('does not duplicate ledger when admin refund already recorded the reversal', async () => {
      eventOrderRepo.findOneBy.mockResolvedValue(paidOrder());
      txRepo.find.mockResolvedValue([
        { id: uuid(71), amount: 50 }, // R$ 50 já estornados via endpoint admin
      ]);
      stripeInstance.webhooks.constructEvent.mockReturnValue(
        refundEvent(5000),
      );

      await service.handleWebhookEvent('sig', Buffer.from('body'));

      // amount_refunded (5000) - já lançado (5000) = 0 → nada a fazer
      expect(ledgerService.recordTransaction).not.toHaveBeenCalled();
      // refund parcial: order NÃO vai para refunded
      expect(eventOrderRepo.save).not.toHaveBeenCalled();
    });

    it('records only the gap between amount_refunded and already-recorded reversals', async () => {
      eventOrderRepo.findOneBy.mockResolvedValue(paidOrder());
      eventRegistrationRepo.findBy.mockResolvedValue([{ id: uuid(61) }]);
      txRepo.find.mockResolvedValue([{ id: uuid(71), amount: 50 }]);
      stripeInstance.webhooks.constructEvent.mockReturnValue(
        refundEvent(10000), // refund total, mas só R$ 50 lançados
      );

      await service.handleWebhookEvent('sig', Buffer.from('body'));

      // gap = 10000 - 5000 = 5000 cents = R$ 50
      expect(ledgerService.recordTransaction).toHaveBeenCalledWith(
        uuid(1),
        uuid(1),
        50,
        expect.any(String),
        expect.stringMatching(/^event-ticket-refund:/),
        expect.objectContaining({
          eventId: uuid(50),
          ticketTypeId: uuid(51),
          orderId: uuid(60),
          communityProjectKey: 'devparana',
          externalActivationId: undefined,
        }),
      );
      // refund total: order → refunded mesmo com parcial prévio
      expect(eventOrderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'refunded' }),
      );
    });

    it('falls through to donation flow when payment intent has no event order', async () => {
      eventOrderRepo.findOneBy.mockResolvedValue(null);
      txRepo.findOne.mockResolvedValue(null); // doação original não encontrada
      stripeInstance.webhooks.constructEvent.mockReturnValue(
        refundEvent(5000),
      );

      const result = await service.handleWebhookEvent(
        'sig',
        Buffer.from('body'),
      );

      expect(result).toEqual({ received: true });
      expect(eventOrderRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('createEventTicketCheckoutSession / createEventTicketRefund', () => {
    it('creates a hosted checkout session with event-ticket metadata', async () => {
      stripeInstance.checkout.sessions.create.mockResolvedValue({
        id: 'cs_evt_1',
        url: 'https://checkout.stripe.com/x',
      });

      const result = await service.createEventTicketCheckoutSession({
        productName: 'Evento — Lote 1',
        unitAmountCents: 5000,
        quantity: 2,
        email: 'buyer@example.com',
        metadata: {
          entityType: 'event-ticket',
          eventId: uuid(50),
          orderId: uuid(60),
          communityId: 'devparana',
        },
      });

      expect(result).toEqual({
        sessionId: 'cs_evt_1',
        url: 'https://checkout.stripe.com/x',
      });
      const params = stripeInstance.checkout.sessions.create.mock.calls[0][0];
      expect(params.mode).toBe('payment');
      expect(params.metadata.entityType).toBe('event-ticket');
      expect(params.line_items[0].quantity).toBe(2);
      expect(params.line_items[0].price_data.unit_amount).toBe(5000);
      expect(params.customer_email).toBe('buyer@example.com');
    });

    it('creates full refund without amount and partial with amount', async () => {
      await service.createEventTicketRefund('pi_1');
      expect(stripeInstance.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_1',
      });

      await service.createEventTicketRefund('pi_1', 2500);
      expect(stripeInstance.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_1',
        amount: 2500,
      });
    });
  });
});

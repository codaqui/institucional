import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { LedgerService } from '../ledger/ledger.service';
import { AccountType } from '../ledger/entities/account.entity';
import { Transaction } from '../ledger/entities/transaction.entity';

export type CheckoutInterval = 'month' | 'year';
export type CheckoutUiMode = 'embedded_page' | 'hosted';

export interface CreateCheckoutDto {
  amountCents: number;
  communityId: string;
  memberId?: string;
  githubHandle?: string;
  email?: string;
  /** Origem (scheme://host) já validada pelo controller; usada para montar return_url/cancel_url. */
  originUrl?: string;
  /**
   * Caminho relativo (ex: `/comunidades/tisocial/apoiar`) onde o Stripe
   * redireciona o usuário. Default: `/participe/apoiar`. Importante para
   * deploys whitelabel — preserva o contexto da comunidade no retorno.
   */
  returnPath?: string;
  /** 'embedded_page' renderiza na página; 'hosted' redireciona para Stripe (legado) */
  uiMode?: CheckoutUiMode;
  /** Se definido, cria uma assinatura recorrente */
  recurring?: { interval: CheckoutInterval };
}

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(
    private readonly ledgerService: LedgerService,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_fake');
  }

  /**
   * Cria sessão de checkout Stripe.
   *
   * Modos:
   *  - embedded (padrão): retorna { clientSecret } para EmbeddedCheckout
   *  - hosted: retorna { sessionId, url } para redirect
   *
   * Frequências:
   *  - sem recurring → mode: 'payment' (pagamento único)
   *  - com recurring → mode: 'subscription' (mensal/anual)
   *
   * Regras de acesso:
   *  - Até R$ 100 (único ou recorrente): aceito anônimo
   *  - Acima de R$ 100: requer memberId (controlado no controller)
   */
  async createCheckoutSession(dto: CreateCheckoutDto) {
    const {
      amountCents,
      communityId,
      memberId,
      githubHandle,
      uiMode = 'embedded_page',
      recurring,
      email,
      originUrl,
      returnPath,
    } = dto;

    if (amountCents <= 0)
      throw new BadRequestException('Amount must be positive');

    const baseUrl =
      originUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
    // Sanitiza o returnPath: tem que ser caminho relativo começando em `/` e
    // não pode ser protocol-relative (`//host`) — evita open redirect.
    const safePath =
      returnPath &&
      returnPath.startsWith('/') &&
      !returnPath.startsWith('//')
        ? returnPath
        : '/participe/apoiar';
    const returnUrl = `${baseUrl}${safePath}?status=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}${safePath}?status=cancelled`;

    const isSubscription = !!recurring;
    const mode: Stripe.Checkout.SessionCreateParams['mode'] = isSubscription
      ? 'subscription'
      : 'payment';

    const displayName = githubHandle ? `@${githubHandle}` : 'Doador';
    const communityName =
      communityId === 'tesouro-geral' ? 'Codaqui' : `Comunidade ${communityId}`;
    const productName = `Apoio à ${communityName}`;
    const typeDescription = isSubscription ? 'Assinatura' : 'Doação';
    const productDescription = memberId
      ? `${typeDescription} de ${displayName} via Portal Codaqui`
      : 'Doação anônima via Portal Codaqui';

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = {
      quantity: 1,
      price_data: {
        currency: 'brl',
        product_data: { name: productName, description: productDescription },
        unit_amount: amountCents,
        ...(isSubscription && {
          recurring: { interval: recurring.interval },
        }),
      },
    };

    const metadata: Record<string, string> = {
      communityId,
      amountCents: String(amountCents),
      isSubscription: String(isSubscription),
      ...(recurring && { interval: recurring.interval }),
      ...(memberId && { memberId }),
      ...(githubHandle && { githubHandle }),
    };

    const sessionParams = {
      line_items: [lineItem],
      mode,
      metadata,
      payment_method_configuration: process.env.STRIPE_PMC_ID || undefined,
      ...(isSubscription && { subscription_data: { metadata } }),
      ...(email && { customer_email: email }),
      ...(uiMode === 'embedded_page'
        ? { ui_mode: 'embedded_page' as const, return_url: returnUrl }
        : { success_url: returnUrl, cancel_url: cancelUrl }),
    } as Stripe.Checkout.SessionCreateParams;

    const session = await this.stripe.checkout.sessions.create(sessionParams);

    if (uiMode === 'embedded_page') {
      return { clientSecret: session.client_secret };
    }
    return { sessionId: session.id, url: session.url };
  }

  // ---------------------------------------------------------------------------
  // Webhook handlers
  // ---------------------------------------------------------------------------

  async handleWebhookEvent(signature: string, payload: Buffer) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const isDev = process.env.NODE_ENV === 'development';
    let event: Stripe.Event;

    try {
      if (!webhookSecret) {
        throw new Error(
          'STRIPE_WEBHOOK_SECRET não definido. ' +
            (isDev
              ? 'Use o Stripe CLI: stripe listen --forward-to localhost:3001/stripe/webhook'
              : 'Configure o secret em produção.'),
        );
      }
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      this.logger.error(
        `Falha na verificação da assinatura do webhook: ${message}`,
      );
      throw new BadRequestException(`Webhook Error: ${message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object);
        break;
      case 'charge.refunded':
        await this.handleChargeRefunded(event.data.object);
        break;
      case 'charge.succeeded':
      case 'charge.updated':
        await this.handleChargeFinalized(event.data.object);
        break;
      case 'customer.subscription.deleted':
        this.logger.log(`Assinatura cancelada: ${event.data.object.id}`);
        break;
      default:
        this.logger.debug(`Evento ignorado: ${event.type}`);
    }

    return { received: true };
  }

  /**
   * checkout.session.completed — dispara para payments e subscriptions (1ª cobrança).
   * Para subscriptions, o ledger é atualizado aqui (1ª cobrança) e depois em
   * invoice.payment_succeeded (cobranças seguintes).
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const isSubscription = session.metadata?.isSubscription === 'true';

    // Evita duplicata: para assinaturas, ignoramos o Checkout Session e
    // registramos a doação apenas quando a Fatura (Invoice) for paga.
    if (isSubscription) {
      this.logger.debug(
        'checkout.session.completed: Ignorado para assinatura (transferido para invoice.payment_succeeded)',
      );
      return;
    }

    const communityId = session.metadata?.communityId ?? 'tesouro-geral';
    const memberId = session.metadata?.memberId;

    const amountCents = session.amount_total ?? 0;
    if (amountCents <= 0) {
      this.logger.warn(
        `Webhook recebido com amount_total inválido: ${amountCents}`,
      );
      return;
    }

    const amountReais = amountCents / 100;

    // payment_intent (pi_xxx) é o ID que aparece no Stripe Dashboard.
    // Para subscriptions, pode ser null na session — usamos session.id como fallback.
    let paymentIntentId: string;
    if (typeof session.payment_intent === 'string') {
      paymentIntentId = session.payment_intent;
    } else if (session.subscription) {
      paymentIntentId = `sub_${(session.subscription as string).slice(4)}_first`; // fallback legível
    } else {
      paymentIntentId = session.id;
    }

    try {
      await this.recordDonationToLedger({
        communityId,
        memberId,
        githubHandle: session.metadata?.githubHandle,
        amountReais,
        sessionId: session.id,
        paymentIntentId,
        isSubscription,
        interval: session.metadata?.interval as CheckoutInterval | undefined,
      });
      // Captura inline da taxa Stripe (resolve race com charge.succeeded)
      if (typeof session.payment_intent === 'string') {
        await this.captureFeeFromPaymentIntent(session.payment_intent);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(`Falha ao registrar doação no Ledger: ${message}`);
    }
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
    // A 1ª cobrança (subscription_create) e as subsequentes (subscription_cycle)
    // agora são processadas magicamente aqui.

    // Stripe SDK types for Invoice/Subscription can be tricky depending on version/expansion
    const invoiceAny = invoice as any;
    const subscriptionId =
      typeof invoiceAny.subscription === 'string'
        ? invoiceAny.subscription
        : invoiceAny.subscription?.id;

    const subscription = subscriptionId
      ? await this.stripe.subscriptions.retrieve(subscriptionId)
      : null;

    if (!subscription) {
      this.logger.warn('invoice.payment_succeeded sem subscription');
      return;
    }

    const communityId = subscription.metadata?.communityId ?? 'tesouro-geral';
    const memberId = subscription.metadata?.memberId;
    const amountCents = invoice.amount_paid;
    if (amountCents <= 0) return;

    const amountReais = amountCents / 100;
    const paymentIntentId =
      (typeof invoiceAny.payment_intent === 'string'
        ? invoiceAny.payment_intent
        : invoiceAny.payment_intent?.id) ?? invoice.id;

    try {
      await this.recordDonationToLedger({
        communityId,
        memberId,
        githubHandle: subscription.metadata?.githubHandle,
        amountReais,
        sessionId: invoice.id,
        paymentIntentId,
        isSubscription: true,
        interval: subscription.metadata?.interval as
          | CheckoutInterval
          | undefined,
      });
      // Captura inline da taxa Stripe (resolve race com charge.succeeded)
      if (paymentIntentId.startsWith('pi_')) {
        await this.captureFeeFromPaymentIntent(paymentIntentId);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(`Falha ao registrar renovação no Ledger: ${message}`);
    }
  }

  /**
   * charge.refunded — disparado quando um reembolso (parcial ou total) é
   * processado no Stripe. Cria uma transação reversa no ledger (débito da
   * comunidade → crédito da conta externa Stripe), preservando histórico e
   * partidas dobradas. Não modifica nem deleta a doação original.
   *
   * Idempotência: usa o `refund.id` (re_xxx) como referenceId. Reembolsos
   * múltiplos no mesmo charge geram transações distintas (cada refund tem id único).
   */
  private async handleChargeRefunded(charge: Stripe.Charge) {
    const refunds = charge.refunds?.data ?? [];
    if (refunds.length === 0) {
      this.logger.warn(
        `charge.refunded sem refunds[]: ${charge.id} — ignorando`,
      );
      return;
    }

    // Localiza tx original pelo payment_intent (referenceId padrão das doações)
    const paymentIntentId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id;

    if (!paymentIntentId) {
      this.logger.warn(
        `charge.refunded sem payment_intent: ${charge.id} — não é possível localizar doação original`,
      );
      return;
    }

    const originalTx = await this.txRepo.findOne({
      where: { referenceId: paymentIntentId },
      relations: ['sourceAccount', 'destinationAccount'],
    });

    if (!originalTx) {
      this.logger.warn(
        `charge.refunded: doação original não encontrada para ${paymentIntentId} — ignorando`,
      );
      return;
    }

    for (const refund of refunds) {
      // Idempotência: ignora se este refund já foi registrado
      const existing = await this.txRepo.findOneBy({ referenceId: refund.id });
      if (existing) {
        this.logger.debug(
          `Webhook idempotente: refund ${refund.id} já registrado, ignorando.`,
        );
        continue;
      }

      const amountReais = (refund.amount ?? 0) / 100;
      if (amountReais <= 0) {
        this.logger.warn(`Refund ${refund.id} com valor inválido — ignorando`);
        continue;
      }

      // Reversa: source = destino original (comunidade), destino = origem original (stripe_income)
      const description = `Estorno de doação — Refund ${refund.id} (referente a ${paymentIntentId})`;

      try {
        await this.ledgerService.recordTransaction(
          originalTx.destinationAccount.id,
          originalTx.sourceAccount.id,
          amountReais,
          description,
          refund.id,
        );
        this.logger.log(
          `↩️  Estorno R$ ${amountReais.toFixed(2)} ← ${originalTx.destinationAccount.name} | refund: ${refund.id}`,
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Erro desconhecido';
        this.logger.error(
          `Falha ao registrar estorno ${refund.id}: ${message}`,
        );
      }
    }
  }

  /**
   * charge.succeeded / charge.updated — fallback para registrar a taxa Stripe
   * caso a captura inline (em handleCheckoutCompleted / handleInvoicePaymentSucceeded)
   * tenha falhado (ex: BT ainda não pronto naquele instante).
   *
   * Idempotência: `stripe-fee:<txn_id>` garante que múltiplas execuções não dupliquem.
   */
  private async handleChargeFinalized(charge: Stripe.Charge) {
    const btId =
      typeof charge.balance_transaction === 'string'
        ? charge.balance_transaction
        : charge.balance_transaction?.id;

    if (!btId) {
      this.logger.debug(
        `charge ${charge.id} sem balance_transaction (ainda pendente) — ignorando`,
      );
      return;
    }

    // Idempotency check ANTES do retrieve (economiza API call em duplicatas)
    const feeReferenceId = `stripe-fee:${btId}`;
    const existingFee = await this.txRepo.findOneBy({
      referenceId: feeReferenceId,
    });
    if (existingFee) {
      this.logger.debug(
        `Webhook idempotente: taxa ${feeReferenceId} já registrada, ignorando.`,
      );
      return;
    }

    const paymentIntentId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id;

    if (!paymentIntentId) {
      this.logger.warn(
        `charge ${charge.id} sem payment_intent — não é possível localizar doação`,
      );
      return;
    }

    let bt: Stripe.BalanceTransaction;
    try {
      bt = await this.stripe.balanceTransactions.retrieve(btId);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(
        `Falha ao recuperar BalanceTransaction ${btId}: ${message}`,
      );
      return;
    }

    await this.recordStripeFee(charge.id, paymentIntentId, bt);
  }

  /**
   * Captura inline a taxa Stripe a partir de um payment_intent ID.
   * Faz retrieve do PI com expand do latest_charge e seu balance_transaction.
   * Best-effort: se BT ainda não estiver pronto, loga e ignora — o
   * handler `charge.succeeded`/`charge.updated` cuidará como fallback.
   */
  private async captureFeeFromPaymentIntent(paymentIntentId: string) {
    let pi: Stripe.PaymentIntent;
    try {
      pi = await this.stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge.balance_transaction'],
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.warn(
        `captureFee: falha ao recuperar PI ${paymentIntentId}: ${message}`,
      );
      return;
    }

    const latestCharge = pi.latest_charge as Stripe.Charge | string | null;
    if (!latestCharge || typeof latestCharge === 'string') {
      this.logger.debug(
        `captureFee: PI ${paymentIntentId} sem latest_charge expandido — fallback aguardando charge.succeeded`,
      );
      return;
    }

    const bt = latestCharge.balance_transaction as
      | Stripe.BalanceTransaction
      | string
      | null;
    if (!bt || typeof bt === 'string') {
      this.logger.debug(
        `captureFee: charge ${latestCharge.id} sem balance_transaction expandido — fallback aguardando charge.succeeded`,
      );
      return;
    }

    await this.recordStripeFee(latestCharge.id, paymentIntentId, bt);
  }

  /**
   * Core idempotente do registro da taxa no ledger.
   * Idempotência: `stripe-fee:<txn_id>`.
   */
  private async recordStripeFee(
    chargeId: string,
    paymentIntentId: string,
    bt: Stripe.BalanceTransaction,
  ) {
    const feeReferenceId = `stripe-fee:${bt.id}`;
    const existingFee = await this.txRepo.findOneBy({
      referenceId: feeReferenceId,
    });
    if (existingFee) {
      this.logger.debug(
        `Webhook idempotente: taxa ${feeReferenceId} já registrada, ignorando.`,
      );
      return;
    }

    const originalTx = await this.txRepo.findOne({
      where: { referenceId: paymentIntentId },
      relations: ['sourceAccount', 'destinationAccount'],
    });

    if (!originalTx) {
      this.logger.warn(
        `recordStripeFee: doação original não encontrada para ${paymentIntentId} (charge ${chargeId}) — ignorando taxa`,
      );
      return;
    }

    const feeCents = bt.fee ?? 0;
    if (feeCents <= 0) {
      this.logger.debug(
        `recordStripeFee: charge ${chargeId} sem taxa (fee=${feeCents}) — ignorando`,
      );
      return;
    }

    const feeReais = feeCents / 100;

    const stripeFeesAccount =
      await this.ledgerService.getOrCreateCommunityAccount(
        'stripe_fees',
        'Stripe Fees (External)',
        AccountType.EXTERNAL,
      );

    const description = `Taxa Stripe — Charge ${chargeId} (referente a ${paymentIntentId})`;

    try {
      await this.ledgerService.recordTransaction(
        originalTx.destinationAccount.id,
        stripeFeesAccount.id,
        feeReais,
        description,
        feeReferenceId,
      );
      this.logger.log(
        `💸 Taxa Stripe R$ ${feeReais.toFixed(2)} ← ${originalTx.destinationAccount.name} | bt: ${bt.id} | pi: ${paymentIntentId}`,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(
        `Falha ao registrar taxa Stripe ${feeReferenceId}: ${message}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Ledger helper
  // ---------------------------------------------------------------------------

  private async recordDonationToLedger(params: {
    communityId: string;
    memberId?: string;
    githubHandle?: string;
    amountReais: number;
    sessionId: string;
    paymentIntentId: string;
    isSubscription: boolean;
    interval?: CheckoutInterval;
  }) {
    const {
      communityId,
      memberId,
      githubHandle,
      amountReais,
      sessionId,
      paymentIntentId,
      isSubscription,
      interval,
    } = params;

    const stripeIncomeAccount =
      await this.ledgerService.getOrCreateCommunityAccount(
        'stripe_income',
        'Stripe Income (External)',
        AccountType.EXTERNAL,
      );

    const destAccount = await this.ledgerService.getOrCreateCommunityAccount(
      communityId,
      `Comunidade: ${communityId}`,
    );

    // Idempotência: ignora se paymentIntentId já foi registrado no ledger
    const existing = await this.txRepo.findOneBy({
      referenceId: paymentIntentId,
    });
    if (existing) {
      this.logger.warn(
        `Webhook idempotente: transação ${paymentIntentId} já registrada, ignorando.`,
      );
      return;
    }

    const displayName = githubHandle
      ? `@${githubHandle}`
      : (memberId ?? 'anônimo');

    let typeLabel: string;
    if (isSubscription) {
      typeLabel = `Assinatura ${interval === 'year' ? 'anual' : 'mensal'}`;
    } else {
      typeLabel = 'Doação';
    }

    // description inclui sessionId (cs_test/in_xxx) para detectar modo test/live no frontend
    const description = memberId
      ? `${typeLabel} de ${displayName} [${memberId}] — Sessão ${sessionId}`
      : `${typeLabel} anônima — Sessão ${sessionId}`;

    await this.ledgerService.recordTransaction(
      stripeIncomeAccount.id,
      destAccount.id,
      amountReais,
      description,
      paymentIntentId, // pi_xxx — ID visível no Stripe Dashboard
    );

    const memberLabel = memberId ? ` | membro: ${memberId}` : ' (anônimo)';
    this.logger.log(
      `✅ ${typeLabel} R$ ${amountReais.toFixed(2)} → ${communityId} | pi: ${paymentIntentId}${memberLabel}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  /**
   * Lista doações do membro logado (pagamentos únicos + assinaturas).
   * Busca por memberId na description (sempre presente quando logado).
   */
  async getMyDonations(memberId: string): Promise<
    {
      id: string;
      amount: number;
      description: string;
      community: string;
      referenceId: string;
      createdAt: Date;
    }[]
  > {
    const rows = await this.txRepo
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.sourceAccount', 'src')
      .leftJoinAndSelect('tx.destinationAccount', 'dst')
      .where('tx.description LIKE :pattern', { pattern: `%[${memberId}]%` })
      .orderBy('tx.createdAt', 'DESC')
      .getMany();

    return rows.map((tx) => ({
      id: tx.id,
      amount: Number.parseFloat(String(tx.amount)),
      description: tx.description,
      community: tx.destinationAccount?.name ?? 'Comunidade',
      referenceId: tx.referenceId ?? '',
      createdAt: tx.createdAt,
    }));
  }

  /**
   * Lista assinaturas ativas do membro.
   * Busca no Stripe por subscriptions onde metadata.memberId === memberId.
   *
   * Retorna apenas assinaturas com status active ou past_due (cobráveis).
   * Usando search API do Stripe (disponível no API versão 2022-11-15+).
   */
  async getMySubscriptions(memberId: string): Promise<
    {
      id: string;
      status: string;
      interval: string;
      amount: number;
      currency: string;
      communityId: string;
      currentPeriodEnd: number;
      cancelAtPeriodEnd: boolean;
    }[]
  > {
    // Sanitize UUID to prevent Stripe Search API injection
    const safeMemberId = memberId.replaceAll(/[^a-f0-9-]/gi, '');
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        safeMemberId,
      )
    ) {
      throw new BadRequestException('ID de membro inválido.');
    }

    // Stripe Search API — busca por metadata
    const result = await this.stripe.subscriptions.search({
      query: `metadata['memberId']:'${safeMemberId}' AND status:'active'`,
      limit: 20,
    });

    // Inclui também past_due (assinaturas com falha de pagamento mas ainda ativas)
    const pastDue = await this.stripe.subscriptions.search({
      query: `metadata['memberId']:'${safeMemberId}' AND status:'past_due'`,
      limit: 20,
    });

    const all = [...result.data, ...pastDue.data];

    return all.map((sub) => {
      const item = sub.items.data[0];
      return {
        id: sub.id,
        status: sub.status,
        interval: item?.price?.recurring?.interval ?? 'month',
        amount: item?.price?.unit_amount ?? 0,
        currency: item?.price?.currency ?? 'brl',
        communityId: sub.metadata?.communityId ?? 'tesouro-geral',
        currentPeriodEnd: item?.current_period_end ?? 0,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      };
    });
  }

  /**
   * Cancela assinatura ao final do período atual (não imediatamente).
   * Segue o padrão recomendado pela Stripe: cancel_at_period_end: true.
   * O membro não perde o período que já pagou.
   *
   * Verifica que o memberId da assinatura corresponde ao solicitante
   * para evitar que um membro cancele a assinatura de outro.
   */
  async cancelSubscription(
    subscriptionId: string,
    memberId: string,
  ): Promise<{ cancelAtPeriodEnd: boolean; currentPeriodEnd: number }> {
    const sub = await this.stripe.subscriptions.retrieve(subscriptionId);

    if (sub.metadata?.memberId !== memberId) {
      throw new BadRequestException('Assinatura não pertence a este membro.');
    }

    if (sub.status === 'canceled') {
      throw new BadRequestException('Esta assinatura já foi cancelada.');
    }

    const updated = await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true, // Stripe best practice: não cancela imediatamente
    });

    const updatedItem = updated.items.data[0];
    const currentPeriodEnd = updatedItem?.current_period_end ?? 0;
    this.logger.log(
      `Assinatura ${subscriptionId} marcada para cancelar em ${new Date(currentPeriodEnd * 1000).toLocaleDateString('pt-BR')} (membro: ${memberId})`,
    );

    return {
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      currentPeriodEnd,
    };
  }
}

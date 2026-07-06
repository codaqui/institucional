import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { LedgerService } from '../ledger/ledger.service';
import { AccountType } from '../ledger/entities/account.entity';
import { Transaction } from '../ledger/entities/transaction.entity';
import { ClubService } from '../club/club.service';
import { CompaniesService } from '../companies/companies.service';

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

export interface MemberSummary {
  memberId: string;
  githubHandle: string;
}

/** @deprecated Use MemberSummary */
export type ClubMemberSummary = MemberSummary;
/** @deprecated Use MemberSummary */
export type BusinessMemberSummary = MemberSummary;

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(
    private readonly ledgerService: LedgerService,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    private readonly clubService: ClubService,
    private readonly companiesService: CompaniesService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_fake');
  }

  /**
   * Sanitiza returnPath: tem que ser caminho relativo começando em `/` e
   * não pode ser protocol-relative (`//host`) — evita open redirect.
   */
  private sanitizeReturnPath(returnPath: string | undefined): string {
    if (!returnPath) return '/participe/apoiar';
    if (!returnPath.startsWith('/')) return '/participe/apoiar';
    if (returnPath.startsWith('//')) return '/participe/apoiar';
    return returnPath;
  }

  private buildLineItem(
    amountCents: number,
    productName: string,
    productDescription: string,
    isSubscription: boolean,
    recurring: CreateCheckoutDto['recurring'],
  ): Stripe.Checkout.SessionCreateParams.LineItem {
    return {
      quantity: 1,
      price_data: {
        currency: 'brl',
        product_data: { name: productName, description: productDescription },
        unit_amount: amountCents,
        ...(isSubscription &&
          recurring && {
            recurring: { interval: recurring.interval },
          }),
      },
    };
  }

  private buildCheckoutMetadata(
    dto: CreateCheckoutDto,
    isSubscription: boolean,
  ): Record<string, string> {
    const { amountCents, communityId, memberId, githubHandle, recurring } = dto;
    return {
      communityId,
      amountCents: String(amountCents),
      isSubscription: String(isSubscription),
      ...(recurring && { interval: recurring.interval }),
      ...(memberId && { memberId }),
      ...(githubHandle && { githubHandle }),
    };
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
    const safePath = this.sanitizeReturnPath(returnPath);
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

    const lineItem = this.buildLineItem(
      amountCents,
      productName,
      productDescription,
      isSubscription,
      recurring,
    );

    const metadata = this.buildCheckoutMetadata(dto, isSubscription);

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
        await this.handleSubscriptionDeleted(event.data.object);
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

    if (await this.processBusinessSubscriptionCheckout(session, isSubscription)) {
      return;
    }

    // Evita duplicata: para assinaturas PF, ignoramos o Checkout Session e
    // registramos a doação apenas quando a Fatura (Invoice) for paga.
    if (isSubscription) {
      this.logger.debug(
        'checkout.session.completed: Ignorado para assinatura (transferido para invoice.payment_succeeded)',
      );
      return;
    }

    const amountReais = this.resolveCheckoutAmountReais(session.amount_total);
    if (amountReais === null) {
      this.logger.warn(
        `Webhook recebido com amount_total inválido: ${session.amount_total ?? 0}`,
      );
      return;
    }

    const checkoutMetadata = this.resolveCheckoutDonationMetadata(session, amountReais, isSubscription);

    try {
      await this.recordDonationToLedger(checkoutMetadata);
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

    const subscriptionId = this.resolveInvoiceSubscriptionId(invoice);
    const subscription = subscriptionId
      ? await this.stripe.subscriptions.retrieve(subscriptionId)
      : null;

    if (!subscription) {
      this.logger.warn('invoice.payment_succeeded sem subscription');
      return;
    }
    const resolvedSubscriptionId = subscription.id;

    const communityId = subscription.metadata?.communityId ?? 'tesouro-geral';
    const memberId = subscription.metadata?.memberId;
    const companyId = subscription.metadata?.companyId;
    const entityType = subscription.metadata?.entityType;
    const amountCents = invoice.amount_paid;
    if (amountCents <= 0) return;

    const amountReais = amountCents / 100;
    const paymentIntentId = this.resolveInvoicePaymentIntentId(invoice);

    // Para empresas, busca o nome para exibição na descrição do ledger
    const companyName = await this.resolveCompanyName(entityType, companyId);

    try {
      await this.recordDonationToLedger({
        communityId,
        memberId,
        githubHandle: subscription.metadata?.githubHandle,
        companyId: entityType === 'business' ? companyId : undefined,
        companyName,
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

    // Crédito de SortCoins roda mesmo se o ledger falhar (evita perder benefício ao apoiador).
    try {
      await this.processInvoiceCoinCredit({
        entityType,
        subscription,
        subscriptionId,
        resolvedSubscriptionId,
        amountReais,
        paymentIntentId,
        companyId,
        memberId,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(`Falha ao creditar SortCoins da invoice: ${message}`);
    }
  }

  /**
   * customer.subscription.deleted — assinatura cancelada.
   * Para empresas: suspende a empresa e congela a carteira.
   * Para membros PF: congela os SortCoins da carteira.
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    this.logger.log(`Assinatura cancelada: ${subscription.id}`);

    const entityType = subscription.metadata?.entityType;
    const memberId = subscription.metadata?.memberId;

    try {
      if (entityType === 'business') {
        await this.companiesService.suspendFromSubscriptionDeleted(subscription.id);
      } else if (memberId) {
        await this.clubService.freezeCoin(memberId);
      }
    } catch (err) {
      this.logger.error(
        `Erro ao processar cancelamento de assinatura ${subscription.id}: ${err}`,
      );
    }
  }

  /**
   * Cria sessão de checkout Stripe para assinatura mensal de empresa (CLUB Business).
   * Requer que o membro seja o responsável pela empresa.
   */
  async createCompanyCheckoutSession(
    companyId: string,
    memberId: string,
    originUrl?: string,
    subscriptionAmountCents?: number,
  ) {
    const company = await this.companiesService.findById(companyId);
    if (company?.responsibleMemberId !== memberId) {
      throw new ForbiddenException('Sem permissão para criar checkout desta empresa');
    }

    const MIN_AMOUNT_CENTS = 20_000; // R$ 200,00
    const configuredAmount = company.subscriptionAmountCents;
    let amountCents = MIN_AMOUNT_CENTS;
    if (subscriptionAmountCents && subscriptionAmountCents >= MIN_AMOUNT_CENTS) {
      amountCents = subscriptionAmountCents;
    } else if (configuredAmount && configuredAmount >= MIN_AMOUNT_CENTS) {
      amountCents = configuredAmount;
    }

    if (company.subscriptionAmountCents !== amountCents) {
      await this.companiesService.setSubscriptionAmount(companyId, amountCents);
    }

    const baseUrl = originUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
    const returnUrl = `${baseUrl}/participe/apoiar?status=success&session_id={CHECKOUT_SESSION_ID}`;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'brl',
            product_data: {
              name: `CLUB Business — ${company.name}`,
              description: `Assinatura mensal Codaqui Business para ${company.name}`,
            },
            unit_amount: amountCents,
            recurring: { interval: 'month' },
          },
        },
      ],
      metadata: {
        entityType: 'business',
        companyId,
        memberId,
        isSubscription: 'true',
      },
      subscription_data: {
        metadata: {
          entityType: 'business',
          companyId,
          memberId,
          isSubscription: 'true',
        },
      },
      ...(company.stripeCustomerId ? { customer: company.stripeCustomerId } : {}),
      ui_mode: 'embedded_page' as const,
      return_url: returnUrl,
    };

    const session = await this.stripe.checkout.sessions.create(sessionParams);
    return { clientSecret: session.client_secret };
  }

  /**
   * Registra reembolso no ledger como transação reversa (conta da
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
    companyId?: string;
    companyName?: string;
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
      companyId,
      companyName,
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

    let typeLabel: string;
    if (companyId) {
      // Doação empresarial — prefixo detectável pelo frontend
      typeLabel = `Assinatura mensal empresarial`;
    } else if (isSubscription) {
      typeLabel = `Assinatura ${interval === 'year' ? 'anual' : 'mensal'}`;
    } else {
      typeLabel = 'Doação';
    }

    // description inclui sessionId (cs_test/in_xxx) para detectar modo test/live no frontend
    let description: string;
    if (companyId) {
      // formato: "Assinatura mensal empresarial — Empresa: Nome [companyId] — Sessão in_xxx"
      const nameLabel = companyName ?? companyId;
      description = `${typeLabel} — Empresa: ${nameLabel} [${companyId}] — Sessão ${sessionId}`;
    } else {
      const displayName = githubHandle
        ? `@${githubHandle}`
        : (memberId ?? 'anônimo');
      description = memberId
        ? `${typeLabel} de ${displayName} [${memberId}] — Sessão ${sessionId}`
        : `${typeLabel} anônima — Sessão ${sessionId}`;
    }

    await this.ledgerService.recordTransaction(
      stripeIncomeAccount.id,
      destAccount.id,
      amountReais,
      description,
      paymentIntentId, // pi_xxx — ID visível no Stripe Dashboard
    );

    let entityLabel = ' (anônimo)';
    if (companyId) {
      entityLabel = ` | empresa: ${companyName ?? companyId}`;
    } else if (memberId) {
      entityLabel = ` | membro: ${memberId}`;
    }
    this.logger.log(
      `✅ ${typeLabel} R$ ${amountReais.toFixed(2)} → ${communityId} | pi: ${paymentIntentId}${entityLabel}`,
    );
  }

  private resolveSessionPaymentIntentId(session: Stripe.Checkout.Session): string {
    if (typeof session.payment_intent === 'string') {
      return session.payment_intent;
    }
    if (typeof session.subscription === 'string') {
      return `sub_${session.subscription.slice(4)}_first`;
    }
    return session.id;
  }

  private resolveCheckoutAmountReais(amountTotal: number | null): number | null {
    if (!amountTotal || amountTotal <= 0) return null;
    return amountTotal / 100;
  }

  private resolveCheckoutDonationMetadata(
    session: Stripe.Checkout.Session,
    amountReais: number,
    isSubscription: boolean,
  ): {
    communityId: string;
    memberId?: string;
    githubHandle?: string;
    amountReais: number;
    sessionId: string;
    paymentIntentId: string;
    isSubscription: boolean;
    interval?: CheckoutInterval;
  } {
    return {
      communityId: session.metadata?.communityId ?? 'tesouro-geral',
      memberId: session.metadata?.memberId,
      githubHandle: session.metadata?.githubHandle,
      amountReais,
      sessionId: session.id,
      paymentIntentId: this.resolveSessionPaymentIntentId(session),
      isSubscription,
      interval: session.metadata?.interval as CheckoutInterval | undefined,
    };
  }

  private resolveInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
    const invoiceAny = invoice as any;
    if (typeof invoiceAny.subscription === 'string') {
      return invoiceAny.subscription;
    }
    return invoiceAny.subscription?.id ?? null;
  }

  private resolveInvoicePaymentIntentId(invoice: Stripe.Invoice): string {
    const invoiceAny = invoice as any;
    if (typeof invoiceAny.payment_intent === 'string') {
      return invoiceAny.payment_intent;
    }
    return invoiceAny.payment_intent?.id ?? invoice.id;
  }

  private async resolveCompanyName(
    entityType: string | undefined,
    companyId: string | undefined,
  ): Promise<string | undefined> {
    if (entityType !== 'business' || !companyId) return undefined;
    try {
      const company = await this.companiesService.findById(companyId);
      return company?.name;
    } catch {
      return undefined;
    }
  }

  private async processBusinessSubscriptionCheckout(
    session: Stripe.Checkout.Session,
    isSubscription: boolean,
  ): Promise<boolean> {
    if (!(isSubscription && session.metadata?.entityType === 'business')) {
      return false;
    }

    const companyId = session.metadata?.companyId;
    const customerId = typeof session.customer === 'string' ? session.customer : null;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
    if (companyId && customerId) {
      await this.companiesService.setStripeCustomer(companyId, customerId);
    }
    if (companyId && subscriptionId) {
      await this.companiesService.setStripeSubscription(companyId, subscriptionId);
    }
    this.logger.debug(
      `checkout.session.completed (business subscription): customer=${customerId} sub=${subscriptionId} salvos para company=${companyId}`,
    );
    return true;
  }

  private async processInvoiceCoinCredit(args: {
    entityType: string | undefined;
    subscription: Stripe.Subscription;
    subscriptionId: string | null;
    resolvedSubscriptionId: string;
    amountReais: number;
    paymentIntentId: string;
    companyId: string | undefined;
    memberId: string | undefined;
  }): Promise<void> {
    if (args.entityType === 'business') {
      const customerId = this.resolveSubscriptionCustomerId(args.subscription);
      if (!customerId) {
        this.logger.warn(
          `invoice.payment_succeeded sem customer para assinatura empresarial ${args.subscriptionId}`,
        );
        return;
      }
      await this.companiesService.activateFromInvoice(
        args.resolvedSubscriptionId,
        customerId,
        args.amountReais,
        `stripe-pi:${args.paymentIntentId}`,
        args.companyId,
      );
      return;
    }

    if (args.memberId) {
      await this.clubService.creditFromInvoice(
        args.memberId,
        args.amountReais,
        `stripe-pi:${args.paymentIntentId}`,
      );
    }
  }

  private resolveSubscriptionCustomerId(subscription: Stripe.Subscription): string | null {
    if (typeof subscription.customer === 'string') return subscription.customer;
    return subscription.customer?.id ?? null;
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  /**
   * Lista doações do membro logado (pagamentos únicos + assinaturas).
   * Busca por memberId na description (sempre presente quando logado).
   */
  async getMyDonations(
    memberId: string,
    page = 1,
    limit = 20,
  ): Promise<
    {
      items: {
        id: string;
        amount: number;
        description: string;
        community: string;
        referenceId: string;
        createdAt: Date;
      }[];
      total: number;
      page: number;
      limit: number;
    }
  > {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const requestedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 20;
    const safeLimit = Math.min(requestedLimit, 100);
    const skip = (safePage - 1) * safeLimit;

    const rows = await this.txRepo
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.sourceAccount', 'src')
      .leftJoinAndSelect('tx.destinationAccount', 'dst')
      .where('tx.description LIKE :pattern', { pattern: `%[${memberId}]%` })
      .orderBy('tx.createdAt', 'DESC')
      .skip(skip)
      .take(safeLimit)
      .getMany();

    const total = await this.txRepo
      .createQueryBuilder('tx')
      .where('tx.description LIKE :pattern', { pattern: `%[${memberId}]%` })
      .getCount();

    return {
      items: rows.map((tx) => ({
        id: tx.id,
        amount: Number.parseFloat(String(tx.amount)),
        description: tx.description,
        community: tx.destinationAccount?.name ?? 'Comunidade',
        referenceId: tx.referenceId ?? '',
        createdAt: tx.createdAt,
      })),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  /**
   * Lista assinaturas ativas do membro.
   * Busca no Stripe por subscriptions onde metadata.memberId === memberId.
   *
   * Retorna apenas assinaturas com status active ou past_due (cobráveis).
   * Usando search API do Stripe (disponível no API versão 2022-11-15+).
   */
  async getMySubscriptions(
    memberId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    items: {
      id: string;
      status: string;
      interval: string;
      amount: number;
      currency: string;
      communityId: string;
      entityType: 'member' | 'business';
      companyId: string | null;
      currentPeriodEnd: number;
      cancelAtPeriodEnd: boolean;
    }[];
    total: number;
    page: number;
    limit: number;
  }> {
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
    const deduped = Array.from(new Map(all.map((sub) => [sub.id, sub])).values());
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const requestedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 20;
    const safeLimit = Math.min(requestedLimit, 100);
    const start = (safePage - 1) * safeLimit;
    const paged = deduped.slice(start, start + safeLimit);

    return {
      items: paged.map((sub) => {
      const item = sub.items.data[0];
      return {
        id: sub.id,
        status: sub.status,
        interval: item?.price?.recurring?.interval ?? 'month',
        amount: item?.price?.unit_amount ?? 0,
        currency: item?.price?.currency ?? 'brl',
        communityId: sub.metadata?.communityId ?? 'tesouro-geral',
        entityType:
          sub.metadata?.entityType === 'business' || !!sub.metadata?.companyId
            ? 'business'
            : 'member',
        companyId: sub.metadata?.companyId ?? null,
        currentPeriodEnd: item?.current_period_end ?? 0,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      };
      }),
      total: deduped.length,
      page: safePage,
      limit: safeLimit,
    };
  }

  /**
   * Busca todas as subscriptions ativas ou com pagamento pendente no Stripe.
   */
  private async fetchActiveSubscriptions(): Promise<Stripe.Subscription[]> {
    const [active, pastDue] = await Promise.all([
      this.stripe.subscriptions.list({ status: 'active', limit: 100 }),
      this.stripe.subscriptions.list({ status: 'past_due', limit: 100 }),
    ]);
    return [...active.data, ...pastDue.data];
  }

  /**
   * Deduplica subscriptions por chave e converte para MemberSummary.
   */
  private mapToMemberSummaries(
    subscriptions: Stripe.Subscription[],
    dedupKey: (sub: Stripe.Subscription) => string,
  ): MemberSummary[] {
    const deduped = Array.from(
      new Map(subscriptions.map((sub) => [dedupKey(sub), sub])).values(),
    );
    return deduped
      .map((sub) => {
        const memberId = sub.metadata?.memberId ?? '';
        const githubHandle = sub.metadata?.githubHandle ?? '';
        if (!memberId || !githubHandle) return null;
        return { memberId, githubHandle };
      })
      .filter((row): row is MemberSummary => row !== null);
  }

  /**
   * Lista membros com apoio recorrente CLUB ativo (mensal, pessoa física).
   */
  async getClubMembers(): Promise<{ items: MemberSummary[]; total: number }> {
    const subscriptions = await this.fetchActiveSubscriptions();
    const filtered = subscriptions.filter((sub) => {
      const metadata = sub.metadata ?? {};
      const interval = sub.items.data[0]?.price?.recurring?.interval;
      const isBusiness = metadata.entityType === 'business' || Boolean(metadata.companyId);
      return !!metadata.memberId && !isBusiness && interval === 'month';
    });
    const items = this.mapToMemberSummaries(filtered, (sub) => sub.metadata?.memberId ?? sub.id);
    return { items, total: items.length };
  }

  /**
   * Lista membros com assinatura CLUB Business ativa.
   */
  async getBusinessMembers(): Promise<{ items: MemberSummary[]; total: number }> {
    const subscriptions = await this.fetchActiveSubscriptions();
    const filtered = subscriptions.filter((sub) => {
      const metadata = sub.metadata ?? {};
      const interval = sub.items.data[0]?.price?.recurring?.interval;
      return (
        metadata.entityType === 'business' &&
        !!metadata.memberId &&
        !!metadata.companyId &&
        interval === 'month'
      );
    });
    const items = this.mapToMemberSummaries(filtered, (sub) => sub.metadata?.companyId ?? sub.id);
    return { items, total: items.length };
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

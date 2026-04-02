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
   *  - Pagamento único até R$ 100: aceito anônimo
   *  - Pagamento único acima de R$ 100: requer memberId
   *  - Subscription: always requer memberId (controlado no controller)
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
    } = dto;

    if (amountCents <= 0)
      throw new BadRequestException('Amount must be positive');

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const returnUrl = `${frontendUrl}/participe/apoiar?status=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontendUrl}/participe/apoiar?status=cancelled`;

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
      if (isDev) {
        this.logger.debug(
          'Dev: webhook signature verification skipped (Stripe CLI)',
        );
        event = JSON.parse(payload.toString()) as Stripe.Event;
      } else {
        if (!webhookSecret) {
          throw new Error('STRIPE_WEBHOOK_SECRET não definido em produção');
        }
        event = this.stripe.webhooks.constructEvent(
          payload,
          signature,
          webhookSecret,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Falha na verificação da assinatura do webhook: ${err.message}`,
      );
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object);
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
    } catch (error: any) {
      this.logger.error(
        `Falha ao registrar doação no Ledger: ${error.message}`,
      );
    }
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
    // A 1ª cobrança (subscription_create) e as subsequentes (subscription_cycle)
    // agora são processadas magicamente aqui.

    // Stripe SDK v17: subscription ID fica em invoice.lines.data[].parent.subscription_item_details
    // ou acessamos via cast pois o tipo do SDK varia entre versões
    const subscriptionId: string | undefined = (invoice as any).subscription;
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
    const paymentIntentId: string =
      (invoice as any).payment_intent ?? invoice.id;

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
    } catch (error: any) {
      this.logger.error(
        `Falha ao registrar renovação no Ledger: ${error.message}`,
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

    this.logger.log(
      `✅ ${typeLabel} R$ ${amountReais.toFixed(2)} → ${communityId} | pi: ${paymentIntentId}` +
        (memberId ? ` | membro: ${memberId}` : ' (anônimo)'),
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
      amount: Number(tx.amount),
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
        currentPeriodEnd: (sub as any).current_period_end ?? 0,
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

    this.logger.log(
      `Assinatura ${subscriptionId} marcada para cancelar em ` +
        new Date((updated as any).current_period_end * 1000).toLocaleDateString(
          'pt-BR',
        ) +
        ` (membro: ${memberId})`,
    );

    return {
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      currentPeriodEnd: (updated as any).current_period_end,
    };
  }
}

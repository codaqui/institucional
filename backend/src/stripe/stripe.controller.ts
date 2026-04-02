import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  Headers,
  BadRequestException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  StripeService,
  CheckoutInterval,
  CheckoutUiMode,
} from './stripe.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';

/** Limite em centavos para doação anônima: R$ 100 */
const ANONYMOUS_LIMIT_CENTS = 10_000;

@ApiTags('Stripe')
@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  /**
   * Lista as doações do membro autenticado (pagamentos únicos + assinaturas).
   */
  @Get('my-donations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Minhas doações' })
  getMyDonations(@Req() req: { user: JwtPayload }) {
    return this.stripeService.getMyDonations(req.user.sub);
  }

  /**
   * Lista assinaturas recorrentes ativas do membro.
   */
  @Get('my-subscriptions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Minhas assinaturas recorrentes' })
  getMySubscriptions(@Req() req: { user: JwtPayload }) {
    return this.stripeService.getMySubscriptions(req.user.sub);
  }

  /**
   * Cancela assinatura ao final do período atual (cancel_at_period_end: true).
   * Segue o padrão oficial Stripe — o membro não perde o período já pago.
   */
  @Delete('subscriptions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Cancelar assinatura (ao final do período)' })
  cancelSubscription(
    @Param('id') subscriptionId: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.stripeService.cancelSubscription(subscriptionId, req.user.sub);
  }

  /**
   * Cria sessão de checkout Stripe.
   *
   * Body:
   *   - amount: number (centavos)
   *   - communityId: string
   *   - uiMode?: 'embedded' | 'hosted'   (default: 'embedded')
   *   - recurring?: { interval: 'month' | 'year' }
   *
   * Regras:
   *   - Pagamento único até R$ 100: aceito sem login
   *   - Pagamento único acima de R$ 100: requer login
   *   - Assinatura recorrente: sempre requer login
   *
   * Retorno:
   *   - embedded: { clientSecret }
   *   - hosted:   { sessionId, url }
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Post('checkout-session')
  @ApiOperation({
    summary: 'Criar sessão de checkout',
    description:
      'Cria sessão Stripe. Embedded (padrão) retorna clientSecret para EmbeddedCheckout. ' +
      'Recurring exige login.',
  })
  async createCheckoutSession(
    @Req() req: { user?: JwtPayload },
    @Body()
    body: {
      amount: number;
      communityId: string;
      uiMode?: CheckoutUiMode;
      recurring?: { interval: CheckoutInterval };
    },
  ) {
    if (!body.amount || !body.communityId) {
      throw new BadRequestException(
        'amount (centavos) e communityId são obrigatórios.',
      );
    }
    if (body.amount <= 0) {
      throw new BadRequestException('O valor deve ser positivo.');
    }

    // Limite superior para evitar abuso
    const MAX_AMOUNT_CENTS = 5_000_000; // R$ 50.000
    if (body.amount > MAX_AMOUNT_CENTS) {
      throw new BadRequestException('Valor máximo por transação: R$ 50.000.');
    }

    const isRecurring = !!body.recurring;

    // Subscriptions sempre requerem login
    if (isRecurring && !req.user) {
      throw new UnauthorizedException(
        'Doações recorrentes requerem login com GitHub.',
      );
    }

    // Pagamentos únicos acima de R$ 100 requerem login
    if (!isRecurring && body.amount > ANONYMOUS_LIMIT_CENTS && !req.user) {
      throw new UnauthorizedException(
        'Doações acima de R$ 100 requerem login com GitHub.',
      );
    }

    return this.stripeService.createCheckoutSession({
      amountCents: body.amount,
      communityId: body.communityId,
      uiMode: body.uiMode ?? 'embedded_page',
      recurring: body.recurring,
      memberId: req.user?.sub,
      githubHandle: req.user?.handle,
      email: req.user?.email,
    });
  }

  @Post('webhook')
  @SkipThrottle()
  @ApiOperation({ summary: 'Webhook Stripe (interno)' })
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: any,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }
    const raw = req.rawBody;
    if (!raw) {
      throw new BadRequestException('Webhook requires raw body');
    }
    return this.stripeService.handleWebhookEvent(signature, raw);
  }
}

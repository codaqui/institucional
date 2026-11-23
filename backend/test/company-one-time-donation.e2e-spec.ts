import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { bootstrapE2eActors, closeE2eApplication, removeBusinessE2eFixtures } from './e2e-app.helper';
import { StripeService } from '../src/stripe/stripe.service';
import type { JwtPayload } from '../src/auth/jwt.strategy';

const mockStripe = {
  checkout: { sessions: { create: jest.fn() } },
  webhooks: { constructEvent: jest.fn() },
  subscriptions: { list: jest.fn(), retrieve: jest.fn(), search: jest.fn(), update: jest.fn() },
  paymentIntents: { retrieve: jest.fn() },
  balanceTransactions: { retrieve: jest.fn() },
  refunds: { create: jest.fn() },
};

jest.mock('stripe', () => jest.fn().mockImplementation(() => mockStripe));

const testDatabase = process.env.DB_NAME ?? '';
if (!testDatabase.endsWith('_test')) {
  throw new Error('O E2E de doação empresarial única exige DB_NAME terminado em _test.');
}

const actors = {
  responsible: {
    sub: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    githubId: 'e2e-company-once',
    handle: 'e2e-company-once',
    name: 'Responsável E2E',
    email: 'company-once@e2e.invalid',
    avatarUrl: '',
    roles: ['membro'],
  },
} satisfies Record<string, JwtPayload>;
const communityId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const paymentReferences = ['pi_e2e_company_treasury', 'pi_e2e_company_community'];

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cs_e2e_company_once',
    amount_total: 2500,
    payment_status: 'paid',
    payment_intent: 'pi_e2e_company_treasury',
    metadata: {
      entityType: 'business',
      companyId: '',
      memberId: actors.responsible.sub,
      communityId: 'tesouro-geral',
      amountCents: '2500',
      isSubscription: 'false',
    },
    ...overrides,
  };
}

describe('Doação empresarial única — PostgreSQL real e Stripe mockado', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let stripeService: StripeService;

  const removeFixtures = async (database: DataSource) => {
    await database.query('DELETE FROM transactions WHERE "referenceId" = ANY($1)', [paymentReferences]);
    await removeBusinessE2eFixtures(database, Object.values(actors).map((actor) => actor.sub));
    await database.query('DELETE FROM communities WHERE id = $1', [communityId]);
  };

  beforeAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_e2e_company_once';
    ({ app, dataSource } = await bootstrapE2eActors(actors, 'CompanyOnce', removeFixtures));
    stripeService = app.get(StripeService);
    await dataSource.getRepository('communities').save({
      id: communityId,
      slug: 'e2e-company-once-community',
      name: 'Comunidade E2E',
      description: 'Comunidade sintética para doação única',
      emoji: '🧪',
      logoUrl: 'https://codaqui.dev/logo.png',
      level: 'integrada',
      status: 'active',
      sealStatus: 'none',
      siteEnabled: false,
    });
    mockStripe.checkout.sessions.create.mockImplementation(async (params) => ({
      id: 'cs_e2e_company_once',
      client_secret: 'cs_e2e_secret',
      url: 'https://stripe.test/checkout',
      payment_intent: params.metadata.communityId === 'tesouro-geral'
        ? 'pi_e2e_company_treasury'
        : 'pi_e2e_company_community',
      metadata: params.metadata,
    }));
    mockStripe.paymentIntents.retrieve.mockResolvedValue({ latest_charge: null });
  }, 60_000);

  afterAll(async () => {
    await closeE2eApplication(app, dataSource, removeFixtures);
  });

  it('registra Tesouro e comunidade após sucesso assíncrono, sem ativar empresa ou patrocínio', async () => {
    const registration = await request(app.getHttpServer())
      .post('/companies')
      .set('x-test-actor', 'responsible')
      .send({ cnpj: '11222333000181', name: 'Empresa Doação Única' })
      .expect(201);
    const companyId = registration.body.id as string;
    expect(registration.body.status).toBe('pending');

    const treasuryCheckout = await request(app.getHttpServer())
      .post('/stripe/checkout-session/company/one-time')
      .set('x-test-actor', 'responsible')
      .send({ companyId, amount: 2500, communityId: 'tesouro-geral', uiMode: 'embedded_page' })
      .expect(201);
    expect(treasuryCheckout.body.clientSecret).toBe('cs_e2e_secret');
    const treasuryParams = mockStripe.checkout.sessions.create.mock.calls[0][0];
    expect(treasuryParams).toMatchObject({ mode: 'payment' });
    expect(treasuryParams.subscription_data).toBeUndefined();
    expect(treasuryParams.customer_creation).toBeUndefined();

    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: session({ payment_status: 'unpaid', metadata: { ...session().metadata, companyId } }) },
    });
    await stripeService.handleWebhookEvent('sig', Buffer.from('body'));
    expect(await dataSource.query('SELECT id FROM transactions WHERE "referenceId" = $1', ['pi_e2e_company_treasury'])).toHaveLength(0);

    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.async_payment_succeeded',
      data: { object: session({ metadata: { ...session().metadata, companyId } }) },
    });
    await stripeService.handleWebhookEvent('sig', Buffer.from('body'));
    const treasuryLedger = await dataSource.query('SELECT description, amount FROM transactions WHERE "referenceId" = $1', ['pi_e2e_company_treasury']);
    expect(treasuryLedger).toHaveLength(1);
    expect(treasuryLedger[0].description).toContain('Doação empresarial única');
    expect(treasuryLedger[0].description).toContain(actors.responsible.sub);

    const communityCheckout = await request(app.getHttpServer())
      .post('/stripe/checkout-session/company/one-time')
      .set('x-test-actor', 'responsible')
      .send({ companyId, amount: 2500, communityId: 'e2e-company-once-community', uiMode: 'embedded_page' })
      .expect(201);
    expect(communityCheckout.body.clientSecret).toBe('cs_e2e_secret');

    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.async_payment_succeeded',
      data: {
        object: session({
          id: 'cs_e2e_company_community',
          payment_intent: 'pi_e2e_company_community',
          metadata: { ...session().metadata, companyId, communityId: 'e2e-company-once-community' },
        }),
      },
    });
    await stripeService.handleWebhookEvent('sig', Buffer.from('body'));
    const communityLedger = await dataSource.query('SELECT description FROM transactions WHERE "referenceId" = $1', ['pi_e2e_company_community']);
    expect(communityLedger).toHaveLength(1);

    const donations = await request(app.getHttpServer())
      .get('/stripe/my-donations?page=1&limit=20')
      .set('x-test-actor', 'responsible')
      .expect(200);
    expect(donations.body.items).toHaveLength(2);

    const sponsors = await request(app.getHttpServer()).get('/companies/sponsors').expect(200);
    expect(sponsors.body.items.filter((item: { id: string }) => item.id === companyId)).toHaveLength(0);
    const company = await dataSource.query('SELECT status, "stripeCustomerId", "subscriptionAmountCents" FROM companies WHERE id = $1', [companyId]);
    expect(company[0]).toMatchObject({ status: 'pending', stripeCustomerId: null, subscriptionAmountCents: 20000 });
  });
});

jest.setTimeout(60_000);

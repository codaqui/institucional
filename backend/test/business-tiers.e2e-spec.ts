import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createE2eApplication, saveE2eActors } from './e2e-app.helper';
import type { JwtPayload } from '../src/auth/jwt.strategy';
import { Migration045BusinessTiers1794700000000 } from '../src/migrations/1794700000000-Migration045_BusinessTiers';

const testDatabase = process.env.DB_NAME ?? '';
if (!testDatabase.endsWith('_test')) {
  throw new Error('O E2E de Business tiers exige DB_NAME terminado em _test.');
}

const actors = {
  admin: { sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', handle: 'e2e-business-admin', roles: ['admin'] },
  responsible: { sub: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', handle: 'e2e-business-owner', roles: ['membro'] },
  collaborator: { sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', handle: 'E2E-Business-Collab', roles: ['membro'] },
} satisfies Record<string, JwtPayload>;

type ActorName = keyof typeof actors;
const actorIds = Object.values(actors).map((actor) => actor.sub);
const as = (actor: ActorName) => ({ 'x-test-actor': actor });

describe('Fase 6 — Business tiers com PostgreSQL real', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  async function removeFixtures() {
    await dataSource.query('DELETE FROM audit_logs WHERE "actorId" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM company_wallet_transactions WHERE "walletId" IN (SELECT id FROM company_wallets WHERE "companyId" IN (SELECT id FROM companies WHERE "responsibleMemberId" = ANY($1::uuid[])))', [actorIds]);
    await dataSource.query('DELETE FROM company_wallets WHERE "companyId" IN (SELECT id FROM companies WHERE "responsibleMemberId" = ANY($1::uuid[]))', [actorIds]);
    await dataSource.query('DELETE FROM company_subscription_tracking WHERE "companyId" IN (SELECT id FROM companies WHERE "responsibleMemberId" = ANY($1::uuid[]))', [actorIds]);
    await dataSource.query('DELETE FROM company_members WHERE "companyId" IN (SELECT id FROM companies WHERE "responsibleMemberId" = ANY($1::uuid[]))', [actorIds]);
    await dataSource.query('DELETE FROM companies WHERE "responsibleMemberId" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM members WHERE id = ANY($1::uuid[])', [actorIds]);
  }

  beforeAll(async () => {
    ({ app, dataSource } = await createE2eApplication(actors));
    await removeFixtures();
    await saveE2eActors(dataSource, actors, 'Business');
  });

  afterAll(async () => {
    if (dataSource) await removeFixtures();
    if (app) await app.close();
  });

  it('executa admin, colaborador mixed-case, Amiga, Aliada, badge, expiração, renovação e migration down/up', async () => {
    const registration = await request(app.getHttpServer())
      .post('/companies')
      .set(as('responsible'))
      .send({ cnpj: '11222333000181', name: 'Empresa E2E' })
      .expect(201);
    const companyId = registration.body.id as string;
    expect(registration.body).toMatchObject({ status: 'pending', tier: 'amiga' });

    await request(app.getHttpServer())
      .patch(`/companies/${companyId}/status`)
      .set(as('admin'))
      .send({ status: 'active' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/companies/${companyId}/members`)
      .set(as('responsible'))
      .send({ githubHandle: actors.collaborator.handle })
      .expect(201);

    const adminList = await request(app.getHttpServer())
      .get('/companies/admin/list?page=1&limit=10')
      .set(as('admin'))
      .expect(200);
    expect(adminList.body.items.find((item: { id: string }) => item.id === companyId))
      .toMatchObject({ responsibleGithubHandle: actors.responsible.handle, tier: 'amiga' });

    const businessMembers = await request(app.getHttpServer())
      .get('/companies/business-members')
      .expect(200);
    expect(businessMembers.body).toContain(actors.collaborator.sub);

    await request(app.getHttpServer())
      .patch(`/companies/${companyId}/tier`)
      .set(as('admin'))
      .send({ tier: 'aliada', engagementCriterion: 'workshop', evidenceUrl: 'https://drive.google.com/evidence', validationNotes: 'Validação sintética.' })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ tier: 'aliada', engagementCriterion: 'workshop', validatedByMemberId: actors.admin.sub });
        expect(response.body.sealValidUntil).toBeTruthy();
      });

    const badges = await request(app.getHttpServer()).get('/companies/badges/public').expect(200);
    expect(badges.body.filter((item: { id: string }) => item.id === companyId)).toHaveLength(1);
    expect(badges.body.find((item: { id: string }) => item.id === companyId)).toMatchObject({ tier: 'aliada' });
    expect(JSON.stringify(badges.body)).not.toContain('responsibleMemberId');
    expect(JSON.stringify(badges.body)).not.toContain('evidenceUrl');

    const sponsors = await request(app.getHttpServer()).get('/companies/sponsors').expect(200);
    const sponsor = sponsors.body.items.find((item: { id: string }) => item.id === companyId);
    expect(sponsor).toMatchObject({ tier: 'aliada', sealActive: true });
    expect(sponsor).not.toHaveProperty('responsibleMemberId');
    expect(sponsor).not.toHaveProperty('stripeCustomerId');
    expect(sponsor).not.toHaveProperty('validationNotes');

    const wallet = await request(app.getHttpServer())
      .get(`/companies/${companyId}/wallet`)
      .set(as('responsible'))
      .expect(200);
    const walletId = wallet.body.id as string;

    const past = new Date(Date.now() - 86_400_000);
    await dataSource.query('UPDATE companies SET "sealValidUntil" = $1 WHERE id = $2', [past, companyId]);
    expect((await request(app.getHttpServer()).get('/companies/badges/public').expect(200)).body
      .filter((item: { id: string }) => item.id === companyId)).toHaveLength(0);
    const expiredSponsors = await request(app.getHttpServer()).get('/companies/sponsors').expect(200);
    expect(expiredSponsors.body.items.find((item: { id: string }) => item.id === companyId))
      .toMatchObject({ tier: 'aliada', sealActive: false });

    await request(app.getHttpServer())
      .patch(`/companies/${companyId}/tier`)
      .set(as('admin'))
      .send({ tier: 'aliada' })
      .expect(200);
    expect((await request(app.getHttpServer()).get('/companies/badges/public').expect(200)).body
      .filter((item: { id: string }) => item.id === companyId)).toHaveLength(1);

    const walletBefore = await dataSource.query('SELECT * FROM company_wallets WHERE id = $1', [walletId]);
    await dataSource.query('DROP TABLE IF EXISTS e2e_backup_business_companies');
    await dataSource.query('CREATE TABLE e2e_backup_business_companies AS SELECT * FROM companies WHERE id = $1', [companyId]);
    const queryRunner = dataSource.createQueryRunner();
    const migration = new Migration045BusinessTiers1794700000000();
    await migration.down(queryRunner);
    await migration.up(queryRunner);
    await queryRunner.release();
    await dataSource.query(`
      UPDATE companies
      SET
        "tier" = backup."tier",
        "engagementCriterion" = backup."engagementCriterion",
        "evidenceUrl" = backup."evidenceUrl",
        "validationNotes" = backup."validationNotes",
        "validatedAt" = backup."validatedAt",
        "validatedByMemberId" = backup."validatedByMemberId",
        "sealValidUntil" = backup."sealValidUntil"
      FROM e2e_backup_business_companies AS backup
      WHERE companies.id = backup.id
    `);
    await dataSource.query('DROP TABLE e2e_backup_business_companies');

    const restored = await dataSource.query('SELECT tier, "sealValidUntil" FROM companies WHERE id = $1', [companyId]);
    expect(restored[0].tier).toBe('aliada');
    const walletAfter = await dataSource.query('SELECT * FROM company_wallets WHERE id = $1', [walletId]);
    expect(walletAfter).toEqual(walletBefore);
    const stripe = await dataSource.query('SELECT "stripeCustomerId", "stripeSubscriptionId", "subscriptionAmountCents" FROM companies WHERE id = $1', [companyId]);
    expect(stripe[0]).toMatchObject({ stripeCustomerId: null, stripeSubscriptionId: null, subscriptionAmountCents: 20000 });
  });
});

jest.setTimeout(60_000);

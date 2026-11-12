import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createE2eApplication } from './e2e-app.helper';
import type { JwtPayload } from '../src/auth/jwt.strategy';
import { Migration048EmailCampaigns1795100000000 } from '../src/migrations/1795100000000-Migration048_EmailCampaigns';
import { CampaignsService } from '../src/campaigns/campaigns.service';
import { EmailService } from '../src/notifications/email.service';
import { SmtpEmailProvider } from '../src/notifications/email.provider';
import { EmailTemplateService } from '../src/notifications/email-template.service';
import { AuditService } from '../src/audit/audit.service';
import { EmailCampaign } from '../src/campaigns/entities/email-campaign.entity';
import { EmailCampaignRecipient } from '../src/campaigns/entities/email-campaign-recipient.entity';
import { EmailSuppression } from '../src/campaigns/entities/email-suppression.entity';
import { MemberRole } from '../src/members/entities/member.entity';

const testDatabase = process.env.DB_NAME ?? '';
if (!testDatabase.endsWith('_test')) {
  throw new Error('O E2E de campanhas exige DB_NAME terminado em _test.');
}

const makeActor = (
  sub: string,
  handle: string,
  roles: MemberRole[],
): JwtPayload => ({
  sub,
  githubId: `gh-${handle}`,
  handle,
  name: handle,
  email: `${handle}@e2e-camp.example.org`,
  avatarUrl: '',
  roles,
});

const actors = {
  admin: makeActor(
    '11111111-e300-4000-8000-000000000001',
    'e2e-camp-admin',
    [MemberRole.ADMIN],
  ),
  analyzer: makeActor(
    '11111111-e300-4000-8000-000000000002',
    'e2e-camp-analyzer',
    [MemberRole.FINANCE_ANALYZER],
  ),
  optedMember: makeActor(
    '11111111-e300-4000-8000-000000000003',
    'e2e-camp-opted',
    [MemberRole.MEMBRO, MemberRole.MENTOR],
  ),
  noOptMember: makeActor(
    '11111111-e300-4000-8000-000000000004',
    'e2e-camp-noopt',
    [MemberRole.MEMBRO, MemberRole.MENTOR],
  ),
  communityLeader: makeActor(
    '11111111-e300-4000-8000-000000000005',
    'e2e-camp-comm-leader',
    [MemberRole.MEMBRO],
  ),
  communityDirMember: makeActor(
    '11111111-e300-4000-8000-000000000006',
    'e2e-camp-comm-dir',
    [MemberRole.MEMBRO, MemberRole.DIRETOR],
  ),
  unlinkedMember: makeActor(
    '11111111-e300-4000-8000-000000000007',
    'e2e-camp-unlinked',
    [MemberRole.MEMBRO],
  ),
  inactiveMember: makeActor(
    '11111111-e300-4000-8000-000000000008',
    'e2e-camp-inactive',
    [MemberRole.MEMBRO, MemberRole.MENTOR],
  ),
  noreplyMember: makeActor(
    '11111111-e300-4000-8000-000000000009',
    'e2e-camp-noreply',
    [MemberRole.MEMBRO, MemberRole.MENTOR],
  ),
} satisfies Record<string, JwtPayload>;

const actorIds = Object.values(actors).map((a) => a.sub);
const communityId = '22222222-e300-4000-8000-000000000001';
const directorateId = '33333333-e300-4000-8000-000000000001';
const designationIds = [
  '44444444-e300-4000-8000-000000000001',
  '44444444-e300-4000-8000-000000000002',
];
const as = (actor: keyof typeof actors) => ({ 'x-test-actor': actor });

describe('Email Campaigns (E3) — API, fila concorrente, descadastro e migration 048 com PostgreSQL real', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let campaignsService: CampaignsService;
  let emailService: EmailService;
  let smtpProvider: SmtpEmailProvider;

  async function removeFixtures() {
    await dataSource.query(
      `DELETE FROM email_logs WHERE "to" LIKE '%@e2e-camp.example.org' OR "campaignId" IN (SELECT id FROM email_campaigns WHERE "createdById" = ANY($1::uuid[]))`,
      [actorIds],
    );
    await dataSource.query(
      `DELETE FROM email_campaign_recipients WHERE "campaignId" IN (SELECT id FROM email_campaigns WHERE "createdById" = ANY($1::uuid[]))`,
      [actorIds],
    );
    await dataSource.query(
      `DELETE FROM email_campaigns WHERE "createdById" = ANY($1::uuid[])`,
      [actorIds],
    );
    await dataSource.query(
      `DELETE FROM email_suppressions WHERE "emailNormalized" LIKE '%@e2e-camp.example.org' OR "createdById" = ANY($1::uuid[])`,
      [actorIds],
    );
    await dataSource.query(
      `DELETE FROM member_designations WHERE id = ANY($1::uuid[]) OR "memberId" = ANY($2::uuid[])`,
      [designationIds, actorIds],
    );
    await dataSource.query(`DELETE FROM directorates WHERE id = $1`, [
      directorateId,
    ]);
    await dataSource.query(`DELETE FROM communities WHERE id = $1`, [
      communityId,
    ]);
    await dataSource.query(
      `DELETE FROM audit_logs WHERE "actorId" = ANY($1::uuid[]) OR "actorHandle" = 'unsubscribe-link'`,
      [actorIds],
    );
    await dataSource.query(`DELETE FROM members WHERE id = ANY($1::uuid[])`, [
      actorIds,
    ]);
  }

  beforeAll(async () => {
    ({ app, dataSource } = await createE2eApplication(actors));
    campaignsService = app.get(CampaignsService);
    emailService = app.get(EmailService);
    smtpProvider = app.get(SmtpEmailProvider);

    const queryRunner = dataSource.createQueryRunner();
    const existingTable = (await queryRunner.query(
      `SELECT to_regclass('public.email_campaigns') AS table_name`,
    )) as Array<{ table_name: string | null }>;
    if (!existingTable[0]?.table_name) {
      await new Migration048EmailCampaigns1795100000000().up(queryRunner);
    }
    await queryRunner.release();

    await removeFixtures();

    await dataSource.getRepository('members').save([
      {
        id: actors.admin.sub,
        githubId: 'e2e-camp-gh-admin',
        githubHandle: actors.admin.handle,
        name: 'Admin Campanhas',
        email: 'admin@e2e-camp.example.org',
        secondaryEmails: ['admin@e2e-camp.example.org'],
        avatarUrl: '',
        roles: actors.admin.roles,
        isActive: true,
        marketingEmailOptIn: true,
      },
      {
        id: actors.analyzer.sub,
        githubId: 'e2e-camp-gh-analyzer',
        githubHandle: actors.analyzer.handle,
        name: 'Analyzer Campanhas',
        email: 'analyzer@e2e-camp.example.org',
        secondaryEmails: ['analyzer@e2e-camp.example.org'],
        avatarUrl: '',
        roles: actors.analyzer.roles,
        isActive: true,
        marketingEmailOptIn: false,
      },
      {
        id: actors.optedMember.sub,
        githubId: 'e2e-camp-gh-opted',
        githubHandle: actors.optedMember.handle,
        name: 'Membro Opt-in',
        email: 'opted@e2e-camp.example.org',
        secondaryEmails: ['opted@e2e-camp.example.org'],
        avatarUrl: '',
        roles: actors.optedMember.roles,
        isActive: true,
        marketingEmailOptIn: true,
      },
      {
        id: actors.noOptMember.sub,
        githubId: 'e2e-camp-gh-noopt',
        githubHandle: actors.noOptMember.handle,
        name: 'Membro Sem Opt-in',
        email: 'noopt@e2e-camp.example.org',
        secondaryEmails: ['noopt@e2e-camp.example.org'],
        avatarUrl: '',
        roles: actors.noOptMember.roles,
        isActive: true,
        marketingEmailOptIn: false,
      },
      {
        id: actors.communityLeader.sub,
        githubId: 'e2e-camp-gh-comm-leader',
        githubHandle: actors.communityLeader.handle,
        name: 'Lider Comunidade',
        email: 'leader@e2e-camp.example.org',
        secondaryEmails: ['leader@e2e-camp.example.org'],
        avatarUrl: '',
        roles: actors.communityLeader.roles,
        isActive: true,
        marketingEmailOptIn: true,
      },
      {
        id: actors.communityDirMember.sub,
        githubId: 'e2e-camp-gh-comm-dir',
        githubHandle: actors.communityDirMember.handle,
        name: 'Diretor Comunidade',
        email: 'dir@e2e-camp.example.org',
        secondaryEmails: ['dir@e2e-camp.example.org'],
        avatarUrl: '',
        roles: actors.communityDirMember.roles,
        isActive: true,
        marketingEmailOptIn: false,
      },
      {
        id: actors.unlinkedMember.sub,
        githubId: 'e2e-camp-gh-unlinked',
        githubHandle: actors.unlinkedMember.handle,
        name: 'Membro Sem Vinculo',
        email: 'unlinked@e2e-camp.example.org',
        secondaryEmails: ['unlinked@e2e-camp.example.org'],
        avatarUrl: '',
        roles: actors.unlinkedMember.roles,
        isActive: true,
        marketingEmailOptIn: true,
      },
      {
        id: actors.inactiveMember.sub,
        githubId: 'e2e-camp-gh-inactive',
        githubHandle: actors.inactiveMember.handle,
        name: 'Membro Inativo',
        email: 'inactive@e2e-camp.example.org',
        secondaryEmails: ['inactive@e2e-camp.example.org'],
        avatarUrl: '',
        roles: actors.inactiveMember.roles,
        isActive: false,
        marketingEmailOptIn: true,
      },
      {
        id: actors.noreplyMember.sub,
        githubId: 'e2e-camp-gh-noreply',
        githubHandle: actors.noreplyMember.handle,
        name: 'Membro Noreply',
        email: '12345+noreply@users.noreply.github.com',
        secondaryEmails: [],
        avatarUrl: '',
        roles: actors.noreplyMember.roles,
        isActive: true,
        marketingEmailOptIn: true,
      },
    ]);

    await dataSource.query(
      `INSERT INTO communities (id, slug, name, description, emoji, "logoUrl", level, status) VALUES ($1, 'e2e-camp-comm', 'Comunidade E2E Camp', 'Descrição E2E', '🚀', 'https://codaqui.dev/logo.png', 'integrada', 'active')`,
      [communityId],
    );
    await dataSource.query(
      `INSERT INTO directorates (id, slug, name, "communityId", "isActive") VALUES ($1, 'e2e-camp-dir', 'Diretoria E2E Camp', $2, true)`,
      [directorateId, communityId],
    );
    await dataSource.query(
      `INSERT INTO member_designations (id, "memberId", "targetType", "targetId", designation, status, "appointedById")
       VALUES
         ($1, $3, 'community', $5, 'responsible', 'active', $6),
         ($2, $4, 'directorate', $7, 'director', 'active', $6)`,
      [
        designationIds[0],
        designationIds[1],
        actors.communityLeader.sub,
        actors.communityDirMember.sub,
        communityId,
        actors.admin.sub,
        directorateId,
      ],
    );
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    if (dataSource) await removeFixtures();
    if (app) await app.close();
  });

  it('valida segmentos (community_governance sem membros sem vínculo, role, designation, manual), idempotência, concorrência SKIP LOCKED e advisory lock', async () => {
    // 1. Idempotência por idempotencyKey
    const createPayload = {
      name: 'Comunicado Governança Comunitária E2E',
      subject: 'Reunião de Governança',
      bodyMarkdown: 'Olá **governança** da comunidade!',
      purpose: 'transactional',
      segmentType: 'community_governance',
      segmentConfig: { communityId },
      idempotencyKey: 'e2e-camp-idemp-gov-001',
    };

    await request(app.getHttpServer())
      .post('/campaigns')
      .set(as('analyzer'))
      .send(createPayload)
      .expect(403);

    const firstCreate = await request(app.getHttpServer())
      .post('/campaigns')
      .set(as('admin'))
      .send(createPayload)
      .expect(201);

    const duplicateCreate = await request(app.getHttpServer())
      .post('/campaigns')
      .set(as('admin'))
      .send({ ...createPayload, name: 'Tentativa Duplicada' })
      .expect(201);

    expect(duplicateCreate.body.id).toBe(firstCreate.body.id);
    expect(duplicateCreate.body.name).toBe(createPayload.name);

    // 2. Prévia de community_governance: inclui apenas communityLeader e communityDirMember, nunca unlinkedMember
    const previewRes = await request(app.getHttpServer())
      .post(`/campaigns/${firstCreate.body.id}/preview`)
      .set(as('admin'))
      .expect(200);

    const includedEmails = previewRes.body.included.map(
      (r: { email: string }) => r.email,
    );
    expect(includedEmails.sort()).toEqual([
      'dir@e2e-camp.example.org',
      'leader@e2e-camp.example.org',
    ]);
    expect(includedEmails).not.toContain('unlinked@e2e-camp.example.org');

    // 3. Confirmação da campanha
    const confirmRes = await request(app.getHttpServer())
      .post(`/campaigns/${firstCreate.body.id}/confirm`)
      .set(as('admin'))
      .send({})
      .expect(200);
    expect(confirmRes.body.status).toBe('sending');

    // 4. Dois workers concorrentes disputando a mesma fila com FOR UPDATE SKIP LOCKED
    //    e exercitando o advisory lock global real do PostgreSQL no EmailService
    const sentRecipients: string[] = [];
    const advisoryLockHeldDuringSend: boolean[] = [];
    jest.spyOn(smtpProvider, 'isConfigured').mockReturnValue(true);
    jest.spyOn(smtpProvider, 'send').mockImplementation(async (message) => {
      sentRecipients.push(message.to);
      const checkRunner = dataSource.createQueryRunner();
      try {
        await checkRunner.connect();
        const tryRes = (await checkRunner.query(
          'SELECT pg_try_advisory_lock($1, $2) AS acquired',
          [0x436f6461, 1],
        )) as Array<{ acquired: boolean }>;
        const acquiredByOtherSession = Boolean(tryRes[0]?.acquired);
        if (acquiredByOtherSession) {
          await checkRunner.query(
            'SELECT pg_advisory_unlock($1, $2)',
            [0x436f6461, 1],
          );
        }
        advisoryLockHeldDuringSend.push(!acquiredByOtherSession);
      } finally {
        await checkRunner.release();
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    });

    // Instancia um segundo worker apontando para o mesmo PostgreSQL real
    const secondWorker = new CampaignsService(
      dataSource.getRepository(EmailCampaign),
      dataSource.getRepository(EmailCampaignRecipient),
      dataSource.getRepository(EmailSuppression),
      dataSource.getRepository('members') as never,
      dataSource.getRepository('member_designations') as never,
      dataSource.getRepository('directorates') as never,
      dataSource.getRepository('communities') as never,
      emailService,
      app.get(EmailTemplateService),
      app.get(AuditService),
      dataSource,
    );

    await Promise.all([
      campaignsService.processCampaignQueue(1),
      secondWorker.processCampaignQueue(1),
    ]);

    // Cada destinatário deve receber exatamente 1 envio (sem duplicação)
    sentRecipients.sort((a, b) => a.localeCompare(b));
    expect(sentRecipients).toEqual([
      'dir@e2e-camp.example.org',
      'leader@e2e-camp.example.org',
    ]);
    // Confirma que o advisory lock global de sessão do PostgreSQL estava ativo durante cada envio
    expect(advisoryLockHeldDuringSend).toEqual([true, true]);

    const detailAfterSend = await request(app.getHttpServer())
      .get(`/campaigns/${firstCreate.body.id}`)
      .set(as('admin'))
      .expect(200);
    expect(detailAfterSend.body.status).toBe('completed');
    expect(detailAfterSend.body.metrics).toMatchObject({
      total: 2,
      sent: 2,
      pending: 0,
      failed: 0,
    });
  });

  it('impede campanha promocional após descadastro público mesmo se admin reativar marketingEmailOptIn no banco, permite reativação pelo titular e testa retry/cancelamento/retenção/logs', async () => {
    // 1. Cria campanha promocional manual incluindo opted@e2e-camp.example.org e noopt@e2e-camp.example.org
    const promoCreate = await request(app.getHttpServer())
      .post('/campaigns')
      .set(as('admin'))
      .send({
        name: 'Novidades Codaqui Promocional E2E',
        subject: 'Participe das novidades!',
        bodyMarkdown: 'Confira os **próximos passos** da comunidade.',
        purpose: 'promotional',
        segmentType: 'manual',
        segmentConfig: {
          emails: [
            'opted@e2e-camp.example.org',
            'OPTED@e2e-camp.example.org',
            'noopt@e2e-camp.example.org',
          ],
          consentEvidence: 'Opt-in verificado em Meus dados',
        },
        idempotencyKey: 'e2e-camp-idemp-promo-001',
      })
      .expect(201);

    const promoPreview = await request(app.getHttpServer())
      .post(`/campaigns/${promoCreate.body.id}/preview`)
      .set(as('admin'))
      .expect(200);

    // opted@ entra; OPTED@ é excluído como duplicate; noopt@ é excluído como noOptIn
    expect(promoPreview.body.includedCount).toBe(1);
    expect(promoPreview.body.exclusionsByReason).toMatchObject({
      duplicate: 1,
      noOptIn: 1,
    });
    expect(promoPreview.body.rendered.html).toContain('/descadastro?token=');

    await request(app.getHttpServer())
      .post(`/campaigns/${promoCreate.body.id}/confirm`)
      .set(as('admin'))
      .send({})
      .expect(200);

    // Simula falha no primeiro envio para testar retry sem reenviar quem já está sent
    jest.spyOn(smtpProvider, 'isConfigured').mockReturnValue(true);
    jest
      .spyOn(smtpProvider, 'send')
      .mockRejectedValueOnce(
        new Error('550 5.1.1 Invalid recipient address simulated'),
      );

    await campaignsService.processCampaignQueue(5);

    const failedDetail = await request(app.getHttpServer())
      .get(`/campaigns/${promoCreate.body.id}`)
      .set(as('admin'))
      .expect(200);
    expect(failedDetail.body.status).toBe('completed_with_errors');
    const failedRecipient = failedDetail.body.recipients.find(
      (r: { email: string }) => r.email === 'opted@e2e-camp.example.org',
    );
    expect(failedRecipient.status).toBe('failed');

    // Faz retry do recipient que falhou e processa com sucesso
    await request(app.getHttpServer())
      .post(
        `/campaigns/${promoCreate.body.id}/recipients/${failedRecipient.id}/retry`,
      )
      .set(as('admin'))
      .expect(200);

    jest.spyOn(smtpProvider, 'send').mockResolvedValueOnce(undefined);

    await campaignsService.processCampaignQueue(5);

    // Tentar retry de um recipient já 'sent' deve retornar 409
    await request(app.getHttpServer())
      .post(
        `/campaigns/${promoCreate.body.id}/recipients/${failedRecipient.id}/retry`,
      )
      .set(as('admin'))
      .expect(409);

    // 2. Descadastro público sem autenticação via token do recipient
    const rawToken = campaignsService.buildUnsubscribeToken(failedRecipient.id);
    const unsubRes = await request(app.getHttpServer())
      .get(`/campaigns/unsubscribe?token=${rawToken}`)
      .expect(200);
    expect(unsubRes.body).toMatchObject({
      ok: true,
      status: 'unsubscribed',
    });
    expect(JSON.stringify(unsubRes.body)).not.toContain(
      'opted@e2e-camp.example.org',
    );

    // Admin tenta reativar indevidamente marketingEmailOptIn = true direto no banco
    await dataSource.query(
      `UPDATE members SET "marketingEmailOptIn" = true WHERE id = $1`,
      [actors.optedMember.sub],
    );

    // Admin também tenta remover a supressão de unsubscribe pela API -> 403 Forbidden
    const suppressionsList = await request(app.getHttpServer())
      .get('/campaigns/suppressions')
      .set(as('admin'))
      .expect(200);
    const unsubSuppression = suppressionsList.body.find(
      (s: { emailNormalized: string }) =>
        s.emailNormalized === 'opted@e2e-camp.example.org',
    );
    expect(unsubSuppression).toBeDefined();

    await request(app.getHttpServer())
      .delete(`/campaigns/suppressions/${unsubSuppression.id}`)
      .set(as('admin'))
      .expect(403);

    // Nova campanha promocional continua bloqueando opted@e2e-camp.example.org como 'suppressed'
    const secondPromo = await request(app.getHttpServer())
      .post('/campaigns')
      .set(as('admin'))
      .send({
        name: 'Segunda Promocional E2E',
        subject: 'Segunda chamada promocional',
        bodyMarkdown: 'Conteúdo promocional.',
        purpose: 'promotional',
        segmentType: 'manual',
        segmentConfig: {
          emails: ['opted@e2e-camp.example.org'],
          consentEvidence: 'Opt-in verificado em Meus dados',
        },
        idempotencyKey: 'e2e-camp-idemp-promo-002',
      })
      .expect(201);

    const secondPreview = await request(app.getHttpServer())
      .post(`/campaigns/${secondPromo.body.id}/preview`)
      .set(as('admin'))
      .expect(200);
    expect(secondPreview.body.includedCount).toBe(0);
    expect(secondPreview.body.exclusionsByReason.suppressed).toBe(1);

    // O próprio titular reativa em Meus dados com confirmReactivation: true
    await request(app.getHttpServer())
      .patch('/members/me/marketing-consent')
      .set(as('optedMember'))
      .send({ marketingEmailOptIn: true, confirmReactivation: false })
      .expect(409);

    await request(app.getHttpServer())
      .patch('/members/me/marketing-consent')
      .set(as('optedMember'))
      .send({ marketingEmailOptIn: true, confirmReactivation: true })
      .expect(200);

    const thirdPreview = await request(app.getHttpServer())
      .post(`/campaigns/${secondPromo.body.id}/preview`)
      .set(as('admin'))
      .expect(200);
    expect(thirdPreview.body.includedCount).toBe(1);

    // Cancelamento da segunda campanha promocional
    await request(app.getHttpServer())
      .post(`/campaigns/${secondPromo.body.id}/cancel`)
      .set(as('admin'))
      .expect(200)
      .expect((res) => expect(res.body.status).toBe('canceled'));

    // 3. Filtros de logs e exportação CSV
    await request(app.getHttpServer())
      .get(
        `/notifications/emails?campaignId=${promoCreate.body.id}&recipient=opted@e2e-camp.example.org`,
      )
      .set(as('analyzer'))
      .expect(403);

    const analyzerLogsRes = await request(app.getHttpServer())
      .get(`/notifications/emails?campaignId=${promoCreate.body.id}`)
      .set(as('analyzer'))
      .expect(200);
    expect(analyzerLogsRes.body.total).toBeGreaterThanOrEqual(2);
    expect(analyzerLogsRes.body.data[0].to).toBe('[redacted]');

    const adminLogsRes = await request(app.getHttpServer())
      .get(
        `/notifications/emails?campaignId=${promoCreate.body.id}&recipient=opted@e2e-camp.example.org`,
      )
      .set(as('admin'))
      .expect(200);
    expect(adminLogsRes.body.total).toBeGreaterThanOrEqual(2);
    expect(adminLogsRes.body.data[0].to).toBe('opted@e2e-camp.example.org');

    const csvRes = await request(app.getHttpServer())
      .get(`/notifications/emails/export?campaignId=${promoCreate.body.id}`)
      .set(as('admin'))
      .expect(200);
    expect(csvRes.text).toContain('campaignId');
    expect(csvRes.text).toContain(promoCreate.body.id);

    // 4. Anonimização de destinatários após 365 dias preservando contagens e supressões
    await dataSource.query(
      `UPDATE email_campaign_recipients SET "createdAt" = NOW() - INTERVAL '366 days' WHERE id = $1`,
      [failedRecipient.id],
    );
    const anonymizedCount = await campaignsService.cleanupOldRecipients();
    expect(anonymizedCount).toBeGreaterThanOrEqual(1);

    const anonRow = (await dataSource.query(
      `SELECT email, name, "emailNormalized", "unsubscribeTokenHash", status FROM email_campaign_recipients WHERE id = $1`,
      [failedRecipient.id],
    )) as Array<{
      email: string | null;
      name: string | null;
      emailNormalized: string | null;
      unsubscribeTokenHash: string | null;
      status: string;
    }>;
    expect(anonRow[0]).toEqual({
      email: null,
      name: null,
      emailNormalized: null,
      unsubscribeTokenHash: null,
      status: 'sent',
    });
  });

  it('executa down e up da Migration 048 preservando membros e email_logs pré-existentes', async () => {
    const preLogCount = (await dataSource.query(
      `SELECT COUNT(*)::int AS cnt FROM email_logs WHERE "to" LIKE '%@e2e-camp.example.org'`,
    )) as Array<{ cnt: number }>;
    expect(preLogCount[0].cnt).toBeGreaterThan(0);

    // Limpa campanhas de teste para permitir o down/up limpo e validar preservação de members e email_logs
    await dataSource.query(
      `DELETE FROM email_campaign_recipients WHERE "campaignId" IN (SELECT id FROM email_campaigns WHERE "createdById" = ANY($1::uuid[]))`,
      [actorIds],
    );
    await dataSource.query(
      `DELETE FROM email_campaigns WHERE "createdById" = ANY($1::uuid[])`,
      [actorIds],
    );

    const queryRunner = dataSource.createQueryRunner();
    const migration = new Migration048EmailCampaigns1795100000000();
    await migration.down(queryRunner);
    await migration.up(queryRunner);
    await queryRunner.release();

    const postLogCount = (await dataSource.query(
      `SELECT COUNT(*)::int AS cnt FROM email_logs WHERE "to" LIKE '%@e2e-camp.example.org'`,
    )) as Array<{ cnt: number }>;
    expect(postLogCount[0].cnt).toBe(preLogCount[0].cnt);

    const memberCheck = (await dataSource.query(
      `SELECT "marketingEmailOptIn" FROM members WHERE id = $1`,
      [actors.admin.sub],
    )) as Array<{ marketingEmailOptIn: boolean }>;
    expect(memberCheck[0]?.marketingEmailOptIn).toBe(false);
  });
});

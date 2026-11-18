import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createE2eApplication } from './e2e-app.helper';
import type { JwtPayload } from '../src/auth/jwt.strategy';
import { Migration049C4P1795200000000 } from '../src/migrations/1795200000000-Migration049_C4P';
import { Migration053EventC4P1795600000000 } from '../src/migrations/1795600000000-Migration053_EventC4P';
import { MemberRole } from '../src/members/entities/member.entity';

const testDatabase = process.env.DB_NAME ?? '';
if (!testDatabase.endsWith('_test')) {
  throw new Error('O E2E de C4P exige DB_NAME terminado em _test.');
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
  email: `${handle}@e2e-c4p.example.org`,
  avatarUrl: '',
  roles,
});

const actors = {
  admin: makeActor(
    '11111111-e400-4000-8000-000000000001',
    'e2e-c4p-admin',
    [MemberRole.ADMIN],
  ),
  organizer: makeActor(
    '11111111-e400-4000-8000-000000000002',
    'e2e-c4p-organizer',
    [MemberRole.EVENT_ORGANIZER],
  ),
  evaluator: makeActor(
    '11111111-e400-4000-8000-000000000003',
    'e2e-c4p-eval',
    [MemberRole.MEMBRO],
  ),
  pendingEval: makeActor(
    '11111111-e400-4000-8000-000000000004',
    'e2e-c4p-pending',
    [MemberRole.MEMBRO],
  ),
  outsider: makeActor(
    '11111111-e400-4000-8000-000000000005',
    'e2e-c4p-outsider',
    [MemberRole.MEMBRO],
  ),
  responsible: makeActor(
    '11111111-e400-4000-8000-000000000006',
    'e2e-c4p-resp',
    [MemberRole.MEMBRO],
  ),
  otherResponsible: makeActor(
    '11111111-e400-4000-8000-000000000007',
    'e2e-c4p-otherresp',
    [MemberRole.MEMBRO],
  ),
} satisfies Record<string, JwtPayload>;

const actorIds = Object.values(actors).map((a) => a.sub);
const communityId = '22222222-e400-4000-8000-000000000001';
const as = (actor: keyof typeof actors) => ({ 'x-test-actor': actor });

describe('C4P (Fase 7) — jornada completa, permissões e migration 049 com PostgreSQL real', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  async function removeFixtures() {
    await dataSource.query(
      `DELETE FROM c4p_votes WHERE "evaluatorDesignationId" IN (SELECT id FROM member_designations WHERE "targetId" IN (SELECT id FROM c4p_calls WHERE slug LIKE 'e2e-c4p%'))`,
    );
    await dataSource.query(`DELETE FROM c4p_talks WHERE "callId" IN (SELECT id FROM c4p_calls WHERE slug LIKE 'e2e-c4p%')`);
    await dataSource.query(`DELETE FROM c4p_calls WHERE slug LIKE 'e2e-c4p%'`);
    await dataSource.query(`DELETE FROM external_event_activations WHERE "eventKey" LIKE 'sympla:e2e-c4p%'`);
    await dataSource.query(`DELETE FROM managed_events WHERE slug LIKE 'e2e-c4p%'`);
    await dataSource.query(
      `DELETE FROM member_designations WHERE "targetType" = 'c4p_campaign' OR ("targetType" = 'community' AND "targetId" = $1)`,
      [communityId],
    );
    await dataSource.query(`DELETE FROM communities WHERE id = $1`, [communityId]);
    await dataSource.query(`DELETE FROM audit_logs WHERE "actorId" = ANY($1::uuid[])`, [actorIds]);
    await dataSource.query(`DELETE FROM email_logs WHERE "to" LIKE '%@e2e-c4p.example.org'`);
    await dataSource.query(`DELETE FROM members WHERE id = ANY($1::uuid[])`, [actorIds]);
  }

  beforeAll(async () => {
    ({ app, dataSource } = await createE2eApplication(actors, { turnstile: true }));

    const queryRunner = dataSource.createQueryRunner();
    const existingTable = (await queryRunner.query(
      `SELECT to_regclass('public.c4p_calls') AS table_name`,
    )) as Array<{ table_name: string | null }>;
    if (!existingTable[0]?.table_name) {
      await new Migration049C4P1795200000000().up(queryRunner);
    }
    await queryRunner.release();

    await removeFixtures();

    await dataSource.getRepository('members').save(
      Object.values(actors).map((actor) => ({
        id: actor.sub,
        githubId: `e2e-c4p-gh-${actor.handle}`,
        githubHandle: actor.handle,
        name: actor.name,
        email: actor.email,
        avatarUrl: '',
        roles: actor.roles,
        isActive: true,
      })),
    );

    await dataSource.getRepository('communities').save({
      id: communityId,
      slug: 'e2e-c4p-community',
      name: 'Comunidade E2E C4P',
      description: 'Comunidade sintética de teste',
      emoji: '🧪',
      logoUrl: 'https://codaqui.dev/logo.png',
      level: 'integrada',
      status: 'active',
      sealStatus: 'none',
      siteEnabled: false,
    });
    await dataSource.getRepository('member_designations').save({
      memberId: actors.responsible.sub,
      targetType: 'community',
      targetId: communityId,
      designation: 'responsible',
      appointedById: actors.admin.sub,
      status: 'active',
    });
  }, 60_000);

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it('migration 049: down remove as tabelas e up recria sem tocar em membros', async () => {
    const queryRunner = dataSource.createQueryRunner();
    const migration = new Migration049C4P1795200000000();
    await migration.down(queryRunner);
    const afterDown = (await queryRunner.query(
      `SELECT to_regclass('public.c4p_calls') AS t`,
    )) as Array<{ t: string | null }>;
    expect(afterDown[0].t).toBeNull();
    await migration.up(queryRunner);
    const afterUp = (await queryRunner.query(
      `SELECT to_regclass('public.c4p_calls') AS t`,
    )) as Array<{ t: string | null }>;
    expect(afterUp[0].t).toBe('c4p_calls');
    const indexCheck = (await queryRunner.query(
      `SELECT indexname FROM pg_indexes WHERE indexname = 'UQ_member_designations_c4p_evaluator'`,
    )) as Array<{ indexname: string }>;
    expect(indexCheck[0]?.indexname).toBe('UQ_member_designations_c4p_evaluator');
    await queryRunner.release();

    const member = await dataSource
      .getRepository('members')
      .findOneBy({ id: actors.admin.sub });
    expect(member).not.toBeNull();
  });

  it('migration 053: down/up preserva campanhas e recria a associação externa', async () => {
    const queryRunner = dataSource.createQueryRunner();
    const migration = new Migration053EventC4P1795600000000();
    await migration.up(queryRunner);
    await migration.down(queryRunner);
    const afterDown = (await queryRunner.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'c4p_calls' AND column_name = 'externalActivationId'`,
    )) as Array<{ column_name: string }>;
    expect(afterDown).toHaveLength(0);
    await migration.up(queryRunner);
    const afterUp = (await queryRunner.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'c4p_calls' AND column_name = 'externalActivationId'`,
    )) as Array<{ column_name: string }>;
    expect(afterUp).toHaveLength(1);
    await queryRunner.release();

    const calls = await dataSource.getRepository('c4p_calls').find();
    expect(Array.isArray(calls)).toBe(true);
  });

  describe('jornada completa', () => {
    let callId: string;
    let talkId: string;
    let designationId: string;

    it('organizer cria a campanha em draft', async () => {
      const res = await request(app.getHttpServer())
        .post('/c4p/manage/calls')
        .set(as('organizer'))
        .send({
          slug: 'e2e-c4p-call',
          name: 'C4P E2E',
          communityId,
          publicResults: true,
        })
        .expect(201);
      callId = res.body.id;
      expect(res.body.status).toBe('draft');
      expect(res.body.criteria).toHaveLength(5);
    });

    it('responsável da comunidade dona também gerencia a campanha', async () => {
      await request(app.getHttpServer())
        .patch(`/c4p/manage/calls/${callId}`)
        .set(as('responsible'))
        .send({ name: 'C4P E2E (comunidade)' })
        .expect(200);
    });

    it('responsável de OUTRA comunidade não gerencia (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/c4p/manage/calls/${callId}`)
        .set(as('otherResponsible'))
        .send({ name: 'tentativa' })
        .expect(403);
    });

    it('membro sem papel não gerencia (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/c4p/manage/calls/${callId}`)
        .set(as('outsider'))
        .send({ name: 'tentativa' })
        .expect(403);
    });

    it('abre a campanha (draft → open)', async () => {
      await request(app.getHttpServer())
        .patch(`/c4p/manage/calls/${callId}`)
        .set(as('organizer'))
        .send({ status: 'open' })
        .expect(200);
    });

    it('submissão pública grava consentimento e confirma por e-mail (skipped)', async () => {
      const res = await request(app.getHttpServer())
        .post('/c4p/public/calls/e2e-c4p-call/submissions')
        .send({
          speakerName: 'Maria Sintética',
          speakerEmail: 'maria@e2e-c4p.example.org',
          title: 'Palestra E2E',
          summary: 'Resumo da palestra.',
          consent: true,
          turnstileToken: 'development',
        });
      expect(res.status).toBe(201);
      talkId = res.body.id;
      expect(Object.keys(res.body)).toEqual(['id']);

      const talk = await dataSource.getRepository('c4p_talks').findOneBy({ id: talkId });
      expect(talk?.origin).toBe('public_form');
      expect(talk?.consentAt).not.toBeNull();

      const log = await dataSource.query(
        `SELECT status FROM email_logs WHERE "to" = 'maria@e2e-c4p.example.org' ORDER BY "createdAt" DESC LIMIT 1`,
      );
      expect(log[0]?.status).toBe('skipped');
    });

    it('convida avaliador (pending) e reconvite é idempotente', async () => {
      const res = await request(app.getHttpServer())
        .post(`/c4p/manage/calls/${callId}/evaluators`)
        .set(as('organizer'))
        .send({ handleOrEmail: 'e2e-c4p-eval' })
        .expect(201);
      designationId = res.body.id;
      expect(res.body.status).toBe('pending');

      await request(app.getHttpServer())
        .post(`/c4p/manage/calls/${callId}/evaluators`)
        .set(as('organizer'))
        .send({ handleOrEmail: 'e2e-c4p-eval' })
        .expect(201)
        .expect((res2) => expect(res2.body.id).toBe(designationId));
    });

    it('convite para membro inexistente retorna 404', async () => {
      await request(app.getHttpServer())
        .post(`/c4p/manage/calls/${callId}/evaluators`)
        .set(as('organizer'))
        .send({ handleOrEmail: 'nao-existe' })
        .expect(404);
    });

    it('segundo convite pendente para avaliação de permissões de voto', async () => {
      await request(app.getHttpServer())
        .post(`/c4p/manage/calls/${callId}/evaluators`)
        .set(as('organizer'))
        .send({ handleOrEmail: 'e2e-c4p-pending' })
        .expect(201);
    });

    it('avaliador pendente não vota (403)', async () => {
      await request(app.getHttpServer())
        .put(`/c4p/evaluator/calls/${callId}/talks/${talkId}/vote`)
        .set(as('pendingEval'))
        .send({ scores: { relevancia: 5 } })
        .expect(403);
    });

    it('membro sem designation não vota (403)', async () => {
      await request(app.getHttpServer())
        .put(`/c4p/evaluator/calls/${callId}/talks/${talkId}/vote`)
        .set(as('outsider'))
        .send({ scores: { relevancia: 5 } })
        .expect(403);
    });

    it('avaliador aceita o convite e vota com upsert', async () => {
      await request(app.getHttpServer())
        .post(`/c4p/evaluator/designations/${designationId}/accept`)
        .set(as('evaluator'))
        .expect(201);

      await request(app.getHttpServer())
        .put(`/c4p/evaluator/calls/${callId}/talks/${talkId}/vote`)
        .set(as('evaluator'))
        .send({ scores: { relevancia: 8 } })
        .expect(200);

      await request(app.getHttpServer())
        .put(`/c4p/evaluator/calls/${callId}/talks/${talkId}/vote`)
        .set(as('evaluator'))
        .send({ scores: { relevancia: 6, clareza: 4 }, comment: 'revisado' })
        .expect(200);

      const votes = await dataSource.getRepository('c4p_votes').find();
      expect(votes).toHaveLength(1);
      expect(votes[0].scores).toEqual({ relevancia: 6, clareza: 4 });
      expect(votes[0].comment).toBe('revisado');
    });

    it('voto com critério desconhecido retorna 400', async () => {
      await request(app.getHttpServer())
        .put(`/c4p/evaluator/calls/${callId}/talks/${talkId}/vote`)
        .set(as('evaluator'))
        .send({ scores: { inexistente: 5 } })
        .expect(400);
    });

    it('dashboard reflete o voto', async () => {
      const res = await request(app.getHttpServer())
        .get(`/c4p/manage/calls/${callId}/dashboard`)
        .set(as('organizer'))
        .expect(200);
      expect(res.body.totals.talks).toBe(1);
      expect(res.body.totals.votes).toBe(1);
      expect(res.body.ranking[0].avgTotal).toBeCloseTo(5);
    });

    it('organizer NÃO finaliza (403); admin finaliza', async () => {
      await request(app.getHttpServer())
        .post(`/c4p/manage/calls/${callId}/finalize`)
        .set(as('organizer'))
        .send({ talkIds: [talkId] })
        .expect(403);

      await request(app.getHttpServer())
        .post(`/c4p/manage/calls/${callId}/finalize`)
        .set(as('admin'))
        .send({ talkIds: [talkId] })
        .expect(201)
        .expect((res) => {
          expect(res.body.status).toBe('closed');
          expect(res.body.selectedTalkIds).toEqual([talkId]);
        });
    });

    it('voto em campanha fechada retorna 409', async () => {
      await request(app.getHttpServer())
        .put(`/c4p/evaluator/calls/${callId}/talks/${talkId}/vote`)
        .set(as('evaluator'))
        .send({ scores: { relevancia: 1 } })
        .expect(409);
    });

    it('resultado público mostra aprovadas sem notas nem contato', async () => {
      const res = await request(app.getHttpServer())
        .get('/c4p/public/calls/e2e-c4p-call/results')
        .expect(200);
      expect(res.body.talks).toHaveLength(1);
      expect(res.body.talks[0]).toEqual({
        title: 'Palestra E2E',
        speakerName: 'Maria Sintética',
        track: null,
        level: null,
      });
      const json = JSON.stringify(res.body);
      expect(json).not.toContain('scores');
      expect(json).not.toContain('comment');
      expect(json).not.toContain('maria@e2e-c4p.example.org');
    });

    it('snapshot inclui a campanha fechada com resultados', async () => {
      const res = await request(app.getHttpServer())
        .get('/c4p/public/snapshot')
        .expect(200);
      const call = res.body.calls.find((c) => c.slug === 'e2e-c4p-call');
      expect(call).toBeDefined();
      expect(call.status).toBe('closed');
      expect(call.results.talks).toHaveLength(1);
      expect(call.community.slug).toBe('e2e-c4p-community');
      const json = JSON.stringify(res.body);
      expect(json).not.toContain('maria@e2e-c4p.example.org');
    });

    it('reabrir limpa a seleção (admin)', async () => {
      await request(app.getHttpServer())
        .post(`/c4p/manage/calls/${callId}/reopen`)
        .set(as('admin'))
        .expect(201)
        .expect((res) => {
          expect(res.body.status).toBe('open');
          expect(res.body.selectedTalkIds).toBeNull();
          expect(res.body.finalizedAt).toBeNull();
        });
    });
  });

  describe('C4P como recurso da atividade', () => {
    it('ativa por evento próprio/externo sem duplicar e associa o resultado público', async () => {
      const managedEventId = '33333333-e400-4000-8000-000000000001';
      await dataSource.getRepository('managed_events').save({
        id: managedEventId,
        slug: 'e2e-c4p-managed',
        title: 'Evento E2E C4P',
        summary: 'Evento sintético',
        location: 'Online',
        startAt: new Date('2027-01-10T12:00:00.000Z'),
        communityProjectKey: 'devparana',
        status: 'draft',
        createdByMemberId: actors.admin.sub,
      });

      const managed = await request(app.getHttpServer())
        .post(`/events/${managedEventId}/c4p`)
        .set(as('organizer'))
        .send({ slug: 'e2e-c4p-managed-call', name: 'C4P — Evento E2E' })
        .expect(201);
      expect(managed.body.managedEventId).toBe(managedEventId);
      const managedRepeat = await request(app.getHttpServer())
        .post(`/events/${managedEventId}/c4p`)
        .set(as('organizer'))
        .send({ slug: 'e2e-c4p-managed-call', name: 'C4P — Evento E2E' })
        .expect(201);
      expect(managedRepeat.body.id).toBe(managed.body.id);

      const eventKey = 'sympla:e2e-c4p:123';
      const external = await request(app.getHttpServer())
        .post(`/events/external/${eventKey}/c4p`)
        .set(as('admin'))
        .send({
          slug: 'e2e-c4p-external-call',
          name: 'C4P — Evento Externo E2E',
          communityProjectKey: 'devparana',
          title: 'Evento Externo E2E',
          startAt: '2027-01-10T12:00:00.000Z',
          publicResults: true,
        });
      if (external.status !== 201) throw new Error(JSON.stringify(external.body));
      expect(external.body.externalActivationId).toBeDefined();
      const externalRepeat = await request(app.getHttpServer())
        .post(`/events/external/${eventKey}/c4p`)
        .set(as('admin'))
        .send({
          slug: 'e2e-c4p-external-call',
          name: 'C4P — Evento Externo E2E',
          communityProjectKey: 'devparana',
        })
        .expect(201);
      expect(externalRepeat.body.id).toBe(external.body.id);

      await request(app.getHttpServer())
        .post(`/events/external/${eventKey}/activate`)
        .set(as('admin'))
        .send({ features: ['checkin'], communityProjectKey: 'devparana', workloadMinutes: 60 })
        .expect(201)
        .expect((res) => expect(res.body.features).toEqual(['checkin', 'c4p']));
      await request(app.getHttpServer())
        .post(`/events/external/${eventKey}/activate`)
        .set(as('admin'))
        .send({ features: ['c4p'], communityProjectKey: 'devparana' })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/c4p/manage/calls/${external.body.id}`)
        .set(as('admin'))
        .send({ status: 'open' })
        .expect(200);
      const submission = await request(app.getHttpServer())
        .post('/c4p/public/calls/e2e-c4p-external-call/submissions')
        .send({
          speakerName: 'Palestrante Externo',
          speakerEmail: 'externo@e2e-c4p.example.org',
          title: 'Palestra Externa E2E',
          summary: 'Resumo.',
          consent: true,
          turnstileToken: 'development',
        })
        .expect(201);
      const invite = await request(app.getHttpServer())
        .post(`/c4p/manage/calls/${external.body.id}/evaluators`)
        .set(as('admin'))
        .send({ handleOrEmail: 'e2e-c4p-eval' })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/c4p/evaluator/designations/${invite.body.id}/accept`)
        .set(as('evaluator'))
        .expect(201);
      await request(app.getHttpServer())
        .put(`/c4p/evaluator/calls/${external.body.id}/talks/${submission.body.id}/vote`)
        .set(as('evaluator'))
        .send({ scores: { relevancia: 9 } })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/c4p/manage/calls/${external.body.id}/finalize`)
        .set(as('admin'))
        .send({ talkIds: [submission.body.id] })
        .expect(201);

      const snapshot = await request(app.getHttpServer())
        .get('/c4p/public/snapshot')
        .expect(200);
      const publicCall = snapshot.body.calls.find((call) => call.slug === 'e2e-c4p-external-call');
      expect(publicCall.externalEventKey).toBe(eventKey);
      expect(publicCall.results.talks[0].title).toBe('Palestra Externa E2E');
      expect(JSON.stringify(publicCall)).not.toContain('externo@e2e-c4p.example.org');
    }, 60_000);
  });
});

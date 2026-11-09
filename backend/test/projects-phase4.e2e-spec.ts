import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../src/auth/jwt.strategy';

const testDatabase = process.env.DB_NAME ?? '';
if (!testDatabase.endsWith('_test')) {
  throw new Error('O E2E da Fase 4 exige DB_NAME terminado em _test.');
}

const actors = {
  admin: { sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', handle: 'e2e-admin', roles: ['admin'] },
  director: { sub: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', handle: 'e2e-director', roles: ['membro', 'diretor'] },
  mentor: { sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', handle: 'e2e-mentor', roles: ['membro', 'mentor'] },
  participant: { sub: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', handle: 'e2e-participant', roles: ['membro'] },
  contender: { sub: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', handle: 'e2e-contender', roles: ['membro'] },
  finance: { sub: 'ffffffff-ffff-4fff-8fff-ffffffffffff', handle: 'e2e-finance', roles: ['membro', 'finance-analyzer'] },
} satisfies Record<string, JwtPayload>;

type ActorName = keyof typeof actors;
const actorIds = Object.values(actors).map((actor) => actor.sub);
const as = (actor: ActorName) => ({ 'x-test-actor': actor });

describe('Fase 4 — jornada de projetos com PostgreSQL real', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  async function removeFixtures() {
    await dataSource.query('DELETE FROM email_logs WHERE "to" LIKE $1', ['%@e2e.invalid']);
    await dataSource.query('DELETE FROM audit_logs WHERE "actorId" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM project_certificates WHERE "memberId" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM hour_ledger WHERE "memberId" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM project_participants WHERE "memberId" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM member_designations WHERE "memberId" = ANY($1::uuid[]) OR "appointedById" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM extension_projects WHERE "createdById" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM assemblies WHERE "createdById" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM partnerships WHERE "entityId" IN (SELECT id FROM entities WHERE "registeredById" = ANY($1::uuid[]))', [actorIds]);
    await dataSource.query('DELETE FROM entities WHERE "registeredById" = ANY($1::uuid[])', [actorIds]);
    await dataSource.query('DELETE FROM directorates WHERE slug = $1', ['e2e-directorate']);
    await dataSource.query('DELETE FROM members WHERE id = ANY($1::uuid[])', [actorIds]);
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: JwtPayload }>();
          const actor = req.headers['x-test-actor'] as ActorName | undefined;
          req.user = actor ? actors[actor] : undefined;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    await removeFixtures();

    await dataSource.getRepository('members').save(Object.entries(actors).map(([key, actor]) => ({
      id: actor.sub,
      githubId: `e2e-${key}`,
      githubHandle: actor.handle,
      name: `Ator sintético ${key}`,
      email: `${key}@e2e.invalid`,
      roles: actor.roles,
    })));
    const directorate = await dataSource.getRepository('directorates').save({
      slug: 'e2e-directorate',
      name: 'Diretoria E2E',
      description: 'Fixture sintética',
    });
    await dataSource.getRepository('member_designations').save({
      memberId: actors.director.sub,
      targetType: 'directorate',
      targetId: directorate.id,
      targetKey: null,
      designation: 'director',
      status: 'active',
      appointedById: actors.admin.sub,
      confirmedById: actors.admin.sub,
      confirmedAt: new Date('2026-11-01T12:00:00.000Z'),
    });
  });

  afterAll(async () => {
    await removeFixtures();
    if (app) await app.close();
  });

  it('executa a jornada e serializa vagas, horas, comprovantes e assembleias', async () => {
    const entityResponse = await request(app.getHttpServer())
      .post('/entities')
      .set(as('director'))
      .send({ name: 'Entidade E2E', type: 'ong' })
      .expect(201);
    const entityId = entityResponse.body.id as string;

    const draftResponse = await request(app.getHttpServer())
      .post('/projects')
      .set(as('director'))
      .send({ name: 'Projeto E2E', entityId })
      .expect(201);
    const projectId = draftResponse.body.id as string;
    expect(draftResponse.body.status).toBe('draft');

    const proposedResponse = await request(app.getHttpServer())
      .patch(`/projects/${projectId}`)
      .set(as('director'))
      .send({
        status: 'proposed',
        kind: 'projeto',
        summary: 'Projeto sintético para validação da jornada.',
        startsAt: '2026-12-10',
        endsAt: '2026-12-20',
        registrationStartsAt: '2026-11-01',
        registrationEndsAt: '2026-12-01',
        odsPrimary: 4,
        odsSecondary: [5],
        targetCommunity: 'Participantes sintéticos',
        justification: 'Validar a implementação.',
        objective: 'Exercitar a jornada completa.',
        skillsDeveloped: 'Colaboração e testes.',
        methodology: 'PjBL',
        totalHours: 4,
        schedule: [{ numero: 1, descricao: 'Encontro único', carga: 4 }],
        maxParticipants: 1,
        mentorMemberId: actors.mentor.sub,
      });
    expect(proposedResponse.body).toMatchObject({ status: 'proposed' });
    expect(proposedResponse.status).toBe(200);

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}`)
      .set(as('director'))
      .send({ status: 'active' })
      .expect(200);

    const joins = await Promise.all([
      request(app.getHttpServer()).post(`/projects/${projectId}/join`).set(as('participant')),
      request(app.getHttpServer()).post(`/projects/${projectId}/join`).set(as('contender')),
    ]);
    expect(joins.map((response) => response.status).sort()).toEqual([201, 409]);
    const participants = await dataSource.query(
      'SELECT "memberId" FROM project_participants WHERE "projectId" = $1 AND role = $2 AND "leftAt" IS NULL',
      [projectId, 'participant'],
    );
    expect(participants).toHaveLength(1);

    const participantsResponse = await request(app.getHttpServer())
      .get(`/projects/${projectId}/participants`)
      .set(as('mentor'))
      .expect(200);
    expect(participantsResponse.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ memberId: actors.mentor.sub, role: 'mentor' }),
      expect.objectContaining({ memberId: actors.participant.sub, role: 'participant' }),
    ]));

    const hourPayload = {
      memberId: actors.participant.sub,
      hours: 4,
      occurredAt: '2026-11-08',
      description: 'Encontro E2E',
      idempotencyKey: 'e2e-hour-1',
    };
    const hourResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/hours`)
      .set(as('mentor'))
      .send(hourPayload)
      .expect(201);
    const hourId = hourResponse.body.id as string;
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/hours`)
      .set(as('mentor'))
      .send(hourPayload)
      .expect(409);
    expect(await dataSource.query('SELECT id FROM hour_ledger WHERE "memberId" = $1 AND "idempotencyKey" = $2', [actors.participant.sub, 'e2e-hour-1'])).toHaveLength(1);

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/hours/${hourId}`)
      .set(as('mentor'))
      .send({ hours: 3, description: 'Encontro E2E revisado' })
      .expect(200);
    const hoursList = await request(app.getHttpServer())
      .get(`/projects/${projectId}/hours`)
      .set(as('mentor'))
      .expect(200);
    expect(hoursList.body[0]).toMatchObject({ id: hourId, hours: 3, status: 'pending' });
    expect(hoursList.body[0]).not.toHaveProperty('idempotencyKey');
    expect(hoursList.body[0]).not.toHaveProperty('reportedById');

    await request(app.getHttpServer())
      .post(`/hours/${hourId}/approve`)
      .set(as('finance'))
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}`)
      .set(as('mentor'))
      .send({ status: 'finished', reportDiscussionUrl: 'https://github.com/codaqui/institucional/discussions/900' })
      .expect(200);

    const certificates = await Promise.all([
      request(app.getHttpServer()).post(`/project-certificates/projects/${projectId}`).set(as('participant')).send({ kind: 'participant' }),
      request(app.getHttpServer()).post(`/project-certificates/projects/${projectId}`).set(as('participant')).send({ kind: 'participant' }),
    ]);
    expect(certificates.map((response) => response.status)).toEqual([201, 201]);
    expect(certificates[0].body.code).toBe(certificates[1].body.code);
    expect(certificates[0].body.hoursAtIssue).toBe(3);
    expect(await dataSource.query('SELECT id FROM project_certificates WHERE "projectId" = $1 AND "memberId" = $2 AND kind = $3', [projectId, actors.participant.sub, 'participant'])).toHaveLength(1);

    await request(app.getHttpServer())
      .get(`/project-certificates/verify/${certificates[0].body.code}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ valid: true, projectName: 'Projeto E2E', hoursAtIssue: 3 });
      });

    const assemblyPayload = {
      entityId,
      type: 'ordinaria',
      title: 'Assembleia E2E',
      scheduledAt: '2026-12-01T18:00:00.000Z',
      agendaSummary: 'Pauta sintética.',
    };
    const assemblies = await Promise.all([
      request(app.getHttpServer()).post('/assemblies').set(as('admin')).send({ ...assemblyPayload, discussionUrl: 'https://github.com/codaqui/institucional/discussions/901' }),
      request(app.getHttpServer()).post('/assemblies').set(as('admin')).send({ ...assemblyPayload, discussionUrl: 'https://github.com/codaqui/institucional/discussions/902' }),
    ]);
    expect(assemblies.map((response) => response.status)).toEqual([201, 201]);
    expect(assemblies.map((response) => response.body.number).sort((a, b) => a - b)).toEqual([1, 2]);
    expect(assemblies.every((response) => response.body.entity.slug === 'entidade-e2e')).toBe(true);
  });
});

jest.setTimeout(60_000);

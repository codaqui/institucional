import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AssembliesController } from '../src/assemblies/assemblies.controller';
import { AssembliesService } from '../src/assemblies/assemblies.service';
import { Assembly } from '../src/assemblies/entities/assembly.entity';
import { AuditService } from '../src/audit/audit.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../src/auth/jwt.strategy';
import { DesignationsService } from '../src/designations/designations.service';
import { MemberDesignation } from '../src/designations/entities/member-designation.entity';
import { Directorate } from '../src/directorates/entities/directorate.entity';
import { Member, MemberRole } from '../src/members/entities/member.entity';

const testDatabase =
  process.env.ASSEMBLIES_TEST_DB_NAME ?? 'codaqui_assemblies_test';
if (!testDatabase.endsWith('_test')) {
  throw new Error('O banco E2E de assembleias precisa terminar em _test.');
}

const actors = {
  admin: {
    sub: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    handle: 'admin-sintetico',
    roles: [MemberRole.ADMIN],
  } as JwtPayload,
  director: {
    sub: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    handle: 'diretor-sintetico',
    roles: [MemberRole.MEMBRO, MemberRole.DIRETOR],
  } as JwtPayload,
};

type ActorName = keyof typeof actors;

function as(actor: ActorName) {
  return { 'x-test-actor': actor };
}

const createPayload = {
  type: 'ordinaria',
  title: 'Assembleia sintética',
  scheduledAt: '2026-12-01T18:00:00.000Z',
  agendaSummary: 'Pauta sintética para validação local.',
  discussionUrl: 'https://github.com/codaqui/institucional/discussions/901',
};

describe('Assemblies API com PostgreSQL real', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.ASSEMBLIES_TEST_DB_HOST ?? '127.0.0.1',
          port: Number(process.env.ASSEMBLIES_TEST_DB_PORT ?? 55439),
          username: process.env.ASSEMBLIES_TEST_DB_USER ?? 'postgres',
          password: process.env.ASSEMBLIES_TEST_DB_PASSWORD ?? 'postgres',
          database: testDatabase,
          entities: [Assembly, Member, MemberDesignation, Directorate],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([Assembly, Member, MemberDesignation]),
      ],
      controllers: [AssembliesController],
      providers: [
        AssembliesService,
        DesignationsService,
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<{
            headers: Record<string, string | undefined>;
            user?: JwtPayload;
          }>();
          const actor = req.headers['x-test-actor'] as ActorName | undefined;
          req.user = actors[actor ?? 'admin'];
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    dataSource = moduleFixture.get(DataSource);
  });

  beforeEach(async () => {
    await dataSource.getRepository(Assembly).clear();
    await dataSource.getRepository(MemberDesignation).clear();
    await dataSource.getRepository(Directorate).clear();
    await dataSource.getRepository(Member).clear();

    await dataSource.getRepository(Member).save([
      {
        id: actors.admin.sub,
        githubId: 'assembly-admin-synthetic',
        githubHandle: actors.admin.handle,
        name: 'Admin sintético',
        email: 'admin@example.invalid',
        roles: [MemberRole.ADMIN],
      },
      {
        id: actors.director.sub,
        githubId: 'assembly-director-synthetic',
        githubHandle: actors.director.handle,
        name: 'Diretor sintético',
        email: 'director@example.invalid',
        roles: [MemberRole.MEMBRO, MemberRole.DIRETOR],
      },
    ]);
    const directorate = await dataSource.getRepository(Directorate).save({
      slug: 'diretoria-sintetica',
      name: 'Diretoria sintética',
      description: null,
    });
    await dataSource.getRepository(MemberDesignation).save({
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
    if (app) await app.close();
  });

  function createAssembly(
    overrides: Record<string, unknown> = {},
  ): Promise<Assembly> {
    return dataSource.getRepository(Assembly).save({
      type: 'ordinaria',
      number: 1,
      title: 'Assembleia sintética',
      scheduledAt: new Date('2026-12-01T18:00:00.000Z'),
      heldAt: null,
      status: 'scheduled',
      agendaSummary: 'Pauta sintética para validação local.',
      discussionUrl: createPayload.discussionUrl,
      ataPdfUrl: null,
      notaryRegistry: null,
      createdById: actors.admin.sub,
      ...overrides,
    });
  }

  it('permite POST por diretor não-admin com designation real', async () => {
    const response = await request(app.getHttpServer())
      .post('/assemblies')
      .set(as('director'))
      .send(createPayload);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      type: 'ordinaria',
      number: 1,
      slug: 'ordinaria-1',
    });
  });

  it('permite PATCH por diretor não-admin com designation real', async () => {
    const assembly = await createAssembly();

    const response = await request(app.getHttpServer())
      .patch(`/assemblies/${assembly.id}`)
      .set(as('director'))
      .send({ title: 'Título editado pelo diretor' });

    expect(response.status).toBe(200);
    expect((response.body as { title: string }).title).toBe(
      'Título editado pelo diretor',
    );
  });

  it('serializa realização e cancelamento concorrentes sem romper a terminalidade', async () => {
    const assembly = await createAssembly();
    await dataSource.query(`
      CREATE OR REPLACE FUNCTION delay_assembly_update()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM pg_sleep(0.25);
        RETURN NEW;
      END
      $$;
    `);
    await dataSource.query(`
      CREATE TRIGGER delay_assembly_update
      BEFORE UPDATE ON assemblies
      FOR EACH ROW EXECUTE FUNCTION delay_assembly_update();
    `);

    try {
      const responses = await Promise.all([
        request(app.getHttpServer())
          .patch(`/assemblies/${assembly.id}`)
          .set(as('admin'))
          .send({
            status: 'held',
            heldAt: '2026-12-01T20:00:00.000Z',
          }),
        request(app.getHttpServer())
          .patch(`/assemblies/${assembly.id}`)
          .set(as('admin'))
          .send({ status: 'canceled' }),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([
        200, 400,
      ]);
      const successful = responses.find((response) => response.status === 200)!;
      const persisted = await dataSource
        .getRepository(Assembly)
        .findOneByOrFail({ id: assembly.id });
      expect(persisted.status).toBe(
        (successful.body as { status: string }).status,
      );
      expect(['held', 'canceled']).toContain(persisted.status);
    } finally {
      await dataSource.query(
        'DROP TRIGGER IF EXISTS delay_assembly_update ON assemblies;',
      );
      await dataSource.query(
        'DROP FUNCTION IF EXISTS delay_assembly_update();',
      );
    }
  });

  it('preserva edições simultâneas de campos diferentes', async () => {
    const assembly = await createAssembly();

    const responses = await Promise.all([
      request(app.getHttpServer())
        .patch(`/assemblies/${assembly.id}`)
        .set(as('admin'))
        .send({ title: 'Título concorrente' }),
      request(app.getHttpServer())
        .patch(`/assemblies/${assembly.id}`)
        .set(as('admin'))
        .send({ agendaSummary: 'Pauta concorrente preservada.' }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const persisted = await dataSource
      .getRepository(Assembly)
      .findOneByOrFail({ id: assembly.id });
    expect(persisted).toMatchObject({
      title: 'Título concorrente',
      agendaSummary: 'Pauta concorrente preservada.',
    });
  });

  it.each(['title', 'scheduledAt', 'status', 'agendaSummary'])(
    'retorna 400 para null no campo não anulável %s',
    async (field) => {
      const assembly = await createAssembly();

      const response = await request(app.getHttpServer())
        .patch(`/assemblies/${assembly.id}`)
        .set(as('admin'))
        .send({ [field]: null });

      expect(response.status).toBe(400);
    },
  );

  it('retorna 400 para PDF fora da allowlist', async () => {
    const assembly = await createAssembly();

    const response = await request(app.getHttpServer())
      .patch(`/assemblies/${assembly.id}`)
      .set(as('admin'))
      .send({ ataPdfUrl: 'https://example.invalid/ata.pdf' });

    expect(response.status).toBe(400);
    expect((response.body as { message: string }).message).toContain(
      'Domínio não permitido',
    );
  });
});

jest.setTimeout(30_000);

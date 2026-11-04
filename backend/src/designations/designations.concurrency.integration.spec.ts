import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Member, MemberRole } from '../members/entities/member.entity';
import { MemberDesignation } from './entities/member-designation.entity';
import { DesignationsService } from './designations.service';

const describePostgres = process.env.TEST_POSTGRES_URL ? describe : describe.skip;

describePostgres('DesignationsService concurrency (PostgreSQL)', () => {
  let dataSource: DataSource;
  const schema = `designation_test_${randomUUID().replaceAll('-', '')}`;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: process.env.TEST_POSTGRES_URL,
      schema,
      entities: [Member, MemberDesignation, AuditLog],
    });
    await dataSource.initialize();
    await dataSource.query(`CREATE SCHEMA "${schema}"`);
    await dataSource.synchronize();
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.dropDatabase();
      await dataSource.destroy();
    }
  });

  it('serializes concurrent syncs and preserves manual and all derived roles', async () => {
    const members = dataSource.getRepository(Member);
    const member = await members.save(
      members.create({
        githubId: randomUUID(),
        githubHandle: 'concurrent-member',
        name: 'Concurrent Member',
        email: 'concurrent@example.test',
        roles: [MemberRole.MEMBRO, MemberRole.ADMIN],
      }),
    );
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const createService = () =>
      new DesignationsService(
        dataSource.getRepository(MemberDesignation),
        members,
        dataSource,
        audit as any,
      );
    const actor = { actorId: randomUUID(), actorHandle: 'admin' };

    await Promise.all([
      createService().grant(
        {
          memberId: member.id,
          targetType: 'directorate',
          targetId: randomUUID(),
          designation: 'director',
          appointedById: actor.actorId,
        },
        actor,
      ),
      createService().grant(
        {
          memberId: member.id,
          targetType: 'program',
          targetKey: 'universitario',
          designation: 'manager',
          appointedById: actor.actorId,
        },
        actor,
      ),
    ]);

    const reloaded = await members.findOneByOrFail({ id: member.id });
    expect(reloaded.roles).toEqual(
      expect.arrayContaining([
        MemberRole.MEMBRO,
        MemberRole.ADMIN,
        MemberRole.DIRETOR,
        MemberRole.VOLUNTARIO,
        MemberRole.GESTOR_UNIVERSITARIO,
      ]),
    );
  }, 30_000);
});

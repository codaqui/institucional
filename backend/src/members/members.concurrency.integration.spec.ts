import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { DesignationsService } from '../designations/designations.service';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { Member, MemberRole } from './entities/member.entity';
import { MembersService } from './members.service';

const describePostgres = process.env.TEST_POSTGRES_URL ? describe : describe.skip;

describePostgres('MembersService concurrency (PostgreSQL)', () => {
  let dataSource: DataSource;
  const schema = `member_test_${randomUUID().replaceAll('-', '')}`;

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

  it('preserves admin updates and derived roles under a concurrent sync', async () => {
    const members = dataSource.getRepository(Member);
    const member = await members.save(
      members.create({
        githubId: randomUUID(),
        githubHandle: 'concurrent-admin-update',
        name: 'Concurrent Member',
        email: 'concurrent-admin@example.test',
        roles: [MemberRole.MEMBRO],
      }),
    );
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const designations = new DesignationsService(
      dataSource.getRepository(MemberDesignation),
      members,
      dataSource,
      audit as any,
    );
    const membersService = new MembersService(
      members,
      {} as any,
      {} as any,
      dataSource,
    );
    const actor = { actorId: randomUUID(), actorHandle: 'admin' };

    await Promise.all([
      membersService.adminUpdate(member.id, { name: 'Updated Member' }),
      designations.grant(
        {
          memberId: member.id,
          targetType: 'directorate',
          targetId: randomUUID(),
          designation: 'director',
          appointedById: actor.actorId,
        },
        actor,
      ),
    ]);

    const reloaded = await members.findOneByOrFail({ id: member.id });
    expect(reloaded.name).toBe('Updated Member');
    expect(reloaded.roles).toEqual(
      expect.arrayContaining([
        MemberRole.MEMBRO,
        MemberRole.DIRETOR,
        MemberRole.VOLUNTARIO,
      ]),
    );
  }, 30_000);
});

import { Migration045BusinessTiers1794700000000 } from '../migrations/1794700000000-Migration045_BusinessTiers';

describe('Migration045_BusinessTiers', () => {
  const queries: string[] = [];
  const queryRunner = {
    query: jest.fn((sql: string) => {
      queries.push(sql);
      return Promise.resolve(undefined);
    }),
  } as any;

  beforeEach(() => {
    queries.length = 0;
    queryRunner.query.mockClear();
  });

  it('adds tier, evidence and annual seal validation without changing existing companies', async () => {
    await new Migration045BusinessTiers1794700000000().up(queryRunner);
    const upSql = queries.join('\n');

    expect(upSql).toContain('ALTER TABLE "companies" ADD "tier" character varying(32) NOT NULL DEFAULT \'amiga\'');
    expect(upSql).toContain('"engagementCriterion" character varying(32)');
    expect(upSql).toContain('"evidenceUrl" text');
    expect(upSql).toContain('"validationNotes" text');
    expect(upSql).toContain('"validatedAt" TIMESTAMPTZ');
    expect(upSql).toContain('"validatedByMemberId" uuid');
    expect(upSql).toContain('"sealValidUntil" TIMESTAMPTZ');
    expect(upSql).toContain('CHECK ("tier" IN (\'amiga\', \'aliada\'))');
    expect(upSql).toContain('CHECK ("engagementCriterion" IN (\'workshop\', \'hiring\', \'business_event\'))');
    expect(upSql).toContain('FOREIGN KEY ("validatedByMemberId") REFERENCES "members"("id") ON DELETE RESTRICT');
    expect(upSql).not.toContain('UPDATE "companies"');
  });

  it('drops only the fields introduced by this migration', async () => {
    await new Migration045BusinessTiers1794700000000().down(queryRunner);
    const downSql = queries.join('\n');

    for (const field of ['tier', 'engagementCriterion', 'evidenceUrl', 'validationNotes', 'validatedAt', 'validatedByMemberId', 'sealValidUntil']) {
      expect(downSql).toContain(`ALTER TABLE "companies" DROP COLUMN "${field}"`);
    }
    expect(downSql).not.toContain('DROP TABLE "companies"');
  });
});

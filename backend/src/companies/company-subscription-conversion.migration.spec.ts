import { Migration052CompanySubscriptionConversion1795500000000 } from '../migrations/1795500000000-CompanySubscriptionConversion052';

describe('Migration052_CompanySubscriptionConversion', () => {
  const queries: string[] = [];
  const queryRunner = {
    query: jest.fn(async (sql: string) => {
      queries.push(sql);
    }),
  } as any;

  beforeEach(() => {
    queries.length = 0;
    queryRunner.query.mockClear();
  });

  it('creates a recoverable conversion table with one conversion per subscription', async () => {
    await new Migration052CompanySubscriptionConversion1795500000000().up(
      queryRunner,
    );
    const sql = queries.join('\n');

    expect(sql).toContain('CREATE TABLE "company_subscription_conversions"');
    for (const field of [
      'id',
      'stripeSubscriptionId',
      'memberId',
      'companyId',
      'requestedById',
      'status',
      'createdAt',
      'updatedAt',
      'completedAt',
    ]) {
      expect(sql).toContain(`"${field}"`);
    }
    expect(sql).toContain('UNIQUE ("stripeSubscriptionId")');
    expect(sql).toContain("CHECK (\"status\" IN ('pending', 'completed'))");
    expect(sql).not.toContain('UPDATE "companies"');
  });

  it('drops only the conversion table on rollback', async () => {
    await new Migration052CompanySubscriptionConversion1795500000000().down(
      queryRunner,
    );
    expect(queries.join('\n')).toContain(
      'DROP TABLE "company_subscription_conversions"',
    );
    expect(queries.join('\n')).not.toContain('DROP TABLE "companies"');
  });
});

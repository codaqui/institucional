import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 008 — Adiciona nome fantasia (tradeName) à tabela companies.
 *
 * O campo é opcional e será usado no comprovante de doação PJ e na
 * personalização da página de patrocinadores.
 */
export class Migration008CompanyTradeName1775163746259
  implements MigrationInterface
{
  name = 'Migration008CompanyTradeName1775163746259';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "tradeName" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "companies" DROP COLUMN IF EXISTS "tradeName"`,
    );
  }
}

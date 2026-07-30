import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration013MemberGithubToken1775163746264 implements MigrationInterface {
  name = 'Migration013MemberGithubToken1775163746264';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Token OAuth do GitHub do membro (AES-256-GCM ou plain: em dev) — usado
    // para escrever no repositório em nome do próprio membro (GitHub-as-Database).
    // A coluna tem select:false na entidade — nunca é exposta em endpoints.
    await queryRunner.query(
      `ALTER TABLE "members" ADD "githubAccessToken" text`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "members" DROP COLUMN "githubAccessToken"`,
    );
  }
}

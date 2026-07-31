import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration010 — Migração multi-role de membros
 *
 * Substitui a coluna single-value `role` (enum `members_role_enum`) por
 * `roles text[]` (array nativo do Postgres), permitindo que um mesmo membro
 * acumule papéis (ex.: ['membro', 'event_organizer', 'event_checker']).
 *
 * Passos:
 *  1. ADD COLUMN roles text[] NOT NULL DEFAULT '{membro}'.
 *  2. Backfill: roles = ARRAY[role::text] (preserva o papel atual).
 *  3. DROP COLUMN role.
 *  4. DROP TYPE members_role_enum (fica órfão após o drop da coluna).
 *
 * O down() recria a coluna `role` a partir de roles[1] (melhor esforço:
 * papéis novos que não existiam no enum antigo viram 'membro').
 */
export class Migration010MemberRolesArray1775163746261
  implements MigrationInterface
{
  name = 'Migration010MemberRolesArray1775163746261';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "members" ADD COLUMN "roles" text[] NOT NULL DEFAULT '{membro}'
        `);

    await queryRunner.query(`
            UPDATE "members" SET "roles" = ARRAY["role"::text]
        `);

    await queryRunner.query(`
            ALTER TABLE "members" DROP COLUMN "role"
        `);

    await queryRunner.query(`
            DROP TYPE IF EXISTS "public"."members_role_enum"
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TYPE "public"."members_role_enum" AS ENUM('membro', 'finance-analyzer', 'admin')
        `);

    await queryRunner.query(`
            ALTER TABLE "members" ADD COLUMN "role" "public"."members_role_enum"
        `);

    // Melhor esforço: papéis inexistentes no enum antigo (event_*) viram 'membro'
    await queryRunner.query(`
            UPDATE "members"
            SET "role" = CASE
                WHEN "roles"[1] IN ('membro', 'finance-analyzer', 'admin')
                    THEN "roles"[1]::"public"."members_role_enum"
                ELSE 'membro'::"public"."members_role_enum"
            END
        `);

    await queryRunner.query(`
            ALTER TABLE "members" ALTER COLUMN "role" SET NOT NULL
        `);

    await queryRunner.query(`
            ALTER TABLE "members" ALTER COLUMN "role" SET DEFAULT 'membro'::"public"."members_role_enum"
        `);

    await queryRunner.query(`
            ALTER TABLE "members" DROP COLUMN "roles"
        `);
  }
}

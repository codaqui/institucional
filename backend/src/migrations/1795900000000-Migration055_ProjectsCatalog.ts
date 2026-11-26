import { MigrationInterface, QueryRunner } from 'typeorm';
import { CATALOG_SEED } from '../projects/catalog-seed';
import { normalizeProjectName } from '../projects/project.rules';

const ENTITIES = [
  { slug: 'codaqui', name: 'Associação Codaqui', website: 'https://codaqui.dev' },
  { slug: 'devparana', name: 'DevParaná', website: 'https://devparana.org' },
  { slug: 'tisocial', name: 'T.I. Social', website: 'https://tisocial.org.br' },
] as const;

export class Migration055ProjectsCatalog1795900000000 implements MigrationInterface {
  name = 'Migration055ProjectsCatalog1795900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "extension_projects" ADD "category" varchar(24) NOT NULL DEFAULT 'extension'`,
    );
    await queryRunner.query(
      `ALTER TABLE "extension_projects" ADD "canonicalUrl" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "extension_projects" ADD CONSTRAINT "CK_extension_projects_category" CHECK ("category" IN ('program', 'extension', 'campaign', 'open_source'))`,
    );

    const importers = await queryRunner.query(
      'SELECT "id" FROM "members" WHERE "githubHandle" = $1 LIMIT 1',
      ['endersonmenezes'],
    );
    if (importers.length === 0) {
      throw new Error('Migration 055 exige o membro endersonmenezes para registrar a importação.');
    }
    const importerId = importers[0].id as string;

    for (const entity of ENTITIES) {
      await queryRunner.query(
        `INSERT INTO "entities" ("id", "slug", "name", "type", "website", "registeredById", "isActive", "createdAt", "updatedAt")
         VALUES (uuid_generate_v4(), $1, $2, 'outro', $3, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (slug) DO NOTHING`,
        [entity.slug, entity.name, entity.website, importerId],
      );
    }

    const entityIds = new Map<string, string>();
    for (const entity of ENTITIES) {
      const rows = await queryRunner.query(
        'SELECT "id" FROM "entities" WHERE "slug" = $1 LIMIT 1',
        [entity.slug],
      );
      if (rows.length === 0) {
        throw new Error(`Entidade ausente após o seed: ${entity.slug}`);
      }
      entityIds.set(entity.slug, rows[0].id);
    }

    for (const entry of CATALOG_SEED) {
      await queryRunner.query(
        `INSERT INTO "extension_projects" (
          "id", "kind", "category", "name", "normalizedName", "slug", "entityId",
          "summary", "canonicalUrl", "isPublic", "status", "startsAt", "createdById"
        ) VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, $11)
        ON CONFLICT (slug) DO NOTHING`,
        [
          entry.kind,
          entry.category,
          entry.name,
          normalizeProjectName(entry.name),
          entry.slug,
          entityIds.get(entry.entitySlug),
          entry.summary,
          entry.canonicalUrl,
          entry.status,
          entry.startsAt ?? null,
          importerId,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "extension_projects" WHERE "slug" = ANY($1::text[]) AND "category" <> 'extension'`,
      [CATALOG_SEED.map((entry) => entry.slug)],
    );
    await queryRunner.query(
      'ALTER TABLE "extension_projects" DROP CONSTRAINT "CK_extension_projects_category"',
    );
    await queryRunner.query('ALTER TABLE "extension_projects" DROP COLUMN "canonicalUrl"');
    await queryRunner.query('ALTER TABLE "extension_projects" DROP COLUMN "category"');
  }
}

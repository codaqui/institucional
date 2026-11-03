import { Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MigrationInterface, QueryRunner } from 'typeorm';

interface CommunitySeed {
  slug: string;
  name: string;
  description: string;
  emoji: string;
  logoUrl: string;
  location: string | null;
  founded: number | null;
  links: unknown[];
  socialProfiles: unknown[];
  tags: string[];
  level: 'parceira' | 'integrada';
  status: 'proposed' | 'active' | 'suspended' | 'exited';
  sealStatus: 'none' | 'applied' | 'sealed';
  sealGrantedAt?: string | null;
  sealGrantedById?: string | null;
  sealValidUntil?: string | null;
  sealNotes?: string | null;
  siteEnabled: boolean;
  siteDomain: string | null;
}

export class Migration028Communities1793289602000 implements MigrationInterface {
  name = 'Migration028Communities1793289602000';
  private readonly logger = new Logger(
    Migration028Communities1793289602000.name,
  );

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "communities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "slug" character varying(80) NOT NULL,
        "name" character varying(160) NOT NULL,
        "description" text NOT NULL,
        "emoji" character varying(16) NOT NULL,
        "logoUrl" text NOT NULL,
        "location" character varying(160),
        "founded" integer,
        "links" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "socialProfiles" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "tags" text[] NOT NULL DEFAULT '{}'::text[],
        "level" character varying(16) NOT NULL DEFAULT 'parceira',
        "status" character varying(16) NOT NULL DEFAULT 'proposed',
        "sealStatus" character varying(16) NOT NULL DEFAULT 'none',
        "sealGrantedAt" TIMESTAMPTZ,
        "sealGrantedById" uuid,
        "sealValidUntil" TIMESTAMPTZ,
        "sealNotes" text,
        "siteEnabled" boolean NOT NULL DEFAULT false,
        "siteDomain" character varying(255),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_communities" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_communities_slug" UNIQUE ("slug"),
        CONSTRAINT "CHK_communities_level" CHECK ("level" IN ('parceira', 'integrada')),
        CONSTRAINT "CHK_communities_status" CHECK ("status" IN ('proposed', 'active', 'suspended', 'exited')),
        CONSTRAINT "CHK_communities_sealStatus" CHECK ("sealStatus" IN ('none', 'applied', 'sealed'))
      )
    `);

    const seedPath = join(__dirname, '../communities/seed/communities.json');
    const seed = JSON.parse(
      await readFile(seedPath, 'utf8'),
    ) as CommunitySeed[];

    const inserts = seed.map((community) => {
      const columns = [
        'slug',
        'name',
        'description',
        'emoji',
        'logoUrl',
        'location',
        'founded',
        'links',
        'socialProfiles',
        'tags',
        'level',
        'status',
        'sealStatus',
        'siteEnabled',
        'siteDomain',
      ];
      const values: unknown[] = [
        community.slug,
        community.name,
        community.description,
        community.emoji,
        community.logoUrl,
        community.location,
        community.founded,
        JSON.stringify(community.links),
        JSON.stringify(community.socialProfiles),
        community.tags,
        community.level,
        community.status,
        community.sealStatus,
        community.siteEnabled,
        community.siteDomain,
      ];
      const optionalSealColumns = [
        'sealGrantedAt',
        'sealGrantedById',
        'sealValidUntil',
        'sealNotes',
      ] as const;
      for (const column of optionalSealColumns) {
        if (community[column] != null) {
          columns.push(column);
          values.push(community[column]);
        }
      }

      const quotedColumns = columns.map((column) => `"${column}"`).join(', ');
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      return queryRunner.query(
        `INSERT INTO "communities" (${quotedColumns})
         VALUES (${placeholders})
         ON CONFLICT ("slug") DO NOTHING`,
        values,
      );
    });
    await Promise.all(inserts);

    const pending = (await queryRunner.query(`
      SELECT c."slug"
      FROM "communities" c
      WHERE c."level" = 'integrada'
        AND NOT EXISTS (
          SELECT 1 FROM "member_designations" d
          WHERE d."targetType" = 'community'
            AND d."targetId" = c."id"
            AND d."designation" = 'responsible'
            AND d."status" = 'active'
        )
      ORDER BY c."slug"
    `)) as Array<{ slug: string }>;
    if (pending.length > 0) {
      this.logger.warn(
        `Integradas sem responsável ativo (pendência de governança): ${pending.map(({ slug }) => slug).join(', ')}`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "communities"`);
  }
}

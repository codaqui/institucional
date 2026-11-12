import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration049C4P1795200000000 implements MigrationInterface {
  name = 'Migration049C4P1795200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "c4p_calls" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "slug" character varying(80) NOT NULL,
        "name" character varying(160) NOT NULL,
        "description" text,
        "managedEventId" uuid,
        "communityId" uuid,
        "status" character varying(16) NOT NULL DEFAULT 'draft',
        "submissionOpenAt" TIMESTAMPTZ,
        "submissionCloseAt" TIMESTAMPTZ,
        "criteria" jsonb NOT NULL,
        "selectedTalkIds" jsonb,
        "publicResults" boolean NOT NULL DEFAULT false,
        "finalizedAt" TIMESTAMPTZ,
        "createdById" uuid NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_c4p_calls" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_c4p_calls_slug" UNIQUE ("slug"),
        CONSTRAINT "CK_c4p_calls_status" CHECK ("status" IN ('draft','open','closed')),
        CONSTRAINT "FK_c4p_calls_managedEvent" FOREIGN KEY ("managedEventId") REFERENCES "managed_events"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_c4p_calls_community" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_c4p_calls_createdBy" FOREIGN KEY ("createdById") REFERENCES "members"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_c4p_calls_status" ON "c4p_calls" ("status")',
    );

    await queryRunner.query(`
      CREATE TABLE "c4p_talks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "callId" uuid NOT NULL,
        "speakerName" character varying(160) NOT NULL,
        "speakerEmail" character varying(160) NOT NULL,
        "speakerPhone" character varying(60),
        "speakerRole" character varying(200),
        "linkedin" character varying(255),
        "spokeBefore" boolean,
        "title" character varying(255) NOT NULL,
        "summary" text NOT NULL,
        "level" character varying(40),
        "track" character varying(255),
        "bio" text,
        "photoUrl" character varying(2000),
        "extraNotes" text,
        "origin" character varying(16) NOT NULL,
        "consentAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_c4p_talks" PRIMARY KEY ("id"),
        CONSTRAINT "CK_c4p_talks_origin" CHECK ("origin" IN ('public_form','csv_import')),
        CONSTRAINT "FK_c4p_talks_call" FOREIGN KEY ("callId") REFERENCES "c4p_calls"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_c4p_talks_call" ON "c4p_talks" ("callId")',
    );

    await queryRunner.query(`
      CREATE TABLE "c4p_votes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "talkId" uuid NOT NULL,
        "evaluatorDesignationId" uuid NOT NULL,
        "scores" jsonb NOT NULL,
        "comment" text,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_c4p_votes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_c4p_votes_talk_evaluator" UNIQUE ("talkId", "evaluatorDesignationId"),
        CONSTRAINT "FK_c4p_votes_talk" FOREIGN KEY ("talkId") REFERENCES "c4p_talks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_c4p_votes_evaluatorDesignation" FOREIGN KEY ("evaluatorDesignationId") REFERENCES "member_designations"("id") ON DELETE RESTRICT
      )
    `);

    // 1 avaliador active por (campanha, membro) — garantia em banco; o service
    // valida antes para mensagem amigável.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_member_designations_c4p_evaluator"
      ON "member_designations" ("targetId", "memberId")
      WHERE "targetType" = 'c4p_campaign'
        AND "designation" = 'evaluator'
        AND "status" = 'active'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "public"."UQ_member_designations_c4p_evaluator"',
    );
    await queryRunner.query('DROP TABLE "c4p_votes"');
    await queryRunner.query('DROP TABLE "c4p_talks"');
    await queryRunner.query('DROP TABLE "c4p_calls"');
  }
}

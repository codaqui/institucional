import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration044Mentorship1794600000000 implements MigrationInterface {
  name = 'Migration044Mentorship1794600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "mentor_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "memberId" uuid NOT NULL UNIQUE,
        "areas" text[] NOT NULL,
        "focus" text,
        "active" boolean NOT NULL DEFAULT true,
        "approvedById" uuid NOT NULL,
        "since" timestamptz NOT NULL DEFAULT now(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mentor_profiles_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_mentor_profile_member" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_mentor_profile_approver" FOREIGN KEY ("approvedById") REFERENCES "members"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "mentor_availability" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "mentorId" uuid NOT NULL,
        "weekday" integer NOT NULL CHECK ("weekday" BETWEEN 0 AND 6),
        "startTime" character varying(5) NOT NULL,
        "endTime" character varying(5) NOT NULL,
        "timeZone" character varying(64) NOT NULL DEFAULT 'America/Sao_Paulo',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mentor_availability_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_mentor_availability_profile" FOREIGN KEY ("mentorId") REFERENCES "mentor_profiles"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "mentorship_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "mentorId" uuid NOT NULL,
        "menteeName" character varying(160) NOT NULL,
        "menteeEmail" character varying(254) NOT NULL,
        "menteeMemberId" uuid,
        "topicTags" text[] NOT NULL,
        "scheduledAt" timestamptz NOT NULL,
        "durationMin" integer NOT NULL CHECK ("durationMin" BETWEEN 15 AND 240),
        "timeZone" character varying(64) NOT NULL DEFAULT 'America/Sao_Paulo',
        "status" character varying(32) NOT NULL DEFAULT 'requested',
        "meetLink" text,
        "notes" text,
        "completedAt" timestamptz,
        "rating" integer CHECK ("rating" BETWEEN 1 AND 5),
        "feedback" text,
        "cancelReason" text,
        "token" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "guestConsentAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mentorship_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_mentorship_session_token" UNIQUE ("token"),
        CONSTRAINT "UQ_mentorship_session_slot" UNIQUE ("mentorId", "scheduledAt"),
        CONSTRAINT "FK_mentorship_session_mentor" FOREIGN KEY ("mentorId") REFERENCES "mentor_profiles"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_mentorship_session_member" FOREIGN KEY ("menteeMemberId") REFERENCES "members"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_mentorship_session_status" ON "mentorship_sessions" ("status")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "mentorship_sessions"');
    await queryRunner.query('DROP TABLE IF EXISTS "mentor_availability"');
    await queryRunner.query('DROP TABLE IF EXISTS "mentor_profiles"');
  }
}

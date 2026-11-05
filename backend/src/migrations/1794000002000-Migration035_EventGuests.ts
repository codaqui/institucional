import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration035EventGuests1794000002000 implements MigrationInterface {
  name = 'Migration035EventGuests1794000002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."event_registrations_status_enum" ADD VALUE IF NOT EXISTS 'pending_guest'`);
    await queryRunner.query(`ALTER TABLE "event_registrations" ADD "isGuest" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "event_registrations" ADD "guestInvitedByMemberId" uuid`);
    await queryRunner.query(`ALTER TABLE "event_registrations" ADD "guestClaimedAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "event_registrations" ADD "guestConsentAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "event_registrations" ALTER COLUMN "attendeeName" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "event_registrations" ALTER COLUMN "attendeeEmail" DROP NOT NULL`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM "event_registrations"
          WHERE NOT (
            ("attendeeName" IS NOT NULL AND "attendeeEmail" IS NOT NULL)
            OR (
              "isGuest" = true
              AND ("status"::text = 'pending_guest' OR "memberId" IS NULL)
            )
          )
        ) THEN
          RAISE EXCEPTION 'event_registrations possui identidade de participante incompatível com o modelo guest';
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "event_registrations"
      ADD CONSTRAINT "CHK_event_registrations_attendee_identity"
      CHECK (
        ("attendeeName" IS NOT NULL AND "attendeeEmail" IS NOT NULL)
        OR (
          "isGuest" = true
          AND ("status"::text = 'pending_guest' OR "memberId" IS NULL)
        )
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_event_registrations_guest_email" ON "event_registrations" ("isGuest", (lower("attendeeEmail")))`);
    await queryRunner.query(`CREATE INDEX "IDX_event_registrations_event_status" ON "event_registrations" ("eventId", "status")`);
    await queryRunner.query(`ALTER TABLE "event_registrations" ADD CONSTRAINT "FK_event_registrations_guest_inviter" FOREIGN KEY ("guestInvitedByMemberId") REFERENCES "members"("id") ON DELETE SET NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "event_registrations" WHERE "isGuest" = true`);
    await queryRunner.query(`ALTER TABLE "event_registrations" DROP CONSTRAINT "FK_event_registrations_guest_inviter"`);
    await queryRunner.query(`ALTER TABLE "event_registrations" DROP CONSTRAINT IF EXISTS "CHK_event_registrations_attendee_identity"`);
    await queryRunner.query(`DROP INDEX "IDX_event_registrations_event_status"`);
    await queryRunner.query(`DROP INDEX "IDX_event_registrations_guest_email"`);
    await queryRunner.query(`ALTER TABLE "event_registrations" ALTER COLUMN "attendeeEmail" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "event_registrations" ALTER COLUMN "attendeeName" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "event_registrations" DROP COLUMN "guestConsentAt"`);
    await queryRunner.query(`ALTER TABLE "event_registrations" DROP COLUMN "guestClaimedAt"`);
    await queryRunner.query(`ALTER TABLE "event_registrations" DROP COLUMN "guestInvitedByMemberId"`);
    await queryRunner.query(`ALTER TABLE "event_registrations" DROP COLUMN "isGuest"`);
  }
}

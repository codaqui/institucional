import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration041CertificateGrants1794340000000 implements MigrationInterface {
  name = 'Migration041CertificateGrants1794340000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "event_registrations" ADD "certificateGrantedAt" TIMESTAMPTZ');
    await queryRunner.query('ALTER TABLE "event_registrations" ADD "certificateGrantedByMemberId" uuid');
    await queryRunner.query('ALTER TABLE "event_registrations" ADD "certificateInvitedAt" TIMESTAMPTZ');
    await queryRunner.query('UPDATE "event_registrations" SET "certificateGrantedAt" = "checkedInAt", "certificateGrantedByMemberId" = "checkedInByMemberId" WHERE "checkedInAt" IS NOT NULL');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "event_registrations" DROP COLUMN "certificateGrantedAt"');
    await queryRunner.query('ALTER TABLE "event_registrations" DROP COLUMN "certificateGrantedByMemberId"');
    await queryRunner.query('ALTER TABLE "event_registrations" DROP COLUMN "certificateInvitedAt"');
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration001202604021775163746252 implements MigrationInterface {
  name = 'Migration001202604021775163746252';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."members_role_enum" AS ENUM('membro', 'finance-analyzer', 'admin')`,
    );
    await queryRunner.query(
      `CREATE TABLE "members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "githubId" character varying NOT NULL, "githubHandle" character varying NOT NULL, "name" character varying NOT NULL, "email" character varying NOT NULL, "avatarUrl" character varying NOT NULL DEFAULT '', "bio" text, "linkedinUrl" character varying, "role" "public"."members_role_enum" NOT NULL DEFAULT 'membro', "isActive" boolean NOT NULL DEFAULT true, "joinedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_9c1b0d59b1eb93efa52346327d5" UNIQUE ("githubId"), CONSTRAINT "PK_28b53062261b996d9c99fa12404" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."accounts_type_enum" AS ENUM('BANK', 'VIRTUAL_WALLET', 'EXTERNAL', 'EXPENSE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "type" "public"."accounts_type_enum" NOT NULL DEFAULT 'VIRTUAL_WALLET', "projectKey" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a74fa33f34eae917307163635cf" UNIQUE ("projectKey"), CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."account_transfer_requests_status_enum" AS ENUM('pending', 'approved', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "account_transfer_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "requestedById" uuid NOT NULL, "sourceAccountId" uuid NOT NULL, "destinationAccountId" uuid NOT NULL, "amount" integer NOT NULL, "reason" text NOT NULL, "status" "public"."account_transfer_requests_status_enum" NOT NULL DEFAULT 'pending', "reviewedById" uuid, "reviewNote" text, "reviewedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_53cffbb84192c6332caa3ee0cdc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "amount" numeric(10,2) NOT NULL, "description" character varying NOT NULL, "referenceId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "sourceAccountId" uuid, "destinationAccountId" uuid, CONSTRAINT "UQ_8ca2fddf4ca18ce7429730ff20e" UNIQUE ("referenceId"), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reimbursement_requests_status_enum" AS ENUM('pending', 'approved', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "reimbursement_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "memberId" uuid NOT NULL, "accountId" uuid NOT NULL, "amount" integer NOT NULL, "description" text NOT NULL, "receiptUrl" character varying NOT NULL, "internalReceiptUrl" character varying, "status" "public"."reimbursement_requests_status_enum" NOT NULL DEFAULT 'pending', "reviewedById" uuid, "reviewNote" text, "reviewedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b0d89b105649a9a476fdf0a0930" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."expenses_status_enum" AS ENUM('PENDING', 'APPROVED', 'PAID', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "expenses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "description" character varying NOT NULL, "amount" integer NOT NULL, "targetProjectId" character varying NOT NULL, "submittedByUserId" character varying NOT NULL, "receiptUrl" character varying, "status" "public"."expenses_status_enum" NOT NULL DEFAULT 'PENDING', "approvedByUserId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_94c3ceb17e3140abc9282c20610" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" character varying(64) NOT NULL, "actorId" uuid NOT NULL, "actorHandle" character varying(64) NOT NULL, "targetId" uuid, "targetType" character varying(32), "details" jsonb, "ipAddress" character varying(45), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_actorId" ON "audit_logs" ("actorId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_createdAt" ON "audit_logs" ("createdAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "account_transfer_requests" ADD CONSTRAINT "FK_dd79f9456dced1592d8aba2da37" FOREIGN KEY ("requestedById") REFERENCES "members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "account_transfer_requests" ADD CONSTRAINT "FK_4c82e7266d956bac160b44e4070" FOREIGN KEY ("sourceAccountId") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "account_transfer_requests" ADD CONSTRAINT "FK_4c971cb2930342c93a65c9d7594" FOREIGN KEY ("destinationAccountId") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "account_transfer_requests" ADD CONSTRAINT "FK_2b7664fff8d2f39f2f21fb39499" FOREIGN KEY ("reviewedById") REFERENCES "members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_c2edf5312a2dff9e7607e4b4a0c" FOREIGN KEY ("sourceAccountId") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_e704cd38335d6b334f2fce8caf9" FOREIGN KEY ("destinationAccountId") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reimbursement_requests" ADD CONSTRAINT "FK_6505a1b013880200afab9fee6a6" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reimbursement_requests" ADD CONSTRAINT "FK_ee0eb8940b611fb5b1ee7618e17" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reimbursement_requests" ADD CONSTRAINT "FK_a2f2db563c3909c44348a1298b5" FOREIGN KEY ("reviewedById") REFERENCES "members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reimbursement_requests" DROP CONSTRAINT "FK_a2f2db563c3909c44348a1298b5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reimbursement_requests" DROP CONSTRAINT "FK_ee0eb8940b611fb5b1ee7618e17"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reimbursement_requests" DROP CONSTRAINT "FK_6505a1b013880200afab9fee6a6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_e704cd38335d6b334f2fce8caf9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_c2edf5312a2dff9e7607e4b4a0c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account_transfer_requests" DROP CONSTRAINT "FK_2b7664fff8d2f39f2f21fb39499"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account_transfer_requests" DROP CONSTRAINT "FK_4c971cb2930342c93a65c9d7594"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account_transfer_requests" DROP CONSTRAINT "FK_4c82e7266d956bac160b44e4070"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account_transfer_requests" DROP CONSTRAINT "FK_dd79f9456dced1592d8aba2da37"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_createdAt"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_actorId"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "expenses"`);
    await queryRunner.query(`DROP TYPE "public"."expenses_status_enum"`);
    await queryRunner.query(`DROP TABLE "reimbursement_requests"`);
    await queryRunner.query(
      `DROP TYPE "public"."reimbursement_requests_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TABLE "account_transfer_requests"`);
    await queryRunner.query(
      `DROP TYPE "public"."account_transfer_requests_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "accounts"`);
    await queryRunner.query(`DROP TYPE "public"."accounts_type_enum"`);
    await queryRunner.query(`DROP TABLE "members"`);
    await queryRunner.query(`DROP TYPE "public"."members_role_enum"`);
  }
}

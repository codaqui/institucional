import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration012 — Fases 2c/2d: comunicação (e-mail) + eventos externos à la carte
 *
 *  - email_logs: log de cada envio ou tentativa de e-mail (painel /admin/emails)
 *  - external_event_activations: sombra de evento externo no Postgres (features à la carte)
 *  - Generalização (2d): event_registrations / event_orders / ticket_types passam a
 *    referenciar `eventId` (managed) OU `externalActivationId` — CHECK garante
 *    exatamente um preenchido. Registrations ganham externalSource/externalId (dedupe CSV).
 *  - members: opt-in de comunicações de evento (pós-evento exige; transacionais ignoram)
 */
export class Migration012EventCommsAndExternal1775163746263
  implements MigrationInterface
{
  name = 'Migration012EventCommsAndExternal1775163746263';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."email_logs_status_enum" AS ENUM('sent', 'failed')`,
    );

    await queryRunner.query(`
            CREATE TABLE "email_logs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "to" character varying NOT NULL,
                "template" character varying NOT NULL,
                "eventId" character varying,
                "registrationId" character varying,
                "status" "public"."email_logs_status_enum" NOT NULL,
                "error" text,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_email_logs" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_email_logs_createdAt" ON "email_logs" ("createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_email_logs_template_status" ON "email_logs" ("template", "status")`,
    );

    await queryRunner.query(`
            CREATE TABLE "external_event_activations" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "eventKey" character varying NOT NULL,
                "features" text[] NOT NULL DEFAULT '{}',
                "communityProjectKey" character varying NOT NULL,
                "title" character varying,
                "enabledByMemberId" character varying NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_external_event_activations_eventKey" UNIQUE ("eventKey"),
                CONSTRAINT "PK_external_event_activations" PRIMARY KEY ("id")
            )
        `);

    // ── Generalização: managed (eventId) XOR externo (externalActivationId) ──

    await queryRunner.query(`
            ALTER TABLE "event_registrations"
                ALTER COLUMN "eventId" DROP NOT NULL,
                ADD COLUMN "externalActivationId" uuid,
                ADD COLUMN "externalSource" character varying,
                ADD COLUMN "externalId" character varying,
                ADD CONSTRAINT "FK_event_registrations_activation" FOREIGN KEY ("externalActivationId")
                    REFERENCES "external_event_activations"("id") ON DELETE CASCADE,
                ADD CONSTRAINT "CHK_event_registrations_owner_xor" CHECK (
                    ("eventId" IS NOT NULL)::int + ("externalActivationId" IS NOT NULL)::int = 1
                )
        `);
    // Dedupe de importação CSV (safety net — a aplicação checa antes de inserir)
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_event_registrations_activation_externalId"
                ON "event_registrations" ("externalActivationId", "externalId")
                WHERE "externalActivationId" IS NOT NULL AND "externalId" IS NOT NULL
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_event_registrations_activation_email"
                ON "event_registrations" ("externalActivationId", lower("attendeeEmail"))
                WHERE "externalActivationId" IS NOT NULL
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_event_registrations_activationId" ON "event_registrations" ("externalActivationId")`,
    );

    await queryRunner.query(`
            ALTER TABLE "event_orders"
                ALTER COLUMN "eventId" DROP NOT NULL,
                ADD COLUMN "externalActivationId" uuid,
                ADD CONSTRAINT "FK_event_orders_activation" FOREIGN KEY ("externalActivationId")
                    REFERENCES "external_event_activations"("id") ON DELETE CASCADE,
                ADD CONSTRAINT "CHK_event_orders_owner_xor" CHECK (
                    ("eventId" IS NOT NULL)::int + ("externalActivationId" IS NOT NULL)::int = 1
                )
        `);

    await queryRunner.query(`
            ALTER TABLE "ticket_types"
                ALTER COLUMN "eventId" DROP NOT NULL,
                ADD COLUMN "externalActivationId" uuid,
                ADD CONSTRAINT "FK_ticket_types_activation" FOREIGN KEY ("externalActivationId")
                    REFERENCES "external_event_activations"("id") ON DELETE CASCADE,
                ADD CONSTRAINT "CHK_ticket_types_owner_xor" CHECK (
                    ("eventId" IS NOT NULL)::int + ("externalActivationId" IS NOT NULL)::int = 1
                )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ticket_types_activationId" ON "ticket_types" ("externalActivationId")`,
    );

    // ── Opt-in de comunicações de evento (pós-evento exige; transacionais não) ──
    await queryRunner.query(`
            ALTER TABLE "members"
                ADD COLUMN "eventCommsOptIn" boolean NOT NULL DEFAULT false
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "members" DROP COLUMN "eventCommsOptIn"`,
    );

    await queryRunner.query(`
            ALTER TABLE "ticket_types"
                DROP CONSTRAINT "CHK_ticket_types_owner_xor",
                DROP CONSTRAINT "FK_ticket_types_activation",
                DROP COLUMN "externalActivationId"
        `);
    await queryRunner.query(
      `ALTER TABLE "ticket_types" ALTER COLUMN "eventId" SET NOT NULL`,
    );

    await queryRunner.query(`
            ALTER TABLE "event_orders"
                DROP CONSTRAINT "CHK_event_orders_owner_xor",
                DROP CONSTRAINT "FK_event_orders_activation",
                DROP COLUMN "externalActivationId"
        `);
    await queryRunner.query(
      `ALTER TABLE "event_orders" ALTER COLUMN "eventId" SET NOT NULL`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_event_registrations_activationId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_event_registrations_activation_email"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_event_registrations_activation_externalId"`,
    );
    await queryRunner.query(`
            ALTER TABLE "event_registrations"
                DROP CONSTRAINT "CHK_event_registrations_owner_xor",
                DROP CONSTRAINT "FK_event_registrations_activation",
                DROP COLUMN "externalActivationId",
                DROP COLUMN "externalSource",
                DROP COLUMN "externalId"
        `);
    await queryRunner.query(
      `ALTER TABLE "event_registrations" ALTER COLUMN "eventId" SET NOT NULL`,
    );

    await queryRunner.query(`DROP TABLE "external_event_activations"`);
    await queryRunner.query(`DROP TABLE "email_logs"`);
    await queryRunner.query(`DROP TYPE "public"."email_logs_status_enum"`);
  }
}

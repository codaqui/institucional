import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration011 — Fase 2: eventos próprios da Codaqui (managed events)
 *
 * Cria as 5 tabelas do módulo `events`:
 *  - managed_events       — evento próprio (draft/published/canceled/completed)
 *  - ticket_types         — tipos de ingresso / lotes (free/paid/community/company)
 *  - event_orders         — compras via Stripe (espelha o padrão das doações)
 *  - event_registrations  — 1 linha por ingresso (gratuito ou pago), com checkinToken
 *  - event_staff          — papéis por evento (host/checker/finance)
 *
 * FKs de memberId NÃO são criadas (defensivo — members são desativados, nunca
 * deletados; e o checkout grava memberId nullable por defesa).
 */
export class Migration011ManagedEvents1775163746262
  implements MigrationInterface
{
  name = 'Migration011ManagedEvents1775163746262';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."managed_events_status_enum" AS ENUM('draft', 'published', 'canceled', 'completed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ticket_types_kind_enum" AS ENUM('free', 'paid', 'community', 'company')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."event_orders_status_enum" AS ENUM('pending', 'paid', 'refunded', 'expired', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."event_registrations_status_enum" AS ENUM('confirmed', 'pending_match', 'cancelled', 'refunded', 'waitlist')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."event_staff_staffrole_enum" AS ENUM('host', 'checker', 'finance')`,
    );

    await queryRunner.query(`
            CREATE TABLE "managed_events" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "slug" character varying NOT NULL,
                "title" character varying NOT NULL,
                "summary" text NOT NULL,
                "imageUrl" character varying,
                "location" character varying NOT NULL,
                "startAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "endAt" TIMESTAMP WITH TIME ZONE,
                "timezone" character varying NOT NULL DEFAULT 'America/Sao_Paulo',
                "communityProjectKey" character varying NOT NULL,
                "status" "public"."managed_events_status_enum" NOT NULL DEFAULT 'draft',
                "capacity" integer,
                "createdByMemberId" character varying NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_managed_events_slug" UNIQUE ("slug"),
                CONSTRAINT "PK_managed_events" PRIMARY KEY ("id"),
                CONSTRAINT "CHK_managed_events_capacity" CHECK ("capacity" IS NULL OR "capacity" > 0)
            )
        `);

    await queryRunner.query(`
            CREATE TABLE "ticket_types" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "eventId" uuid NOT NULL,
                "name" character varying NOT NULL,
                "kind" "public"."ticket_types_kind_enum" NOT NULL,
                "priceCents" integer NOT NULL DEFAULT 0,
                "quantityTotal" integer NOT NULL,
                "quantitySold" integer NOT NULL DEFAULT 0,
                "salesStartAt" TIMESTAMP WITH TIME ZONE,
                "salesEndAt" TIMESTAMP WITH TIME ZONE,
                "maxPerOrder" integer NOT NULL DEFAULT 4,
                "isActive" boolean NOT NULL DEFAULT true,
                CONSTRAINT "PK_ticket_types" PRIMARY KEY ("id"),
                CONSTRAINT "FK_ticket_types_event" FOREIGN KEY ("eventId")
                    REFERENCES "managed_events"("id") ON DELETE CASCADE,
                CONSTRAINT "CHK_ticket_types_price" CHECK ("priceCents" >= 0),
                CONSTRAINT "CHK_ticket_types_total" CHECK ("quantityTotal" >= 0),
                CONSTRAINT "CHK_ticket_types_sold" CHECK ("quantitySold" >= 0),
                CONSTRAINT "CHK_ticket_types_max_per_order" CHECK ("maxPerOrder" > 0)
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ticket_types_eventId" ON "ticket_types" ("eventId")`,
    );

    await queryRunner.query(`
            CREATE TABLE "event_orders" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "eventId" uuid NOT NULL,
                "ticketTypeId" uuid NOT NULL,
                "quantity" integer NOT NULL,
                "memberId" character varying,
                "totalCents" integer NOT NULL,
                "stripeSessionId" character varying,
                "stripePaymentIntentId" character varying,
                "status" "public"."event_orders_status_enum" NOT NULL DEFAULT 'pending',
                "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "paidAt" TIMESTAMP WITH TIME ZONE,
                "termsVersion" character varying NOT NULL,
                CONSTRAINT "PK_event_orders" PRIMARY KEY ("id"),
                CONSTRAINT "FK_event_orders_event" FOREIGN KEY ("eventId")
                    REFERENCES "managed_events"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_event_orders_ticket_type" FOREIGN KEY ("ticketTypeId")
                    REFERENCES "ticket_types"("id") ON DELETE RESTRICT,
                CONSTRAINT "CHK_event_orders_quantity" CHECK ("quantity" > 0),
                CONSTRAINT "CHK_event_orders_total" CHECK ("totalCents" >= 0)
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_event_orders_eventId" ON "event_orders" ("eventId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_orders_status_expiresAt" ON "event_orders" ("status", "expiresAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_orders_stripePaymentIntentId" ON "event_orders" ("stripePaymentIntentId")`,
    );

    await queryRunner.query(`
            CREATE TABLE "event_registrations" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "eventId" uuid NOT NULL,
                "ticketTypeId" uuid NOT NULL,
                "orderId" uuid,
                "memberId" character varying,
                "attendeeName" character varying NOT NULL,
                "attendeeEmail" character varying NOT NULL,
                "checkinToken" character varying NOT NULL,
                "checkedInAt" TIMESTAMP WITH TIME ZONE,
                "checkedInByMemberId" character varying,
                "status" "public"."event_registrations_status_enum" NOT NULL DEFAULT 'confirmed',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_event_registrations_checkinToken" UNIQUE ("checkinToken"),
                CONSTRAINT "PK_event_registrations" PRIMARY KEY ("id"),
                CONSTRAINT "FK_event_registrations_event" FOREIGN KEY ("eventId")
                    REFERENCES "managed_events"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_event_registrations_ticket_type" FOREIGN KEY ("ticketTypeId")
                    REFERENCES "ticket_types"("id") ON DELETE RESTRICT,
                CONSTRAINT "FK_event_registrations_order" FOREIGN KEY ("orderId")
                    REFERENCES "event_orders"("id") ON DELETE SET NULL
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_event_registrations_eventId" ON "event_registrations" ("eventId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_registrations_eventId_memberId" ON "event_registrations" ("eventId", "memberId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_registrations_orderId" ON "event_registrations" ("orderId")`,
    );

    await queryRunner.query(`
            CREATE TABLE "event_staff" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "eventId" uuid NOT NULL,
                "memberId" character varying NOT NULL,
                "staffRole" "public"."event_staff_staffrole_enum" NOT NULL,
                CONSTRAINT "UQ_event_staff_event_member_role" UNIQUE ("eventId", "memberId", "staffRole"),
                CONSTRAINT "PK_event_staff" PRIMARY KEY ("id"),
                CONSTRAINT "FK_event_staff_event" FOREIGN KEY ("eventId")
                    REFERENCES "managed_events"("id") ON DELETE CASCADE
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_event_staff_eventId" ON "event_staff" ("eventId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "event_staff"`);
    await queryRunner.query(`DROP TABLE "event_registrations"`);
    await queryRunner.query(`DROP TABLE "event_orders"`);
    await queryRunner.query(`DROP TABLE "ticket_types"`);
    await queryRunner.query(`DROP TABLE "managed_events"`);
    await queryRunner.query(`DROP TYPE "public"."event_staff_staffrole_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."event_registrations_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."event_orders_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."ticket_types_kind_enum"`);
    await queryRunner.query(`DROP TYPE "public"."managed_events_status_enum"`);
  }
}

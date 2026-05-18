import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 006 — Clube Codaqui + Apoio Empresarial
 *
 * Tabelas criadas:
 *  CLUB:
 *   1. club_wallets              — carteira de SortCoins por membro
 *   2. club_wallet_transactions  — histórico de créditos/débitos (idempotente)
 *   3. club_raffles              — sorteios criados pelos admins
 *   4. club_raffle_entries       — inscrição de membro/empresa em sorteio
 *
 *  COMPANIES:
 *   5. companies                 — cadastro PJ (CNPJ obrigatório)
 *   6. company_wallets           — carteira de SortCoins da empresa
 *   7. company_wallet_transactions — histórico de créditos/débitos PJ (idempotente)
 *   8. company_members           — colaboradores da empresa (somente leitura)
 */
export class Migration006ClubAndCompanies1775163746257
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Enum types (idempotente via bloco DO — synchronize:true em dev pode
    // já ter criado os tipos antes da migration rodar) ───────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."club_wallet_transactions_source_enum"
          AS ENUM('stripe_invoice', 'raffle_entry', 'raffle_refund', 'manual_admin', 'company_distribution');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "public"."club_wallet_transactions_source_enum"
          ADD VALUE IF NOT EXISTS 'company_distribution';
      EXCEPTION WHEN others THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."club_raffles_status_enum"
          AS ENUM('open', 'closed', 'drawn', 'canceled');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."club_raffle_entries_ownertype_enum"
          AS ENUM('member', 'company');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."companies_status_enum"
          AS ENUM('pending', 'active', 'past_due', 'suspended', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."company_wallet_transactions_source_enum"
          AS ENUM('stripe_invoice', 'manual_admin', 'raffle_entry', 'raffle_refund', 'company_distribution');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "public"."company_wallet_transactions_source_enum"
          ADD VALUE IF NOT EXISTS 'company_distribution';
      EXCEPTION WHEN others THEN NULL;
      END $$
    `);

    // ── 1. club_wallets ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "club_wallets" (
        "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
        "memberId"    uuid NOT NULL,
        "balances"    jsonb NOT NULL DEFAULT '{}',
        "frozenTypes" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_club_wallets_memberId" UNIQUE ("memberId"),
        CONSTRAINT "PK_club_wallets" PRIMARY KEY ("id")
      )
    `);

    // ── 2. club_wallet_transactions ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "club_wallet_transactions" (
        "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
        "walletId"    uuid NOT NULL,
        "coinType"    character varying NOT NULL DEFAULT 'sort_coin',
        "amount"      integer NOT NULL,
        "source"      "public"."club_wallet_transactions_source_enum" NOT NULL,
        "referenceId" character varying,
        "description" character varying,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_club_wallet_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_club_wallet_tx_idempotency" UNIQUE ("walletId", "source", "referenceId", "coinType"),
        CONSTRAINT "FK_club_wallet_transactions_wallet"
          FOREIGN KEY ("walletId") REFERENCES "club_wallets"("id")
      )
    `);

    // ── 3. club_raffles ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "club_raffles" (
        "id"                uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title"             character varying NOT NULL,
        "description"       text,
        "costInCoins"       integer NOT NULL,
        "status"            "public"."club_raffles_status_enum" NOT NULL DEFAULT 'open',
        "winnerId"          character varying,
        "winnerType"        "public"."club_raffle_entries_ownertype_enum",
        "drawAt"            TIMESTAMP,
        "closesAt"          TIMESTAMP NOT NULL,
        "createdByMemberId" character varying NOT NULL,
        "createdAt"         TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_club_raffles" PRIMARY KEY ("id")
      )
    `);

    // ── 4. club_raffle_entries ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "club_raffle_entries" (
        "id"         uuid NOT NULL DEFAULT uuid_generate_v4(),
        "raffleId"   uuid NOT NULL,
        "ownerId"    character varying NOT NULL,
        "ownerType"  "public"."club_raffle_entries_ownertype_enum" NOT NULL,
        "coinsSpent" integer NOT NULL,
        "enteredAt"  TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_club_raffle_entries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_club_raffle_entries_owner" UNIQUE ("raffleId", "ownerId", "ownerType"),
        CONSTRAINT "FK_club_raffle_entries_raffle"
          FOREIGN KEY ("raffleId") REFERENCES "club_raffles"("id")
      )
    `);

    // ── 5. companies ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "companies" (
        "id"                       uuid NOT NULL DEFAULT uuid_generate_v4(),
        "cnpj"                     character varying(14) NOT NULL,
        "name"                     character varying NOT NULL,
        "logoUrl"                  character varying,
        "websiteUrl"               character varying,
        "status"                   "public"."companies_status_enum" NOT NULL DEFAULT 'pending',
        "responsibleMemberId"      uuid NOT NULL,
        "stripeCustomerId"         character varying,
        "stripeSubscriptionId"     character varying,
        "subscriptionAmountCents"  integer NOT NULL DEFAULT 20000,
        "showOnSponsorsPage"       boolean NOT NULL DEFAULT false,
        "createdAt"                TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"                TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_companies_cnpj" UNIQUE ("cnpj"),
        CONSTRAINT "UQ_companies_responsibleMemberId" UNIQUE ("responsibleMemberId"),
        CONSTRAINT "UQ_companies_stripeCustomerId" UNIQUE ("stripeCustomerId"),
        CONSTRAINT "UQ_companies_stripeSubscriptionId" UNIQUE ("stripeSubscriptionId"),
        CONSTRAINT "PK_companies" PRIMARY KEY ("id")
      )
    `);

    // ── 6. company_wallets ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company_wallets" (
        "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
        "companyId"   uuid NOT NULL,
        "balances"    jsonb NOT NULL DEFAULT '{}',
        "frozenTypes" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_company_wallets_companyId" UNIQUE ("companyId"),
        CONSTRAINT "PK_company_wallets" PRIMARY KEY ("id"),
        CONSTRAINT "FK_company_wallets_company"
          FOREIGN KEY ("companyId") REFERENCES "companies"("id")
      )
    `);

    // ── 7. company_wallet_transactions ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company_wallet_transactions" (
        "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
        "walletId"    uuid NOT NULL,
        "coinType"    character varying NOT NULL DEFAULT 'sort_coin',
        "amount"      integer NOT NULL,
        "source"      "public"."company_wallet_transactions_source_enum" NOT NULL,
        "referenceId" character varying,
        "description" character varying,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_company_wallet_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_company_wallet_tx_idempotency" UNIQUE ("walletId", "source", "referenceId", "coinType"),
        CONSTRAINT "FK_company_wallet_transactions_wallet"
          FOREIGN KEY ("walletId") REFERENCES "company_wallets"("id")
      )
    `);

    // ── 8. company_members ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company_members" (
        "id"          uuid          NOT NULL DEFAULT gen_random_uuid(),
        "companyId"   uuid          NOT NULL,
        "memberId"    varchar(255)  NOT NULL,
        "addedAt"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_company_members"           PRIMARY KEY ("id"),
        CONSTRAINT "UQ_company_members_pair"      UNIQUE ("companyId", "memberId"),
        CONSTRAINT "FK_company_members_company"   FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "company_members"`);
    await queryRunner.query(`DROP TABLE "company_wallet_transactions"`);
    await queryRunner.query(`DROP TABLE "company_wallets"`);
    await queryRunner.query(`DROP TABLE "companies"`);
    await queryRunner.query(`DROP TABLE "club_raffle_entries"`);
    await queryRunner.query(`DROP TABLE "club_raffles"`);
    await queryRunner.query(`DROP TABLE "club_wallet_transactions"`);
    await queryRunner.query(`DROP TABLE "club_wallets"`);

    await queryRunner.query(
      `DROP TYPE "public"."company_wallet_transactions_source_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."companies_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."club_raffle_entries_ownertype_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."club_raffles_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."club_wallet_transactions_source_enum"`,
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration002 — Seed de contas e saldos históricos (OpenCollective → Ledger)
 *
 * Regras de segurança:
 *  1. Contas: criadas somente se não existirem (ON CONFLICT DO NOTHING).
 *     Contas pré-existentes com doações reais nunca são alteradas.
 *  2. Seed transactions: sempre inseridas (saldos históricos intencionais).
 *     Idempotência garantida pelo campo `referenceId` único — nunca duplica.
 *  3. Todas as contas de comunidade usam type = VIRTUAL_WALLET para aparecer
 *     em getCommunityBalances() e no portal de transparência.
 */
export class Migration002202604061775163746253 implements MigrationInterface {
  name = 'Migration002202604061775163746253';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── stripe_income (EXTERNAL) ─────────────────────────────────────────
    await queryRunner.query(`
            INSERT INTO accounts (id, name, type, "projectKey", "createdAt")
            VALUES (uuid_generate_v4(), 'Stripe Income (External)', 'EXTERNAL', 'stripe_income', now())
            ON CONFLICT ("projectKey") DO NOTHING
        `);

    // ── tisocial ─────────────────────────────────────────────────────────
    await queryRunner.query(`
            INSERT INTO accounts (id, name, type, "projectKey", "createdAt")
            VALUES (uuid_generate_v4(), 'Comunidade: TI Social', 'VIRTUAL_WALLET', 'tisocial', now())
            ON CONFLICT ("projectKey") DO NOTHING
        `);

    await queryRunner.query(`
            INSERT INTO transactions (id, amount, description, "referenceId", "sourceAccountId", "destinationAccountId", "createdAt")
            SELECT
                uuid_generate_v4(),
                6.58,
                'Migration seed: saldo histórico OpenCollective — TI Social',
                'migration-seed-20260406-tisocial',
                (SELECT id FROM accounts WHERE "projectKey" = 'stripe_income'),
                (SELECT id FROM accounts WHERE "projectKey" = 'tisocial'),
                now()
            WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE "referenceId" = 'migration-seed-20260406-tisocial')
        `);

    // ── campostechpg ──────────────────────────────────────────────────────
    await queryRunner.query(`
            INSERT INTO accounts (id, name, type, "projectKey", "createdAt")
            VALUES (uuid_generate_v4(), 'Comunidade: CamposTech', 'VIRTUAL_WALLET', 'campostechpg', now())
            ON CONFLICT ("projectKey") DO NOTHING
        `);

    await queryRunner.query(`
            INSERT INTO transactions (id, amount, description, "referenceId", "sourceAccountId", "destinationAccountId", "createdAt")
            SELECT
                uuid_generate_v4(),
                1852.26,
                'Migration seed: saldo histórico OpenCollective — CamposTech',
                'migration-seed-20260406-campostechpg',
                (SELECT id FROM accounts WHERE "projectKey" = 'stripe_income'),
                (SELECT id FROM accounts WHERE "projectKey" = 'campostechpg'),
                now()
            WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE "referenceId" = 'migration-seed-20260406-campostechpg')
        `);

    // ── devparana ─────────────────────────────────────────────────────────
    await queryRunner.query(`
            INSERT INTO accounts (id, name, type, "projectKey", "createdAt")
            VALUES (uuid_generate_v4(), 'Comunidade: DevParaná', 'VIRTUAL_WALLET', 'devparana', now())
            ON CONFLICT ("projectKey") DO NOTHING
        `);

    await queryRunner.query(`
            INSERT INTO transactions (id, amount, description, "referenceId", "sourceAccountId", "destinationAccountId", "createdAt")
            SELECT
                uuid_generate_v4(),
                16057.31,
                'Migration seed: saldo histórico OpenCollective — DevParaná',
                'migration-seed-20260406-devparana',
                (SELECT id FROM accounts WHERE "projectKey" = 'stripe_income'),
                (SELECT id FROM accounts WHERE "projectKey" = 'devparana'),
                now()
            WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE "referenceId" = 'migration-seed-20260406-devparana')
        `);

    // ── tesouro-geral (Codaqui) ───────────────────────────────────────────
    // Esta conta tipicamente já existe (criada pelo Stripe webhook).
    // type = VIRTUAL_WALLET para aparecer em getCommunityBalances().
    // O seed de R$ 3.686,26 é uma importação histórica intencional do saldo
    // legado do OpenCollective — deve ser inserido mesmo em conta pré-existente.
    // A idempotência é garantida pelo referenceId único.
    await queryRunner.query(`
            INSERT INTO accounts (id, name, type, "projectKey", "createdAt")
            VALUES (uuid_generate_v4(), 'Codaqui (Tesouro)', 'VIRTUAL_WALLET', 'tesouro-geral', now())
            ON CONFLICT ("projectKey") DO NOTHING
        `);

    await queryRunner.query(`
            INSERT INTO transactions (id, amount, description, "referenceId", "sourceAccountId", "destinationAccountId", "createdAt")
            SELECT
                uuid_generate_v4(),
                3686.26,
                'Migration seed: saldo histórico OpenCollective — Codaqui (tesouro-geral)',
                'migration-seed-20260406-tesouro-geral',
                (SELECT id FROM accounts WHERE "projectKey" = 'stripe_income'),
                (SELECT id FROM accounts WHERE "projectKey" = 'tesouro-geral'),
                now()
            WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE "referenceId" = 'migration-seed-20260406-tesouro-geral')
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DELETE FROM transactions WHERE "referenceId" IN (
                'migration-seed-20260406-tesouro-geral',
                'migration-seed-20260406-tisocial',
                'migration-seed-20260406-campostechpg',
                'migration-seed-20260406-devparana'
            )
        `);
    // Contas não são removidas para preservar dados pré-existentes.
  }
}

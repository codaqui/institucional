import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration002202604061775163746253 implements MigrationInterface {
    name = 'Migration002202604061775163746253'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Ensure stripe_income account exists
        await queryRunner.query(`
            INSERT INTO accounts (id, name, type, "projectKey", "createdAt")
            SELECT uuid_generate_v4(), 'Stripe Income (External)', 'EXTERNAL', 'stripe_income', now()
            WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE "projectKey" = 'stripe_income')
        `);

        // Ensure community / treasury accounts exist
        await queryRunner.query(`
            INSERT INTO accounts (id, name, type, "projectKey", "createdAt")
            SELECT uuid_generate_v4(), 'Comunidade: tisocial', 'VIRTUAL_WALLET', 'tisocial', now()
            WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE "projectKey" = 'tisocial')
        `);

        await queryRunner.query(`
            INSERT INTO accounts (id, name, type, "projectKey", "createdAt")
            SELECT uuid_generate_v4(), 'Comunidade: campostechpg', 'VIRTUAL_WALLET', 'campostechpg', now()
            WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE "projectKey" = 'campostechpg')
        `);

        await queryRunner.query(`
            INSERT INTO accounts (id, name, type, "projectKey", "createdAt")
            SELECT uuid_generate_v4(), 'Comunidade: devparana', 'VIRTUAL_WALLET', 'devparana', now()
            WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE "projectKey" = 'devparana')
        `);

        // Ensure tesouro-geral (Codaqui) exists — user indicated this account already exists; this is safe/idempotent
        await queryRunner.query(`
            INSERT INTO accounts (id, name, type, "projectKey", "createdAt")
            SELECT uuid_generate_v4(), 'Codaqui (Tesouro)', 'BANK', 'tesouro-geral', now()
            WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE "projectKey" = 'tesouro-geral')
        `);

        // Insert idempotent transactions (stripe_income -> community)
        await queryRunner.query(`
            INSERT INTO transactions (id, amount, description, "referenceId", "sourceAccountId", "destinationAccountId", "createdAt")
            SELECT uuid_generate_v4(), 3686.26, 'Migration seed: saldo inicial para Codaqui (tesouro-geral)', 'migration-seed-20260406-tesouro-geral',
                (SELECT id FROM accounts WHERE "projectKey" = 'stripe_income'),
                (SELECT id FROM accounts WHERE "projectKey" = 'tesouro-geral'),
                now()
            WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE "referenceId" = 'migration-seed-20260406-tesouro-geral')
        `);

        await queryRunner.query(`
            INSERT INTO transactions (id, amount, description, "referenceId", "sourceAccountId", "destinationAccountId", "createdAt")
            SELECT uuid_generate_v4(), 6.58, 'Migration seed: saldo inicial para TI Social', 'migration-seed-20260406-tisocial',
                (SELECT id FROM accounts WHERE "projectKey" = 'stripe_income'),
                (SELECT id FROM accounts WHERE "projectKey" = 'tisocial'),
                now()
            WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE "referenceId" = 'migration-seed-20260406-tisocial')
        `);

        await queryRunner.query(`
            INSERT INTO transactions (id, amount, description, "referenceId", "sourceAccountId", "destinationAccountId", "createdAt")
            SELECT uuid_generate_v4(), 1852.26, 'Migration seed: saldo inicial para CamposTech (campostechpg)', 'migration-seed-20260406-campostechpg',
                (SELECT id FROM accounts WHERE "projectKey" = 'stripe_income'),
                (SELECT id FROM accounts WHERE "projectKey" = 'campostechpg'),
                now()
            WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE "referenceId" = 'migration-seed-20260406-campostechpg')
        `);

        await queryRunner.query(`
            INSERT INTO transactions (id, amount, description, "referenceId", "sourceAccountId", "destinationAccountId", "createdAt")
            SELECT uuid_generate_v4(), 16057.31, 'Migration seed: saldo inicial para DevParaná', 'migration-seed-20260406-devparana',
                (SELECT id FROM accounts WHERE "projectKey" = 'stripe_income'),
                (SELECT id FROM accounts WHERE "projectKey" = 'devparana'),
                now()
            WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE "referenceId" = 'migration-seed-20260406-devparana')
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove only the transactions inserted by this migration (idempotent)
        await queryRunner.query(`
            DELETE FROM transactions WHERE "referenceId" IN (
                'migration-seed-20260406-tesouro-geral',
                'migration-seed-20260406-tisocial',
                'migration-seed-20260406-campostechpg',
                'migration-seed-20260406-devparana'
            )
        `);

        // NOTE: Do not delete accounts automatically to avoid removing pre-existing accounts.
    }
}

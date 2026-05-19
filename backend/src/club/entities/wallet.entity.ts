import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Carteira de SortCoins de um membro.
 * Saldos em JSONB para suportar múltiplos tipos de coin sem migration.
 * NUNCA atualizar balances fora de transação com SELECT FOR UPDATE.
 */
@Entity('club_wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** FK → members.id */
  @Column({ unique: true, type: 'uuid' })
  memberId: string;

  /**
   * Saldos por coinType — ex: { "sort_coin": 142, "event_coin": 5 }
   * Atualizar apenas dentro de transaction + SELECT FOR UPDATE.
   */
  @Column({ type: 'jsonb', default: '{}' })
  balances: Record<string, number>;

  /**
   * Tipos de coin congelados — array nativo Postgres (text[]).
   * Congelado quando assinatura cancela ou fica past_due.
   * Ex: ["sort_coin"]
   */
  @Column({ type: 'text', array: true, default: () => "ARRAY[]::text[]" })
  frozenTypes: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Account } from '../../ledger/entities/account.entity';

/**
 * Fornecedor — pessoa física ou jurídica que recebe pagamentos da Codaqui.
 *
 * Cada fornecedor é vinculado a uma Account (type EXTERNAL) no ledger
 * para rastrear os valores pagos via contabilidade de dupla partida.
 *
 * Dados são 100% públicos (transparência financeira).
 */
@Entity('vendors')
export class Vendor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nome do fornecedor (ex: "Escritório Contábil XYZ") */
  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** CNPJ ou CPF (formato livre, ex: "44.593.429/0001-05") */
  @Column({ type: 'varchar', length: 20, nullable: true })
  document: string | null;

  /** Site do fornecedor */
  @Column({ type: 'varchar', length: 500, nullable: true })
  website: string | null;

  /** Conta contábil EXTERNAL vinculada no ledger */
  @ManyToOne(() => Account, { eager: true })
  @JoinColumn({ name: 'accountId' })
  account: Account;

  @Column()
  accountId: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

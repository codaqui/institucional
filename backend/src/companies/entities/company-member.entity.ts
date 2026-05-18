import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Company } from './company.entity';

/**
 * Colaborador de uma empresa.
 * Tem acesso somente leitura à carteira da empresa.
 */
@Entity('company_members')
@Unique(['companyId', 'memberId'])
export class CompanyMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  companyId: string;

  /** GitHub handle do colaborador (ex: "username") */
  @Column()
  memberId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  addedAt: Date;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: Company;
}

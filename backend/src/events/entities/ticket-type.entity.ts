import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum TicketKind {
  FREE = 'free',
  PAID = 'paid',
  COMMUNITY = 'community',
  COMPANY = 'company',
}

@Entity('ticket_types')
export class TicketType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** evento managed — XOR com externalActivationId (CHECK no banco) */
  @Column({ type: 'uuid', nullable: true })
  eventId: string | null;

  /** evento externo ativado (2d) — ticket types de CSV/payments */
  @Column({ type: 'uuid', nullable: true })
  externalActivationId: string | null;

  /** ex.: "Lote 1 — Early bird", "Comunitário" */
  @Column()
  name: string;

  @Column({ type: 'enum', enum: TicketKind })
  kind: TicketKind;

  /** 0 para free */
  @Column({ type: 'int', default: 0 })
  priceCents: number;

  @Column({ type: 'int' })
  quantityTotal: number;

  @Column({ type: 'int', default: 0 })
  quantitySold: number;

  /** janela de vendas do lote (null = sem restrição) */
  @Column({ type: 'timestamptz', nullable: true })
  salesStartAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  salesEndAt: Date | null;

  @Column({ type: 'int', default: 4 })
  maxPerOrder: number;

  @Column({ default: true })
  isActive: boolean;
}

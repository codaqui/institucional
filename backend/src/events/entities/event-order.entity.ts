import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  REFUNDED = 'refunded',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Entity('event_orders')
export class EventOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** evento managed — XOR com externalActivationId (CHECK no banco) */
  @Column({ type: 'uuid', nullable: true })
  eventId: string | null;

  /** evento externo ativado com feature payments (2d) */
  @Column({ type: 'uuid', nullable: true })
  externalActivationId: string | null;

  @Column({ type: 'uuid' })
  ticketTypeId: string;

  @Column({ type: 'int' })
  quantity: number;

  /** checkout exige login (decisão #2); nullable só por defensividade */
  @Column({ type: 'varchar', nullable: true })
  memberId: string | null;

  /** quem pagou o pedido — pode ser diferente do participante (ingresso nominado) */
  @Column({ type: 'varchar', nullable: true })
  payerMemberId: string | null;

  /** lista de participantes informada no checkout [{ name, email }] */
  @Column({ type: 'text', nullable: true })
  attendees: string | null;

  @Column({ type: 'int' })
  totalCents: number;

  @Column({ type: 'varchar', nullable: true })
  stripeSessionId: string | null;

  @Column({ type: 'varchar', nullable: true })
  stripePaymentIntentId: string | null;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  /** reserva de quota expira (ex.: 30 min) */
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  /** preenchido pelo webhook checkout.session.completed */
  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  /**
   * Versão dos termos de compra/política de reembolso aceitos no checkout
   * (conformidade CDC art. 49 — arrependimento em até 7 dias corridos).
   */
  @Column()
  termsVersion: string;

  @CreateDateColumn()
  createdAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum RegistrationStatus {
  CONFIRMED = 'confirmed',
  PENDING_MATCH = 'pending_match',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  WAITLIST = 'waitlist',
}

/** 1 linha por ingresso individual (gratuito ou pago) */
@Entity('event_registrations')
export class EventRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** evento managed — XOR com externalActivationId (CHECK no banco) */
  @Column({ type: 'uuid', nullable: true })
  eventId: string | null;

  /** evento externo ativado (2d) — XOR com eventId */
  @Column({ type: 'uuid', nullable: true })
  externalActivationId: string | null;

  /** "<source>:<sourceId>" da fonte externa (dedupe de importações) */
  @Column({ type: 'varchar', nullable: true })
  externalSource: string | null;

  /** id do participante na fonte externa (dedupe de importações) */
  @Column({ type: 'varchar', nullable: true })
  externalId: string | null;

  @Column({ type: 'uuid' })
  ticketTypeId: string;

  /** null para RSVP gratuito direto */
  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ type: 'varchar', nullable: true })
  memberId: string | null;

  /** quem pagou pelo ingresso (denormalizado) — pode ser != memberId */
  @Column({ type: 'varchar', nullable: true })
  payerMemberId: string | null;

  @Column()
  attendeeName: string;

  @Column()
  attendeeEmail: string;

  /** uuid — vai no QR code */
  @Column({ unique: true })
  checkinToken: string;

  @Column({ type: 'timestamptz', nullable: true })
  checkedInAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  checkedInByMemberId: string | null;

  @Column({
    type: 'enum',
    enum: RegistrationStatus,
    default: RegistrationStatus.CONFIRMED,
  })
  status: RegistrationStatus;

  @CreateDateColumn()
  createdAt: Date;
}

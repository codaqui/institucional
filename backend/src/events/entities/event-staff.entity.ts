import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum EventStaffRole {
  HOST = 'host',
  CHECKER = 'checker',
  FINANCE = 'finance',
}

/** papéis por evento (host/checker/finance delegados) */
@Entity('event_staff')
export class EventStaff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  eventId: string;

  @Column()
  memberId: string;

  @Column({ type: 'enum', enum: EventStaffRole })
  staffRole: EventStaffRole;
}

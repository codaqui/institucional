import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Ownership de eventos externos por organizer.
 *
 * Substitui o antigo arquivo static/events/organizers.json.
 * Cada linha representa um membro (event_organizer) e a lista de scopes
 * que ele pode gerenciar.
 *
 * Scopes:
 * - "<source>:<sourceId>:<eventId>"  → evento específico
 * - "<source>:<sourceId>:*"          → todos os eventos da fonte
 */
@Entity('event_organizer_ownerships')
@Index('IDX_event_organizer_ownerships_memberId', ['memberId'], { unique: true })
export class EventOrganizerOwnership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** FK → members.id (um registro por membro). */
  @Column({ type: 'uuid' })
  memberId: string;

  /** Handle GitHub do organizer (denormalizado para exibição). */
  @Column()
  githubHandle: string;

  /** Scopes de ownership (array nativo do Postgres). */
  @Column({ type: 'text', array: true, default: () => "ARRAY[]::text[]" })
  scope: string[];

  /** Admin que criou a ownership. */
  @Column({ type: 'uuid' })
  createdByMemberId: string;

  /** Admin que editou por último. */
  @Column({ type: 'uuid' })
  updatedByMemberId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

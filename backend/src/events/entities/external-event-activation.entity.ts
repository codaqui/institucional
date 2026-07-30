import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/** Features à la carte habilitáveis em evento externo */
export const EXTERNAL_EVENT_FEATURES = [
  'checkin',
  'certificates',
  'payments',
] as const;
export type ExternalEventFeature = (typeof EXTERNAL_EVENT_FEATURES)[number];

/**
 * Sombra no Postgres de um evento externo (que existe apenas como snapshot
 * estático). Criada pelo owner do evento (organizers.json) ou admin para
 * habilitar features de gestão (check-in, certificados, pagamentos).
 */
@Entity('external_event_activations')
export class ExternalEventActivation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** "<source>:<sourceId>:<eventId>" — ex.: "sympla:elasnocodigo:3321444" */
  @Column({ unique: true })
  eventKey: string;

  /** subconjunto de ['checkin', 'certificates', 'payments'] */
  @Column({ type: 'text', array: true, default: '{}' })
  features: string[];

  /** conta ledger da comunidade organizadora (sempre obrigatório) */
  @Column()
  communityProjectKey: string;

  /** título amigável (usado em certificados/relatórios) */
  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  /** data/hora de início do evento (copiada do snapshot no momento da ativação) */
  @Column({ type: 'timestamptz', nullable: true })
  startAt: Date | null;

  @Column()
  enabledByMemberId: string;

  @CreateDateColumn()
  createdAt: Date;
}

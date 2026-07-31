import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Override de metadados de evento persistido no banco.
 *
 * Substitui o antigo GitHub-as-Database (arquivos *.override.json no repo).
 * O campo `payload` armazena o JSON do antigo `extendData` — textos simples,
 * sem estrutura relacional, conforme solicitado para manter o banco leve.
 */
@Entity('event_overrides')
@Index(['sourceKey', 'eventId'], { unique: true })
export class EventOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** "<source>:<sourceId>" — ex.: "ocgroups:cloud-native-maringa" */
  @Column()
  sourceKey: string;

  /** Identificador do evento na fonte externa. */
  @Column()
  eventId: string;

  /** Membro dono do override (pode editar). */
  @Column()
  ownerMemberId: string;

  /** Handle GitHub do dono (denormalizado para exibição pública e sync). */
  @Column()
  ownerHandle: string;

  /**
   * JSON com os metadados estendidos (antigo `extendData`).
   * Mantido como texto simples para não consumir schema relacional.
   */
  @Column({ type: 'text' })
  payload: string;

  /** Motivo da última edição (opcional). */
  @Column({ type: 'varchar', nullable: true })
  reason: string | null;

  /** Membro que criou o override. */
  @Column()
  createdByMemberId: string;

  /** Membro que editou o override por último. */
  @Column()
  updatedByMemberId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

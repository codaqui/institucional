import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum EmailStatus {
  SENT = 'sent',
  FAILED = 'failed',
}

/**
 * Log de todo e-mail enviado (ou tentado) pela plataforma.
 * Alimenta o painel /admin/emails (enviados/falhas por template e reenvio).
 */
@Entity('email_logs')
@Index('IDX_email_logs_createdAt', ['createdAt'])
@Index('IDX_email_logs_template_status', ['template', 'status'])
export class EmailLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  to: string;

  /** identificador do template (ex.: 'event-registration-confirmation') */
  @Column()
  template: string;

  @Column({ type: 'varchar', nullable: true })
  eventId: string | null;

  @Column({ type: 'varchar', nullable: true })
  registrationId: string | null;

  @Column({ type: 'enum', enum: EmailStatus })
  status: EmailStatus;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

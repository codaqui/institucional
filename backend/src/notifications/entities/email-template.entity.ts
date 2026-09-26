import {
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Override de template de e-mail persistido no banco.
 * Um registro por template (id estável). Ausência de registro =
 * template padrão em código (fallback garantido).
 */
@Entity('email_templates')
export class EmailTemplate {
  /** Id estável do template (ex.: 'event-registration-confirmation'). */
  @PrimaryColumn()
  id: string;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  bodyMarkdown: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

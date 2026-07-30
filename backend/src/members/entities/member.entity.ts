import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum MemberRole {
  MEMBRO = 'membro',
  FINANCE_ANALYZER = 'finance-analyzer',
  ADMIN = 'admin',
  EVENT_ORGANIZER = 'event_organizer',
  EVENT_FINANCE = 'event_finance',
  EVENT_HOST = 'event_host',
  EVENT_CHECKER = 'event_checker',
}

@Entity('members')
export class Member {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  githubId: string;

  @Column()
  githubHandle: string;

  @Column()
  name: string;

  @Column()
  email: string;

  @Column({ default: '' })
  avatarUrl: string;

  @Column({ nullable: true, type: 'text' })
  bio: string | null;

  @Column({ nullable: true, type: 'varchar' })
  linkedinUrl: string | null;

  // Multi-role: um mesmo membro acumula papéis (ex.: ['membro', 'event_checker']).
  // Array nativo do Postgres (text[]) — não usar simple-array (serializa CSV).
  @Column({
    type: 'text',
    array: true,
    default: () => "ARRAY['membro']::text[]",
  })
  roles: MemberRole[];

  @Column({ default: true })
  isActive: boolean;

  /** Opt-in para e-mails NÃO transacionais de eventos (pós-evento, novidades) */
  @Column({ default: false })
  eventCommsOptIn: boolean;

  /**
   * Token OAuth do GitHub do membro (scope public_repo) — criptografado em
   * repouso (AES-256-GCM via crypto.util; `plain:` em dev sem a env).
   * `select: false`: NUNCA retornado em queries por padrão — para ler use
   * select explícito (ver MembersService.getGithubAccessToken).
   */
  @Column({ type: 'text', nullable: true, select: false })
  githubAccessToken: string | null;

  /**
   * E-mails verificados da conta GitHub (GET /user/emails a cada login) —
   * usados no match de participantes importados via CSV. `select: false`:
   * fora das serializações públicas por padrão.
   */
  @Column({ type: 'text', array: true, default: '{}', select: false })
  secondaryEmails: string[];

  @CreateDateColumn()
  joinedAt: Date;
}

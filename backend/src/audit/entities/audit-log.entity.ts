import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import type { AuditCategory } from '../audit-category';

export enum AuditAction {
  // Auth
  LOGIN = 'auth.login',
  LOGOUT = 'auth.logout',

  // Members
  ROLE_CHANGE = 'member.role_change',
  ROLE_DERIVED = 'member.role_derived',
  MEMBER_DEACTIVATE = 'member.deactivate',
  MEMBER_ACTIVATE = 'member.activate',
  MEMBER_VISIBILITY_UPDATED = 'member.visibility_updated',

  // Designations
  DESIGNATION_GRANTED = 'designation.granted',
  DESIGNATION_CONFIRMED = 'designation.confirmed',
  DESIGNATION_REVOKED = 'designation.revoked',

  // Communities
  COMMUNITY_CREATED = 'community.created',
  COMMUNITY_UPDATED = 'community.updated',
  COMMUNITY_SEAL_REQUESTED = 'community.seal_requested',
  COMMUNITY_SEAL_GRANTED = 'community.seal_granted',

  // Directorates
  DIRECTORATE_CREATED = 'directorate.created',
  DIRECTORATE_UPDATED = 'directorate.updated',

  // Entities and partnerships
  ENTITY_CREATED = 'entity.created',
  ENTITY_UPDATED = 'entity.updated',
  PARTNERSHIP_CREATED = 'partnership.created',
  PARTNERSHIP_UPDATED = 'partnership.updated',

  // Extension projects
  PROJECT_CREATED = 'project.created',
  PROJECT_UPDATED = 'project.updated',
  PROJECT_STATUS_CHANGED = 'project.status_changed',
  PROJECT_MENTOR_DESIGNATED = 'project.mentor_designated',
  PROJECT_PARTICIPANT_JOINED = 'project.participant_joined',
  PROJECT_PARTICIPANT_REMOVED = 'project.participant_removed',
  PROJECT_CERTIFICATE_ISSUED = 'project.certificate_issued',

  // Ledger
  MANUAL_TRANSACTION = 'ledger.manual_transaction',
  ACCOUNT_CREATED = 'ledger.account_created',

  // Reimbursements
  REIMBURSEMENT_APPROVED = 'reimbursement.approved',
  REIMBURSEMENT_REJECTED = 'reimbursement.rejected',
  REIMBURSEMENT_DELETED = 'reimbursement.deleted',
  REIMBURSEMENT_REVERTED = 'reimbursement.reverted',

  // Transfers
  TRANSFER_APPROVED = 'transfer.approved',
  TRANSFER_REJECTED = 'transfer.rejected',

  // Stripe
  SUBSCRIPTION_CANCELLED = 'stripe.subscription_cancelled',

  // Events (organizers + overrides via GitHub-as-Database)
  EVENT_ORGANIZER_GRANTED = 'event.organizer_granted',
  EVENT_ORGANIZER_REVOKED = 'event.organizer_revoked',
  EVENT_OVERRIDE_UPSERTED = 'event.override_upserted',
  EVENT_OVERRIDE_DELETED = 'event.override_deleted',

  // Events (managed events — Fase 2)
  EVENT_PUBLISHED = 'event.published',
  EVENT_ADULT_ONLY_CHANGED = 'event.adult_only_changed',
  EVENT_CANCELED = 'event.canceled',
  EVENT_ORDER_REFUNDED = 'event.order_refunded',
  EVENT_QUOTA_RECONCILED = 'event.quota_reconciled',

  // Events (2c/2d — check-in, ativações externas, importações)
  EVENT_CHECKIN = 'event.checkin',
  EVENT_ACTIVATION_SAVED = 'event.activation_saved',
  EVENT_PARTICIPANTS_IMPORTED = 'event.participants_imported',
  EVENT_INTERNAL_SYNCED = 'event.internal_synced',
  EVENT_GUEST_INVITED = 'event.guest_invited',
  EVENT_GUEST_CLAIMED = 'event.guest_claimed',
  EVENT_GUEST_LINKED = 'event.guest_linked',

  // E-mail
  EMAIL_TEMPLATE_UPSERTED = 'email.template_upserted',
  EMAIL_TEMPLATE_DELETED = 'email.template_deleted',

  // Hours
  HOUR_CREATED = 'hour.created',
  HOUR_APPROVED = 'hour.approved',
  HOUR_REJECTED = 'hour.rejected',

  // Assemblies
  ASSEMBLY_CREATED = 'assembly.created',
  ASSEMBLY_UPDATED = 'assembly.updated',
  ASSEMBLY_STATUS_CHANGED = 'assembly.status_changed',
  ASSEMBLY_NOTARY_REGISTERED = 'assembly.notary_registered',

  // Settings
  SETTINGS_AUDIT_RETENTION_UPDATED = 'settings.audit_retention_updated',
}

@Entity('audit_logs')
@Index('IDX_audit_logs_createdAt', ['createdAt'])
@Index('IDX_audit_logs_actorId', ['actorId'])
@Index('IDX_audit_logs_category_createdAt', ['category', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Ação realizada (enum legível) */
  @Column({ type: 'varchar', length: 64 })
  action: AuditAction;

  @Column({ type: 'varchar', length: 16, default: 'operational' })
  category: AuditCategory;

  /** UUID do membro que executou a ação */
  @Column({ type: 'uuid' })
  actorId: string;

  /** Handle GitHub do ator (desnormalizado para consulta rápida) */
  @Column({ type: 'varchar', length: 64 })
  actorHandle: string;

  /** UUID do recurso afetado (membro, transação, reembolso, etc.) */
  @Column({ type: 'uuid', nullable: true })
  targetId: string | null;

  /** Tipo do recurso afetado (member, transaction, reimbursement, transfer) */
  @Column({ type: 'varchar', length: 32, nullable: true })
  targetType: string | null;

  /** Detalhes da mudança em formato JSON livre */
  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, any> | null;

  /** IP somente em logs operacionais; governo permanente não retém esse dado. */
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

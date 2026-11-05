import { AuditAction } from './entities/audit-log.entity';

export type AuditCategory = 'governance' | 'operational';

const GOVERNANCE_ACTIONS = new Set<AuditAction>([
  AuditAction.ROLE_CHANGE,
  AuditAction.ROLE_DERIVED,
  AuditAction.MEMBER_DEACTIVATE,
  AuditAction.MEMBER_ACTIVATE,
  AuditAction.MEMBER_VISIBILITY_UPDATED,
  AuditAction.DESIGNATION_GRANTED,
  AuditAction.DESIGNATION_CONFIRMED,
  AuditAction.DESIGNATION_REVOKED,
  AuditAction.COMMUNITY_CREATED,
  AuditAction.COMMUNITY_UPDATED,
  AuditAction.COMMUNITY_SEAL_REQUESTED,
  AuditAction.COMMUNITY_SEAL_GRANTED,
  AuditAction.DIRECTORATE_CREATED,
  AuditAction.DIRECTORATE_UPDATED,
  AuditAction.MANUAL_TRANSACTION,
  AuditAction.ACCOUNT_CREATED,
  AuditAction.REIMBURSEMENT_APPROVED,
  AuditAction.REIMBURSEMENT_REJECTED,
  AuditAction.REIMBURSEMENT_DELETED,
  AuditAction.REIMBURSEMENT_REVERTED,
  AuditAction.TRANSFER_APPROVED,
  AuditAction.TRANSFER_REJECTED,
  AuditAction.EVENT_ORGANIZER_GRANTED,
  AuditAction.EVENT_ORGANIZER_REVOKED,
  AuditAction.EVENT_PUBLISHED,
  AuditAction.EVENT_ADULT_ONLY_CHANGED,
  AuditAction.EVENT_GUEST_INVITED,
  AuditAction.HOUR_CREATED,
  AuditAction.HOUR_APPROVED,
  AuditAction.HOUR_REJECTED,
  AuditAction.EVENT_ORDER_REFUNDED,
  AuditAction.SETTINGS_AUDIT_RETENTION_UPDATED,
]);

export function auditCategory(action: AuditAction): AuditCategory {
  return GOVERNANCE_ACTIONS.has(action) ? 'governance' : 'operational';
}

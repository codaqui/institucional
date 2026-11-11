import { auditCategory } from './audit-category';
import { AuditAction } from './entities/audit-log.entity';

describe('auditCategory', () => {
  it.each([
    AuditAction.ROLE_CHANGE,
    AuditAction.ROLE_DERIVED,
    AuditAction.MEMBER_DEACTIVATE,
    AuditAction.MEMBER_ACTIVATE,
    AuditAction.DESIGNATION_GRANTED,
    AuditAction.DESIGNATION_CONFIRMED,
    AuditAction.DESIGNATION_REVOKED,
    AuditAction.MENTOR_PROFILE_UPDATED,
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
    AuditAction.EVENT_ORDER_REFUNDED,
    AuditAction.SETTINGS_AUDIT_RETENTION_UPDATED,
    AuditAction.ASSEMBLY_CREATED,
    AuditAction.ASSEMBLY_UPDATED,
    AuditAction.ASSEMBLY_STATUS_CHANGED,
    AuditAction.ASSEMBLY_NOTARY_REGISTERED,
    'announcement.created' as AuditAction,
    'announcement.updated' as AuditAction,
    'announcement.deactivated' as AuditAction,
  ])('classifies %s as governance', (action) => {
    expect(auditCategory(action)).toBe('governance');
  });

  it.each([
    AuditAction.LOGIN,
    AuditAction.LOGOUT,
    AuditAction.SUBSCRIPTION_CANCELLED,
    AuditAction.EVENT_OVERRIDE_UPSERTED,
    AuditAction.EVENT_OVERRIDE_DELETED,
    AuditAction.EVENT_CANCELED,
    AuditAction.EVENT_QUOTA_RECONCILED,
    AuditAction.EVENT_CHECKIN,
    AuditAction.EVENT_CERTIFICATE_GRANTED,
    AuditAction.EVENT_CERTIFICATE_INVITED,
    AuditAction.EVENT_ACTIVATION_SAVED,
    AuditAction.EVENT_PARTICIPANTS_IMPORTED,
    AuditAction.EVENT_PARTICIPANT_DELETED,
    AuditAction.EVENT_INTERNAL_SYNCED,
    AuditAction.EMAIL_TEMPLATE_UPSERTED,
    AuditAction.EMAIL_TEMPLATE_DELETED,
    AuditAction.CITY_CREATED,
    AuditAction.CITY_UPDATED,
    AuditAction.UNIVERSITY_INSTITUTION_CREATED,
    AuditAction.UNIVERSITY_INSTITUTION_UPDATED,
    AuditAction.UNIVERSITY_AMBASSADOR_APPLIED,
    AuditAction.UNIVERSITY_AMBASSADOR_REJECTED,
    AuditAction.UNIVERSITY_AMBASSADOR_CONFIRMED,
  ])('classifies %s as operational', (action) => {
    expect(auditCategory(action)).toBe('operational');
  });

  it('covers every current audit action', () => {
    const actions = Object.values(AuditAction);
    expect(actions).toHaveLength(78);
    for (const action of actions) {
      expect(['governance', 'operational']).toContain(auditCategory(action));
    }
  });

  it('fails safe to operational for an unknown action', () => {
    expect(auditCategory('future.operational_action' as AuditAction)).toBe(
      'operational',
    );
  });
});

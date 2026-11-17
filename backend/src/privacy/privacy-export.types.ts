export interface MemberDataExport {
  schemaVersion: 1;
  generatedAt: string;
  subject: Record<string, unknown>;
  account: Record<string, unknown>;
  designations: Array<Record<string, unknown>>;
  events: { registrations: Array<Record<string, unknown>> };
  mentorship: {
    profile: Record<string, unknown> | null;
    availability: Array<Record<string, unknown>>;
    sessionsAsMentor: Array<Record<string, unknown>>;
    sessionsAsMentee: Array<Record<string, unknown>>;
  };
  hours: { entries: Array<Record<string, unknown>>; statements: Array<Record<string, unknown>> };
  projects: {
    memberships: Array<Record<string, unknown>>;
    certificates: Array<Record<string, unknown>>;
  };
  finance: {
    transactions: Array<Record<string, unknown>>;
    reimbursements: Array<Record<string, unknown>>;
    wallet: Record<string, unknown> | null;
    walletTransactions: Array<Record<string, unknown>>;
    companies: Array<Record<string, unknown>>;
    subscriptions: Array<Record<string, unknown>>;
  };
  c4p: { talks: Array<Record<string, unknown>>; votes: Array<Record<string, unknown>> };
  communications: {
    recipients: Array<Record<string, unknown>>;
    suppressions: Array<Record<string, unknown>>;
    emailLogs: Array<Record<string, unknown>>;
  };
  coverage: string[];
  exclusions: string[];
}

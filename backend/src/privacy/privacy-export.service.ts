import { Injectable } from '@nestjs/common';
import { DataSource, EntityTarget, In, Like, ObjectLiteral, Repository } from 'typeorm';
import { Member } from '../members/entities/member.entity';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { EventRegistration } from '../events/entities/event-registration.entity';
import { MentorProfile } from '../mentorship/entities/mentor-profile.entity';
import { MentorAvailability } from '../mentorship/entities/mentor-availability.entity';
import { MentorshipSession } from '../mentorship/entities/mentorship-session.entity';
import { HourEntry } from '../hours/entities/hour-entry.entity';
import { HourStatement } from '../hours/entities/hour-statement.entity';
import { ProjectParticipant } from '../projects/entities/project-participant.entity';
import { ProjectCertificate } from '../projects/entities/project-certificate.entity';
import { Transaction } from '../ledger/entities/transaction.entity';
import { ReimbursementRequest } from '../reimbursements/entities/reimbursement-request.entity';
import { Wallet } from '../club/entities/wallet.entity';
import { WalletTransaction } from '../club/entities/wallet-transaction.entity';
import { Company } from '../companies/entities/company.entity';
import { CompanySubscriptionTracking } from '../companies/entities/company-subscription-tracking.entity';
import { C4pTalk } from '../c4p/entities/c4p-talk.entity';
import { C4pVote } from '../c4p/entities/c4p-vote.entity';
import { EmailCampaignRecipient } from '../campaigns/entities/email-campaign-recipient.entity';
import { EmailSuppression } from '../campaigns/entities/email-suppression.entity';
import { EmailLog } from '../notifications/entities/email-log.entity';
import type { MemberDataExport } from './privacy-export.types';

function pick<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.map((key) => [key, value[key]])) as Pick<T, K>;
}

@Injectable()
export class PrivacyExportService {
  constructor(private readonly dataSource: DataSource) {}

  private repo<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> {
    return this.dataSource.getRepository(entity);
  }

  async exportMember(memberId: string): Promise<MemberDataExport> {
    const member = await this.repo(Member).findOneOrFail({
      where: { id: memberId },
      select: [
        'id', 'githubId', 'githubHandle', 'name', 'email', 'secondaryEmails',
        'avatarUrl', 'bio', 'linkedinUrl', 'roles', 'isActive', 'eventCommsOptIn',
        'marketingEmailOptIn', 'profileVisibility', 'joinedAt',
      ],
    });
    const emails = [...new Set([member.email, ...(member.secondaryEmails ?? [])]
      .filter(Boolean)
      .map((email) => email.toLowerCase()))];

    const designations = await this.repo(MemberDesignation).find({ where: { memberId } });
    const designationFields = [
      'id', 'memberId', 'targetType', 'targetId', 'targetKey', 'designation',
      'status', 'appointedById', 'confirmedById', 'confirmedAt', 'endedAt',
      'validUntil', 'applicationNotes', 'createdAt', 'updatedAt',
    ] as const;

    const registrations = await this.repo(EventRegistration).find({
      where: [{ memberId }, { payerMemberId: memberId }],
    });
    const registrationFields = [
      'id', 'eventId', 'externalActivationId', 'externalSource', 'ticketTypeId',
      'orderId', 'memberId', 'payerMemberId', 'isGuest', 'checkedInAt',
      'certificateGrantedAt', 'certificateInvitedAt', 'status', 'createdAt',
    ] as const;

    const profile = await this.repo(MentorProfile).findOne({ where: { memberId } });
    const availability = profile
      ? await this.repo(MentorAvailability).find({ where: { mentorId: profile.id } })
      : [];
    const sessionsAsMentor = profile
      ? await this.repo(MentorshipSession).find({ where: { mentorId: profile.id } })
      : [];
    const sessionsAsMentee = await this.repo(MentorshipSession).find({ where: { menteeMemberId: memberId } });

    const hours = await this.repo(HourEntry).find({ where: { memberId } });
    const statements = await this.repo(HourStatement).find({ where: { memberId } });
    const memberships = await this.repo(ProjectParticipant).find({ where: { memberId } });
    const certificates = await this.repo(ProjectCertificate).find({ where: { memberId } });

    const transactions = await this.repo(Transaction).find({
      where: { description: Like(`%[${memberId}]%`) },
    });
    const reimbursements = await this.repo(ReimbursementRequest).find({ where: { memberId } });
    const wallet = await this.repo(Wallet).findOne({ where: { memberId } });
    const walletTransactions = wallet
      ? await this.repo(WalletTransaction).find({ where: { walletId: wallet.id } })
      : [];
    const companies = await this.repo(Company).find({ where: { responsibleMemberId: memberId } });
    const subscriptions = companies.length > 0
      ? await this.repo(CompanySubscriptionTracking).find({ where: { companyId: In(companies.map((company) => company.id)) } })
      : [];

    const talks = emails.length > 0
      ? await this.repo(C4pTalk).find({ where: { speakerEmail: In(emails) } })
      : [];
    const votes = designations.length > 0
      ? await this.repo(C4pVote).find({ where: { evaluatorDesignationId: In(designations.map((item) => item.id)) } })
      : [];

    const recipients = await this.repo(EmailCampaignRecipient).find({ where: { memberId } });
    const suppressions = emails.length > 0
      ? await this.repo(EmailSuppression).find({ where: { emailNormalized: In(emails) } })
      : [];
    const emailLogs = emails.length > 0
      ? await this.repo(EmailLog).find({ where: { to: In(emails) } })
      : [];

    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      subject: pick(member, ['id', 'githubId', 'githubHandle', 'name', 'email']),
      account: pick(member, [
        'id', 'githubId', 'githubHandle', 'name', 'email', 'secondaryEmails',
        'avatarUrl', 'bio', 'linkedinUrl', 'roles', 'isActive', 'eventCommsOptIn',
        'marketingEmailOptIn', 'profileVisibility', 'joinedAt',
      ]),
      designations: designations.map((item) => pick(item, designationFields)),
      events: {
        registrations: registrations.map((item) => ({
          ...pick(item, registrationFields),
          ...(item.memberId === memberId
            ? pick(item, ['attendeeName', 'attendeeEmail', 'guestConsentAt'] as const)
            : {}),
        })),
      },
      mentorship: {
        profile: profile ? pick(profile, ['id', 'memberId', 'areas', 'focus', 'active', 'approvedById', 'since', 'createdAt', 'updatedAt'] as const) : null,
        availability: availability.map((item) => pick(item, ['id', 'mentorId', 'weekday', 'startTime', 'endTime', 'timeZone', 'createdAt', 'updatedAt'] as const)),
        sessionsAsMentor: sessionsAsMentor.map((item) => pick(item, ['id', 'mentorId', 'topicTags', 'scheduledAt', 'durationMin', 'timeZone', 'status', 'meetLink', 'completedAt', 'createdAt', 'updatedAt'] as const)),
        sessionsAsMentee: sessionsAsMentee.map((item) => pick(item, ['id', 'mentorId', 'menteeName', 'menteeEmail', 'menteeMemberId', 'topicTags', 'scheduledAt', 'durationMin', 'timeZone', 'status', 'meetLink', 'completedAt', 'rating', 'feedback', 'cancelReason', 'guestConsentAt', 'createdAt', 'updatedAt'] as const)),
      },
      hours: {
        entries: hours.map((item) => pick(item, ['id', 'memberId', 'sourceType', 'sourceId', 'sourceLabel', 'hours', 'description', 'occurredAt', 'status', 'reportedById', 'approvedById', 'approvedAt', 'rejectReason', 'createdAt', 'updatedAt'] as const)),
        statements: statements.map((item) => pick(item, ['id', 'memberId', 'from', 'to', 'totalHours', 'entries', 'createdAt'] as const)),
      },
      projects: {
        memberships: memberships.map((item) => pick(item, ['id', 'projectId', 'memberId', 'role', 'joinedAt', 'leftAt', 'createdAt', 'updatedAt'] as const)),
        certificates: certificates.map((item) => pick(item, ['id', 'projectId', 'memberId', 'kind', 'code', 'hoursAtIssue', 'issuedAt', 'createdById', 'createdAt'] as const)),
      },
      finance: {
        transactions: transactions.map((item) => ({
          ...pick(item, ['id', 'description', 'referenceId', 'createdAt'] as const),
          amount: Number(item.amount),
          sourceAccount: item.sourceAccount ? pick(item.sourceAccount, ['id', 'name', 'projectKey'] as const) : null,
          destinationAccount: item.destinationAccount ? pick(item.destinationAccount, ['id', 'name', 'projectKey'] as const) : null,
        })),
        reimbursements: reimbursements.map((item) => pick(item, ['id', 'memberId', 'accountId', 'amount', 'description', 'receiptUrl', 'internalReceiptUrl', 'status', 'reviewedById', 'reviewNote', 'reviewedAt', 'eventId', 'externalActivationId', 'createdAt', 'updatedAt'] as const)),
        wallet: wallet ? pick(wallet, ['id', 'memberId', 'balances', 'frozenTypes', 'createdAt', 'updatedAt'] as const) : null,
        walletTransactions: walletTransactions.map((item) => pick(item, ['id', 'walletId', 'coinType', 'amount', 'source', 'referenceId', 'description', 'createdAt'] as const)),
        companies: companies.map((item) => pick(item, ['id', 'cnpj', 'name', 'tradeName', 'status', 'tier', 'subscriptionAmountCents', 'responsibleMemberId', 'createdAt', 'updatedAt'] as const)),
        subscriptions: subscriptions.map((item) => pick(item, ['id', 'companyId', 'status', 'statusChangedAt', 'frozenAt', 'createdAt', 'updatedAt'] as const)),
      },
      c4p: {
        talks: talks.map((item) => pick(item, ['id', 'callId', 'speakerName', 'speakerEmail', 'speakerPhone', 'speakerRole', 'linkedin', 'spokeBefore', 'title', 'summary', 'level', 'track', 'bio', 'photoUrl', 'extraNotes', 'origin', 'consentAt', 'createdAt', 'updatedAt'] as const)),
        votes: votes.map((item) => pick(item, ['id', 'talkId', 'evaluatorDesignationId', 'scores', 'comment', 'createdAt', 'updatedAt'] as const)),
      },
      communications: {
        recipients: recipients.map((item) => pick(item, ['id', 'campaignId', 'memberId', 'email', 'name', 'emailNormalized', 'status', 'attempts', 'nextAttemptAt', 'sentAt', 'emailLogId', 'createdAt', 'updatedAt'] as const)),
        suppressions: suppressions.map((item) => pick(item, ['id', 'emailNormalized', 'reason', 'source', 'createdById', 'createdAt'] as const)),
        emailLogs: emailLogs.map((item) => pick(item, ['id', 'to', 'template', 'eventId', 'registrationId', 'campaignId', 'campaignRecipientId', 'status', 'createdAt'] as const)),
      },
      coverage: [
        'Conta, identidade, visibilidade e consentimentos',
        'Designations, eventos, mentoria, horas e projetos do titular',
        'Movimentações financeiras, SortCoins, C4P e comunicações diretamente vinculadas',
      ],
      exclusions: [
        'Tokens OAuth/JWT, tokens de guest/check-in e hashes de descadastro',
        'Credenciais e objetos completos do Stripe',
        'Dados pessoais de terceiros em compras, sessões ou curadoria',
        'Logs técnicos, IPs, payloads internos e conteúdo de auditoria sobre outros atores',
      ],
    };
  }
}

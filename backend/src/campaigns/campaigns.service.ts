import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { DataSource, In, LessThan, Repository } from 'typeorm';
import type { JwtPayload } from '../auth/jwt.strategy';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { Community } from '../communities/entities/community.entity';
import {
  type Designation,
  DESIGNATIONS,
  MemberDesignation,
  type TargetType,
  TARGET_TYPES,
} from '../designations/entities/member-designation.entity';
import { Directorate } from '../directorates/entities/directorate.entity';
import { Member, MemberRole } from '../members/entities/member.entity';
import { isKnownTemplate } from '../notifications/default-templates';
import {
  EMAIL_LOG_RETENTION_DAYS,
  EmailService,
  type RenderedEmail,
} from '../notifications/email.service';
import { EmailTemplateService } from '../notifications/email-template.service';
import { EmailStatus } from '../notifications/entities/email-log.entity';
import {
  ConfirmCampaignDto,
  CreateCampaignDto,
  CreateSuppressionDto,
  ListCampaignsQueryDto,
  UpdateCampaignDto,
} from './dto/campaign.dto';
import {
  type CampaignPurpose,
  type CampaignSegmentConfig,
  type CampaignSegmentType,
  type CampaignStatus,
  EmailCampaign,
} from './entities/email-campaign.entity';
import {
  type CampaignRecipientStatus,
  EmailCampaignRecipient,
} from './entities/email-campaign-recipient.entity';
import {
  EmailSuppression,
  type SuppressionSource,
} from './entities/email-suppression.entity';

export type ExclusionReason =
  | 'suppressed'
  | 'inactiveRole'
  | 'invalidEmail'
  | 'noOptIn'
  | 'duplicate';

export interface CampaignMetrics {
  total: number;
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  skipped: number;
  suppressed: number;
}

export interface CampaignPreviewResult {
  campaignId: string;
  status: CampaignStatus;
  includedCount: number;
  excludedCount: number;
  included: Array<{
    memberId: string | null;
    email: string | null;
    name: string | null;
  }>;
  excluded: Array<{
    memberId: string | null;
    email: string | null;
    name: string | null;
    reason: ExclusionReason;
  }>;
  exclusionsByReason: Record<ExclusionReason, number>;
  rendered: RenderedEmail;
}

const STALE_SENDING_MS = 2 * 60_000;
const RETRY_BACKOFF_MS = [1 * 60_000, 5 * 60_000] as const;
const THROTTLE_PAUSE_MS = 15 * 60_000;
const MAX_RECIPIENT_ATTEMPTS = 3;

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);
  private readonly frontendUrl: string;
  private readonly unsubscribeSecret: string;

  constructor(
    @InjectRepository(EmailCampaign)
    private readonly campaignRepo: Repository<EmailCampaign>,
    @InjectRepository(EmailCampaignRecipient)
    private readonly recipientRepo: Repository<EmailCampaignRecipient>,
    @InjectRepository(EmailSuppression)
    private readonly suppressionRepo: Repository<EmailSuppression>,
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,
    @InjectRepository(MemberDesignation)
    private readonly designationRepo: Repository<MemberDesignation>,
    @InjectRepository(Directorate)
    private readonly directorateRepo: Repository<Directorate>,
    @InjectRepository(Community)
    private readonly communityRepo: Repository<Community>,
    private readonly emailService: EmailService,
    private readonly templateService: EmailTemplateService,
    private readonly auditService: AuditService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    this.frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    this.unsubscribeSecret =
      process.env.UNSUBSCRIBE_TOKEN_SECRET ??
      process.env.JWT_SECRET ??
      'codaqui-unsubscribe-default-secret';
  }

  normalizeEmail(raw: string | null | undefined): string {
    return (raw ?? '').trim().toLowerCase();
  }

  private isPlaceholderOrSyntheticEmail(
    emailNormalized: string,
    githubHandle?: string | null,
  ): boolean {
    if (!emailNormalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized)) {
      return true;
    }
    if (
      emailNormalized.endsWith('@users.noreply.github.com') ||
      emailNormalized.endsWith('@placeholder.local') ||
      emailNormalized.endsWith('@anon.invalid')
    ) {
      return true;
    }
    if (
      githubHandle &&
      emailNormalized === `${githubHandle.trim().toLowerCase()}@github.com`
    ) {
      return true;
    }
    return false;
  }

  private resolveVerifiedMemberEmail(member: Member): string | null {
    const primary = this.normalizeEmail(member.email);
    const secondary = Array.isArray(member.secondaryEmails)
      ? member.secondaryEmails
          .map((e) => this.normalizeEmail(e))
          .filter((e) => !this.isPlaceholderOrSyntheticEmail(e, member.githubHandle))
      : null;

    if (secondary !== null) {
      if (secondary.length === 0) {
        return null;
      }
      if (
        !this.isPlaceholderOrSyntheticEmail(primary, member.githubHandle) &&
        secondary.includes(primary)
      ) {
        return primary;
      }
      return secondary[0] ?? null;
    }

    if (this.isPlaceholderOrSyntheticEmail(primary, member.githubHandle)) {
      return null;
    }
    return primary;
  }

  buildUnsubscribeToken(recipientId: string): string {
    return createHmac('sha256', this.unsubscribeSecret)
      .update(recipientId)
      .digest('hex');
  }

  hashUnsubscribeToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private isSuppressedForPurpose(
    suppression: EmailSuppression | undefined,
    purpose: CampaignPurpose,
  ): boolean {
    if (!suppression) return false;
    if (purpose === 'promotional') return true;
    return (
      suppression.source === 'admin' ||
      suppression.source === 'complaint' ||
      suppression.source === 'bounce_manual'
    );
  }

  private validateSegmentConfig(
    purpose: CampaignPurpose,
    segmentType: CampaignSegmentType,
    config: CampaignSegmentConfig,
    templateId?: string | null,
  ): void {
    if (templateId && !isKnownTemplate(templateId)) {
      throw new BadRequestException(`Template desconhecido: ${templateId}`);
    }
    if (!config || typeof config !== 'object') {
      throw new BadRequestException('segmentConfig inválido.');
    }

    switch (segmentType) {
      case 'all_opted_in_members':
        break;
      case 'role': {
        const validRoles = Object.values(MemberRole) as string[];
        if (!config.role || !validRoles.includes(config.role)) {
          throw new BadRequestException(
            'Segmento por role exige uma role global válida.',
          );
        }
        break;
      }
      case 'designation': {
        const validTargets = TARGET_TYPES as readonly string[];
        const validDesignations = DESIGNATIONS as readonly string[];
        if (
          !config.targetType ||
          !validTargets.includes(config.targetType) ||
          !config.designation ||
          !validDesignations.includes(config.designation) ||
          (!config.targetId?.trim() && !config.targetKey?.trim())
        ) {
          throw new BadRequestException(
            'Segmento por designation exige targetType, designation e targetId/targetKey válidos.',
          );
        }
        break;
      }
      case 'community_governance': {
        if (!config.communityId || !config.communityId.trim()) {
          throw new BadRequestException(
            'Segmento community_governance exige communityId.',
          );
        }
        break;
      }
      case 'manual': {
        if (
          !Array.isArray(config.emails) ||
          config.emails.length === 0 ||
          config.emails.length > 500
        ) {
          throw new BadRequestException(
            'Segmento manual exige entre 1 e 500 endereços.',
          );
        }
        if (
          purpose === 'promotional' &&
          (!config.consentEvidence ||
            typeof config.consentEvidence !== 'string' ||
            config.consentEvidence.trim().length < 5)
        ) {
          throw new BadRequestException(
            'Segmento manual promocional exige evidência de consentimento documentada.',
          );
        }
        break;
      }
      default:
        throw new BadRequestException(`Segmento inválido: ${String(segmentType)}`);
    }
  }

  computeMetrics(recipients: EmailCampaignRecipient[]): CampaignMetrics {
    const metrics: CampaignMetrics = {
      total: recipients.length,
      pending: 0,
      sending: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      suppressed: 0,
    };
    for (const r of recipients) {
      if (r.status in metrics) {
        metrics[r.status as keyof Omit<CampaignMetrics, 'total'>] += 1;
      }
    }
    return metrics;
  }

  private sanitizeRecipientForActor(
    recipient: EmailCampaignRecipient,
    isAdmin: boolean,
  ): Omit<EmailCampaignRecipient, 'unsubscribeTokenHash'> {
    const { unsubscribeTokenHash: _omitted, ...rest } = recipient;
    if (isAdmin) {
      return rest;
    }
    return {
      ...rest,
      name: null,
      email: null,
      emailNormalized: null,
    };
  }

  async create(
    dto: CreateCampaignDto,
    actor: JwtPayload,
  ): Promise<EmailCampaign> {
    const idempotencyKey = dto.idempotencyKey.trim();
    const existing = await this.campaignRepo.findOneBy({ idempotencyKey });
    if (existing) {
      return existing;
    }

    this.validateSegmentConfig(
      dto.purpose,
      dto.segmentType,
      dto.segmentConfig,
      dto.templateId,
    );

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('scheduledAt inválido.');
    }

    const entity = this.campaignRepo.create({
      name: dto.name.trim(),
      subject: dto.subject.trim(),
      bodyMarkdown: dto.bodyMarkdown,
      templateId: dto.templateId ?? null,
      purpose: dto.purpose,
      status: 'draft',
      segmentType: dto.segmentType,
      segmentConfig: dto.segmentConfig,
      scheduledAt,
      startedAt: null,
      completedAt: null,
      createdById: actor.sub,
      confirmedById: null,
      confirmedAt: null,
      idempotencyKey,
    });

    let saved: EmailCampaign;
    try {
      saved = await this.campaignRepo.save(entity);
    } catch (error) {
      if ((error as { code?: string })?.code === '23505') {
        const concurrent = await this.campaignRepo.findOneBy({ idempotencyKey });
        if (concurrent) return concurrent;
      }
      throw error;
    }

    await this.auditService.log({
      action: AuditAction.EMAIL_CAMPAIGN_CREATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetType: 'email_campaign',
      details: {
        campaignId: saved.id,
        purpose: saved.purpose,
        segmentType: saved.segmentType,
        idempotencyKey: saved.idempotencyKey,
      },
    });

    return saved;
  }

  async update(
    id: string,
    dto: UpdateCampaignDto,
    actor: JwtPayload,
  ): Promise<EmailCampaign> {
    const campaign = await this.campaignRepo.findOneBy({ id });
    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada.');
    }
    if (campaign.status !== 'draft' && campaign.status !== 'preview') {
      throw new ConflictException(
        'Apenas campanhas em rascunho ou prévia podem ser editadas.',
      );
    }

    const nextPurpose = dto.purpose ?? campaign.purpose;
    const nextSegmentType = dto.segmentType ?? campaign.segmentType;
    const nextSegmentConfig = dto.segmentConfig ?? campaign.segmentConfig;
    const nextTemplateId =
      dto.templateId !== undefined ? dto.templateId : campaign.templateId;

    this.validateSegmentConfig(
      nextPurpose,
      nextSegmentType,
      nextSegmentConfig,
      nextTemplateId,
    );

    if (dto.name !== undefined) campaign.name = dto.name.trim();
    if (dto.subject !== undefined) campaign.subject = dto.subject.trim();
    if (dto.bodyMarkdown !== undefined) campaign.bodyMarkdown = dto.bodyMarkdown;
    if (dto.templateId !== undefined) campaign.templateId = dto.templateId;
    if (dto.purpose !== undefined) campaign.purpose = dto.purpose;
    if (dto.segmentType !== undefined) campaign.segmentType = dto.segmentType;
    if (dto.segmentConfig !== undefined) {
      campaign.segmentConfig = dto.segmentConfig;
    }
    if (dto.scheduledAt !== undefined) {
      campaign.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    }

    const requiresRepreview =
      dto.subject !== undefined ||
      dto.bodyMarkdown !== undefined ||
      dto.templateId !== undefined ||
      dto.purpose !== undefined ||
      dto.segmentType !== undefined ||
      dto.segmentConfig !== undefined;

    if (campaign.status === 'preview' && requiresRepreview) {
      campaign.status = 'draft';
    }

    const saved = await this.campaignRepo.save(campaign);
    await this.auditService.log({
      action: AuditAction.EMAIL_CAMPAIGN_UPDATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetType: 'email_campaign',
      details: {
        campaignId: saved.id,
        status: saved.status,
      },
    });
    return saved;
  }

  async list(query: ListCampaignsQueryDto): Promise<{
    data: Array<EmailCampaign & { metrics: CampaignMetrics }>;
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where: Partial<Pick<EmailCampaign, 'status' | 'purpose'>> = {};
    if (query.status) where.status = query.status;
    if (query.purpose) where.purpose = query.purpose;

    const [items, total] = await this.campaignRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const recipientsByCampaign = new Map<string, EmailCampaignRecipient[]>();
    if (items.length > 0) {
      const allRecipients = await this.recipientRepo.find({
        where: { campaignId: In(items.map((c) => c.id)) },
      });
      for (const r of allRecipients) {
        const list = recipientsByCampaign.get(r.campaignId) ?? [];
        list.push(r);
        recipientsByCampaign.set(r.campaignId, list);
      }
    }

    const data = items.map((c) => ({
      ...c,
      metrics: this.computeMetrics(recipientsByCampaign.get(c.id) ?? []),
    }));

    return {
      data,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      limit,
    };
  }

  async findOne(
    id: string,
    actor: JwtPayload,
  ): Promise<
    EmailCampaign & {
      metrics: CampaignMetrics;
      recipients: Array<Omit<EmailCampaignRecipient, 'unsubscribeTokenHash'>>;
      renderedPreview: RenderedEmail;
    }
  > {
    const campaign = await this.campaignRepo.findOneBy({ id });
    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada.');
    }
    const recipients = await this.recipientRepo.find({
      where: { campaignId: id },
      order: { createdAt: 'ASC' },
    });
    const isAdmin = Boolean(actor.roles?.includes(MemberRole.ADMIN));
    const metrics = this.computeMetrics(recipients);
    const renderedPreview = this.templateService.renderCampaignMarkdown({
      subject: campaign.subject,
      bodyMarkdown: campaign.bodyMarkdown,
      purpose: campaign.purpose,
    });

    return {
      ...campaign,
      metrics,
      recipients: recipients.map((r) => this.sanitizeRecipientForActor(r, isAdmin)),
      renderedPreview,
    };
  }

  private isDesignationLinkActive(
    d: MemberDesignation,
    now: Date,
  ): boolean {
    if (d.status !== 'active') return false;
    if (d.validUntil && new Date(d.validUntil).getTime() <= now.getTime()) {
      return false;
    }
    return true;
  }

  async preview(
    id: string,
    actor: JwtPayload,
  ): Promise<CampaignPreviewResult> {
    const campaign = await this.campaignRepo.findOneBy({ id });
    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada.');
    }
    if (campaign.status !== 'draft' && campaign.status !== 'preview') {
      throw new ConflictException(
        'A prévia só pode ser gerada para campanhas em rascunho ou prévia.',
      );
    }

    const isAdmin = Boolean(actor.roles?.includes(MemberRole.ADMIN));
    if (!isAdmin) {
      throw new ForbiddenException('Apenas administradores podem gerar prévias.');
    }

    const suppressions = await this.suppressionRepo.find();
    const suppressionByEmail = new Map(
      suppressions.map((s) => [this.normalizeEmail(s.emailNormalized), s]),
    );

    const members = await this.memberRepo.find({
      select: [
        'id',
        'name',
        'githubHandle',
        'email',
        'secondaryEmails',
        'roles',
        'isActive',
        'marketingEmailOptIn',
      ],
    });
    const memberById = new Map(members.map((m) => [m.id, m]));

    const exclusionsByReason: Record<ExclusionReason, number> = {
      suppressed: 0,
      inactiveRole: 0,
      invalidEmail: 0,
      noOptIn: 0,
      duplicate: 0,
    };
    const excluded: CampaignPreviewResult['excluded'] = [];
    const included: CampaignPreviewResult['included'] = [];
    const recipientsToSave: EmailCampaignRecipient[] = [];

    const recordExclusion = (
      reason: ExclusionReason,
      info: { memberId: string | null; email: string | null; name: string | null },
    ) => {
      exclusionsByReason[reason] += 1;
      excluded.push({ ...info, reason });
    };

    const evaluateCandidateMember = (
      member: Member,
      seenEmails: Set<string>,
    ) => {
      if (!member.isActive) {
        recordExclusion('inactiveRole', {
          memberId: member.id,
          email: member.email ?? null,
          name: member.name ?? null,
        });
        return;
      }

      const verifiedEmail = this.resolveVerifiedMemberEmail(member);
      if (!verifiedEmail) {
        recordExclusion('invalidEmail', {
          memberId: member.id,
          email: member.email ?? null,
          name: member.name ?? null,
        });
        return;
      }

      if (seenEmails.has(verifiedEmail)) {
        recordExclusion('duplicate', {
          memberId: member.id,
          email: verifiedEmail,
          name: member.name ?? null,
        });
        return;
      }
      seenEmails.add(verifiedEmail);

      const suppression = suppressionByEmail.get(verifiedEmail);
      if (this.isSuppressedForPurpose(suppression, campaign.purpose)) {
        recordExclusion('suppressed', {
          memberId: member.id,
          email: verifiedEmail,
          name: member.name ?? null,
        });
        const recId = randomUUID();
        const rawToken = this.buildUnsubscribeToken(recId);
        recipientsToSave.push(
          this.recipientRepo.create({
            id: recId,
            campaignId: campaign.id,
            memberId: member.id,
            email: verifiedEmail,
            name: member.name ?? null,
            emailNormalized: verifiedEmail,
            status: 'suppressed',
            attempts: 0,
            unsubscribeTokenHash: this.hashUnsubscribeToken(rawToken),
          }),
        );
        return;
      }

      if (campaign.purpose === 'promotional' && !member.marketingEmailOptIn) {
        recordExclusion('noOptIn', {
          memberId: member.id,
          email: verifiedEmail,
          name: member.name ?? null,
        });
        return;
      }

      const recId = randomUUID();
      const rawToken = this.buildUnsubscribeToken(recId);
      included.push({
        memberId: member.id,
        email: verifiedEmail,
        name: member.name ?? null,
      });
      recipientsToSave.push(
        this.recipientRepo.create({
          id: recId,
          campaignId: campaign.id,
          memberId: member.id,
          email: verifiedEmail,
          name: member.name ?? null,
          emailNormalized: verifiedEmail,
          status: 'pending',
          attempts: 0,
          unsubscribeTokenHash: this.hashUnsubscribeToken(rawToken),
        }),
      );
    };

    const now = new Date();
    const seenEmails = new Set<string>();

    if (campaign.segmentType === 'all_opted_in_members') {
      for (const member of members) {
        evaluateCandidateMember(member, seenEmails);
      }
    } else if (campaign.segmentType === 'role') {
      const targetRole = campaign.segmentConfig.role as MemberRole | undefined;
      for (const member of members) {
        if (!targetRole || !member.roles?.includes(targetRole)) continue;
        evaluateCandidateMember(member, seenEmails);
      }
    } else if (campaign.segmentType === 'designation') {
      const cfg = campaign.segmentConfig;
      const allDesignations = await this.designationRepo.find({
        where: {
          targetType: cfg.targetType as TargetType | undefined,
          designation: cfg.designation as Designation | undefined,
          ...(cfg.targetId
            ? { targetId: cfg.targetId }
            : { targetKey: cfg.targetKey }),
        },
      });
      const seenActiveMembers = new Set<string>();
      for (const d of allDesignations) {
        const member = memberById.get(d.memberId);
        if (!member || !this.isDesignationLinkActive(d, now)) {
          recordExclusion('inactiveRole', {
            memberId: d.memberId,
            email: member?.email ?? null,
            name: member?.name ?? null,
          });
          continue;
        }
        if (seenActiveMembers.has(member.id)) {
          recordExclusion('duplicate', {
            memberId: member.id,
            email: member.email ?? null,
            name: member.name ?? null,
          });
          continue;
        }
        seenActiveMembers.add(member.id);
        evaluateCandidateMember(member, seenEmails);
      }
    } else if (campaign.segmentType === 'community_governance') {
      const communityId = campaign.segmentConfig.communityId!;
      const community = await this.communityRepo.findOneBy({ id: communityId });
      if (!community) {
        throw new BadRequestException('Comunidade informada não encontrada.');
      }
      const directorates = await this.directorateRepo.find({
        where: { communityId },
      });
      const activeDirectorateIds = new Set(
        directorates.filter((dir) => dir.isActive).map((dir) => dir.id),
      );
      const allDirectorateIds = new Set(directorates.map((dir) => dir.id));

      const allDesignations = await this.designationRepo.find();
      const matchingDesignations = allDesignations.filter(
        (d) =>
          (d.targetType === 'community' && d.targetId === communityId) ||
          (d.targetType === 'directorate' &&
            d.targetId !== null &&
            allDirectorateIds.has(d.targetId)),
      );

      const seenActiveMembers = new Set<string>();
      for (const d of matchingDesignations) {
        const member = memberById.get(d.memberId);
        const dirIsActive =
          d.targetType !== 'directorate' ||
          (d.targetId !== null && activeDirectorateIds.has(d.targetId));
        if (!member || !dirIsActive || !this.isDesignationLinkActive(d, now)) {
          recordExclusion('inactiveRole', {
            memberId: d.memberId,
            email: member?.email ?? null,
            name: member?.name ?? null,
          });
          continue;
        }
        if (seenActiveMembers.has(member.id)) {
          recordExclusion('duplicate', {
            memberId: member.id,
            email: member.email ?? null,
            name: member.name ?? null,
          });
          continue;
        }
        seenActiveMembers.add(member.id);
        evaluateCandidateMember(member, seenEmails);
      }
    } else if (campaign.segmentType === 'manual') {
      const memberByVerifiedEmail = new Map<string, Member>();
      for (const member of members) {
        const primaryVerified = this.resolveVerifiedMemberEmail(member);
        if (primaryVerified) {
          memberByVerifiedEmail.set(primaryVerified, member);
        }
        if (Array.isArray(member.secondaryEmails)) {
          for (const sec of member.secondaryEmails) {
            const norm = this.normalizeEmail(sec);
            if (!this.isPlaceholderOrSyntheticEmail(norm, member.githubHandle)) {
              memberByVerifiedEmail.set(norm, member);
            }
          }
        }
      }

      const rawEmails = campaign.segmentConfig.emails ?? [];
      const seenManual = new Set<string>();
      for (const raw of rawEmails) {
        const norm = this.normalizeEmail(raw);
        if (seenManual.has(norm)) {
          recordExclusion('duplicate', {
            memberId: null,
            email: norm || raw,
            name: null,
          });
          continue;
        }
        seenManual.add(norm);
        const member = memberByVerifiedEmail.get(norm);
        if (!member) {
          recordExclusion('invalidEmail', {
            memberId: null,
            email: norm || raw,
            name: null,
          });
          continue;
        }
        evaluateCandidateMember(member, seenEmails);
      }
    }

    await this.dataSource.transaction(async (manager) => {
      const txRecipientRepo = manager.getRepository(EmailCampaignRecipient);
      const txCampaignRepo = manager.getRepository(EmailCampaign);
      await txRecipientRepo.delete({ campaignId: campaign.id });
      if (recipientsToSave.length > 0) {
        await txRecipientRepo.save(recipientsToSave);
      }
      campaign.status = 'preview';
      await txCampaignRepo.save(campaign);
    });

    const rendered = this.templateService.renderCampaignMarkdown({
      subject: campaign.subject,
      bodyMarkdown: campaign.bodyMarkdown,
      purpose: campaign.purpose,
    });

    return {
      campaignId: campaign.id,
      status: 'preview',
      includedCount: included.length,
      excludedCount: excluded.length,
      included,
      excluded,
      exclusionsByReason,
      rendered,
    };
  }

  private resolveTemplateName(campaign: EmailCampaign): string {
    if (campaign.templateId && isKnownTemplate(campaign.templateId)) {
      return campaign.templateId;
    }
    return campaign.purpose === 'promotional'
      ? 'campaign-promotional'
      : 'campaign-transactional';
  }

  async sendTest(
    id: string,
    actor: JwtPayload,
  ): Promise<{
    ok: boolean;
    emailLogId: string;
    status: EmailStatus;
    to: string;
  }> {
    const campaign = await this.campaignRepo.findOneBy({ id });
    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada.');
    }
    const to = this.normalizeEmail(actor.email);
    if (!to || this.isPlaceholderOrSyntheticEmail(to, actor.handle)) {
      throw new BadRequestException(
        'O administrador autenticado não possui um endereço de e-mail válido para teste.',
      );
    }

    const rendered = this.templateService.renderCampaignMarkdown({
      subject: `[TESTE] ${campaign.subject}`,
      bodyMarkdown: campaign.bodyMarkdown,
      purpose: campaign.purpose,
      recipientName: actor.name || actor.handle,
      unsubscribeUrl: `${this.frontendUrl}/descadastro?token=test-preview`,
    });

    const log = await this.emailService.sendCampaignEmail({
      to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      template: this.resolveTemplateName(campaign),
      campaignId: campaign.id,
      campaignRecipientId: null,
    });

    return {
      ok: log.status === EmailStatus.SENT || log.status === EmailStatus.SKIPPED,
      emailLogId: log.id,
      status: log.status,
      to,
    };
  }

  async confirm(
    id: string,
    dto: ConfirmCampaignDto,
    actor: JwtPayload,
  ): Promise<EmailCampaign> {
    const campaign = await this.campaignRepo.findOneBy({ id });
    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada.');
    }
    if (campaign.status !== 'preview') {
      throw new ConflictException(
        'A campanha precisa estar em prévia congelada antes da confirmação.',
      );
    }

    const recipients = await this.recipientRepo.find({
      where: { campaignId: campaign.id },
    });
    const pendingCount = recipients.filter((r) => r.status === 'pending').length;
    if (pendingCount === 0) {
      throw new BadRequestException(
        'A campanha não possui destinatários pendentes para envio.',
      );
    }

    const scheduledAt =
      dto.scheduledAt !== undefined
        ? dto.scheduledAt
          ? new Date(dto.scheduledAt)
          : null
        : campaign.scheduledAt;

    const now = new Date();
    campaign.confirmedById = actor.sub;
    campaign.confirmedAt = now;
    campaign.scheduledAt = scheduledAt;

    if (scheduledAt && scheduledAt.getTime() > now.getTime()) {
      campaign.status = 'scheduled';
    } else {
      campaign.status = 'sending';
      campaign.startedAt = now;
    }

    const saved = await this.campaignRepo.save(campaign);
    await this.auditService.log({
      action: AuditAction.EMAIL_CAMPAIGN_CONFIRMED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetType: 'email_campaign',
      details: {
        campaignId: saved.id,
        status: saved.status,
        scheduledAt: saved.scheduledAt?.toISOString() ?? null,
        pendingRecipients: pendingCount,
      },
    });
    return saved;
  }

  async cancel(id: string, actor: JwtPayload): Promise<EmailCampaign> {
    const campaign = await this.campaignRepo.findOneBy({ id });
    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada.');
    }
    if (
      campaign.status !== 'draft' &&
      campaign.status !== 'preview' &&
      campaign.status !== 'scheduled' &&
      campaign.status !== 'sending'
    ) {
      throw new ConflictException(
        `Campanha em estado ${campaign.status} não pode ser cancelada.`,
      );
    }

    campaign.status = 'canceled';
    campaign.completedAt = new Date();
    const saved = await this.campaignRepo.save(campaign);

    await this.recipientRepo.update(
      { campaignId: campaign.id, status: 'pending' },
      {
        status: 'skipped',
        lockedAt: null,
        lastError: 'Campanha cancelada pelo administrador.',
      },
    );

    await this.auditService.log({
      action: AuditAction.EMAIL_CAMPAIGN_CANCELED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetType: 'email_campaign',
      details: {
        campaignId: saved.id,
      },
    });
    return saved;
  }

  async retryRecipient(
    campaignId: string,
    recipientId: string,
    actor: JwtPayload,
  ): Promise<Omit<EmailCampaignRecipient, 'unsubscribeTokenHash'>> {
    const campaign = await this.campaignRepo.findOneBy({ id: campaignId });
    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada.');
    }
    if (campaign.status === 'canceled') {
      throw new ConflictException(
        'Não é possível reenviar destinatários de uma campanha cancelada.',
      );
    }

    const recipient = await this.recipientRepo.findOneBy({
      id: recipientId,
      campaignId,
    });
    if (!recipient) {
      throw new NotFoundException('Destinatário não encontrado nesta campanha.');
    }
    if (recipient.status === 'sent') {
      throw new ConflictException(
        'Destinatário já recebeu o e-mail; reenvio duplicado não é permitido.',
      );
    }
    if (recipient.status === 'suppressed') {
      throw new ConflictException(
        'Destinatário está suprimido; reenvio não é permitido.',
      );
    }
    if (recipient.status !== 'failed' && recipient.status !== 'skipped') {
      throw new ConflictException(
        'Apenas destinatários com falha ou ignorados podem receber retry manual.',
      );
    }

    recipient.status = 'pending';
    recipient.attempts = 0;
    recipient.nextAttemptAt = null;
    recipient.lockedAt = null;
    recipient.lastError = null;
    const savedRecipient = await this.recipientRepo.save(recipient);

    if (
      campaign.status === 'completed' ||
      campaign.status === 'completed_with_errors' ||
      campaign.status === 'failed'
    ) {
      campaign.status = 'sending';
      campaign.completedAt = null;
      await this.campaignRepo.save(campaign);
    }

    await this.auditService.log({
      action: AuditAction.EMAIL_CAMPAIGN_RECIPIENT_RETRIED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetType: 'email_campaign_recipient',
      details: {
        campaignId,
        recipientId,
      },
    });

    return this.sanitizeRecipientForActor(savedRecipient, true);
  }

  async unsubscribeByToken(rawToken: string | undefined): Promise<{
    ok: boolean;
    status: 'unsubscribed' | 'invalid_or_expired';
    message: string;
  }> {
    const trimmed = (rawToken ?? '').trim();
    if (!/^[a-f0-9]{64}$/i.test(trimmed)) {
      return {
        ok: false,
        status: 'invalid_or_expired',
        message:
          'Link de descadastro inválido ou expirado. Caso seja membro, gerencie suas preferências em Meus dados.',
      };
    }

    const tokenHash = this.hashUnsubscribeToken(trimmed);
    const recipient = await this.recipientRepo.findOneBy({
      unsubscribeTokenHash: tokenHash,
    });
    if (!recipient || !recipient.emailNormalized) {
      return {
        ok: false,
        status: 'invalid_or_expired',
        message:
          'Link de descadastro inválido ou expirado. Caso seja membro, gerencie suas preferências em Meus dados.',
      };
    }

    const emailNormalized = this.normalizeEmail(recipient.emailNormalized);
    const existingSuppression = await this.suppressionRepo.findOneBy({
      emailNormalized,
    });
    if (!existingSuppression) {
      await this.suppressionRepo.save(
        this.suppressionRepo.create({
          emailNormalized,
          reason: 'Descadastro público via link de campanha promocional',
          source: 'unsubscribe',
          createdById: recipient.memberId ?? null,
        }),
      );
    }

    if (recipient.memberId) {
      await this.memberRepo.update(
        { id: recipient.memberId },
        { marketingEmailOptIn: false },
      );
    }

    await this.auditService.log({
      action: AuditAction.EMAIL_SUPPRESSION_CREATED,
      actorId: recipient.memberId ?? recipient.id,
      actorHandle: 'unsubscribe-link',
      targetType: 'email_suppression',
      details: {
        campaignId: recipient.campaignId,
        recipientId: recipient.id,
        source: 'unsubscribe',
      },
    });

    return {
      ok: true,
      status: 'unsubscribed',
      message:
        'Sua preferência foi atualizada. Este endereço não receberá novas comunicações promocionais.',
    };
  }

  async listSuppressions(): Promise<EmailSuppression[]> {
    return this.suppressionRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async createSuppression(
    dto: CreateSuppressionDto,
    actor: JwtPayload,
  ): Promise<EmailSuppression> {
    const emailNormalized = this.normalizeEmail(dto.email);
    if (!emailNormalized) {
      throw new BadRequestException('E-mail inválido.');
    }

    const existing = await this.suppressionRepo.findOneBy({ emailNormalized });
    if (existing) {
      if (existing.source === 'unsubscribe') {
        return existing;
      }
      existing.reason = dto.reason.trim();
      existing.source = dto.source as SuppressionSource;
      return this.suppressionRepo.save(existing);
    }

    const saved = await this.suppressionRepo.save(
      this.suppressionRepo.create({
        emailNormalized,
        reason: dto.reason.trim(),
        source: dto.source,
        createdById: actor.sub,
      }),
    );

    await this.auditService.log({
      action: AuditAction.EMAIL_SUPPRESSION_CREATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetType: 'email_suppression',
      details: {
        suppressionId: saved.id,
        source: saved.source,
      },
    });

    return saved;
  }

  async deleteSuppression(id: string, actor: JwtPayload): Promise<void> {
    const existing = await this.suppressionRepo.findOneBy({ id });
    if (!existing) {
      throw new NotFoundException('Supressão não encontrada.');
    }
    if (existing.source === 'unsubscribe') {
      throw new ForbiddenException(
        'Supressão por descadastro do titular não pode ser removida pelo administrador; a reativação exige ação explícita do próprio titular.',
      );
    }
    await this.suppressionRepo.delete({ id });
    await this.auditService.log({
      action: AuditAction.EMAIL_SUPPRESSION_DELETED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetType: 'email_suppression',
      details: {
        suppressionId: id,
        source: existing.source,
      },
    });
  }

  private async claimPendingRecipients(
    campaignId: string,
    batchSize: number,
    now: Date,
  ): Promise<EmailCampaignRecipient[]> {
    return this.dataSource.transaction(async (manager) => {
      if (typeof (manager as { query?: unknown }).query === 'function') {
        const rows = (await manager.query(
          `
          UPDATE email_campaign_recipients
          SET status = 'sending',
              "lockedAt" = $1,
              "updatedAt" = $1
          WHERE id IN (
            SELECT id
            FROM email_campaign_recipients
            WHERE "campaignId" = $2
              AND status = 'pending'
              AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= $1)
            ORDER BY "createdAt" ASC
            FOR UPDATE SKIP LOCKED
            LIMIT $3
          )
          RETURNING *
          `,
          [now, campaignId, batchSize],
        )) as unknown;

        const claimedRows: EmailCampaignRecipient[] = Array.isArray(rows)
          ? Array.isArray(rows[0])
            ? (rows[0] as EmailCampaignRecipient[])
            : (rows as EmailCampaignRecipient[])
          : [];
        return claimedRows;
      }

      const txRecipientRepo = manager.getRepository(EmailCampaignRecipient);
      const allPending = await txRecipientRepo.find({
        where: { campaignId, status: 'pending' },
        order: { createdAt: 'ASC' },
      });
      const due = allPending
        .filter(
          (r) =>
            !r.nextAttemptAt ||
            new Date(r.nextAttemptAt).getTime() <= now.getTime(),
        )
        .slice(0, batchSize);
      for (const r of due) {
        r.status = 'sending';
        r.lockedAt = now;
      }
      if (due.length > 0) {
        await txRecipientRepo.save(due);
      }
      return due;
    });
  }

  @Cron('*/10 * * * * *')
  async processCampaignQueue(batchSize = 10): Promise<void> {
    const now = new Date();
    const staleCutoff = new Date(now.getTime() - STALE_SENDING_MS);

    // 1. Recupera itens presos em 'sending' há mais de 2 minutos.
    const allSendingRecipients = await this.recipientRepo.find({
      where: { status: 'sending', lockedAt: LessThan(staleCutoff) },
    });
    for (const stale of allSendingRecipients) {
      if (stale.attempts >= MAX_RECIPIENT_ATTEMPTS) {
        stale.status = 'failed';
        stale.lockedAt = null;
        stale.lastError = 'Tempo limite de processamento excedido.';
      } else {
        stale.status = 'pending';
        stale.lockedAt = null;
        stale.nextAttemptAt = now;
      }
      await this.recipientRepo.save(stale);
    }

    // 2. Promove campanhas agendadas cujo horário já chegou.
    const scheduledCampaigns = await this.campaignRepo.find({
      where: { status: 'scheduled' },
    });
    for (const scheduled of scheduledCampaigns) {
      if (
        !scheduled.scheduledAt ||
        new Date(scheduled.scheduledAt).getTime() <= now.getTime()
      ) {
        scheduled.status = 'sending';
        scheduled.startedAt = scheduled.startedAt ?? now;
        await this.campaignRepo.save(scheduled);
      }
    }

    // 3. Processa lotes das campanhas em 'sending'.
    const activeCampaigns = await this.campaignRepo.find({
      where: { status: 'sending' },
      order: { createdAt: 'ASC' },
    });

    for (const campaign of activeCampaigns) {
      const confirmerId = campaign.confirmedById ?? campaign.createdById;
      const confirmer = await this.memberRepo.findOneBy({ id: confirmerId });
      if (
        !confirmer ||
        !confirmer.isActive ||
        !confirmer.roles?.includes(MemberRole.ADMIN)
      ) {
        campaign.status = 'failed';
        campaign.completedAt = new Date();
        await this.campaignRepo.save(campaign);
        await this.recipientRepo.update(
          { campaignId: campaign.id, status: 'pending' },
          {
            status: 'failed',
            lockedAt: null,
            lastError:
              'Envio interrompido: autorização de administrador do confirmador ausente ou inativa.',
          },
        );
        continue;
      }

      if (!this.emailService.getStatus().configured) {
        campaign.status = 'failed';
        campaign.completedAt = new Date();
        await this.campaignRepo.save(campaign);
        await this.recipientRepo.update(
          { campaignId: campaign.id, status: 'pending' },
          {
            status: 'failed',
            lockedAt: null,
            lastError: 'SMTP_NOT_CONFIGURED',
          },
        );
        continue;
      }

      const claimed = await this.claimPendingRecipients(
        campaign.id,
        batchSize,
        now,
      );

      for (const recipient of claimed) {
        const freshCampaign = await this.campaignRepo.findOneBy({
          id: campaign.id,
        });
        if (!freshCampaign || freshCampaign.status === 'canceled') {
          recipient.status = 'skipped';
          recipient.lockedAt = null;
          recipient.lastError = 'Campanha cancelada pelo administrador.';
          await this.recipientRepo.save(recipient);
          continue;
        }

        const normEmail = this.normalizeEmail(
          recipient.emailNormalized ?? recipient.email,
        );
        if (!normEmail || !recipient.email) {
          recipient.status = 'failed';
          recipient.lockedAt = null;
          recipient.lastError = 'Destinatário sem e-mail válido.';
          await this.recipientRepo.save(recipient);
          continue;
        }

        const suppression = await this.suppressionRepo.findOneBy({
          emailNormalized: normEmail,
        });
        if (this.isSuppressedForPurpose(suppression ?? undefined, campaign.purpose)) {
          recipient.status = 'suppressed';
          recipient.lockedAt = null;
          recipient.lastError = null;
          await this.recipientRepo.save(recipient);
          continue;
        }

        const rawToken = this.buildUnsubscribeToken(recipient.id);
        const unsubscribeUrl = `${this.frontendUrl}/descadastro?token=${encodeURIComponent(rawToken)}`;
        const rendered = this.templateService.renderCampaignMarkdown({
          subject: campaign.subject,
          bodyMarkdown: campaign.bodyMarkdown,
          purpose: campaign.purpose,
          recipientName: recipient.name,
          unsubscribeUrl,
        });

        const log = await this.emailService.sendCampaignEmail({
          to: recipient.email,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          template: this.resolveTemplateName(campaign),
          campaignId: campaign.id,
          campaignRecipientId: recipient.id,
        });

        recipient.attempts = (recipient.attempts ?? 0) + 1;
        recipient.emailLogId = log.id;
        recipient.lockedAt = null;

        if (log.status === EmailStatus.SENT) {
          recipient.status = 'sent';
          recipient.sentAt = new Date();
          recipient.nextAttemptAt = null;
          recipient.lastError = null;
          await this.recipientRepo.save(recipient);
          continue;
        }

        const sanitizedError = this.emailService.sanitizeOperationalError(
          log.error ?? 'Falha operacional no envio SMTP',
        );
        recipient.lastError = sanitizedError;

        const isThrottleError =
          /(?:^|\b)(421|454)(?:\b|$)|too many login attempts|rate limit|throttl/i.test(
            sanitizedError,
          );
        const isPermanentInvalid =
          /invalid recipient|invalid address|malformed|550 5\.1\.1/i.test(
            sanitizedError,
          );

        if (isThrottleError) {
          const pauseUntil = new Date(Date.now() + THROTTLE_PAUSE_MS);
          if (recipient.attempts >= MAX_RECIPIENT_ATTEMPTS) {
            recipient.status = 'failed';
            recipient.nextAttemptAt = null;
          } else {
            recipient.status = 'pending';
            recipient.nextAttemptAt = pauseUntil;
          }
          await this.recipientRepo.save(recipient);
          await this.recipientRepo.update(
            { campaignId: campaign.id, status: 'pending' },
            { nextAttemptAt: pauseUntil },
          );
          break;
        }

        if (isPermanentInvalid || recipient.attempts >= MAX_RECIPIENT_ATTEMPTS) {
          recipient.status = 'failed';
          recipient.nextAttemptAt = null;
        } else {
          const backoffMs =
            RETRY_BACKOFF_MS[recipient.attempts - 1] ?? RETRY_BACKOFF_MS[1];
          recipient.status = 'pending';
          recipient.nextAttemptAt = new Date(Date.now() + backoffMs);
        }
        await this.recipientRepo.save(recipient);
      }

      // Verifica se a campanha concluiu todos os envios
      const refreshedCampaign = await this.campaignRepo.findOneBy({
        id: campaign.id,
      });
      if (!refreshedCampaign || refreshedCampaign.status !== 'sending') {
        continue;
      }
      const allRecipients = await this.recipientRepo.find({
        where: { campaignId: campaign.id },
      });
      const metrics = this.computeMetrics(allRecipients);
      const hasDuePending = allRecipients.some(
        (r) => r.status === 'pending' || r.status === 'sending',
      );
      if (!hasDuePending) {
        refreshedCampaign.status =
          metrics.failed > 0 ? 'completed_with_errors' : 'completed';
        refreshedCampaign.completedAt = new Date();
        await this.campaignRepo.save(refreshedCampaign);
      }
    }
  }

  @Cron('50 2 * * *')
  async cleanupOldRecipients(): Promise<number> {
    const cutoff = new Date(
      Date.now() - EMAIL_LOG_RETENTION_DAYS * 24 * 3_600_000,
    );
    const oldRecipients = await this.recipientRepo.find({
      where: { createdAt: LessThan(cutoff) },
    });
    const toAnonymize = oldRecipients.filter(
      (r) =>
        r.email !== null ||
        r.name !== null ||
        r.emailNormalized !== null ||
        r.unsubscribeTokenHash !== null,
    );
    if (toAnonymize.length === 0) return 0;

    for (const r of toAnonymize) {
      r.email = null;
      r.name = null;
      r.emailNormalized = null;
      r.unsubscribeTokenHash = null;
    }
    await this.recipientRepo.save(toAnonymize);
    this.logger.log(
      `Campaign recipients cleanup: ${toAnonymize.length} destinatário(s) anonimizados (> ${EMAIL_LOG_RETENTION_DAYS} dias)`,
    );
    return toAnonymize.length;
  }
}

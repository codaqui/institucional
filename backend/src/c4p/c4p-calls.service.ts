import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { JwtPayload } from '../auth/jwt.strategy';
import { Community } from '../communities/entities/community.entity';
import { DesignationsService } from '../designations/designations.service';
import { ManagedEvent } from '../events/entities/managed-event.entity';
import { PaginatedResultDto } from '../ledger/dto/paginated-result.dto';
import { MemberRole } from '../members/entities/member.entity';
import { EmailService } from '../notifications/email.service';
import { EMAIL_TEMPLATE_C4P_TALK_RESULT } from '../notifications/default-templates';
import { DEFAULT_CRITERIA, RESERVED_C4P_SLUGS, C4P_SLUG_PATTERN } from './c4p.constants';
import {
  CreateC4pCallDto,
  ListC4pCallsDto,
  UpdateC4pCallDto,
} from './dto/c4p-call.dto';
import { C4pCall, Criterion } from './entities/c4p-call.entity';
import { C4pTalk } from './entities/c4p-talk.entity';
import { C4pVote } from './entities/c4p-vote.entity';

const CRITERION_KEY_PATTERN = /^[a-z][a-z0-9_]{0,30}$/;
const MANAGE_ROLES: MemberRole[] = [
  MemberRole.ADMIN,
  MemberRole.EVENT_ORGANIZER,
  MemberRole.DIRETOR,
];

export interface PublicCallSummary {
  slug: string;
  name: string;
  description: string | null;
  status: C4pCall['status'];
  submissionOpenAt: Date | null;
  submissionCloseAt: Date | null;
  community: { slug: string; name: string } | null;
  event: { slug: string; title: string } | null;
}

@Injectable()
export class C4pCallsService {
  private readonly logger = new Logger(C4pCallsService.name);

  constructor(
    @InjectRepository(C4pCall)
    private readonly repo: Repository<C4pCall>,
    @InjectRepository(C4pTalk)
    private readonly talksRepo: Repository<C4pTalk>,
    @InjectRepository(C4pVote)
    private readonly votesRepo: Repository<C4pVote>,
    @InjectRepository(ManagedEvent)
    private readonly eventsRepo: Repository<ManagedEvent>,
    @InjectRepository(Community)
    private readonly communitiesRepo: Repository<Community>,
    private readonly designations: DesignationsService,
    private readonly emailService: EmailService,
    private readonly audit: AuditService,
  ) {}

  assertAdmin(actor: JwtPayload): void {
    if (!actor.roles.includes(MemberRole.ADMIN)) {
      throw new ForbiddenException(
        'Somente administradores podem finalizar ou reabrir campanhas.',
      );
    }
  }

  async assertCanManage(call: C4pCall, actor: JwtPayload): Promise<void> {
    if (actor.roles.some((role) => MANAGE_ROLES.includes(role as MemberRole))) {
      return;
    }
    if (call.communityId) {
      const responsible = await this.designations.hasDesignation(actor.sub, {
        targetType: 'community',
        targetId: call.communityId,
        designation: 'responsible',
      });
      if (responsible) return;
    }
    throw new ForbiddenException(
      'Você não tem permissão para gerenciar esta campanha.',
    );
  }

  async create(dto: CreateC4pCallDto, actor: JwtPayload): Promise<C4pCall> {
    this.validateSlug(dto.slug);
    const existing = await this.repo.findOneBy({ slug: dto.slug });
    if (existing) {
      throw new ConflictException('Já existe uma campanha com este slug.');
    }
    const window = this.normalizeWindow(
      dto.submissionOpenAt,
      dto.submissionCloseAt,
    );
    const criteria = dto.criteria ?? DEFAULT_CRITERIA;
    this.validateCriteria(criteria);
    await this.validateReferences(dto.managedEventId, dto.communityId);

    const saved = await this.repo.save(
      this.repo.create({
        slug: dto.slug,
        name: dto.name,
        description: dto.description ?? null,
        managedEventId: dto.managedEventId ?? null,
        communityId: dto.communityId ?? null,
        status: 'draft',
        submissionOpenAt: window.submissionOpenAt,
        submissionCloseAt: window.submissionCloseAt,
        criteria,
        publicResults: dto.publicResults ?? false,
        createdById: actor.sub,
      }),
    );
    await this.audit.log({
      action: AuditAction.C4P_CALL_CREATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: saved.id,
      targetType: 'c4p_call',
      details: { after: { ...saved } },
    });
    return saved;
  }

  async update(
    id: string,
    dto: UpdateC4pCallDto,
    actor: JwtPayload,
  ): Promise<C4pCall> {
    const call = await this.repo.findOneBy({ id });
    if (!call) throw new NotFoundException('Campanha não encontrada.');
    await this.assertCanManage(call, actor);

    if (dto.criteria) {
      await this.assertNoVotes(call.id);
      this.validateCriteria(dto.criteria);
    }
    if (dto.status !== undefined && dto.status !== call.status) {
      if (!(call.status === 'draft' && dto.status === 'open')) {
        throw new BadRequestException(
          'Transição de status inválida. Abertura: draft → open; fechamento e reabertura têm endpoints próprios.',
        );
      }
    }
    if (
      dto.submissionOpenAt !== undefined ||
      dto.submissionCloseAt !== undefined
    ) {
      const window = this.normalizeWindow(
        dto.submissionOpenAt !== undefined
          ? dto.submissionOpenAt
          : call.submissionOpenAt,
        dto.submissionCloseAt !== undefined
          ? dto.submissionCloseAt
          : call.submissionCloseAt,
      );
      call.submissionOpenAt = window.submissionOpenAt;
      call.submissionCloseAt = window.submissionCloseAt;
    }
    if (dto.managedEventId !== undefined || dto.communityId !== undefined) {
      await this.validateReferences(dto.managedEventId, dto.communityId);
      if (dto.managedEventId !== undefined) {
        call.managedEventId = dto.managedEventId;
      }
      if (dto.communityId !== undefined) {
        call.communityId = dto.communityId;
      }
    }
    if (dto.name !== undefined) call.name = dto.name;
    if (dto.description !== undefined) call.description = dto.description;
    if (dto.criteria !== undefined) call.criteria = dto.criteria;
    if (dto.publicResults !== undefined) {
      call.publicResults = dto.publicResults;
    }
    if (dto.status !== undefined) call.status = dto.status;

    const before = { ...call };
    const updated = await this.repo.save(call);
    await this.audit.log({
      action: AuditAction.C4P_CALL_UPDATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: id,
      targetType: 'c4p_call',
      details: { before, after: { ...updated } },
    });
    return updated;
  }

  async listManage(
    query: ListC4pCallsDto,
    actor: JwtPayload,
  ): Promise<PaginatedResultDto<C4pCall>> {
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(Math.max(1, Math.floor(query.limit ?? 50)), 100);
    const [data, total] = await this.repo.findAndCount({
      where: query.status ? { status: query.status } : {},
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, totalPages: Math.ceil(total / limit), limit };
  }

  async getManage(id: string, actor: JwtPayload): Promise<C4pCall> {
    const call = await this.repo.findOneBy({ id });
    if (!call) throw new NotFoundException('Campanha não encontrada.');
    await this.assertCanManage(call, actor);
    return call;
  }

  async getBySlug(slug: string): Promise<C4pCall> {
    const call = await this.repo.findOneBy({ slug });
    if (!call) throw new NotFoundException('Campanha não encontrada.');
    return call;
  }

  async listPublic(): Promise<PublicCallSummary[]> {
    const calls = await this.repo.find({
      where: { status: 'open' },
      order: { submissionCloseAt: 'ASC', createdAt: 'ASC' },
    });
    return this.toPublicSummaries(calls);
  }

  async getPublicBySlug(slug: string): Promise<PublicCallSummary> {
    const call = await this.getBySlug(slug);
    const [summary] = await this.toPublicSummaries([call]);
    return summary;
  }

  private async toPublicSummaries(
    calls: C4pCall[],
  ): Promise<PublicCallSummary[]> {
    const communityIds = [
      ...new Set(
        calls
          .map((call) => call.communityId)
          .filter((id): id is string => !!id),
      ),
    ];
    const eventIds = [
      ...new Set(
        calls
          .map((call) => call.managedEventId)
          .filter((id): id is string => !!id),
      ),
    ];
    const [communities, events] = await Promise.all([
      communityIds.length
        ? this.communitiesRepo.findBy({ id: In(communityIds) })
        : Promise.resolve([] as Community[]),
      eventIds.length
        ? this.eventsRepo.findBy({ id: In(eventIds) })
        : Promise.resolve([] as ManagedEvent[]),
    ]);
    const communityById = new Map(communities.map((c) => [c.id, c]));
    const eventById = new Map(events.map((e) => [e.id, e]));
    return calls.map((call) => {
      const community = call.communityId
        ? communityById.get(call.communityId)
        : undefined;
      const event = call.managedEventId
        ? eventById.get(call.managedEventId)
        : undefined;
      return {
        slug: call.slug,
        name: call.name,
        description: call.description,
        status: call.status,
        submissionOpenAt: call.submissionOpenAt,
        submissionCloseAt: call.submissionCloseAt,
        community: community
          ? { slug: community.slug, name: community.name }
          : null,
        event: event ? { slug: event.slug, title: event.title } : null,
      };
    });
  }

  async finalize(
    id: string,
    talkIds: string[],
    actor: JwtPayload,
  ): Promise<C4pCall> {
    this.assertAdmin(actor);
    const call = await this.repo.findOneBy({ id });
    if (!call) throw new NotFoundException('Campanha não encontrada.');
    if (call.status === 'closed') {
      throw new ConflictException('Esta campanha já foi finalizada.');
    }

    const talks = await this.talksRepo.find({ where: { callId: id } });
    const talkById = new Map(talks.map((talk) => [talk.id, talk]));
    const selected = [...new Set(talkIds)].filter((talkId) =>
      talkById.has(talkId),
    );
    if (selected.length === 0) {
      throw new BadRequestException('Nenhuma proposta válida selecionada.');
    }

    const before = { ...call };
    call.status = 'closed';
    call.selectedTalkIds = selected;
    call.finalizedAt = new Date();
    const saved = await this.repo.save(call);

    this.dispatchResultEmails(saved, talks, new Set(selected)).catch(
      (error: Error) =>
        this.logger.warn(
          `Falha ao despachar e-mails de resultado da campanha ${id}: ${error.message}`,
        ),
    );

    await this.audit.log({
      action: AuditAction.C4P_CALL_FINALIZED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: id,
      targetType: 'c4p_call',
      details: {
        before,
        after: { ...saved },
        selectedTalkIds: selected,
      },
    });
    return saved;
  }

  async reopen(id: string, actor: JwtPayload): Promise<C4pCall> {
    this.assertAdmin(actor);
    const call = await this.repo.findOneBy({ id });
    if (!call) throw new NotFoundException('Campanha não encontrada.');

    const before = { ...call };
    call.status = 'open';
    call.selectedTalkIds = null;
    call.finalizedAt = null;
    const saved = await this.repo.save(call);
    await this.audit.log({
      action: AuditAction.C4P_CALL_REOPENED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: id,
      targetType: 'c4p_call',
      details: { before, after: { ...saved } },
    });
    return saved;
  }

  private async dispatchResultEmails(
    call: C4pCall,
    talks: C4pTalk[],
    selected: Set<string>,
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const actionUrl = call.publicResults
      ? `${frontendUrl}/c4p/${call.slug}/resultado`
      : '';
    for (const talk of talks) {
      if (!talk.speakerEmail) continue;
      await this.emailService.sendTemplate(
        EMAIL_TEMPLATE_C4P_TALK_RESULT,
        talk.speakerEmail,
        {
          attendeeName: talk.speakerName,
          eventTitle: call.name,
          eventStartAt: new Date(),
          eventTimeZone: 'America/Sao_Paulo',
          c4pCallName: call.name,
          c4pTalkTitle: talk.title,
          c4pResultStatus: selected.has(talk.id) ? 'aprovada' : 'não aprovada',
          c4pActionUrl: actionUrl,
        },
        { eventId: null, registrationId: talk.id },
      );
    }
  }

  private validateSlug(slug: string): void {
    if (!C4P_SLUG_PATTERN.test(slug)) {
      throw new BadRequestException(
        'O slug deve ser kebab-case (a–z, 0–9, hífens).',
      );
    }
    if (RESERVED_C4P_SLUGS.has(slug)) {
      throw new BadRequestException(
        'Este slug é reservado pelo sistema. Escolha outro.',
      );
    }
  }

  private validateCriteria(criteria: Criterion[]): void {
    if (criteria.length < 1 || criteria.length > 10) {
      throw new BadRequestException(
        'A campanha deve ter de 1 a 10 critérios de avaliação.',
      );
    }
    const keys = new Set<string>();
    let weightSum = 0;
    for (const criterion of criteria) {
      if (!CRITERION_KEY_PATTERN.test(criterion.key)) {
        throw new BadRequestException(
          `Chave de critério inválida: "${criterion.key}". Use snake_case (a–z, 0–9, _).`,
        );
      }
      if (keys.has(criterion.key)) {
        throw new BadRequestException(
          `Chave de critério duplicada: "${criterion.key}".`,
        );
      }
      keys.add(criterion.key);
      if (criterion.label.trim().length < 3 || criterion.label.length > 80) {
        throw new BadRequestException(
          'O rótulo do critério deve ter de 3 a 80 caracteres.',
        );
      }
      if (
        typeof criterion.weight !== 'number' ||
        criterion.weight <= 0 ||
        criterion.weight > 100
      ) {
        throw new BadRequestException(
          'O peso do critério deve ser maior que 0 e no máximo 100.',
        );
      }
      weightSum += criterion.weight;
    }
    if (weightSum <= 0) {
      throw new BadRequestException('A soma dos pesos deve ser maior que 0.');
    }
  }

  private normalizeWindow(
    openAt?: string | Date | null,
    closeAt?: string | Date | null,
  ): { submissionOpenAt: Date | null; submissionCloseAt: Date | null } {
    const open = openAt ? new Date(openAt) : null;
    const close = closeAt ? new Date(closeAt) : null;
    if (open && Number.isNaN(open.getTime())) {
      throw new BadRequestException('Data de abertura inválida.');
    }
    if (close && Number.isNaN(close.getTime())) {
      throw new BadRequestException('Data de encerramento inválida.');
    }
    if (open && close && close.getTime() <= open.getTime()) {
      throw new BadRequestException(
        'O encerramento das submissões deve ser posterior à abertura.',
      );
    }
    return { submissionOpenAt: open, submissionCloseAt: close };
  }

  private async validateReferences(
    managedEventId?: string | null,
    communityId?: string | null,
  ): Promise<void> {
    if (managedEventId) {
      const event = await this.eventsRepo.findOneBy({ id: managedEventId });
      if (!event) {
        throw new BadRequestException('Evento vinculado não encontrado.');
      }
    }
    if (communityId) {
      const community = await this.communitiesRepo.findOneBy({
        id: communityId,
      });
      if (!community || community.status !== 'active') {
        throw new BadRequestException(
          'Comunidade vinculada não encontrada ou inativa.',
        );
      }
    }
  }

  private async assertNoVotes(callId: string): Promise<void> {
    const talks = await this.talksRepo.find({
      where: { callId },
      select: { id: true },
    });
    if (talks.length === 0) return;
    const hasVotes = await this.votesRepo.existsBy({
      talkId: In(talks.map((talk) => talk.id)),
    });
    if (hasVotes) {
      throw new ConflictException(
        'Os critérios não podem mudar depois do início da votação.',
      );
    }
  }
}

import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, ILike, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { JwtPayload } from '../auth/jwt.strategy';
import {
  DesignationStatus,
  MemberDesignation,
} from '../designations/entities/member-designation.entity';
import { DesignationsService } from '../designations/designations.service';
import { Member } from '../members/entities/member.entity';
import { EmailService } from '../notifications/email.service';
import { EMAIL_TEMPLATE_C4P_EVALUATOR_INVITE } from '../notifications/default-templates';
import { C4pCallsService } from './c4p-calls.service';
import { InviteC4pEvaluatorDto } from './dto/c4p-evaluator.dto';
import { C4pCall, C4pCallStatus } from './entities/c4p-call.entity';

export interface EvaluatorSummary {
  designationId: string;
  status: DesignationStatus;
  since: Date;
  member: { id: string; name: string; handle: string; avatarUrl: string | null };
}

export interface MyEvaluationCall {
  designationId: string;
  status: DesignationStatus;
  call: { id: string; slug: string; name: string; status: C4pCallStatus };
}

@Injectable()
export class C4pEvaluatorsService {
  private readonly logger = new Logger(C4pEvaluatorsService.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly calls: C4pCallsService,
    @InjectRepository(C4pCall)
    private readonly callsRepo: Repository<C4pCall>,
    @InjectRepository(MemberDesignation)
    private readonly designationsRepo: Repository<MemberDesignation>,
    @InjectRepository(Member)
    private readonly membersRepo: Repository<Member>,
    private readonly designations: DesignationsService,
    private readonly emailService: EmailService,
    private readonly audit: AuditService,
  ) {
    this.frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  }

  async listEvaluators(
    callId: string,
    actor: JwtPayload,
  ): Promise<EvaluatorSummary[]> {
    await this.calls.getManage(callId, actor);
    const designations = await this.designationsRepo.find({
      where: {
        targetType: 'c4p_campaign',
        targetId: callId,
        designation: 'evaluator',
      },
      order: { createdAt: 'ASC' },
    });
    const memberIds = [...new Set(designations.map((d) => d.memberId))];
    const members = memberIds.length
      ? await this.membersRepo.findBy({ id: In(memberIds) })
      : [];
    const byId = new Map(members.map((m) => [m.id, m]));
    return designations
      .map((designation): EvaluatorSummary | null => {
        const member = byId.get(designation.memberId);
        if (!member) return null;
        return {
          designationId: designation.id,
          status: designation.status,
          since: designation.createdAt,
          member: {
            id: member.id,
            name: member.name,
            handle: member.githubHandle,
            avatarUrl: member.avatarUrl,
          },
        };
      })
      .filter((row): row is EvaluatorSummary => row !== null);
  }

  async invite(
    callId: string,
    dto: InviteC4pEvaluatorDto,
    actor: JwtPayload,
  ): Promise<MemberDesignation> {
    const call = await this.calls.getManage(callId, actor);
    const handleOrEmail = dto.handleOrEmail.trim();
    const member = await this.membersRepo.findOne({
      where: [
        { githubHandle: ILike(handleOrEmail) },
        { email: ILike(handleOrEmail) },
      ],
    });
    if (!member?.isActive) {
      throw new NotFoundException(
        'Membro não encontrado com este handle ou e-mail.',
      );
    }

    const existing = await this.designationsRepo.findOne({
      where: {
        targetType: 'c4p_campaign',
        targetId: callId,
        memberId: member.id,
        designation: 'evaluator',
      },
    });
    if (existing?.status === 'active') {
      throw new ConflictException(
        'Este membro já é avaliador desta campanha.',
      );
    }
    if (existing?.status === 'pending') {
      return existing;
    }

    const created = await this.designations.grant(
      {
        memberId: member.id,
        targetType: 'c4p_campaign',
        targetId: callId,
        designation: 'evaluator',
        status: 'pending',
        appointedById: actor.sub,
      },
      { actorId: actor.sub, actorHandle: actor.handle },
    );

    this.sendInvite(call, member).catch((error: Error) =>
      this.logger.warn(
        `Falha ao enviar convite de avaliador ${created.id}: ${error.message}`,
      ),
    );

    await this.audit.log({
      action: AuditAction.C4P_EVALUATOR_INVITED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: call.id,
      targetType: 'c4p_call',
      details: { designationId: created.id, memberId: member.id },
    });
    return created;
  }

  async remove(
    callId: string,
    designationId: string,
    actor: JwtPayload,
  ): Promise<void> {
    await this.calls.getManage(callId, actor);
    const designation = await this.requireCampaignDesignation(
      callId,
      designationId,
    );
    await this.designations.revoke(designation.id, {
      actorId: actor.sub,
      actorHandle: actor.handle,
    });
    await this.audit.log({
      action: AuditAction.C4P_EVALUATOR_REMOVED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: callId,
      targetType: 'c4p_call',
      details: { designationId: designation.id, memberId: designation.memberId },
    });
  }

  async myEvaluations(memberId: string): Promise<MyEvaluationCall[]> {
    const designations = await this.designationsRepo.find({
      where: {
        memberId,
        targetType: 'c4p_campaign',
        designation: 'evaluator',
        status: In(['pending', 'active']),
      },
      order: { createdAt: 'DESC' },
    });
    if (designations.length === 0) return [];
    const callIds = [...new Set(designations.map((d) => d.targetId))];
    const calls = await this.callsRepo.findBy({ id: In(callIds) });
    const byId = new Map(calls.map((call) => [call.id, call]));
    return designations
      .map((designation) => {
        const call = designation.targetId
          ? byId.get(designation.targetId)
          : undefined;
        if (!call) return null;
        return {
          designationId: designation.id,
          status: designation.status,
          call: {
            id: call.id,
            slug: call.slug,
            name: call.name,
            status: call.status,
          },
        };
      })
      .filter((row): row is MyEvaluationCall => row !== null);
  }

  async accept(
    designationId: string,
    actor: JwtPayload,
  ): Promise<MemberDesignation> {
    const designation = await this.designationsRepo.findOneBy({
      id: designationId,
    });
    if (
      designation?.memberId !== actor.sub ||
      designation.targetType !== 'c4p_campaign'
    ) {
      throw new NotFoundException('Convite não encontrado.');
    }
    if (designation.status !== 'pending') {
      throw new ConflictException(
        'Somente convites pendentes podem ser aceitos.',
      );
    }
    return this.designations.confirm(designation.id, {
      actorId: actor.sub,
      actorHandle: actor.handle,
    });
  }

  private async requireCampaignDesignation(
    callId: string,
    designationId: string,
  ): Promise<MemberDesignation> {
    const designation = await this.designationsRepo.findOneBy({
      id: designationId,
    });
    if (
      designation?.targetType !== 'c4p_campaign' ||
      designation.targetId !== callId
    ) {
      throw new NotFoundException('Avaliador não encontrado nesta campanha.');
    }
    return designation;
  }

  private async sendInvite(call: C4pCall, member: Member): Promise<void> {
    await this.emailService.sendTemplate(
      EMAIL_TEMPLATE_C4P_EVALUATOR_INVITE,
      member.email,
      {
        attendeeName: member.name,
        eventTitle: call.name,
        eventStartAt: new Date(),
        eventTimeZone: 'America/Sao_Paulo',
        c4pCallName: call.name,
        c4pActionUrl: `${this.frontendUrl}/c4p/avaliar`,
      },
      { eventId: null, registrationId: null },
    );
  }
}

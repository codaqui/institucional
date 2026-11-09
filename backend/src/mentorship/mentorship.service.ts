import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { JwtPayload } from '../auth/jwt.strategy';
import { DesignationsService } from '../designations/designations.service';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { MemberRole } from '../members/entities/member.entity';
import { MentorApplicationDto, UpdateMentorProfileDto } from './dto/mentorship.dto';
import { MentorProfile } from './entities/mentor-profile.entity';

@Injectable()
export class MentorshipService {
  constructor(
    @InjectRepository(MentorProfile)
    private readonly profileRepo: Repository<MentorProfile>,
    @InjectRepository(MemberDesignation)
    private readonly designationRepo: Repository<MemberDesignation>,
    private readonly designations: DesignationsService,
    private readonly audit: AuditService,
  ) {}

  async apply(dto: MentorApplicationDto, user: JwtPayload) {
    const duplicate = await this.designationRepo.findOneBy({
      memberId: user.sub,
      targetType: 'program',
      targetKey: 'mentoria',
      designation: 'mentor',
      status: 'pending',
    });
    if (duplicate) throw new ConflictException('Já existe uma candidatura de mentor pendente.');
    const application = await this.designations.grant({
      memberId: user.sub,
      targetType: 'program',
      targetKey: 'mentoria',
      designation: 'mentor',
      appointedById: user.sub,
      status: 'pending',
    }, { actorId: user.sub, actorHandle: user.handle });
    await this.profileRepo.save(this.profileRepo.create({
      memberId: user.sub,
      areas: dto.areas,
      focus: dto.focus?.trim() || null,
      active: false,
      approvedById: user.sub,
    }));
    return application;
  }

  listMyApplications(user: JwtPayload) {
    return this.designationRepo.find({
      where: { memberId: user.sub, targetType: 'program', targetKey: 'mentoria', designation: 'mentor' },
      order: { createdAt: 'DESC' },
    });
  }

  async listApplications(actor: JwtPayload) {
    this.assertAdmin(actor);
    return this.designationRepo.find({
      where: { targetType: 'program', targetKey: 'mentoria', designation: 'mentor', status: 'pending' },
      order: { createdAt: 'ASC' },
    });
  }

  async confirmApplication(id: string, actor: JwtPayload): Promise<MentorProfile> {
    this.assertAdmin(actor);
    const application = await this.designationRepo.findOneBy({ id });
    if (!application) throw new NotFoundException('Candidatura de mentor não encontrada.');
    if (application.status !== 'pending') {
      throw new ConflictException('Somente candidaturas pendentes podem ser confirmadas.');
    }
    await this.designations.confirm(id, { actorId: actor.sub, actorHandle: actor.handle });
    this.designations.invalidateCache();
    const profile = await this.profileRepo.findOneBy({ memberId: application.memberId });
    if (!profile) throw new NotFoundException('Perfil de mentor não encontrado.');
    profile.active = true;
    profile.approvedById = actor.sub;
    await this.audit.log({
      action: AuditAction.DESIGNATION_CONFIRMED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: application.memberId,
      targetType: 'member',
      details: { designationId: id, mentorProfileId: profile.id },
    });
    return this.profileRepo.save(profile);
  }

  async getProfile(actor: JwtPayload): Promise<MentorProfile> {
    return this.requireActiveProfile(actor);
  }

  async updateProfile(dto: UpdateMentorProfileDto, actor: JwtPayload): Promise<MentorProfile> {
    const profile = await this.requireActiveProfile(actor);
    profile.areas = dto.areas;
    profile.focus = dto.focus?.trim() || null;
    return this.profileRepo.save(profile);
  }

  private async requireActiveProfile(actor: JwtPayload): Promise<MentorProfile> {
    const profile = await this.profileRepo.findOneBy({ memberId: actor.sub, active: true });
    if (!profile) throw new ForbiddenException('É necessário ser um mentor ativo.');
    return profile;
  }

  private assertAdmin(actor: JwtPayload): void {
    if (!actor.roles?.includes(MemberRole.ADMIN)) {
      throw new ForbiddenException('Somente admin pode gerenciar candidaturas de mentores.');
    }
  }
}

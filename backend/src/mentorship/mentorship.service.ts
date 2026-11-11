import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { JwtPayload } from '../auth/jwt.strategy';
import { DesignationsService } from '../designations/designations.service';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { Member, MemberRole } from '../members/entities/member.entity';
import { MentorApplicationDto, UpdateMentorAdminDto, UpdateMentorProfileDto } from './dto/mentorship.dto';
import { MentorProfile } from './entities/mentor-profile.entity';
import { MentorAvailability } from './entities/mentor-availability.entity';
import { MentorshipSession, MentorshipSessionStatus } from './entities/mentorship-session.entity';

@Injectable()
export class MentorshipService {
  constructor(
    @InjectRepository(MentorProfile)
    private readonly profileRepo: Repository<MentorProfile>,
    @InjectRepository(MemberDesignation)
    private readonly designationRepo: Repository<MemberDesignation>,
    private readonly designations: DesignationsService,
    private readonly audit: AuditService,
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,
    @InjectRepository(MentorAvailability)
    private readonly availabilityRepo: Repository<MentorAvailability>,
    @InjectRepository(MentorshipSession)
    private readonly sessionRepo: Repository<MentorshipSession>,
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
    const applications = await this.designationRepo.find({
      where: { targetType: 'program', targetKey: 'mentoria', designation: 'mentor', status: 'pending' },
      order: { createdAt: 'ASC' },
    });
    if (applications.length === 0) return [];
    const members = await this.memberRepo.findBy({
      id: In(applications.map((application) => application.memberId)),
      isActive: true,
    });
    const activeMembers = new Map(members.map((member) => [member.id, member]));
    const profiles = await this.profileRepo.find({
      where: { memberId: In(members.map((member) => member.id)) },
    });
    const profilesByMember = new Map(profiles.map((profile) => [profile.memberId, profile]));
    return applications.flatMap((application) => {
      const member = activeMembers.get(application.memberId);
      if (!member) return [];
      const profile = profilesByMember.get(application.memberId);
      return [{
        ...application,
        name: member.name,
        githubHandle: member.githubHandle,
        avatarUrl: member.avatarUrl,
        areas: profile?.areas ?? [],
        focus: profile?.focus ?? null,
      }];
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

  async listMentors(actor: JwtPayload, page = 1, limit = 50) {
    this.assertAdmin(actor);
    const [profiles, total] = await this.profileRepo.findAndCount({
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const members = await this.memberRepo.findBy({ id: In(profiles.map((profile) => profile.memberId)) });
    const membersById = new Map(members.map((member) => [member.id, member]));
    return {
      data: profiles.map((profile) => {
        const member = membersById.get(profile.memberId)!;
        return {
          id: profile.id,
          memberId: profile.memberId,
          name: member.name,
          githubHandle: member.githubHandle,
          avatarUrl: member.avatarUrl,
          areas: profile.areas,
          focus: profile.focus,
          active: profile.active,
          isPlaceholder: !member.isActive && member.email.endsWith('@anon.invalid'),
        };
      }),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
    };
  }

  async updateMentor(id: string, dto: UpdateMentorAdminDto, actor: JwtPayload): Promise<MentorProfile> {
    this.assertAdmin(actor);
    const { profile, memberIds, audit: auditDetails } = await this.profileRepo.manager.transaction(async (manager) => {
      const profiles = manager.getRepository(MentorProfile);
      const members = manager.getRepository(Member);
      const designations = manager.getRepository(MemberDesignation);
      const current = await profiles.findOneBy({ id });
      if (!current) throw new NotFoundException('Perfil de mentor não encontrado.');
      const targetMember = await members.findOneBy({ id: dto.memberId, isActive: true });
      if (!targetMember) throw new NotFoundException('Membro ativo não encontrado.');
      const conflict = await profiles.findOneBy({ memberId: dto.memberId });
      if (conflict && conflict.id !== id) {
        throw new ConflictException('O membro já possui um perfil de mentor.');
      }

      const before = {
        memberId: current.memberId,
        areas: [...current.areas],
        focus: current.focus,
        active: current.active,
      };
      const previousMemberId = current.memberId;
      const affectedMemberIds = [...new Set([previousMemberId, dto.memberId])];
      const mentorshipDesignations = await designations.find({
        where: {
          memberId: In(affectedMemberIds),
          targetType: 'program',
          targetKey: 'mentoria',
          designation: 'mentor',
        },
      });
      const reassigned = previousMemberId !== dto.memberId;
      for (const designation of mentorshipDesignations) {
        if (designation.memberId === previousMemberId
          && (reassigned || !dto.active)
          && ['pending', 'active'].includes(designation.status)) {
          designation.status = 'removed';
          designation.endedAt = new Date();
          await designations.save(designation); // NOSONAR -- a transação usa uma única conexão PostgreSQL.
        }
      }
      if (dto.active) {
        let targetDesignation = mentorshipDesignations.find((designation) => designation.memberId === dto.memberId);
        if (!targetDesignation) {
          targetDesignation = designations.create({
            memberId: dto.memberId,
            targetType: 'program',
            targetKey: 'mentoria',
            designation: 'mentor',
            appointedById: actor.sub,
          });
        }
        targetDesignation.status = 'active';
        targetDesignation.confirmedById = actor.sub;
        targetDesignation.confirmedAt = new Date();
        targetDesignation.endedAt = null;
        await designations.save(targetDesignation);
      }

      current.memberId = dto.memberId;
      current.areas = dto.areas;
      current.focus = dto.focus?.trim() || null;
      current.active = dto.active;
      current.approvedById = actor.sub;
      const saved = await profiles.save(current);
      return {
        profile: saved,
        memberIds: affectedMemberIds,
        audit: {
          before,
          after: {
            memberId: saved.memberId,
            areas: saved.areas,
            focus: saved.focus,
            active: saved.active,
          },
        },
      };
    });
    for (const memberId of memberIds) {
      await this.designations.syncMember(memberId); // NOSONAR -- cada sincronização usa lock transacional por membro.
    }
    this.designations.invalidateCache();
    await this.audit.log({
      action: AuditAction.MENTOR_PROFILE_UPDATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: profile.memberId,
      targetType: 'member',
      details: { mentorProfileId: profile.id, ...auditDetails },
    });
    return profile;
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

  async listPublic() {
    const { sessions: _sessions, ...payload } = await this.buildSnapshot();
    return payload;
  }

  private async buildSnapshot() {
    const profiles = await this.profileRepo.find({ where: { active: true }, order: { createdAt: 'ASC' } });
    if (profiles.length === 0) {
      return {
        mentors: [],
        insights: { completed: 0, activeMentors: 0, areas: [], noShowRate: 0 },
        sessions: [],
      };
    }
    const members = await this.memberRepo.findBy({
      id: In(profiles.map((profile) => profile.memberId)),
      isActive: true,
    });
    const membersById = new Map(members.map((member) => [member.id, member]));
    const activeProfiles = profiles.filter((profile) => membersById.has(profile.memberId));
    const profileIds = activeProfiles.map((profile) => profile.id);
    if (profileIds.length === 0) {
      return {
        mentors: [],
        insights: { completed: 0, activeMentors: 0, areas: [], noShowRate: 0 },
        sessions: [],
      };
    }
    const [availability, sessions] = await Promise.all([
      this.availabilityRepo.find({ where: { mentorId: In(profileIds) } }),
      this.sessionRepo.find({
        where: { mentorId: In(profileIds) },
        select: { mentorId: true, status: true },
      }),
    ]);
    const mentors = activeProfiles.map((profile) => {
      const member = membersById.get(profile.memberId)!;
      return {
        id: profile.id,
        handle: member.githubHandle,
        name: member.name,
        avatarUrl: member.avatarUrl,
        areas: profile.areas,
        focus: profile.focus,
        availability: availability
          .filter((rule) => rule.mentorId === profile.id)
          .map((rule) => ({
            weekday: rule.weekday,
            startTime: rule.startTime,
            endTime: rule.endTime,
            timeZone: rule.timeZone,
          })),
      };
    });
    const completed = sessions.filter((session) => session.status === MentorshipSessionStatus.COMPLETED).length;
    const noShow = sessions.filter((session) => session.status === MentorshipSessionStatus.NO_SHOW).length;
    const areas = [...new Set(activeProfiles.flatMap((profile) => profile.areas))]
      .sort((left, right) => left.localeCompare(right))
      .map((area) => {
        const areaProfileIds = activeProfiles
          .filter((profile) => profile.areas.includes(area))
          .map((profile) => profile.id);
        return {
          area,
          mentors: areaProfileIds.length,
          completed: sessions.filter((session) => session.status === MentorshipSessionStatus.COMPLETED
            && areaProfileIds.includes(session.mentorId)).length,
        };
      });
    return {
      mentors,
      insights: {
        completed,
        activeMentors: mentors.length,
        areas,
        noShowRate: completed + noShow === 0 ? 0 : Number((noShow / (completed + noShow)).toFixed(4)),
      },
      sessions,
    };
  }

  async listInsights(actor: JwtPayload) {
    this.assertAdmin(actor);
    const { sessions, ...publicPayload } = await this.buildSnapshot();
    const count = (status: MentorshipSessionStatus) => sessions
      .filter((session) => session.status === status).length;
    return {
      ...publicPayload.insights,
      requested: count(MentorshipSessionStatus.REQUESTED),
      confirmed: count(MentorshipSessionStatus.CONFIRMED),
      completed: count(MentorshipSessionStatus.COMPLETED),
      canceled: count(MentorshipSessionStatus.CANCELED),
      noShow: count(MentorshipSessionStatus.NO_SHOW),
    };
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

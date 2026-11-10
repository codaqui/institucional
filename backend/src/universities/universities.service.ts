import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Raw, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { JwtPayload } from '../auth/jwt.strategy';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { DesignationsService } from '../designations/designations.service';
import { Institution } from '../entities/entities/institution.entity';
import { ManagedEvent, ManagedEventStatus } from '../events/entities/managed-event.entity';
import { entitySlug } from '../entities/entities.rules';
import { Member, MemberRole } from '../members/entities/member.entity';
import { City } from './entities/city.entity';
import { AmbassadorApplicationDto, ConfirmAmbassadorDto, CreateCityDto, CreateUniversityInstitutionDto, UpdateCityDto, UpdateUniversityInstitutionDto } from './dto/university.dto';

@Injectable()
export class UniversitiesService {
  constructor(
    @InjectRepository(City)
    private readonly cityRepo: Repository<City>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    @InjectRepository(MemberDesignation)
    private readonly designationRepo: Repository<MemberDesignation>,
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,
    private readonly designations: DesignationsService,
    private readonly audit: AuditService,
    @InjectRepository(ManagedEvent)
    private readonly eventRepo: Repository<ManagedEvent>,
  ) {}

  async createCity(dto: CreateCityDto, actor: JwtPayload): Promise<City> {
    await this.assertUniversityManager(actor);
    try {
      const city = await this.cityRepo.save(this.cityRepo.create({
        ...dto,
        name: dto.name.trim(),
        uf: dto.uf.toUpperCase(),
        isActive: dto.isActive ?? true,
      }));
      await this.audit.log({
        action: AuditAction.CITY_CREATED,
        actorId: actor.sub,
        actorHandle: actor.handle,
        targetId: city.id,
        targetType: 'city',
        details: { after: { ...city } },
      });
      return city;
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Esta cidade já está cadastrada.');
      }
      throw error;
    }
  }

  async updateCity(id: string, dto: UpdateCityDto, actor: JwtPayload): Promise<City> {
    await this.assertUniversityManager(actor);
    const city = await this.cityRepo.findOneBy({ id });
    if (!city) throw new NotFoundException('Cidade não encontrada.');
    const before = { ...city };
    Object.assign(city, dto);
    if (dto.name !== undefined) city.name = dto.name.trim();
    if (dto.uf !== undefined) city.uf = dto.uf.toUpperCase();
    const updated = await this.cityRepo.save(city);
    await this.audit.log({
      action: AuditAction.CITY_UPDATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: id,
      targetType: 'city',
      details: { before, after: { ...updated } },
    });
    return updated;
  }

  async createInstitution(dto: CreateUniversityInstitutionDto, actor: JwtPayload): Promise<Institution> {
    await this.assertUniversityManager(actor);
    await this.requireActiveCity(dto.cityId);
    const institution = await this.institutionRepo.save(this.institutionRepo.create({
      ...dto,
      name: dto.name.trim(),
      slug: entitySlug(dto.slug ?? dto.name),
      type: 'instituicao_ensino',
      registeredById: actor.sub,
      isActive: dto.isActive ?? true,
    }));
    await this.audit.log({
      action: AuditAction.UNIVERSITY_INSTITUTION_CREATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: institution.id,
      targetType: 'entity',
      details: { after: { ...institution } },
    });
    return institution;
  }

  async updateInstitution(id: string, dto: UpdateUniversityInstitutionDto, actor: JwtPayload): Promise<Institution> {
    await this.assertUniversityManager(actor);
    const institution = await this.institutionRepo.findOneBy({ id });
    if (!institution) throw new NotFoundException('IES não encontrada.');
    if (dto.cityId !== undefined) await this.requireActiveCity(dto.cityId);
    const before = { ...institution };
    Object.assign(institution, dto);
    if (dto.name !== undefined) institution.name = dto.name.trim();
    if (dto.slug !== undefined) institution.slug = entitySlug(dto.slug);
    const updated = await this.institutionRepo.save(institution);
    await this.audit.log({
      action: AuditAction.UNIVERSITY_INSTITUTION_UPDATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: id,
      targetType: 'entity',
      details: { before, after: { ...updated } },
    });
    return updated;
  }

  async getPublic() {
    const [cities, institutions, designations, events] = await Promise.all([
      this.cityRepo.find({ where: { isActive: true }, order: { name: 'ASC' } }),
      this.institutionRepo.find({
        where: { type: 'instituicao_ensino', isActive: true },
        order: { name: 'ASC' },
      }),
      this.designationRepo.find({
        where: {
          targetType: 'ies',
          designation: 'ambassador',
          status: 'active',
          validUntil: Raw((alias) => `(${alias} IS NULL OR ${alias} > NOW())`),
        },
        order: { createdAt: 'ASC' },
      }),
      this.eventRepo.find({
        where: {
          institutionId: Not(IsNull()),
          status: ManagedEventStatus.PUBLISHED,
        },
        order: { startAt: 'ASC' },
      }),
    ]);
    const cityById = new Map(cities.map((city) => [city.id, city]));
    const memberIds = [...new Set(designations.map((designation) => designation.memberId))];
    const members = memberIds.length > 0
      ? await this.memberRepo.findBy({ id: In(memberIds) })
      : [];
    const memberById = new Map(members.map((member) => [member.id, member]));
    return {
      generatedAt: new Date().toISOString(),
      cities,
      institutions: institutions.map((institution) => {
        const city = cityById.get(institution.cityId ?? '');
        const designation = designations.find(
          (candidate) => candidate.targetId === institution.id,
        );
        const member = designation ? memberById.get(designation.memberId) : undefined;
        return {
          id: institution.id,
          slug: institution.slug,
          name: institution.name,
          website: institution.website,
          city: city ? { id: city.id, name: city.name, uf: city.uf } : null,
          ambassador: designation && member
            ? {
                githubHandle: member.githubHandle,
                name: member.name,
                avatarUrl: member.avatarUrl,
                validUntil: designation.validUntil,
              }
            : null,
        };
      }),
      events: events.map((event) => ({
        id: event.id,
        slug: event.slug,
        title: event.title,
        startAt: event.startAt,
        status: event.status,
        location: event.location,
        institutionId: event.institutionId,
      })),
    };
  }

  async getManage(actor: JwtPayload) {
    await this.assertUniversityManager(actor);
    return this.getPublic();
  }

  async applyAmbassador(
    institutionId: string,
    dto: AmbassadorApplicationDto,
    actor: JwtPayload,
  ): Promise<MemberDesignation> {
    await this.requireInstitution(institutionId);
    if (await this.designations.hasDesignation(actor.sub, {
      targetType: 'ies',
      targetId: institutionId,
      designation: 'ambassador',
    })) {
      throw new ConflictException('Você já é embaixador desta IES.');
    }
    try {
      const application = await this.designationRepo.manager.transaction(async (manager) => {
        const repo = manager.getRepository(MemberDesignation);
        const duplicate = await repo.findOne({
          where: {
            memberId: actor.sub,
            targetType: 'ies',
            targetId: institutionId,
            designation: 'ambassador',
            status: 'pending',
          },
        });
        if (duplicate) {
          throw new ConflictException('Já existe uma candidatura pendente nesta IES.');
        }
        return repo.save(repo.create({
          memberId: actor.sub,
          targetType: 'ies',
          targetId: institutionId,
          designation: 'ambassador',
          status: 'pending',
          appointedById: actor.sub,
          applicationNotes: dto.applicationNotes.trim(),
        }));
      });
      await this.audit.log({
        action: AuditAction.UNIVERSITY_AMBASSADOR_APPLIED,
        actorId: actor.sub,
        actorHandle: actor.handle,
        targetId: application.id,
        targetType: 'member-designation',
        details: { institutionId },
      });
      return application;
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Já existe uma candidatura pendente nesta IES.');
      }
      throw error;
    }
  }

  async listApplications(actor: JwtPayload) {
    await this.assertUniversityManager(actor);
    const applications = await this.designationRepo.find({
      where: { targetType: 'ies', designation: 'ambassador', status: 'pending' },
      order: { createdAt: 'ASC' },
    });
    const memberIds = [...new Set(applications.map((application) => application.memberId))];
    const members = memberIds.length > 0
      ? await this.memberRepo.findBy({ id: In(memberIds) })
      : [];
    const memberById = new Map(members.map((member) => [member.id, member]));
    return applications.map((application) => {
      const member = memberById.get(application.memberId);
      return {
        ...application,
        member: member
          ? {
              id: member.id,
              name: member.name,
              githubHandle: member.githubHandle,
              avatarUrl: member.avatarUrl,
            }
          : null,
      };
    });
  }

  listMyApplications(actor: JwtPayload) {
    return this.designationRepo.find({
      where: { memberId: actor.sub, targetType: 'ies', designation: 'ambassador' },
      order: { createdAt: 'DESC' },
    });
  }

  async rejectApplication(id: string, actor: JwtPayload): Promise<MemberDesignation> {
    await this.assertUniversityManager(actor);
    const application = await this.designationRepo.findOneBy({ id });
    if (!application) throw new NotFoundException('Candidatura não encontrada.');
    if (application.status !== 'pending') {
      throw new ConflictException('Somente candidaturas pendentes podem ser rejeitadas.');
    }
    application.status = 'removed';
    application.endedAt = new Date();
    const rejected = await this.designationRepo.save(application);
    this.designations.invalidateCache();
    await this.audit.log({
      action: AuditAction.UNIVERSITY_AMBASSADOR_REJECTED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: id,
      targetType: 'member-designation',
      details: { institutionId: application.targetId },
    });
    return rejected;
  }

  async confirmApplication(
    id: string,
    dto: ConfirmAmbassadorDto,
    actor: JwtPayload,
  ): Promise<MemberDesignation> {
    if (!actor.roles?.includes(MemberRole.ADMIN)) {
      throw new ForbiddenException('Somente admin pode confirmar embaixadores.');
    }
    const application = await this.designationRepo.findOneBy({ id });
    if (!application) throw new NotFoundException('Candidatura não encontrada.');
    if (application.status !== 'pending') {
      throw new ConflictException('Somente candidaturas pendentes podem ser confirmadas.');
    }
    application.status = 'active';
    application.confirmedById = actor.sub;
    application.confirmedAt = new Date();
    application.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    try {
      const confirmed = await this.designationRepo.save(application);
      this.designations.invalidateCache();
      await this.audit.log({
        action: AuditAction.UNIVERSITY_AMBASSADOR_CONFIRMED,
        actorId: actor.sub,
        actorHandle: actor.handle,
        targetId: id,
        targetType: 'member-designation',
        details: { institutionId: application.targetId, validUntil: application.validUntil },
      });
      return confirmed;
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Esta IES já possui um embaixador ativo.');
      }
      throw error;
    }
  }

  private async requireInstitution(id: string): Promise<Institution> {
    const institution = await this.institutionRepo.findOneBy({ id, isActive: true });
    if (institution?.type !== 'instituicao_ensino') {
      throw new NotFoundException('IES ativa não encontrada.');
    }
    return institution;
  }

  private async requireActiveCity(cityId: string): Promise<City> {
    const city = await this.cityRepo.findOneBy({ id: cityId, isActive: true });
    if (!city) throw new NotFoundException('Cidade ativa não encontrada.');
    return city;
  }

  private async assertUniversityManager(actor: JwtPayload): Promise<void> {
    if (actor.roles?.includes(MemberRole.ADMIN)) return;
    const allowed = await this.designations.hasDesignation(actor.sub, {
      targetType: 'program',
      targetKey: 'universitario',
      designation: 'manager',
    });
    if (!allowed) {
      throw new ForbiddenException('Requer gestor do Codaqui Universitário.');
    }
  }
}

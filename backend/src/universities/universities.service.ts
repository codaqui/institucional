import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { JwtPayload } from '../auth/jwt.strategy';
import { DesignationsService } from '../designations/designations.service';
import { Institution } from '../entities/entities/institution.entity';
import { entitySlug } from '../entities/entities.rules';
import { MemberRole } from '../members/entities/member.entity';
import { City } from './entities/city.entity';
import { CreateCityDto, CreateUniversityInstitutionDto, UpdateCityDto, UpdateUniversityInstitutionDto } from './dto/university.dto';

@Injectable()
export class UniversitiesService {
  constructor(
    @InjectRepository(City)
    private readonly cityRepo: Repository<City>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    private readonly designations: DesignationsService,
    private readonly audit: AuditService,
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

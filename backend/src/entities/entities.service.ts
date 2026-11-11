import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { JwtPayload } from '../auth/jwt.strategy';
import { DesignationsService } from '../designations/designations.service';
import { PaginatedResultDto } from '../ledger/dto/paginated-result.dto';
import { MemberRole } from '../members/entities/member.entity';
import { assertPartnershipDates, entitySlug } from './entities.rules';
import { CreateInstitutionDto, ListEntitiesDto, UpdateInstitutionDto } from './dto/institution.dto';
import { CreatePartnershipDto, UpdatePartnershipDto } from './dto/partnership.dto';
import { Institution } from './entities/institution.entity';
import { Partnership } from './entities/partnership.entity';

@Injectable()
export class EntitiesService {
  constructor(
    @InjectRepository(Institution)
    private readonly repo: Repository<Institution>,
    @InjectRepository(Partnership)
    private readonly partnerships: Repository<Partnership>,
    private readonly designations: DesignationsService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateInstitutionDto, actor: JwtPayload): Promise<Institution> {
    await this.assertDirector(actor);
    if (dto.type === 'instituicao_ensino') {
      throw new BadRequestException('Cadastre instituições de ensino em /admin/universitario.');
    }
    const entity = await this.repo.save(this.repo.create({
      ...dto,
      slug: entitySlug(dto.slug ?? dto.name),
      registeredById: actor.sub,
      isActive: dto.isActive ?? true,
    }));
    await this.audit.log({
      action: AuditAction.ENTITY_CREATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: entity.id,
      targetType: 'entity',
      details: { after: { ...entity } },
    });
    return entity;
  }

  async update(id: string, dto: UpdateInstitutionDto, actor: JwtPayload): Promise<Institution> {
    await this.assertDirector(actor);
    const entity = await this.repo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Entidade não encontrada.');
    if (dto.type !== undefined && dto.type !== entity.type
      && (entity.type === 'instituicao_ensino' || dto.type === 'instituicao_ensino')) {
      throw new BadRequestException('Altere o tipo de instituições de ensino somente em /admin/universitario.');
    }
    const before = { ...entity };
    Object.assign(entity, dto);
    if (dto.slug !== undefined) entity.slug = entitySlug(dto.slug);
    const updated = await this.repo.save(entity);
    await this.audit.log({
      action: AuditAction.ENTITY_UPDATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: id,
      targetType: 'entity',
      details: { before, after: { ...updated } },
    });
    return updated;
  }

  async listPublic() {
    const entities = await this.repo.find({ where: { isActive: true }, order: { name: 'ASC' } });
    return entities.map((entity) => ({
      id: entity.id,
      slug: entity.slug,
      name: entity.name,
      type: entity.type,
      website: entity.website,
    }));
  }

  async listManage(query: ListEntitiesDto, actor: JwtPayload): Promise<PaginatedResultDto<Institution>> {
    await this.assertDirector(actor);
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(Math.max(1, Math.floor(query.limit ?? 50)), 100);
    const search = query.search?.trim();
    const where = search
      ? [{ name: ILike(`%${search}%`) }, { slug: ILike(`%${search}%`) }]
      : undefined;
    const [data, total] = await this.repo.findAndCount({
      where,
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, totalPages: Math.ceil(total / limit), limit };
  }

  async listPartnerships(entityId: string, actor: JwtPayload): Promise<Partnership[]> {
    await this.assertDirector(actor);
    await this.requireEntity(entityId);
    return this.partnerships.find({ where: { entityId }, order: { startedAt: 'DESC' } });
  }

  async createPartnership(entityId: string, dto: CreatePartnershipDto, actor: JwtPayload): Promise<Partnership> {
    await this.assertDirector(actor);
    assertPartnershipDates(dto);
    const entity = await this.repo.findOneBy({ id: entityId, isActive: true });
    if (!entity) throw new NotFoundException('Entidade ativa não encontrada.');
    const partnership = await this.partnerships.save(this.partnerships.create({
      ...dto,
      entityId: entity.id,
      status: dto.status ?? 'active',
      notes: dto.notes ?? null,
    }));
    await this.audit.log({
      action: AuditAction.PARTNERSHIP_CREATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: partnership.id,
      targetType: 'partnership',
      details: { after: { ...partnership } },
    });
    return partnership;
  }

  async updatePartnership(id: string, dto: UpdatePartnershipDto, actor: JwtPayload): Promise<Partnership> {
    await this.assertDirector(actor);
    const partnership = await this.partnerships.findOneBy({ id });
    if (!partnership) throw new NotFoundException('Parceria não encontrada.');
    assertPartnershipDates({
      startedAt: dto.startedAt ?? partnership.startedAt,
      endsAt: dto.endsAt === undefined ? partnership.endsAt : dto.endsAt,
    });
    const before = { ...partnership };
    Object.assign(partnership, dto);
    const updated = await this.partnerships.save(partnership);
    await this.audit.log({
      action: AuditAction.PARTNERSHIP_UPDATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: id,
      targetType: 'partnership',
      details: { before, after: { ...updated } },
    });
    return updated;
  }

  private async requireEntity(id: string): Promise<Institution> {
    const entity = await this.repo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Entidade não encontrada.');
    return entity;
  }

  private async assertDirector(actor: JwtPayload): Promise<void> {
    if (actor.roles?.includes(MemberRole.ADMIN)) return;
    const allowed = await this.designations.hasAnyDesignation(actor.sub, {
      targetType: 'directorate',
      designation: 'director',
    });
    if (!allowed) {
      throw new ForbiddenException('Cadastro de entidades requer admin ou diretor ativo.');
    }
  }
}

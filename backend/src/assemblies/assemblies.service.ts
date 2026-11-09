import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Institution } from '../entities/entities/institution.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { JwtPayload } from '../auth/jwt.strategy';
import { DesignationsService } from '../designations/designations.service';
import { MemberRole } from '../members/entities/member.entity';
import { PaginatedResultDto } from '../ledger/dto/paginated-result.dto';
import { assemblySlug, assertAssemblyTransition } from './assembly.rules';
import {
  CreateAssemblyDto,
  ListAssembliesDto,
  UpdateAssemblyDto,
} from './dto/assembly.dto';
import {
  Assembly,
  AssemblyStatus,
  AssemblyType,
} from './entities/assembly.entity';

export type AssemblyView = Omit<Assembly, 'createdById' | 'entityId' | 'entity'> & {
  slug: string;
  entity: { slug: string; name: string } | null;
};

const MAX_CREATE_ATTEMPTS = 3;

@Injectable()
export class AssembliesService {
  constructor(
    @InjectRepository(Assembly)
    private readonly repo: Repository<Assembly>,
    private readonly dataSource: DataSource,
    private readonly designations: DesignationsService,
    private readonly audit: AuditService,
    @Optional()
    private readonly entities?: Repository<Institution>,
  ) {}

  async create(
    dto: CreateAssemblyDto,
    actor: JwtPayload,
  ): Promise<AssemblyView> {
    await this.assertCanManage(actor, dto.entityId);

    let created: Assembly;
    for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
      try {
        created = await this.dataSource.transaction(async (manager) => {
          await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
            `${dto.entityId}:${dto.type}`,
          ]);
          const rows: Array<{ number: string | number }> = await manager.query(
            'SELECT COALESCE(MAX(number), 0) + 1 AS number FROM assemblies WHERE "entityId" = $1 AND type = $2',
            [dto.entityId, dto.type],
          );
          const number = Number(rows[0]?.number ?? 1);
          const txRepo = manager.getRepository(Assembly);
          const assembly = txRepo.create({
            ...dto,
            number,
            status: 'scheduled',
            heldAt: null,
            ataPdfUrl: dto.ataPdfUrl ?? null,
            notaryRegistry: dto.notaryRegistry ?? null,
            createdById: actor.sub,
          });
          assertAssemblyTransition(assembly, dto, actor);
          return txRepo.save(assembly);
        });
        break;
      } catch (error) {
        if (
          attempt === MAX_CREATE_ATTEMPTS - 1 ||
          !isAssemblyNumberUniqueViolation(error)
        ) {
          throw error;
        }
      }
    }

    const view = await this.toView(created!);
    await this.audit.log({
      action: AuditAction.ASSEMBLY_CREATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: created!.id,
      targetType: 'assembly',
      details: { after: view },
    });
    return view;
  }

  async update(
    id: string,
    dto: UpdateAssemblyDto,
    actor: JwtPayload,
  ): Promise<AssemblyView> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Assembleia não encontrada.');
    await this.assertCanManage(actor, existing.entityId);
    const { before, after, previousStatus } = await this.dataSource.transaction(
      async (manager) => {
        const txRepo = manager.getRepository(Assembly);
        const assembly = await txRepo.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!assembly) {
          throw new NotFoundException('Assembleia não encontrada.');
        }

        const before = await this.toView(assembly);
        const previousStatus = assembly.status;
        assertAssemblyTransition(assembly, dto, actor);
        Object.assign(
          assembly,
          Object.fromEntries(
            Object.entries(dto).filter(([, value]) => value !== undefined),
          ),
        );
        const updated = await txRepo.save(assembly);
        return {
          before,
          after: await this.toView(updated),
          previousStatus,
        };
      },
    );

    await this.audit.log({
      action: AuditAction.ASSEMBLY_UPDATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: id,
      targetType: 'assembly',
      details: { before, after },
    });
    if (previousStatus !== after.status) {
      await this.audit.log({
        action: AuditAction.ASSEMBLY_STATUS_CHANGED,
        actorId: actor.sub,
        actorHandle: actor.handle,
        targetId: id,
        targetType: 'assembly',
        details: {
          beforeStatus: previousStatus,
          afterStatus: after.status,
        },
      });
    }
    if (dto.ataPdfUrl !== undefined || dto.notaryRegistry !== undefined) {
      await this.audit.log({
        action: AuditAction.ASSEMBLY_NOTARY_REGISTERED,
        actorId: actor.sub,
        actorHandle: actor.handle,
        targetId: id,
        targetType: 'assembly',
        details: {
          before: {
            ataPdfUrl: before.ataPdfUrl,
            notaryRegistry: before.notaryRegistry,
          },
          after: {
            ataPdfUrl: after.ataPdfUrl,
            notaryRegistry: after.notaryRegistry,
          },
        },
      });
    }
    return after;
  }

  async listPublic(): Promise<AssemblyView[]> {
    const assemblies = await this.repo.find({
      order: { scheduledAt: 'DESC' },
    });
    return Promise.all(assemblies.map((assembly) => this.toView(assembly)));
  }

  async publicBySlug(slug: string): Promise<AssemblyView> {
    return this.publicByEntityAndSlug('codaqui', slug);
  }

  async publicByEntityAndSlug(entitySlug: string, slug: string): Promise<AssemblyView> {
    const match = /^(ordinaria|oficial)-([1-9]\d*)$/.exec(slug);
    const number = match ? Number(match[2]) : null;
    if (!match || !Number.isSafeInteger(number)) {
      throw new NotFoundException('Assembleia não encontrada.');
    }

    const assembly = await this.repo.findOne({
      where: { type: match[1] as AssemblyType, number: number!, entity: { slug: entitySlug } },
    });
    if (!assembly) throw new NotFoundException('Assembleia não encontrada.');
    return this.toView(assembly);
  }

  async listManage(
    query: ListAssembliesDto,
    actor?: JwtPayload,
  ): Promise<PaginatedResultDto<AssemblyView>> {
    if (actor) await this.assertCanManage(actor, query.entityId);
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(Math.max(1, Math.floor(query.limit ?? 50)), 100);
    const where: { type?: AssemblyType; status?: AssemblyStatus; entityId?: string } = {};
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.entityId) where.entityId = query.entityId;

    const [assemblies, total] = await this.repo.findAndCount({
      where,
      order: { scheduledAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: await Promise.all(assemblies.map((assembly) => this.toView(assembly))),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
    };
  }

  private async assertCanManage(actor: JwtPayload, entityId?: string): Promise<void> {
    if (actor.roles?.includes(MemberRole.ADMIN)) return;
    if (entityId && this.entities) {
      const entity = await this.entities.findOneBy({ id: entityId });
      if (entity && entity.slug !== 'codaqui') {
        const isManager = await this.designations.hasDesignation(actor.sub, {
          targetType: 'entity', targetId: entityId, designation: 'manager',
        });
        if (!isManager) {
          throw new ForbiddenException('Esta assembleia exige admin ou manager da entidade.');
        }
        return;
      }
    }
    const isDirector = await this.designations.hasAnyDesignation(actor.sub, {
      targetType: 'directorate',
      designation: 'director',
    });
    if (!isDirector) {
      throw new ForbiddenException(
        'Somente admin ou diretor ativo pode gerenciar assembleias.',
      );
    }
  }

  private async toView(assembly: Assembly): Promise<AssemblyView> {
    const entity = assembly.entity ?? (this.entities
      ? await this.entities.findOneBy({ id: assembly.entityId })
      : null);
    return {
      id: assembly.id,
      type: assembly.type,
      number: assembly.number,
      slug: assemblySlug(assembly.type, assembly.number),
      title: assembly.title,
      scheduledAt: assembly.scheduledAt,
      heldAt: assembly.heldAt,
      status: assembly.status,
      agendaSummary: assembly.agendaSummary,
      discussionUrl: assembly.discussionUrl,
      ataPdfUrl: assembly.ataPdfUrl,
      notaryRegistry: assembly.notaryRegistry,
      entity: entity ? { slug: entity.slug, name: entity.name } : null,
      createdAt: assembly.createdAt,
      updatedAt: assembly.updatedAt,
    };
  }
}

function isAssemblyNumberUniqueViolation(error: unknown): boolean {
  const candidate = error as {
    code?: string;
    constraint?: string;
    driverError?: { code?: string; constraint?: string };
  };
  return (
    (candidate?.code === '23505' || candidate?.driverError?.code === '23505') &&
    (candidate?.constraint === 'UQ_assemblies_entity_type_number' ||
      candidate?.driverError?.constraint === 'UQ_assemblies_entity_type_number')
  );
}

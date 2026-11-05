import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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

export type AssemblyView = Omit<Assembly, 'createdById'> & { slug: string };

const MAX_CREATE_ATTEMPTS = 3;

@Injectable()
export class AssembliesService {
  constructor(
    @InjectRepository(Assembly)
    private readonly repo: Repository<Assembly>,
    private readonly dataSource: DataSource,
    private readonly designations: DesignationsService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateAssemblyDto,
    actor: JwtPayload,
  ): Promise<AssemblyView> {
    await this.assertCanManage(actor);

    let created: Assembly;
    for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
      try {
        created = await this.dataSource.transaction(async (manager) => {
          await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
            dto.type,
          ]);
          const rows: Array<{ number: string | number }> = await manager.query(
            'SELECT COALESCE(MAX(number), 0) + 1 AS number FROM assemblies WHERE type = $1',
            [dto.type],
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

    const view = this.toView(created!);
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
    await this.assertCanManage(actor);
    const assembly = await this.repo.findOne({ where: { id } });
    if (!assembly) throw new NotFoundException('Assembleia não encontrada.');

    const before = this.toView(assembly);
    const previousStatus = assembly.status;
    assertAssemblyTransition(assembly, dto, actor);
    Object.assign(
      assembly,
      Object.fromEntries(
        Object.entries(dto).filter(([, value]) => value !== undefined),
      ),
    );
    const updated = await this.repo.save(assembly);
    const after = this.toView(updated);

    await this.audit.log({
      action: AuditAction.ASSEMBLY_UPDATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: id,
      targetType: 'assembly',
      details: { before, after },
    });
    if (previousStatus !== updated.status) {
      await this.audit.log({
        action: AuditAction.ASSEMBLY_STATUS_CHANGED,
        actorId: actor.sub,
        actorHandle: actor.handle,
        targetId: id,
        targetType: 'assembly',
        details: {
          beforeStatus: previousStatus,
          afterStatus: updated.status,
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
    return assemblies.map((assembly) => this.toView(assembly));
  }

  async publicBySlug(slug: string): Promise<AssemblyView> {
    const match = /^(ordinaria|oficial)-([1-9]\d*)$/.exec(slug);
    const number = match ? Number(match[2]) : null;
    if (!match || !Number.isSafeInteger(number)) {
      throw new NotFoundException('Assembleia não encontrada.');
    }

    const assembly = await this.repo.findOne({
      where: { type: match[1] as AssemblyType, number: number! },
    });
    if (!assembly) throw new NotFoundException('Assembleia não encontrada.');
    return this.toView(assembly);
  }

  async listManage(
    query: ListAssembliesDto,
  ): Promise<PaginatedResultDto<AssemblyView>> {
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(Math.max(1, Math.floor(query.limit ?? 50)), 100);
    const where: { type?: AssemblyType; status?: AssemblyStatus } = {};
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;

    const [assemblies, total] = await this.repo.findAndCount({
      where,
      order: { scheduledAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: assemblies.map((assembly) => this.toView(assembly)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
    };
  }

  private async assertCanManage(actor: JwtPayload): Promise<void> {
    if (actor.roles?.includes(MemberRole.ADMIN)) return;
    const isDirector = await this.designations.hasDesignation(actor.sub, {
      targetType: 'directorate',
      designation: 'director',
    });
    if (!isDirector) {
      throw new ForbiddenException(
        'Somente admin ou diretor ativo pode gerenciar assembleias.',
      );
    }
  }

  private toView(assembly: Assembly): AssemblyView {
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
    (candidate?.constraint === 'UQ_assemblies_type_number' ||
      candidate?.driverError?.constraint === 'UQ_assemblies_type_number')
  );
}

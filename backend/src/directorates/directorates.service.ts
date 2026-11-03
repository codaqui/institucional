import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { JwtPayload } from '../auth/jwt.strategy';
import { DesignationsService } from '../designations/designations.service';
import { MemberRole } from '../members/entities/member.entity';
import { PaginatedResultDto } from '../ledger/dto/paginated-result.dto';
import { CreateDirectorateDto } from './dto/create-directorate.dto';
import { ListDirectoratesDto } from './dto/list-directorates.dto';
import { UpdateDirectorateDto } from './dto/update-directorate.dto';
import { Directorate } from './entities/directorate.entity';

@Injectable()
export class DirectoratesService {
  constructor(
    @InjectRepository(Directorate)
    private readonly repo: Repository<Directorate>,
    private readonly designations: DesignationsService,
    private readonly audit: AuditService,
  ) {}

  listPublic(): Promise<Directorate[]> {
    return this.repo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async listManage(
    query: ListDirectoratesDto,
  ): Promise<PaginatedResultDto<Directorate>> {
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(Math.max(1, Math.floor(query.limit ?? 50)), 100);
    const search = query.search?.trim();
    const where = search
      ? [
          { name: ILike(`%${search}%`) },
          { slug: ILike(`%${search}%`) },
          { description: ILike(`%${search}%`) },
        ]
      : undefined;
    const [data, total] = await this.repo.findAndCount({
      where,
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
    };
  }

  async create(
    dto: CreateDirectorateDto,
    actor: JwtPayload,
  ): Promise<Directorate> {
    await this.assertUniqueSlug(dto.slug);
    const created = await this.repo.save(this.repo.create(dto));
    await this.audit.log({
      action: AuditAction.DIRECTORATE_CREATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: created.id,
      targetType: 'directorate',
      details: { after: { ...created } },
    });
    return created;
  }

  async update(
    id: string,
    dto: UpdateDirectorateDto,
    user: JwtPayload,
  ): Promise<Directorate> {
    const directorate = await this.repo.findOne({ where: { id } });
    if (!directorate) throw new NotFoundException('Diretoria não encontrada.');

    if (!user.roles.includes(MemberRole.ADMIN)) {
      const allowed = await this.designations.hasDesignation(user.sub, {
        targetType: 'directorate',
        targetId: id,
        designation: 'director',
      });
      if (!allowed) {
        throw new ForbiddenException(
          'Você só pode editar a própria diretoria.',
        );
      }
    }

    if (dto.slug && dto.slug !== directorate.slug) {
      await this.assertUniqueSlug(dto.slug);
    }
    const before = { ...directorate };
    Object.assign(directorate, dto);
    const updated = await this.repo.save(directorate);
    await this.audit.log({
      action: AuditAction.DIRECTORATE_UPDATED,
      actorId: user.sub,
      actorHandle: user.handle,
      targetId: id,
      targetType: 'directorate',
      details: { before, after: { ...updated } },
    });
    return updated;
  }

  private async assertUniqueSlug(slug: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { slug } });
    if (existing) throw new ConflictException('O slug informado já está em uso.');
  }
}

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { JwtPayload } from '../auth/jwt.strategy';
import { PaginatedResultDto } from '../ledger/dto/paginated-result.dto';
import { MemberRole } from '../members/entities/member.entity';
import { CreateAnnouncementDto, ListAnnouncementsDto, UpdateAnnouncementDto } from './dto/announcement.dto';
import { Announcement } from './entities/announcement.entity';

interface AnnouncementValidationInput {
  text?: string;
  linkUrl?: string | null;
  linkLabel?: string | null;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
}

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private readonly repo: Repository<Announcement>,
    private readonly audit: AuditService,
  ) {}

  private assertAdmin(actor: JwtPayload): void {
    if (!actor.roles.includes(MemberRole.ADMIN)) {
      throw new ForbiddenException('Apenas administradores gerenciam anúncios.');
    }
  }

  private validateText(text: string | undefined): void {
    const normalized = text?.trim() ?? '';
    const labelEnd = normalized.indexOf('](');
    const hasMarkdownLink = labelEnd > 0 && normalized.slice(0, labelEnd).includes('[') && normalized.indexOf(')', labelEnd + 2) > labelEnd + 2;
    if (normalized.length < 3 || normalized.length > 280 || /[<>]/.test(normalized) || hasMarkdownLink) {
      throw new BadRequestException('O texto deve ter 3–280 caracteres, sem HTML ou Markdown.');
    }
  }

  private validateLink(dto: AnnouncementValidationInput): void {
    if (dto.linkUrl && !dto.linkLabel?.trim()) {
      throw new BadRequestException('Informe um rótulo para o link.');
    }
    if (!dto.linkUrl && dto.linkLabel?.trim()) {
      throw new BadRequestException('Remova o rótulo ou informe um link.');
    }
    if (!dto.linkUrl) return;
    if (!dto.linkUrl.includes('://') && !dto.linkUrl.startsWith('//')) {
      if (!dto.linkUrl.startsWith('/')) {
        throw new BadRequestException('O link deve ser um caminho interno iniciado por / ou URL HTTPS.');
      }
      return;
    }
    let url: URL;
    try {
      url = new URL(dto.linkUrl);
    } catch {
      throw new BadRequestException('O link deve ser um caminho interno ou URL HTTPS válida.');
    }
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new BadRequestException('O link externo deve usar HTTPS e não conter credenciais.');
    }
  }

  private validateInput(dto: AnnouncementValidationInput): void {
    this.validateText(dto.text);
    this.validateLink(dto);
    if (dto.startsAt && dto.endsAt) {
      const startsAt = dto.startsAt instanceof Date ? dto.startsAt.getTime() : new Date(dto.startsAt).getTime();
      const endsAt = dto.endsAt instanceof Date ? dto.endsAt.getTime() : new Date(dto.endsAt).getTime();
      if (endsAt <= startsAt) throw new BadRequestException('O fim da exibição deve ser posterior ao início.');
    }
  }

  private normalize(dto: Partial<CreateAnnouncementDto>) {
    return {
      ...(dto.text !== undefined ? { text: dto.text.trim() } : {}),
      ...(dto.severity !== undefined ? { severity: dto.severity } : {}),
      ...(dto.linkUrl !== undefined ? { linkUrl: dto.linkUrl.trim() || null } : {}),
      ...(dto.linkLabel !== undefined ? { linkLabel: dto.linkLabel.trim() || null } : {}),
      ...(dto.startsAt !== undefined ? { startsAt: dto.startsAt ? new Date(dto.startsAt) : null } : {}),
      ...(dto.endsAt !== undefined ? { endsAt: dto.endsAt ? new Date(dto.endsAt) : null } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    };
  }

  async listAdmin(query: ListAnnouncementsDto, actor: JwtPayload): Promise<PaginatedResultDto<Announcement>> {
    this.assertAdmin(actor);
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(Math.max(1, Math.floor(query.limit ?? 50)), 100);
    const [data, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, totalPages: Math.ceil(total / limit), limit };
  }

  async create(dto: CreateAnnouncementDto, actor: JwtPayload): Promise<Announcement> {
    this.assertAdmin(actor);
    this.validateInput(dto);
    const created = await this.repo.save(this.repo.create({
      ...this.normalize(dto),
      active: dto.active ?? true,
      createdById: actor.sub,
      updatedById: actor.sub,
    }));
    await this.audit.log({
      action: AuditAction.ANNOUNCEMENT_CREATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: created.id,
      targetType: 'announcement',
      details: { after: { ...created } },
    });
    return created;
  }

  async update(id: string, dto: UpdateAnnouncementDto, actor: JwtPayload): Promise<Announcement> {
    this.assertAdmin(actor);
    const current = await this.repo.findOneBy({ id });
    if (!current) throw new NotFoundException('Anúncio não encontrado.');
    this.validateInput({ ...current, ...dto });
    const before = { ...current };
    Object.assign(current, this.normalize(dto), { updatedById: actor.sub });
    const updated = await this.repo.save(current);
    await this.audit.log({
      action: AuditAction.ANNOUNCEMENT_UPDATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: id,
      targetType: 'announcement',
      details: { before, after: { ...updated } },
    });
    return updated;
  }

  async deactivate(id: string, actor: JwtPayload): Promise<Announcement> {
    this.assertAdmin(actor);
    const current = await this.repo.findOneBy({ id });
    if (!current) throw new NotFoundException('Anúncio não encontrado.');
    const before = { ...current };
    current.active = false;
    current.updatedById = actor.sub;
    const updated = await this.repo.save(current);
    await this.audit.log({
      action: AuditAction.ANNOUNCEMENT_DEACTIVATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: id,
      targetType: 'announcement',
      details: { before, after: { ...updated } },
    });
    return updated;
  }

  async listPublic() {
    const now = new Date();
    const rows = await this.repo.createQueryBuilder('a')
      .where('a.active = true')
      .andWhere('(a.startsAt IS NULL OR a.startsAt <= :now)', { now })
      .andWhere('(a.endsAt IS NULL OR a.endsAt > :now)', { now })
      .orderBy("CASE a.severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 WHEN 'info' THEN 2 ELSE 3 END", 'ASC')
      .addOrderBy('a.createdAt', 'DESC')
      .getMany();
    const rank = { error: 0, warning: 1, info: 2, success: 3 } as const;
    return rows
      .sort((left, right) =>
        rank[left.severity] - rank[right.severity] ||
        right.createdAt.getTime() - left.createdAt.getTime())
      .map((item) => ({
        id: item.id,
        text: item.text,
        severity: item.severity,
        ...(item.linkUrl ? { linkUrl: item.linkUrl } : {}),
        ...(item.linkLabel ? { linkLabel: item.linkLabel } : {}),
        startsAt: item.startsAt,
        endsAt: item.endsAt,
      }));
  }
}

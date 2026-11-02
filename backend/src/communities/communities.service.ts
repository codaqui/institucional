import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { JwtPayload } from '../auth/jwt.strategy';
import { DesignationsService } from '../designations/designations.service';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { PaginatedResultDto } from '../ledger/dto/paginated-result.dto';
import { Member } from '../members/entities/member.entity';
import { CreateCommunityDto } from './dto/create-community.dto';
import { ListCommunitiesDto } from './dto/list-communities.dto';
import { SealCommunityDto } from './dto/seal-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { Community } from './entities/community.entity';

@Injectable()
export class CommunitiesService {
  constructor(
    @InjectRepository(Community)
    private readonly repo: Repository<Community>,
    @InjectRepository(MemberDesignation)
    private readonly designationRepo: Repository<MemberDesignation>,
    @InjectRepository(Member)
    private readonly membersRepo: Repository<Member>,
    private readonly designations: DesignationsService,
    private readonly audit: AuditService,
  ) {}

  async listPublic() {
    const communities = await this.repo.find({
      where: { status: 'active' },
      order: { name: 'ASC' },
    });
    return Promise.all(
      communities.map(async (community) => ({
        id: community.slug,
        slug: community.slug,
        name: community.name,
        description: community.description,
        emoji: community.emoji,
        logo: community.logoUrl,
        location: community.location,
        founded: community.founded,
        links: community.links,
        socialProfiles: community.socialProfiles,
        tags: community.tags,
        level: community.level,
        status: community.status,
        sealStatus: community.sealStatus,
        sealGrantedAt: community.sealGrantedAt,
        sealGrantedById: community.sealGrantedById,
        sealValidUntil: community.sealValidUntil,
        sealNotes: community.sealNotes,
        siteEnabled: community.siteEnabled,
        siteDomain: community.siteDomain,
        responsible: await this.findResponsible(community.id),
      })),
    );
  }

  async listManage(
    query: ListCommunitiesDto,
  ): Promise<PaginatedResultDto<Community>> {
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

  async create(dto: CreateCommunityDto): Promise<Community> {
    await this.assertUniqueSlug(dto.slug);
    return this.repo.save(
      this.repo.create({
        slug: dto.slug,
        name: dto.name,
        description: dto.description ?? '',
        emoji: dto.emoji ?? '',
        logoUrl: dto.logoUrl ?? '',
        location: dto.location ?? null,
        founded: dto.founded ?? null,
        links: dto.links ?? [],
        socialProfiles: dto.socialProfiles ?? [],
        tags: dto.tags ?? [],
        level: dto.level ?? 'parceira',
        status: dto.status ?? 'active',
        sealStatus: 'none',
        siteEnabled: dto.siteEnabled ?? false,
        siteDomain: dto.siteDomain ?? null,
      }),
    );
  }

  async update(id: string, dto: UpdateCommunityDto): Promise<Community> {
    const community = await this.requireCommunity(id);
    if (dto.slug && dto.slug !== community.slug) {
      await this.assertUniqueSlug(dto.slug);
    }
    Object.assign(community, dto);
    return this.repo.save(community);
  }

  async requestSeal(id: string): Promise<Community> {
    const community = await this.requireCommunity(id);
    community.sealStatus = 'applied';
    return this.repo.save(community);
  }

  async grantSeal(
    id: string,
    dto: SealCommunityDto,
    actor: JwtPayload,
  ): Promise<Community> {
    const community = await this.requireCommunity(id);
    const responsible = await this.findActiveResponsibleDesignation(id);
    if (!responsible) {
      throw new BadRequestException(
        'A comunidade precisa de um responsável ativo para receber o selo.',
      );
    }

    const grantedAt = new Date();
    let validUntil: Date;
    if (dto.validUntil) {
      validUntil = new Date(dto.validUntil);
      if (Number.isNaN(validUntil.getTime()) || validUntil <= grantedAt) {
        throw new BadRequestException(
          'A validade do selo deve ser uma data futura.',
        );
      }
    } else {
      validUntil = new Date(grantedAt);
      validUntil.setUTCFullYear(validUntil.getUTCFullYear() + 1);
    }

    community.sealStatus = 'sealed';
    community.sealGrantedAt = grantedAt;
    community.sealGrantedById = actor.sub;
    community.sealValidUntil = validUntil;
    community.sealNotes = dto.notes;
    const sealed = await this.repo.save(community);
    await this.audit.log({
      action: AuditAction.COMMUNITY_SEAL_GRANTED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: id,
      targetType: 'community',
      details: {
        sealGrantedAt: grantedAt,
        sealValidUntil: validUntil,
        sealNotes: dto.notes,
      },
    });
    return sealed;
  }

  findActiveForDonations(slug: string): Promise<Community | null> {
    return this.repo.findOne({
      where: { slug, status: 'active', level: 'integrada' },
    });
  }

  private async findActiveResponsibleDesignation(communityId: string) {
    const designation = await this.designationRepo.findOne({
      where: {
        targetType: 'community',
        targetId: communityId,
        designation: 'responsible',
        status: 'active',
      },
    });
    if (!designation) return null;

    const active = await this.designations.hasDesignation(
      designation.memberId,
      {
        targetType: 'community',
        targetId: communityId,
        designation: 'responsible',
      },
    );
    return active ? designation : null;
  }

  private async findResponsible(communityId: string) {
    const designation =
      await this.findActiveResponsibleDesignation(communityId);
    if (!designation) return null;

    const member = await this.membersRepo.findOne({
      where: { id: designation.memberId },
    });
    if (!member) return null;
    return {
      id: member.id,
      name: member.name,
      githubHandle: member.githubHandle,
      avatarUrl: member.avatarUrl,
    };
  }

  private async requireCommunity(id: string): Promise<Community> {
    const community = await this.repo.findOne({ where: { id } });
    if (!community) throw new NotFoundException('Comunidade não encontrada.');
    return community;
  }

  private async assertUniqueSlug(slug: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { slug } });
    if (existing)
      throw new ConflictException('O slug informado já está em uso.');
  }
}

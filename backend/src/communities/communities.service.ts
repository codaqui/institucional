import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { JwtPayload } from '../auth/jwt.strategy';
import { DesignationsService } from '../designations/designations.service';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { PaginatedResultDto } from '../ledger/dto/paginated-result.dto';
import { Member, MemberRole } from '../members/entities/member.entity';
import { hasOnlySafeCommunityUrls } from './community-url';
import { CreateCommunityDto } from './dto/create-community.dto';
import { ListCommunitiesDto } from './dto/list-communities.dto';
import { SealCommunityDto } from './dto/seal-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { Community } from './entities/community.entity';

const RESERVED_COMMUNITY_SLUGS = new Set(['tesouro-geral']);
const RESPONSIBLE_UPDATE_FIELDS = new Set([
  'name',
  'description',
  'emoji',
  'logoUrl',
  'location',
  'founded',
  'links',
  'socialProfiles',
  'tags',
]);

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
      communities.map(async (community) => {
        let sealStatus = community.sealStatus;
        if (this.hasEffectiveSeal(community)) {
          sealStatus = 'sealed';
        } else if (community.sealStatus === 'sealed') {
          sealStatus = 'none';
        }

        return {
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
          sealStatus,
          sealEffective: this.hasEffectiveSeal(community),
          sealGrantedAt: community.sealGrantedAt,
          sealGrantedById: community.sealGrantedById,
          sealValidUntil: community.sealValidUntil,
          sealNotes: community.sealNotes,
          siteEnabled: community.siteEnabled,
          siteDomain: community.siteDomain,
          responsible: await this.findResponsible(community.id),
        };
      }),
    );
  }

  async listManage(
    query: ListCommunitiesDto,
    actor: JwtPayload,
  ): Promise<PaginatedResultDto<Community>> {
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(Math.max(1, Math.floor(query.limit ?? 50)), 100);
    let scopedIds: string[] | null = null;
    if (!actor.roles.includes(MemberRole.ADMIN)) {
      const designations = await this.designationRepo.find({
        where: {
          memberId: actor.sub,
          status: 'active',
          targetType: 'community',
          designation: 'responsible',
        },
      });
      scopedIds = designations.flatMap((designation) =>
        designation.targetId ? [designation.targetId] : [],
      );
      if (scopedIds.length === 0) {
        return { data: [], total: 0, page, totalPages: 0, limit };
      }
    }

    const search = query.search?.trim();
    const where = search
      ? [
          { ...(scopedIds ? { id: In(scopedIds) } : {}), name: ILike(`%${search}%`) },
          { ...(scopedIds ? { id: In(scopedIds) } : {}), slug: ILike(`%${search}%`) },
          {
            ...(scopedIds ? { id: In(scopedIds) } : {}),
            description: ILike(`%${search}%`),
          },
        ]
      : scopedIds
        ? { id: In(scopedIds) }
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

  async create(dto: CreateCommunityDto, actor: JwtPayload): Promise<Community> {
    if (RESERVED_COMMUNITY_SLUGS.has(dto.slug)) {
      throw new ConflictException('Este slug é reservado para a tesouraria.');
    }
    this.assertSafeUrls(dto);
    await this.assertUniqueSlug(dto.slug);
    const created = await this.repo.save(
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
    await this.audit.log({
      action: AuditAction.COMMUNITY_CREATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: created.id,
      targetType: 'community',
      details: { after: { ...created } },
    });
    return created;
  }

  async update(
    id: string,
    dto: UpdateCommunityDto,
    actor: JwtPayload,
  ): Promise<Community> {
    const community = await this.requireCommunity(id);
    await this.assertCommunityScope(actor, id);
    if (dto.slug !== undefined && dto.slug !== community.slug) {
      throw new ConflictException('O slug de uma comunidade existente é imutável.');
    }
    if (!actor.roles.includes(MemberRole.ADMIN)) {
      const invalidField = Object.keys(dto).find(
        (field) => !RESPONSIBLE_UPDATE_FIELDS.has(field),
      );
      if (invalidField) {
        throw new BadRequestException(
          `Responsáveis não podem alterar o campo ${invalidField}.`,
        );
      }
    }
    this.assertSafeUrls(dto);
    const before = { ...community };
    const changes = { ...dto };
    delete changes.slug;
    Object.assign(community, changes);
    const updated = await this.repo.save(community);
    await this.audit.log({
      action: AuditAction.COMMUNITY_UPDATED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: id,
      targetType: 'community',
      details: { before, after: { ...updated } },
    });
    return updated;
  }

  async requestSeal(id: string, actor: JwtPayload): Promise<Community> {
    const community = await this.requireCommunity(id);
    await this.assertCommunityScope(actor, id);
    if (community.sealStatus === 'applied') return community;
    if (community.sealStatus === 'sealed' && this.hasEffectiveSeal(community)) {
      throw new ConflictException(
        'O selo ainda está vigente; a renovação deve ser feita pela concessão administrativa.',
      );
    }

    const before = { ...community };
    community.sealStatus = 'applied';
    const updated = await this.repo.save(community);
    await this.audit.log({
      action: AuditAction.COMMUNITY_SEAL_REQUESTED,
      actorId: actor.sub,
      actorHandle: actor.handle,
      targetId: id,
      targetType: 'community',
      details: { before, after: { ...updated } },
    });
    return updated;
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

    const before = { ...community };
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
      details: { before, after: { ...sealed } },
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

  private hasEffectiveSeal(community: Community, now = new Date()): boolean {
    return (
      community.sealStatus === 'sealed' &&
      community.sealValidUntil !== null &&
      community.sealValidUntil > now
    );
  }

  private async assertCommunityScope(
    actor: JwtPayload,
    communityId: string,
  ): Promise<void> {
    if (actor.roles.includes(MemberRole.ADMIN)) return;
    const allowed = await this.designations.hasDesignation(actor.sub, {
      targetType: 'community',
      targetId: communityId,
      designation: 'responsible',
    });
    if (!allowed) {
      throw new ForbiddenException(
        'Responsáveis só podem gerenciar as próprias comunidades.',
      );
    }
  }

  private assertSafeUrls(
    dto: Pick<CreateCommunityDto, 'links' | 'socialProfiles'>,
  ): void {
    if (
      !hasOnlySafeCommunityUrls(dto.links) ||
      !hasOnlySafeCommunityUrls(dto.socialProfiles)
    ) {
      throw new BadRequestException(
        'Links e perfis sociais devem usar https: ou caminhos locais iniciados por /.',
      );
    }
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

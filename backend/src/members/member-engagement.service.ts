import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Community } from '../communities/entities/community.entity';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { MentorProfile } from '../mentorship/entities/mentor-profile.entity';
import { Member } from './entities/member.entity';
import { resolveProfileVisibility } from './profile-visibility';
import type { MemberEngagement } from './member-engagement.types';

const HANDLE_REGEX = /^[a-zA-Z0-9_-]+$/;
const COMMUNITY_DESIGNATION_LABELS: Record<string, string> = {
  responsible: 'Responsável',
  organizer: 'Organização',
  volunteer: 'Voluntariado',
  maintainer: 'Manutenção',
  founder: 'Fundador(a)',
};

@Injectable()
export class MemberEngagementService {
  constructor(
    @InjectRepository(Member) private readonly memberRepo: Repository<Member>,
    @InjectRepository(MemberDesignation) private readonly designationRepo: Repository<MemberDesignation>,
    @InjectRepository(Community) private readonly communityRepo: Repository<Community>,
    @InjectRepository(MentorProfile) private readonly mentorProfileRepo: Repository<MentorProfile>,
  ) {}

  async getByHandle(handle: string): Promise<MemberEngagement> {
    if (!HANDLE_REGEX.test(handle)) throw new BadRequestException('Handle inválido.');
    const member = await this.memberRepo.findOne({
      where: { githubHandle: handle, isActive: true },
      select: ['id', 'githubHandle', 'profileVisibility'],
    });
    if (!member) throw new NotFoundException('Membro não encontrado.');
    const empty: MemberEngagement = { designations: [], communities: [], mentor: null };
    if (!resolveProfileVisibility(member.profileVisibility).designations) return empty;

    const now = Date.now();
    const designations = (await this.designationRepo.find({
      where: { memberId: member.id, status: 'active' },
    })).filter((designation) => designation.status === 'active'
      && (!designation.validUntil || designation.validUntil.getTime() > now));
    const communityDesignations = designations.filter((designation) =>
      designation.targetType === 'community' && Boolean(designation.targetId));
    const communityIds = [...new Set(communityDesignations.map((designation) => designation.targetId!))];
    const communities = communityIds.length > 0
      ? await this.communityRepo.find({
        where: { id: In(communityIds), status: 'active' },
        order: { name: 'ASC' },
      })
      : [];
    const communitiesById = new Map(communities.map((community) => [community.id, community]));
    const publicDesignations: MemberEngagement['designations'] = [];
    for (const designation of communityDesignations) {
      const community = communitiesById.get(designation.targetId!);
      if (!community) continue;
      const label = COMMUNITY_DESIGNATION_LABELS[designation.designation]
        ?? 'Vínculo comunitário';
      publicDesignations.push({
        key: `community:${community.slug}:${designation.designation}`,
        label: `${label} · ${community.name}`,
      });
    }

    const mentorDesignation = designations.some((designation) =>
      designation.targetType === 'program' && designation.targetKey === 'mentoria'
      && designation.designation === 'mentor');
    let mentor: MemberEngagement['mentor'] = null;
    if (mentorDesignation) {
      publicDesignations.push({ key: 'program:mentoria:mentor', label: 'Mentoria' });
      const profile = await this.mentorProfileRepo.findOneBy({ memberId: member.id, active: true });
      if (profile) {
        mentor = {
          id: profile.id,
          href: `/participe/mentoria?mentor=${encodeURIComponent(profile.id)}`,
        };
      }
    }

    return {
      designations: publicDesignations,
      communities: communities.map((community) => ({
        slug: community.slug,
        name: community.name,
        href: `/comunidades/${encodeURIComponent(community.slug)}`,
      })),
      mentor,
    };
  }
}

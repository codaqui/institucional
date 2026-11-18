import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MemberEngagementService } from './member-engagement.service';

const member = {
  id: 'member-1',
  githubHandle: 'maria',
  isActive: true,
  profileVisibility: {},
};

describe('MemberEngagementService', () => {
  const memberRepo = { findOne: jest.fn() };
  const designationRepo = { find: jest.fn() };
  const communityRepo = { find: jest.fn() };
  const mentorProfileRepo = { findOneBy: jest.fn() };
  let service: MemberEngagementService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new MemberEngagementService(
      memberRepo as any,
      designationRepo as any,
      communityRepo as any,
      mentorProfileRepo as any,
    );
    memberRepo.findOne.mockResolvedValue(member);
    designationRepo.find.mockResolvedValue([]);
    communityRepo.find.mockResolvedValue([]);
    mentorProfileRepo.findOneBy.mockResolvedValue(null);
  });

  it('rejects malformed, missing and inactive handles without querying designations', async () => {
    await expect(service.getByHandle('invalid handle')).rejects.toBeInstanceOf(BadRequestException);
    memberRepo.findOne.mockResolvedValue(null);
    await expect(service.getByHandle('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(designationRepo.find).not.toHaveBeenCalled();
  });

  it('hides every designation-derived link when visibility is disabled', async () => {
    memberRepo.findOne.mockResolvedValue({ ...member, profileVisibility: { designations: false } });
    await expect(service.getByHandle('maria')).resolves.toEqual({
      designations: [], communities: [], mentor: null,
    });
    expect(designationRepo.find).not.toHaveBeenCalled();
    expect(communityRepo.find).not.toHaveBeenCalled();
  });

  it('projects only active public communities and deduplicates their cards', async () => {
    designationRepo.find.mockResolvedValue([
      { id: 'd1', targetType: 'community', targetId: 'community-1', designation: 'responsible', status: 'active', validUntil: null },
      { id: 'd2', targetType: 'community', targetId: 'community-1', designation: 'volunteer', status: 'active', validUntil: null },
      { id: 'd3', targetType: 'community', targetId: 'community-2', designation: 'responsible', status: 'active', validUntil: null },
      { id: 'd4', targetType: 'event', targetId: 'event-1', designation: 'organizer', status: 'active', validUntil: null },
      { id: 'd5', targetType: 'community', targetId: 'expired', designation: 'responsible', status: 'active', validUntil: new Date(Date.now() - 1000) },
      { id: 'd6', targetType: 'community', targetId: 'pending', designation: 'responsible', status: 'pending', validUntil: null },
    ]);
    communityRepo.find.mockResolvedValue([
      { id: 'community-1', slug: 'devparana', name: 'DevParaná', status: 'active' },
    ]);

    const result = await service.getByHandle('maria');
    expect(result).toEqual({
      designations: [
        { key: 'community:devparana:responsible', label: 'Responsável · DevParaná' },
        { key: 'community:devparana:volunteer', label: 'Voluntariado · DevParaná' },
      ],
      communities: [{ slug: 'devparana', name: 'DevParaná', href: '/comunidades/devparana' }],
      mentor: null,
    });
    expect(JSON.stringify(result)).not.toMatch(/targetId|appointedBy|applicationNotes|event-1/);
  });

  it('exposes mentorship only with a valid designation and active public profile', async () => {
    designationRepo.find.mockResolvedValue([{
      id: 'mentor-designation', targetType: 'program', targetKey: 'mentoria',
      designation: 'mentor', status: 'active', validUntil: null,
    }]);
    mentorProfileRepo.findOneBy.mockResolvedValue({ id: 'public-mentor-id', memberId: member.id, active: true });

    await expect(service.getByHandle('maria')).resolves.toEqual({
      designations: [{ key: 'program:mentoria:mentor', label: 'Mentoria' }],
      communities: [],
      mentor: {
        id: 'public-mentor-id',
        href: '/participe/mentoria?mentor=public-mentor-id',
      },
    });
  });
});

import { PrivacyExportService } from './privacy-export.service';

const memberId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('PrivacyExportService', () => {
  it('monta o schema 1 com dados do titular e sem segredos ou identidade de terceiros', async () => {
    const member = {
      id: memberId,
      githubId: 'github-1',
      githubHandle: 'maria',
      name: 'Maria',
      email: 'maria@example.com',
      secondaryEmails: ['maria.secondary@example.com'],
      avatarUrl: 'https://example.com/avatar.png',
      bio: 'Bio',
      linkedinUrl: 'https://linkedin.com/in/maria',
      roles: ['membro'],
      isActive: true,
      eventCommsOptIn: false,
      marketingEmailOptIn: true,
      profileVisibility: { hours: true },
      joinedAt: new Date('2026-01-01T00:00:00Z'),
      githubAccessToken: 'must-not-leak',
    };
    const registrationRepository = {
      find: jest.fn().mockResolvedValue([
        { id: 'own', memberId, payerMemberId: memberId, attendeeName: 'Maria', attendeeEmail: member.email, checkinToken: 'secret-token', status: 'confirmed' },
        { id: 'payer', memberId: 'other-member', payerMemberId: memberId, attendeeName: 'Outra pessoa', attendeeEmail: 'other@example.com', status: 'confirmed' },
      ]),
    };
    const sessionRepository = {
      find: jest.fn().mockImplementation(({ where }) => where.mentorId
        ? Promise.resolve([{ id: 'mentor-session', mentorId: 'profile-1', menteeName: 'Outra pessoa', menteeEmail: 'other@example.com', topicTags: ['DevOps'], status: 'completed' }])
        : Promise.resolve([{ id: 'mentee-session', menteeMemberId: memberId, menteeName: 'Maria', menteeEmail: member.email, token: 'guest-secret', status: 'completed' }])),
    };
    const stores: Record<string, any> = {
      Member: { findOneOrFail: jest.fn().mockResolvedValue(member) },
      MemberDesignation: { find: jest.fn().mockResolvedValue([{ id: 'designation-1', memberId, designation: 'evaluator' }]) },
      EventRegistration: registrationRepository,
      MentorProfile: { findOne: jest.fn().mockResolvedValue({ id: 'profile-1', memberId, areas: ['DevOps'] }) },
      MentorAvailability: { find: jest.fn().mockResolvedValue([{ mentorId: 'profile-1', weekday: 1, startTime: '18:00', endTime: '19:00' }]) },
      MentorshipSession: sessionRepository,
      C4pTalk: { find: jest.fn().mockResolvedValue([{ id: 'talk-1', speakerEmail: member.email, title: 'Palestra' }]) },
      C4pVote: { find: jest.fn().mockResolvedValue([{ id: 'vote-1', evaluatorDesignationId: 'designation-1', scores: { content: 5 } }]) },
      Transaction: { find: jest.fn().mockResolvedValue([{ id: 'tx-1', description: `Doação [${memberId}]`, amount: '10.00', referenceId: 'stripe-pi:1' }]) },
    };
    const defaultRepository = () => ({
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    });
    const dataSource = {
      getRepository: jest.fn((entity) => stores[entity.name] ?? defaultRepository()),
    };
    const service = new PrivacyExportService(dataSource as any);

    const exported = await service.exportMember(memberId);
    const serialized = JSON.stringify(exported);

    expect(exported.schemaVersion).toBe(1);
    expect(exported.subject.id).toBe(memberId);
    for (const key of ['account', 'designations', 'events', 'mentorship', 'hours', 'projects', 'finance', 'c4p', 'communications', 'coverage', 'exclusions']) {
      expect(exported).toHaveProperty(key);
    }
    expect(serialized).not.toContain('must-not-leak');
    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toContain('guest-secret');
    expect(exported.mentorship.sessionsAsMentor[0]).not.toHaveProperty('menteeEmail');
    expect(exported.events.registrations[1]).not.toHaveProperty('attendeeEmail');
    expect(registrationRepository.find).toHaveBeenCalledWith({
      where: [{ memberId }, { payerMemberId: memberId }],
    });
  });
});

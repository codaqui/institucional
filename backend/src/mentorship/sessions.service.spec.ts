import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { MentorshipSessionStatus } from './entities/mentorship-session.entity';
import type { JwtPayload } from '../auth/jwt.strategy';
import { MemberRole } from '../members/entities/member.entity';

const mentorActor: JwtPayload = {
  sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', githubId: '1', handle: 'ana', name: 'Ana', email: 'ana@example.test', avatarUrl: '', roles: ['mentor'],
};
const otherMentor = { ...mentorActor, sub: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' };

describe('SessionsService', () => {
  let service: SessionsService;
  let sessionRepo: Record<string, jest.Mock>;
  let profileRepo: Record<string, jest.Mock>;
  let hours: Record<string, jest.Mock>;
  let emailService: Record<string, jest.Mock>;

  const session = {
    id: 'session-1',
    mentorId: 'mentor-1',
    menteeName: 'Ana',
    menteeEmail: 'ana@example.test',
    topicTags: ['DevOps'],
    scheduledAt: new Date(Date.now() - 60_000),
    durationMin: 60,
    timeZone: 'America/Sao_Paulo',
    status: MentorshipSessionStatus.REQUESTED,
    token: 'token-1',
  };

  beforeEach(() => {
    sessionRepo = {
      findOneBy: jest.fn().mockImplementation(() => Promise.resolve({ ...session })),
      find: jest.fn().mockResolvedValue([]),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      save: jest.fn((value) => Promise.resolve(value)),
    };
    profileRepo = {
      findOneBy: jest.fn().mockImplementation(({ id, memberId }) => Promise.resolve(
        id === 'mentor-1' || memberId === mentorActor.sub
          ? { id: 'mentor-1', memberId: mentorActor.sub, active: true }
          : { id: 'mentor-2', memberId: memberId ?? otherMentor.sub, active: true },
      )),
    };
    hours = { recordMentorshipSession: jest.fn().mockResolvedValue({ id: 'hour-1' }) };
    emailService = { sendTemplate: jest.fn().mockResolvedValue({ status: 'sent' }) };
    service = new SessionsService(sessionRepo as any, profileRepo as any, hours as any, emailService as any);
  });

  it('confirms only with an HTTPS meet link and notifies', async () => {
    await expect(service.confirm('session-1', 'http://insecure.test', mentorActor)).rejects.toThrow(BadRequestException);

    const confirmed = await service.confirm('session-1', 'https://meet.example.test/session', mentorActor);
    expect(confirmed.status).toBe(MentorshipSessionStatus.CONFIRMED);
    expect(emailService.sendTemplate).toHaveBeenCalledWith(
      'mentorship-confirmed',
      session.menteeEmail,
      expect.objectContaining({ meetLink: 'https://meet.example.test/session' }),
      expect.objectContaining({ registrationId: 'session-1' }),
    );
  });

  it('persists confirmation even when the email renderer fails', async () => {
    emailService.sendTemplate.mockRejectedValue(new Error('template unavailable'));

    await expect(service.confirm('session-1', 'https://meet.example.test/session', mentorActor))
      .resolves.toMatchObject({ status: MentorshipSessionStatus.CONFIRMED });
    expect(sessionRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      status: MentorshipSessionStatus.CONFIRMED,
    }));
  });

  it('rejects completion by another mentor and before the scheduled time', async () => {
    await expect(service.complete('session-1', otherMentor)).rejects.toThrow(ForbiddenException);
    sessionRepo.findOneBy.mockResolvedValue({ ...session, status: MentorshipSessionStatus.CONFIRMED, scheduledAt: new Date(Date.now() + 60_000) });
    await expect(service.complete('session-1', mentorActor)).rejects.toThrow(ConflictException);
  });

  it('completes once and credits hours only once', async () => {
    sessionRepo.findOneBy.mockResolvedValue({ ...session, status: MentorshipSessionStatus.CONFIRMED });
    const completed = await service.complete('session-1', mentorActor);
    expect(completed.status).toBe(MentorshipSessionStatus.COMPLETED);
    expect(hours.recordMentorshipSession).toHaveBeenCalledWith(expect.objectContaining({ id: 'session-1', durationMin: 60 }));

    sessionRepo.findOneBy.mockResolvedValue({ ...session, status: MentorshipSessionStatus.COMPLETED });
    await expect(service.complete('session-1', mentorActor)).rejects.toThrow(ConflictException);
    expect(hours.recordMentorshipSession).toHaveBeenCalledTimes(1);
  });

  it('cancels with a reason and allows no-show without hours', async () => {
    const canceled = await service.cancel('session-1', 'Conflito de agenda', mentorActor);
    expect(canceled).toMatchObject({ status: MentorshipSessionStatus.CANCELED, cancelReason: 'Conflito de agenda' });

    sessionRepo.findOneBy.mockResolvedValue({ ...session, status: MentorshipSessionStatus.CONFIRMED });
    const noShow = await service.noShow('session-1', mentorActor);
    expect(noShow.status).toBe(MentorshipSessionStatus.NO_SHOW);
    expect(hours.recordMentorshipSession).not.toHaveBeenCalled();
  });

  it('persists cancellation even when the email renderer fails', async () => {
    emailService.sendTemplate.mockRejectedValue(new Error('template unavailable'));

    await expect(service.cancel('session-1', 'Conflito de agenda', mentorActor))
      .resolves.toMatchObject({ status: MentorshipSessionStatus.CANCELED });
    expect(sessionRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      status: MentorshipSessionStatus.CANCELED,
    }));
  });

  it('rates a completed session by token', async () => {
    sessionRepo.findOneBy.mockResolvedValue({ ...session, status: MentorshipSessionStatus.COMPLETED });
    const rated = await service.rate('token-1', 5, 'Ótima sessão');
    expect(rated).toMatchObject({ rating: 5, feedback: 'Ótima sessão' });
  });

  it('cancels a guest session by token without exposing actor ids', async () => {
    const persisted = { ...session };
    sessionRepo.findOneBy.mockResolvedValue(persisted);

    const canceled = await service.cancelByToken('token-1', 'Mudança de agenda');

    expect(canceled.status).toBe(MentorshipSessionStatus.CANCELED);
    expect(canceled).not.toHaveProperty('mentorId');
    expect(canceled).not.toHaveProperty('menteeMemberId');
  });

  it('allows an admin to complete and credits the session mentor', async () => {
    const admin = { ...otherMentor, roles: [MemberRole.ADMIN] };
    sessionRepo.findOneBy.mockResolvedValue({ ...session, status: MentorshipSessionStatus.CONFIRMED });

    await service.complete('session-1', admin);

    expect(hours.recordMentorshipSession).toHaveBeenCalledWith(
      expect.objectContaining({ mentorId: mentorActor.sub }),
    );
  });

  it('sends the confirmed meet link in the day-before reminder', async () => {
    sessionRepo.find.mockResolvedValue([{
      ...session,
      status: MentorshipSessionStatus.CONFIRMED,
      meetLink: 'https://meet.example.test/session',
    }]);

    await service.sendDayBeforeReminders();

    expect(emailService.sendTemplate).toHaveBeenCalledWith(
      'mentorship-reminder-d1',
      session.menteeEmail,
      expect.objectContaining({ meetLink: 'https://meet.example.test/session' }),
      expect.objectContaining({ registrationId: session.id }),
    );
  });

  it('anonymizes only expired guests without a linked member', async () => {
    sessionRepo.find.mockResolvedValue([{ ...session, menteeMemberId: null }]);

    await service.anonymizeExpiredGuests();

    expect(sessionRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      id: session.id,
      menteeName: 'Participante anonimizado',
      menteeEmail: `anon-${session.id}@anon.invalid`,
    }));
  });
});

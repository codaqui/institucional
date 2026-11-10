import { ConflictException } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import type { JwtPayload } from '../auth/jwt.strategy';
import { MentorAvailability } from './entities/mentor-availability.entity';
import { MentorshipSession } from './entities/mentorship-session.entity';

const mentorActor: JwtPayload = {
  sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', githubId: '1', handle: 'ana', name: 'Ana', email: 'ana@example.test', avatarUrl: '', roles: ['mentor'],
};
const nextMonday = () => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + ((8 - date.getUTCDay()) % 7 || 7));
  date.setUTCHours(22, 0, 0, 0);
  return date.toISOString().slice(0, 16);
};

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let availabilityRepo: Record<string, jest.Mock>;
  let sessionRepo: Record<string, jest.Mock>;
  let profileRepo: Record<string, jest.Mock>;
  let emailService: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    availabilityRepo = {
      findOneBy: jest.fn().mockResolvedValue({ id: 'availability-1', weekday: 1, startTime: '19:00', endTime: '20:00', timeZone: 'America/Sao_Paulo' }),
      findOne: jest.fn().mockResolvedValue({ id: 'availability-1', weekday: 1, startTime: '19:00', endTime: '20:00', timeZone: 'America/Sao_Paulo' }),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    sessionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve({ id: 'session-1', ...value })),
      manager: {
        transaction: jest.fn((callback) => callback({
          getRepository: (entity: unknown) => entity === MentorAvailability ? availabilityRepo : sessionRepo,
        })),
      },
    };
    profileRepo = { findOneBy: jest.fn().mockResolvedValue({ id: 'mentor-1', memberId: mentorActor.sub, active: true }) };
    memberRepo = { findOneBy: jest.fn().mockResolvedValue({ id: mentorActor.sub, email: 'mentor@example.test' }) };
    emailService = { sendTemplate: jest.fn().mockResolvedValue({ status: 'sent' }) };
    service = new AvailabilityService(availabilityRepo as any, sessionRepo as any, profileRepo as any, emailService as any, memberRepo as any);
  });

  it('rejects invalid rules and overlaps only between the replacement rules', async () => {
    await expect(service.replaceAvailability(1, [{ startTime: '20:00', endTime: '19:00', timeZone: 'America/Sao_Paulo' }], mentorActor))
      .rejects.toThrow(ConflictException);
    await expect(service.replaceAvailability(1, [
      { startTime: '19:00', endTime: '20:00', timeZone: 'America/Sao_Paulo' },
      { startTime: '19:30', endTime: '20:30', timeZone: 'America/Sao_Paulo' },
    ], mentorActor)).rejects.toThrow(ConflictException);
  });

  it('allows a replacement that overlaps the previous persisted rule', async () => {
    availabilityRepo.find.mockResolvedValue([{ startTime: '19:30', endTime: '20:30' }]);

    await expect(service.replaceAvailability(1, [{ startTime: '19:00', endTime: '20:00', timeZone: 'America/Sao_Paulo' }], mentorActor))
      .resolves.toEqual([expect.objectContaining({ startTime: '19:00', endTime: '20:00' })]);
    expect(availabilityRepo.delete).toHaveBeenCalledWith({ mentorId: 'mentor-1', weekday: 1 });
  });

  it('locks the rule, saves and notifies both participants before rejecting a conflict without email', async () => {
    const scheduledAt = nextMonday();
    const input = {
      mentorId: 'mentor-1', scheduledAt, durationMin: 60,
      menteeName: 'Ana', menteeEmail: 'ana@example.test', topicTags: ['DevOps'], guestConsentAt: new Date(),
    };

    await expect(service.reserveSlot(input)).resolves.toMatchObject({ status: 'requested', scheduledAt: new Date(`${scheduledAt}:00-03:00`) });
    expect(availabilityRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({
      lock: { mode: 'pessimistic_write' },
    }));
    expect(emailService.sendTemplate).toHaveBeenCalledTimes(2);
    expect(emailService.sendTemplate).toHaveBeenCalledWith(
      'mentorship-requested',
      'ana@example.test',
      expect.objectContaining({ attendeeName: 'Ana' }),
      expect.objectContaining({ registrationId: 'session-1' }),
    );
    expect(emailService.sendTemplate).toHaveBeenCalledWith(
      'mentorship-requested',
      'mentor@example.test',
      expect.objectContaining({ attendeeName: 'Ana' }),
      expect.objectContaining({ registrationId: 'session-1' }),
    );

    emailService.sendTemplate.mockClear();
    sessionRepo.findOne.mockResolvedValue({ id: 'existing-session' });
    await expect(service.reserveSlot(input)).rejects.toThrow(ConflictException);
    expect(emailService.sendTemplate).not.toHaveBeenCalled();
  });

  it('uses the availability rule timezone instead of a fixed timezone', async () => {
    const scheduledAt = nextMonday();
    availabilityRepo.findOne.mockResolvedValue({
      id: 'availability-1', weekday: 1, startTime: '19:00', endTime: '20:00', timeZone: 'UTC',
    });

    const reserved = await service.reserveSlot({
      mentorId: 'mentor-1', scheduledAt, durationMin: 60,
      menteeName: 'Ana', menteeEmail: 'ana@example.test', topicTags: ['DevOps'], guestConsentAt: new Date(),
    });

    expect(reserved.scheduledAt).toEqual(new Date(`${scheduledAt}:00Z`));
    expect(reserved.timeZone).toBe('UTC');
  });

  it('derives the weekday in the rule timezone across a day boundary', async () => {
    availabilityRepo.find.mockResolvedValue([{
      id: 'availability-1', mentorId: 'mentor-1', weekday: 1,
      startTime: '19:00', endTime: '20:00', timeZone: 'Pacific/Kiritimati',
    }]);

    const slots = await service.listAvailability('mentor-1', new Date('2026-11-15T23:30:00Z'));

    expect(slots).toContainEqual({
      scheduledAt: '2026-11-16T19:00', durationMin: 60, timeZone: 'Pacific/Kiritimati',
    });
  });

  it('rejects a slot outside the weekly availability', async () => {
    const scheduledAt = nextMonday();
    availabilityRepo.findOne.mockResolvedValue(null);
    await expect(service.reserveSlot({
      mentorId: 'mentor-1', scheduledAt, durationMin: 60,
      menteeName: 'Ana', menteeEmail: 'ana@example.test', topicTags: ['DevOps'], guestConsentAt: new Date(),
    })).rejects.toThrow(ConflictException);
  });
});

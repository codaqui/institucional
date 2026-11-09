import { ConflictException } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import type { JwtPayload } from '../auth/jwt.strategy';

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

  beforeEach(() => {
    availabilityRepo = {
      findOneBy: jest.fn().mockResolvedValue({ id: 'availability-1', weekday: 1, startTime: '19:00', endTime: '20:00', timeZone: 'America/Sao_Paulo' }),
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
        transaction: jest.fn((callback) => callback({ getRepository: () => ({ ...sessionRepo, ...availabilityRepo }) })),
      },
    };
    profileRepo = { findOneBy: jest.fn().mockResolvedValue({ id: 'mentor-1', memberId: mentorActor.sub, active: true }) };
    emailService = { sendTemplate: jest.fn().mockResolvedValue({ status: 'sent' }) };
    service = new AvailabilityService(availabilityRepo as any, sessionRepo as any, profileRepo as any, emailService as any);
  });

  it('rejects invalid and overlapping availability rules', async () => {
    await expect(service.replaceAvailability(1, [{ startTime: '20:00', endTime: '19:00', timeZone: 'America/Sao_Paulo' }], mentorActor))
      .rejects.toThrow(ConflictException);
    availabilityRepo.find.mockResolvedValue([{ startTime: '19:30', endTime: '20:30' }]);
    await expect(service.replaceAvailability(1, [{ startTime: '19:00', endTime: '20:00', timeZone: 'America/Sao_Paulo' }], mentorActor))
      .rejects.toThrow(ConflictException);
  });

  it('reserves a real slot and rejects a second overlapping reservation without email', async () => {
    const scheduledAt = nextMonday();
    const input = {
      mentorId: 'mentor-1', scheduledAt, durationMin: 60,
      menteeName: 'Ana', menteeEmail: 'ana@example.test', topicTags: ['DevOps'], guestConsentAt: new Date(),
    };

    await expect(service.reserveSlot(input)).resolves.toMatchObject({ status: 'requested', scheduledAt: new Date(scheduledAt) });
    sessionRepo.findOne.mockResolvedValue({ id: 'existing-session' });
    await expect(service.reserveSlot(input)).rejects.toThrow(ConflictException);
    expect(emailService.sendTemplate).not.toHaveBeenCalled();
  });

  it('rejects a slot outside the weekly availability', async () => {
    const scheduledAt = nextMonday();
    availabilityRepo.findOneBy.mockResolvedValue(null);
    await expect(service.reserveSlot({
      mentorId: 'mentor-1', scheduledAt, durationMin: 60,
      menteeName: 'Ana', menteeEmail: 'ana@example.test', topicTags: ['DevOps'], guestConsentAt: new Date(),
    })).rejects.toThrow(ConflictException);
  });
});

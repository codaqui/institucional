import { ArgumentMetadata, BadRequestException, ParseArrayPipe } from '@nestjs/common';
import { MentorshipController } from './mentorship.controller';
import { AvailabilityRuleDto } from './dto/mentorship.dto';
import { MemberRole } from '../members/entities/member.entity';
import type { JwtPayload } from '../auth/jwt.strategy';

const admin = {
  sub: 'admin-1', githubId: '1', handle: 'admin', name: 'Admin',
  email: 'admin@example.test', avatarUrl: '', roles: [MemberRole.ADMIN],
} as JwtPayload;

describe('MentorshipController sessions', () => {
  const mentorship = {
    listMentors: jest.fn(),
    updateMentor: jest.fn(),
  };
  const availability = {};
  const sessions = {
    cancel: jest.fn(),
    cancelByToken: jest.fn(),
    listForAdmin: jest.fn(),
  };
  const controller = new MentorshipController(mentorship as any, availability as any, sessions as any);

  beforeEach(() => jest.clearAllMocks());

  it('scopes authenticated cancellation by session id', async () => {
    await controller.cancel('session-1', { reason: 'Conflito' }, { user: admin });

    expect(sessions.cancel).toHaveBeenCalledWith('session-1', 'Conflito', admin);
    expect(sessions.cancelByToken).not.toHaveBeenCalled();
  });

  it('cancels an anonymous guest by token', async () => {
    await controller.cancel('token-1', { reason: 'Conflito' }, { user: null });

    expect(sessions.cancelByToken).toHaveBeenCalledWith('token-1', 'Conflito');
    expect(sessions.cancel).not.toHaveBeenCalled();
  });

  it('passes pagination to the admin session listing', async () => {
    await controller.listAdminSessions({ page: 2, limit: 25 }, { user: admin });

    expect(sessions.listForAdmin).toHaveBeenCalledWith(admin, 2, 25);
  });
});

describe('MentorshipController availability', () => {
  const mentorship = {};
  const availability = {
    listMyAvailability: jest.fn(),
    replaceAvailability: jest.fn(),
  };
  const sessions = {};
  const controller = new MentorshipController(mentorship as any, availability as any, sessions as any);
  const mentor = {
    sub: 'mentor-1', githubId: '2', handle: 'mentor', name: 'Mentor',
    email: 'mentor@example.test', avatarUrl: '', roles: [MemberRole.MENTOR],
  } as JwtPayload;

  beforeEach(() => jest.clearAllMocks());

  it('declares the authenticated availability/mine route before the public listing', () => {
    const methods = Object.getOwnPropertyNames(MentorshipController.prototype);

    expect(methods.indexOf('listMyAvailability')).toBeGreaterThan(-1);
    expect(methods.indexOf('listMyAvailability')).toBeLessThan(methods.indexOf('listAvailability'));
  });

  it('lists the signed-in mentor rules through the availability service', async () => {
    availability.listMyAvailability.mockResolvedValue([
      { weekday: 1, startTime: '19:00', endTime: '20:00', timeZone: 'America/Sao_Paulo' },
    ]);

    await controller.listMyAvailability({ user: mentor });

    expect(availability.listMyAvailability).toHaveBeenCalledWith(mentor);
  });

  it('passes the weekday and the parsed rules to the replace use case', async () => {
    const rules = [{ startTime: '19:00', endTime: '20:00', timeZone: 'America/Sao_Paulo' }];

    await controller.replaceAvailability(1, rules, { user: mentor });

    expect(availability.replaceAvailability).toHaveBeenCalledWith(1, rules, mentor);
  });
});

describe('AvailabilityRuleDto contracts', () => {
  const metadata: ArgumentMetadata = { type: 'body' };
  const pipe = new ParseArrayPipe({
    items: AvailabilityRuleDto,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  it('accepts valid availability windows', async () => {
    await expect(pipe.transform([
      { startTime: '19:00', endTime: '20:00', timeZone: 'America/Sao_Paulo' },
    ], metadata)).resolves.toEqual([
      expect.objectContaining({ startTime: '19:00', endTime: '20:00', timeZone: 'America/Sao_Paulo' }),
    ]);
  });

  it.each([
    [{ startTime: '25:00', endTime: '20:00' }],
    [{ startTime: '19:00', endTime: '9:00' }],
    [{ startTime: '19:00', endTime: '20:00', timeZone: 'America/Inexistente' }],
    [{ startTime: '19:00', endTime: '20:00', timeZone: 'GMT-3' }],
    [{ startTime: '19:00', endTime: '20:00', extraField: 'x' }],
    '19:00,20:00',
  ])('rejects invalid availability payloads: %j', async (payload: unknown) => {
    await expect(pipe.transform(payload, metadata)).rejects.toThrow(BadRequestException);
  });
});

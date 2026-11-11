import { MentorshipController } from './mentorship.controller';
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

import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, JwtPayload } from './jwt.strategy';
import { MembersService } from '../members/members.service';
import { MemberRole } from '../members/entities/member.entity';

describe('JwtStrategy', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;

  const makeMembersService = (findOne: jest.Mock) =>
    ({ findOne }) as unknown as MembersService;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  describe('constructor', () => {
    it('instantiates with the configured secret', () => {
      process.env.NODE_ENV = 'test';
      process.env.JWT_SECRET = 'super-secret';
      expect(
        () => new JwtStrategy(makeMembersService(jest.fn())),
      ).not.toThrow();
    });

    it('falls back to the dev secret outside production', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.JWT_SECRET;
      expect(
        () => new JwtStrategy(makeMembersService(jest.fn())),
      ).not.toThrow();
    });

    it('throws in production when JWT_SECRET is missing', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      expect(() => new JwtStrategy(makeMembersService(jest.fn()))).toThrow(
        'JWT_SECRET is required in production',
      );
    });
  });

  describe('validate', () => {
    const payload: JwtPayload = {
      sub: 'member-uuid-1',
      githubId: '12345',
      handle: 'octocat',
      name: 'Octo Cat',
      email: 'octo@cat.dev',
      avatarUrl: 'https://avatars/octocat',
      roles: [MemberRole.MEMBRO],
    };

    it('returns the payload with fresh roles from the database', async () => {
      const findOne = jest.fn().mockResolvedValue({
        id: 'member-uuid-1',
        roles: [MemberRole.MEMBRO, MemberRole.ADMIN],
      });
      const strategy = new JwtStrategy(makeMembersService(findOne));

      const result = await strategy.validate(payload);

      expect(findOne).toHaveBeenCalledWith('member-uuid-1');
      expect(result).toEqual({
        ...payload,
        roles: [MemberRole.MEMBRO, MemberRole.ADMIN],
      });
    });

    it('throws UnauthorizedException when the member no longer exists', async () => {
      const findOne = jest.fn().mockResolvedValue(null);
      const strategy = new JwtStrategy(makeMembersService(findOne));

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});

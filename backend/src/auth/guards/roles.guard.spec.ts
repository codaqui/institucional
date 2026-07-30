import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { MemberRole } from '../../members/entities/member.entity';
import type { JwtPayload } from '../jwt.strategy';

const buildContext = (user?: Partial<JwtPayload>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows access when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(buildContext())).toBe(true);
  });

  it('throws UnauthorizedException when there is no user', () => {
    reflector.getAllAndOverride.mockReturnValue([MemberRole.ADMIN]);
    expect(() => guard.canActivate(buildContext())).toThrow(
      UnauthorizedException,
    );
  });

  it('allows member with accumulated roles matching the required role', () => {
    reflector.getAllAndOverride.mockReturnValue([MemberRole.EVENT_CHECKER]);
    const user: Partial<JwtPayload> = {
      sub: 'member-1',
      roles: [MemberRole.MEMBRO, MemberRole.EVENT_CHECKER],
    };
    expect(guard.canActivate(buildContext(user))).toBe(true);
  });

  it('rejects member without intersection with the required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([MemberRole.ADMIN]);
    const user: Partial<JwtPayload> = {
      sub: 'member-1',
      roles: [MemberRole.MEMBRO, MemberRole.EVENT_CHECKER],
    };
    expect(() => guard.canActivate(buildContext(user))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects when the user has no roles at all', () => {
    reflector.getAllAndOverride.mockReturnValue([MemberRole.ADMIN]);
    const user = { sub: 'member-1' } as Partial<JwtPayload>;
    expect(() => guard.canActivate(buildContext(user))).toThrow(
      ForbiddenException,
    );
  });
});

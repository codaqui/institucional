import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { validate } from 'class-validator';
import { Test, TestingModule } from '@nestjs/testing';
import type { JwtPayload } from '../auth/jwt.strategy';
import {
  DesignationsController,
  GrantDesignationDto,
} from './designations.controller';
import { Designations } from './designations.decorator';
import { DesignationsGuard } from './designations.guard';
import { DesignationsService } from './designations.service';

const adminRequest = {
  user: {
    sub: 'admin-1',
    handle: 'admin',
    roles: ['admin'],
  } as JwtPayload,
};

class ScopedController {
  @Designations({
    targetType: 'community',
    targetIdParam: 'id',
    designation: 'responsible',
  })
  update() {}
}

function guardContext(user?: Partial<JwtPayload>): ExecutionContext {
  return {
    getHandler: () => ScopedController.prototype.update,
    getClass: () => ScopedController,
    switchToHttp: () => ({
      getRequest: () => ({ user, params: { id: 'community-1' } }),
    }),
  } as unknown as ExecutionContext;
}

describe('DesignationsController', () => {
  let controller: DesignationsController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      listActive: jest.fn(),
      grant: jest.fn(),
      confirm: jest.fn(),
      revoke: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DesignationsController],
      providers: [{ provide: DesignationsService, useValue: service }],
    }).compile();
    controller = module.get(DesignationsController);
  });

  it('lists active designations for the authenticated member', async () => {
    const designations = [{ id: 'designation-1', status: 'active' }];
    service.listActive.mockResolvedValue(designations);

    await expect(controller.getMyDesignations(adminRequest)).resolves.toBe(
      designations,
    );
    expect(service.listActive).toHaveBeenCalledWith('admin-1');
  });

  it('grants a designation using the authenticated admin as actor and appointer', async () => {
    const body: GrantDesignationDto = {
      memberId: 'member-1',
      targetType: 'community',
      targetId: 'community-1',
      designation: 'responsible',
      status: 'pending',
    };
    service.grant.mockImplementation(async (input) => input);

    await controller.grant(adminRequest, body);

    expect(service.grant).toHaveBeenCalledWith(
      { ...body, appointedById: 'admin-1' },
      { actorId: 'admin-1', actorHandle: 'admin' },
    );
  });

  it.each([
    {
      name: 'director without a directorate',
      value: { targetType: 'directorate', designation: 'director' },
    },
    {
      name: 'designation that does not belong to the target',
      value: {
        targetType: 'community',
        targetId: 'a9e2ac1f-0a70-4f1f-a4aa-c9756b2f7901',
        designation: 'director',
      },
    },
    {
      name: 'both target id and wildcard key',
      value: {
        targetType: 'event',
        targetId: 'a9e2ac1f-0a70-4f1f-a4aa-c9756b2f7901',
        targetKey: 'meetup:devpr',
        designation: 'organizer',
      },
    },
  ])('rejects $name in the DTO', async ({ value }) => {
    const dto = Object.assign(new GrantDesignationDto(), {
      memberId: 'f5f7a67c-b0b1-487f-b45d-f189e1dc65cf',
      ...value,
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });

  it.each([
    {
      targetType: 'program',
      targetKey: 'mentoria',
      designation: 'mentor',
    },
    {
      targetType: 'event',
      targetKey: 'meetup:devpr',
      designation: 'organizer',
    },
  ])('accepts valid program and wildcard DTO shapes', async (value) => {
    const dto = Object.assign(new GrantDesignationDto(), {
      memberId: 'f5f7a67c-b0b1-487f-b45d-f189e1dc65cf',
      ...value,
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('confirms and revokes designations as the authenticated admin', async () => {
    await controller.confirm('designation-1', adminRequest);
    await controller.revoke('designation-1', adminRequest);

    const actor = { actorId: 'admin-1', actorHandle: 'admin' };
    expect(service.confirm).toHaveBeenCalledWith('designation-1', actor);
    expect(service.revoke).toHaveBeenCalledWith('designation-1', actor);
  });
});

describe('DesignationsGuard', () => {
  let guard: DesignationsGuard;
  let service: { hasDesignation: jest.Mock };

  beforeEach(() => {
    service = { hasDesignation: jest.fn() };
    guard = new DesignationsGuard(new Reflector(), service as any);
  });

  it('allows admins without requiring a scoped designation', async () => {
    await expect(
      guard.canActivate(guardContext({ sub: 'admin-1', roles: ['admin'] })),
    ).resolves.toBe(true);
    expect(service.hasDesignation).not.toHaveBeenCalled();
  });

  it('checks the designation against the target id from route params', async () => {
    service.hasDesignation.mockResolvedValue(true);

    await expect(
      guard.canActivate(guardContext({ sub: 'member-1', roles: ['membro'] })),
    ).resolves.toBe(true);
    expect(service.hasDesignation).toHaveBeenCalledWith('member-1', {
      targetType: 'community',
      targetId: 'community-1',
      designation: 'responsible',
    });
  });

  it('rejects a member without the required designation', async () => {
    service.hasDesignation.mockResolvedValue(false);

    await expect(
      guard.canActivate(guardContext({ sub: 'member-1', roles: ['membro'] })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('requires an authenticated user', async () => {
    await expect(guard.canActivate(guardContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

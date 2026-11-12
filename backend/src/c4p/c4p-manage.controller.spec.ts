import { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { C4pCallsService } from './c4p-calls.service';
import { C4pDashboardService } from './c4p-dashboard.service';
import { C4pEvaluatorsService } from './c4p-evaluators.service';
import { C4pManageController } from './c4p-manage.controller';
import { C4pTalksService } from './c4p-talks.service';

const jwtUser = (roles: string[]) => ({
  sub: 'user-1',
  githubId: 1,
  handle: 'user',
  name: 'User',
  email: 'user@example.com',
  avatarUrl: null,
  roles,
});

describe('C4pManageController', () => {
  let controller: C4pManageController;
  let calls: Record<string, jest.Mock>;
  let talks: Record<string, jest.Mock>;
  let evaluators: Record<string, jest.Mock>;
  let dashboard: Record<string, jest.Mock>;
  let currentUser: ReturnType<typeof jwtUser>;

  const buildModule = async () => {
    const module = await Test.createTestingModule({
      controllers: [C4pManageController],
      providers: [
        { provide: C4pCallsService, useValue: calls },
        { provide: C4pTalksService, useValue: talks },
        { provide: C4pEvaluatorsService, useValue: evaluators },
        { provide: C4pDashboardService, useValue: dashboard },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = currentUser;
          return true;
        },
      })
      .compile();
    return module.get(C4pManageController);
  };

  beforeEach(() => {
    calls = {
      create: jest.fn().mockResolvedValue({ id: 'call-1' }),
      finalize: jest.fn().mockResolvedValue({ id: 'call-1', status: 'closed' }),
      reopen: jest.fn().mockResolvedValue({ id: 'call-1', status: 'open' }),
      listManage: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    };
    talks = {};
    evaluators = {};
    dashboard = {};
    currentUser = jwtUser(['admin']);
  });

  it('POST calls repassa o actor ao service', async () => {
    controller = await buildModule();
    await controller.create({ slug: 's', name: 'Nome' }, { user: currentUser });
    expect(calls.create).toHaveBeenCalledWith(
      { slug: 's', name: 'Nome' },
      currentUser,
    );
  });

  it('finalize e reopen exigem role admin (metadata de roles no handler)', async () => {
    controller = await buildModule();
    expect(Reflect.getMetadata('roles', controller.finalize)).toEqual(['admin']);
    expect(Reflect.getMetadata('roles', controller.reopen)).toEqual(['admin']);
    expect(Reflect.getMetadata('roles', controller.create)).toBeUndefined();
  });

  it('finalize permite admin e repassa ao service', async () => {
    controller = await buildModule();
    await controller.finalize(
      'call-1',
      { talkIds: ['t1'] },
      { user: currentUser },
    );
    expect(calls.finalize).toHaveBeenCalledWith(
      'call-1',
      ['t1'],
      currentUser,
    );
  });

  it('reopen repassa ao service para admin', async () => {
    controller = await buildModule();
    await controller.reopen('call-1', { user: currentUser });
    expect(calls.reopen).toHaveBeenCalledWith('call-1', currentUser);
  });
});

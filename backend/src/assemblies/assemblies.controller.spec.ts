import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AssembliesController } from './assemblies.controller';
import type { AssembliesService } from './assemblies.service';
import {
  CreateAssemblyDto,
  ListAssembliesDto,
  UpdateAssemblyDto,
} from './dto/assembly.dto';

const actor = {
  sub: 'director-1',
  handle: 'diretor',
  roles: ['diretor'],
} as JwtPayload;

function guardContext(
  handler: unknown,
  user?: Partial<JwtPayload>,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => AssembliesController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('AssembliesController', () => {
  let controller: AssembliesController;
  let service: Record<string, jest.Mock>;

  beforeEach(() => {
    service = {
      listPublic: jest.fn().mockResolvedValue([]),
      publicBySlug: jest.fn().mockResolvedValue({ slug: 'ordinaria-1' }),
      listManage: jest.fn().mockResolvedValue({ data: [] }),
      create: jest.fn().mockResolvedValue({ id: 'assembly-1' }),
      update: jest.fn().mockResolvedValue({ id: 'assembly-1' }),
    };
    controller = new AssembliesController(
      service as unknown as AssembliesService,
    );
  });

  it('delegates public collection and detail without an actor', async () => {
    await controller.listPublic();
    await controller.publicBySlug('ordinaria-1');

    expect(service.listPublic).toHaveBeenCalledWith();
    expect(service.publicBySlug).toHaveBeenCalledWith('ordinaria-1');
  });

  it('delegates filters and mutations with their authenticated actor', async () => {
    const query = { page: 2, limit: 25, status: 'scheduled' } as const;
    const create = { title: 'Nova assembleia' } as CreateAssemblyDto;
    const patch = { title: 'Título editado' } as UpdateAssemblyDto;

    await controller.listManage(query);
    await controller.create(create, { user: actor });
    await controller.update('assembly-1', patch, { user: actor });

    expect(service.listManage).toHaveBeenCalledWith(query);
    expect(service.create).toHaveBeenCalledWith(create, actor);
    expect(service.update).toHaveBeenCalledWith('assembly-1', patch, actor);
  });

  it('protects management routes from a plain member using the real roles guard', () => {
    const guard = new RolesGuard(new Reflector());
    const context = guardContext(
      // eslint-disable-next-line @typescript-eslint/unbound-method
      AssembliesController.prototype.listManage,
      { roles: ['membro'] } as JwtPayload,
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows directors through the management roles guard', () => {
    const guard = new RolesGuard(new Reflector());
    const context = guardContext(
      // eslint-disable-next-line @typescript-eslint/unbound-method
      AssembliesController.prototype.listManage,
      actor,
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('accepts valid management filters and pagination', async () => {
    const query = plainToInstance(ListAssembliesDto, {
      page: '2',
      limit: '100',
      type: 'oficial',
      status: 'held',
    });

    expect(await validate(query)).toHaveLength(0);
    expect(query).toMatchObject({
      page: 2,
      limit: 100,
      type: 'oficial',
      status: 'held',
    });
  });

  it.each([
    { page: 0 },
    { limit: 101 },
    { type: 'extraordinaria' },
    { status: 'draft' },
  ])('rejects invalid management query %p', async (value) => {
    const query = plainToInstance(ListAssembliesDto, value);

    expect(await validate(query)).not.toHaveLength(0);
  });
});

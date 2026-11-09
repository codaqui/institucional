import { ProjectsController } from './projects.controller';

describe('ProjectsController', () => {
  it('delegates public and administrative reads and writes', async () => {
    const service = {
      listPublic: jest.fn(), publicBySlug: jest.fn(), listManage: jest.fn(), create: jest.fn(), update: jest.fn(),
    } as any;
    const controller = new ProjectsController(service);
    const actor = { sub: 'director-1', handle: 'director', roles: ['diretor'] } as any;

    await controller.listPublic();
    await controller.publicBySlug('projeto');
    await controller.listManage({ page: 1, limit: 10 } as any, { user: actor });
    await controller.create({ name: 'Projeto', entityId: 'entity-1' } as any, { user: actor });
    await controller.update('project-1', { summary: 'Novo' } as any, { user: actor });

    expect(service.listPublic).toHaveBeenCalled();
    expect(service.publicBySlug).toHaveBeenCalledWith('projeto');
    expect(service.listManage).toHaveBeenCalledWith({ page: 1, limit: 10 }, actor);
    expect(service.create).toHaveBeenCalledWith(expect.any(Object), actor);
    expect(service.update).toHaveBeenCalledWith('project-1', { summary: 'Novo' }, actor);
  });
});

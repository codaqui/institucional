import { EntitiesController } from './entities.controller';
import { PartnershipsController } from './partnerships.controller';

describe('entities controllers', () => {
  it('delegates entity reads and writes', async () => {
    const service = {
      listPublic: jest.fn(),
      listManage: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      listPartnerships: jest.fn(),
      createPartnership: jest.fn(),
    } as any;
    const controller = new EntitiesController(service);
    const actor = { sub: 'admin-1', handle: 'admin', roles: ['admin'] } as any;

    await controller.create(baseEntity(), { user: actor });
    await controller.listManage({ page: 2, limit: 10 } as any, { user: actor });
    await controller.createPartnership('entity-1', { kind: 'pontual', startedAt: '2026-01-01' } as any, { user: actor });

    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Entidade' }), actor);
    expect(service.listManage).toHaveBeenCalledWith({ page: 2, limit: 10 }, actor);
    expect(service.createPartnership).toHaveBeenCalledWith('entity-1', expect.any(Object), actor);
  });

  it('delegates partnership updates to the dedicated controller', async () => {
    const service = { updatePartnership: jest.fn() } as any;
    const controller = new PartnershipsController(service);
    const actor = { sub: 'admin-1', handle: 'admin', roles: ['admin'] } as any;

    await controller.update('partnership-1', { status: 'ended', endsAt: '2026-02-01' }, { user: actor });

    expect(service.updatePartnership).toHaveBeenCalledWith('partnership-1', { status: 'ended', endsAt: '2026-02-01' }, actor);
  });
});

function baseEntity() {
  return { name: 'Entidade', type: 'ong' } as any;
}

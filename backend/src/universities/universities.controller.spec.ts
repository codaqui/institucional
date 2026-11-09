import { UniversitiesController } from './universities.controller';
import type { JwtPayload } from '../auth/jwt.strategy';

const actor = { sub: 'admin-1', handle: 'admin', roles: ['admin'] } as JwtPayload;

describe('UniversitiesController', () => {
  it('delegates city and institution mutations to the service', async () => {
    const service = {
      createCity: jest.fn().mockResolvedValue({ id: 'city-1' }),
      updateCity: jest.fn().mockResolvedValue({ id: 'city-1' }),
      createInstitution: jest.fn().mockResolvedValue({ id: 'ies-1' }),
      updateInstitution: jest.fn().mockResolvedValue({ id: 'ies-1' }),
    };
    const controller = new UniversitiesController(service as any);

    await controller.createCity({ name: 'Maringá', uf: 'PR' }, { user: actor });
    await controller.updateCity('city-1', { uf: 'SP' }, { user: actor });
    await controller.createInstitution({ name: 'IES Exemplo', cityId: 'city-1' }, { user: actor });
    await controller.updateInstitution('ies-1', { cityId: 'city-2' }, { user: actor });

    expect(service.createCity).toHaveBeenCalledWith({ name: 'Maringá', uf: 'PR' }, actor);
    expect(service.updateCity).toHaveBeenCalledWith('city-1', { uf: 'SP' }, actor);
    expect(service.createInstitution).toHaveBeenCalledWith({ name: 'IES Exemplo', cityId: 'city-1' }, actor);
    expect(service.updateInstitution).toHaveBeenCalledWith('ies-1', { cityId: 'city-2' }, actor);
  });

  it('delegates ambassador application operations', async () => {
    const service = {
      applyAmbassador: jest.fn().mockResolvedValue({ id: 'application-1' }),
      listApplications: jest.fn().mockResolvedValue([]),
      listMyApplications: jest.fn().mockResolvedValue([]),
      rejectApplication: jest.fn().mockResolvedValue({ id: 'application-1' }),
      confirmApplication: jest.fn().mockResolvedValue({ id: 'application-1' }),
    };
    const controller = new UniversitiesController(service as any);

    await controller.applyAmbassador('ies-1', { applicationNotes: 'Motivação' }, { user: actor });
    await controller.listApplications({ user: actor });
    await controller.listMyApplications({ user: actor });
    await controller.rejectApplication('application-1', { user: actor });
    await controller.confirmApplication('application-1', {}, { user: actor });

    expect(service.applyAmbassador).toHaveBeenCalledWith('ies-1', { applicationNotes: 'Motivação' }, actor);
    expect(service.listApplications).toHaveBeenCalledWith(actor);
    expect(service.listMyApplications).toHaveBeenCalledWith(actor);
    expect(service.rejectApplication).toHaveBeenCalledWith('application-1', actor);
    expect(service.confirmApplication).toHaveBeenCalledWith('application-1', {}, actor);
  });
});

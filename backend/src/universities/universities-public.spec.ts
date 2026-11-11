import { UniversitiesService } from './universities.service';
import type { JwtPayload } from '../auth/jwt.strategy';

const manager = { sub: 'manager-1', roles: ['gestor_universitario'] } as JwtPayload;

describe('UniversitiesService — public snapshot', () => {
  it('projects only public city, IES, ambassador and event fields', async () => {
    const city = { id: 'city-1', name: 'Maringá', uf: 'PR', isActive: true };
    const ies = {
      id: 'ies-1',
      slug: 'ies-exemplo',
      name: 'IES Exemplo',
      type: 'instituicao_ensino',
      website: 'https://ies.example.test',
      cityId: 'city-1',
      isActive: true,
    };
    const member = {
      id: 'member-1',
      name: 'Ana',
      githubHandle: 'ana',
      avatarUrl: 'avatar',
      email: 'ana@example.test',
    };
    const designation = {
      id: 'application-1',
      memberId: member.id,
      targetType: 'ies',
      targetId: ies.id,
      designation: 'ambassador',
      status: 'active',
      applicationNotes: 'motivação privada',
      validUntil: null,
    };
    const event = {
      id: 'event-1',
      slug: 'evento-ies',
      title: 'Evento IES',
      startAt: new Date('2026-11-10T18:00:00Z'),
      status: 'published',
      location: 'Maringá',
      institutionId: ies.id,
    };
    const service = new UniversitiesService(
      { find: jest.fn().mockResolvedValue([city]) } as any,
      { find: jest.fn().mockResolvedValue([ies]) } as any,
      { find: jest.fn().mockResolvedValue([designation]) } as any,
      { findBy: jest.fn().mockResolvedValue([member]) } as any,
      { hasDesignation: jest.fn().mockResolvedValue(true) } as any,
      { log: jest.fn() } as any,
      { find: jest.fn().mockResolvedValue([event]) } as any,
    );

    const payload = await service.getPublic();
    expect(payload.cities).toEqual([city]);
    expect(payload.institutions[0].ambassador).toEqual({
      githubHandle: 'ana',
      name: 'Ana',
      avatarUrl: 'avatar',
      validUntil: null,
    });
    expect(payload.institutions[0]).not.toHaveProperty('applicationNotes');
    expect(payload.institutions[0]).not.toHaveProperty('contactEmail');
    expect(payload.institutions[0]).not.toHaveProperty('isActive');
    expect(payload.institutions[0]).not.toHaveProperty('cityId');
    expect(payload).not.toHaveProperty('applications');
    expect(payload.events).toEqual([{
      id: event.id,
      slug: event.slug,
      title: event.title,
      startAt: event.startAt,
      status: event.status,
      location: event.location,
      institutionId: ies.id,
    }]);
  });

  it('includes inactive records and editing fields only in the management projection', async () => {
    const inactiveCity = { id: 'city-inactive', name: 'Cidade Histórica', uf: 'PR', isActive: false };
    const inactiveIes = {
      id: 'ies-inactive',
      slug: 'ies-inactive',
      name: 'IES Inativa',
      type: 'instituicao_ensino',
      website: null,
      contactEmail: 'contato@ies.example.test',
      cityId: inactiveCity.id,
      isActive: false,
    };
    const cityRepo = { find: jest.fn().mockResolvedValue([inactiveCity]) };
    const institutionRepo = { find: jest.fn().mockResolvedValue([inactiveIes]) };
    const service = new UniversitiesService(
      cityRepo as any,
      institutionRepo as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { findBy: jest.fn().mockResolvedValue([]) } as any,
      { hasDesignation: jest.fn().mockResolvedValue(true) } as any,
      { log: jest.fn() } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
    );

    const payload = await service.getManage(manager);

    expect(cityRepo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
    expect(institutionRepo.find).toHaveBeenCalledWith({
      where: { type: 'instituicao_ensino' },
      order: { name: 'ASC' },
    });
    expect(payload.cities).toEqual([inactiveCity]);
    expect(payload.institutions).toEqual([{
      id: inactiveIes.id,
      slug: inactiveIes.slug,
      name: inactiveIes.name,
      website: null,
      city: { id: inactiveCity.id, name: inactiveCity.name, uf: inactiveCity.uf },
      cityId: inactiveCity.id,
      contactEmail: inactiveIes.contactEmail,
      isActive: false,
      ambassador: null,
    }]);
  });

  it('requires the manager designation for the management projection', async () => {
    const service = new UniversitiesService(
      { find: jest.fn().mockResolvedValue([]) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { findBy: jest.fn().mockResolvedValue([]) } as any,
      { hasDesignation: jest.fn().mockResolvedValue(true) } as any,
      { log: jest.fn() } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
    );

    await expect(service.getManage(manager)).resolves.toMatchObject({
      cities: [],
      institutions: [],
      events: [],
    });
  });
});

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UniversitiesService } from './universities.service';
import type { JwtPayload } from '../auth/jwt.strategy';

const actor = (roles: string[]): JwtPayload => ({
  sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  githubId: '1',
  handle: 'ana',
  name: 'Ana',
  email: 'ana@example.test',
  avatarUrl: '',
  roles,
} as JwtPayload);

const managerActor = actor(['membro', 'gestor_universitario']);
const adminActor = actor(['admin']);
const memberActor = actor(['membro']);

describe('UniversitiesService — cities and institutions', () => {
  let service: UniversitiesService;
  let cityRepo: Record<string, jest.Mock>;
  let institutionRepo: Record<string, jest.Mock>;
  let designations: Record<string, jest.Mock>;
  let audit: Record<string, jest.Mock>;

  beforeEach(() => {
    cityRepo = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve({ id: 'city-1', ...value })),
      findOneBy: jest.fn().mockResolvedValue({ id: 'city-1', name: 'Maringá', uf: 'PR', isActive: true }),
    };
    institutionRepo = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve({ id: 'ies-1', ...value })),
      findOneBy: jest.fn(),
    };
    designations = { hasDesignation: jest.fn().mockResolvedValue(true) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new UniversitiesService(
      cityRepo as any,
      institutionRepo as any,
      designations as any,
      audit as any,
    );
  });

  it('rejects a member without the university manager designation', async () => {
    designations.hasDesignation.mockResolvedValue(false);
    await expect(service.createCity({ name: 'Maringá', uf: 'PR' }, memberActor))
      .rejects.toThrow(ForbiddenException);
    expect(cityRepo.save).not.toHaveBeenCalled();
  });

  it('normalizes city fields before saving', async () => {
    const city = await service.createCity({ name: '  Maringá  ', uf: 'pr' }, adminActor);
    expect(city).toMatchObject({ name: 'Maringá', uf: 'PR', isActive: true });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'university.city_created' }));
  });

  it('creates an IES linked to an active city', async () => {
    const institution = await service.createInstitution({
      name: 'IES Exemplo',
      cityId: 'city-1',
      website: 'https://ies.example.test',
      contactEmail: 'contato@ies.example.test',
    }, managerActor);

    expect(institution).toMatchObject({
      id: 'ies-1',
      type: 'instituicao_ensino',
      cityId: 'city-1',
      registeredById: managerActor.sub,
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'university.institution_created' }));
  });

  it('rejects an institution when the city does not exist or is inactive', async () => {
    cityRepo.findOneBy.mockResolvedValue(null);
    await expect(service.createInstitution({ name: 'IES Exemplo', cityId: 'missing' }, managerActor))
      .rejects.toThrow(NotFoundException);
    expect(institutionRepo.save).not.toHaveBeenCalled();
  });

  it('updates a city with normalized UF', async () => {
    const updated = await service.updateCity('city-1', { uf: 'sp' }, managerActor);
    expect(updated.uf).toBe('SP');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'university.city_updated' }));
  });
});

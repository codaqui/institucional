import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
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

function createServiceFixture() {
  const cityRepo = {
    create: jest.fn((value) => value),
    save: jest.fn((value) => Promise.resolve({ id: 'city-1', ...value })),
    findOneBy: jest.fn().mockResolvedValue({ id: 'city-1', name: 'Maringá', uf: 'PR', isActive: true }),
  };
  const institutionRepo = {
    create: jest.fn((value) => value),
    save: jest.fn((value) => Promise.resolve({ id: 'ies-1', ...value })),
    findOneBy: jest.fn().mockResolvedValue({ id: 'ies-1', type: 'instituicao_ensino', isActive: true }),
  };
  const designationRepo: Record<string, jest.Mock> = {
    create: jest.fn((value) => value),
    save: jest.fn((value) => Promise.resolve({ id: 'application-1', ...value })),
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    manager: {
      transaction: jest.fn((callback) => callback({
        getRepository: () => designationRepo,
      })),
    },
  };
  const memberRepo = { findBy: jest.fn().mockResolvedValue([]) };
  const designations = { hasDesignation: jest.fn().mockResolvedValue(true), invalidateCache: jest.fn() };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new UniversitiesService(
    cityRepo as any,
    institutionRepo as any,
    designationRepo as any,
    memberRepo as any,
    designations as any,
    audit as any,
  );
  return { service, cityRepo, institutionRepo, designationRepo, memberRepo, designations, audit };
}

describe('UniversitiesService — cities and institutions', () => {
  let service: UniversitiesService;
  let cityRepo: Record<string, jest.Mock>;
  let institutionRepo: Record<string, jest.Mock>;
  let designationRepo: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
  let designations: Record<string, jest.Mock>;
  let audit: Record<string, jest.Mock>;

  beforeEach(() => {
    ({ service, cityRepo, institutionRepo, designationRepo, memberRepo, designations, audit } = createServiceFixture());
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

  it('updates only entities with the IES type', async () => {
    await service.updateInstitution('ies-1', { name: 'IES Atualizada' }, managerActor);

    expect(institutionRepo.findOneBy).toHaveBeenCalledWith({ id: 'ies-1', type: 'instituicao_ensino' });

    institutionRepo.findOneBy.mockResolvedValue(null);
    await expect(service.updateInstitution('entity-1', { name: 'Não é IES' }, managerActor))
      .rejects.toThrow(NotFoundException);
    expect(institutionRepo.save).toHaveBeenCalledTimes(1);
  });

  it('preserves an unchanged historical city when reactivating an IES', async () => {
    institutionRepo.findOneBy.mockResolvedValue({
      id: 'ies-1',
      type: 'instituicao_ensino',
      cityId: 'city-inactive',
      isActive: false,
    });
    cityRepo.findOneBy.mockResolvedValue(null);

    await expect(service.updateInstitution('ies-1', {
      cityId: 'city-inactive',
      isActive: true,
    }, managerActor)).resolves.toMatchObject({ cityId: 'city-inactive', isActive: true });
    expect(cityRepo.findOneBy).not.toHaveBeenCalled();
  });

  it('rejects changing an IES to an inactive city', async () => {
    institutionRepo.findOneBy.mockResolvedValue({
      id: 'ies-1',
      type: 'instituicao_ensino',
      cityId: 'city-active',
      isActive: true,
    });
    cityRepo.findOneBy.mockResolvedValue(null);

    await expect(service.updateInstitution('ies-1', { cityId: 'city-inactive' }, managerActor))
      .rejects.toThrow(NotFoundException);
    expect(institutionRepo.save).not.toHaveBeenCalled();
  });
});

describe('UniversitiesService — ambassador applications', () => {
  let service: UniversitiesService;
  let cityRepo: Record<string, jest.Mock>;
  let institutionRepo: Record<string, jest.Mock>;
  let designationRepo: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
  let designations: Record<string, jest.Mock>;
  let audit: Record<string, jest.Mock>;

  beforeEach(() => {
    ({ service, cityRepo, institutionRepo, designationRepo, memberRepo, designations, audit } = createServiceFixture());
  });

  it('creates a pending application and rejects duplicates', async () => {
    designations.hasDesignation.mockResolvedValue(false);
    const pending = await service.applyAmbassador('ies-1', { applicationNotes: 'Quero contribuir' }, memberActor);
    expect(pending).toMatchObject({
      status: 'pending',
      targetType: 'ies',
      targetId: 'ies-1',
      designation: 'ambassador',
    });

    designationRepo.findOne.mockResolvedValue(pending);
    await expect(service.applyAmbassador('ies-1', { applicationNotes: 'Outra candidatura' }, memberActor))
      .rejects.toThrow(ConflictException);
  });

  it('allows only admin to confirm an application', async () => {
    const pending = {
      id: 'application-1',
      memberId: memberActor.sub,
      targetType: 'ies',
      targetId: 'ies-1',
      designation: 'ambassador',
      status: 'pending',
    };
    designationRepo.findOneBy = jest.fn().mockResolvedValue(pending);

    await expect(service.confirmApplication('application-1', {}, managerActor))
      .rejects.toThrow(ForbiddenException);

    const confirmed = await service.confirmApplication('application-1', { validUntil: '2027-11-09' }, adminActor);
    expect(confirmed).toMatchObject({
      status: 'active',
      confirmedById: adminActor.sub,
      validUntil: new Date('2027-11-09'),
    });
    expect(designations.invalidateCache).toHaveBeenCalledTimes(1);
  });

  it('lets the manager reject a pending application', async () => {
    designationRepo.findOneBy = jest.fn().mockResolvedValue({
      id: 'application-1',
      memberId: memberActor.sub,
      targetType: 'ies',
      targetId: 'ies-1',
      designation: 'ambassador',
      status: 'pending',
    });

    const rejected = await service.rejectApplication('application-1', managerActor);
    expect(rejected).toMatchObject({ status: 'removed', endedAt: expect.any(Date) });
    expect(designations.invalidateCache).toHaveBeenCalledTimes(1);
  });
});

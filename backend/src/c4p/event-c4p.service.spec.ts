import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '../auth/jwt.strategy';
import { EventC4pService } from './event-c4p.service';

const actor = { sub: 'actor-1', handle: 'actor', roles: ['event_organizer'] } as JwtPayload;
const dto = { slug: 'devpr-conf-2027-c4p', name: 'C4P — DevPR Conf 2027' };

describe('EventC4pService', () => {
  let service: EventC4pService;
  let managedRepo: Record<string, jest.Mock>;
  let activationRepo: Record<string, jest.Mock>;
  let callRepo: Record<string, jest.Mock>;
  let calls: Record<string, jest.Mock>;
  let events: Record<string, jest.Mock>;
  let dataSource: Record<string, jest.Mock>;
  let managerActivationRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    managedRepo = {
      findOneBy: jest.fn().mockResolvedValue({ id: 'event-1', communityProjectKey: 'devparana' }),
    };
    activationRepo = { findOneBy: jest.fn().mockResolvedValue(null) };
    callRepo = { findOneBy: jest.fn().mockResolvedValue(null) };
    managerActivationRepo = {
      create: jest.fn((value) => ({ ...value, id: 'activation-1' })),
      save: jest.fn(async (value) => value),
    };
    calls = {
      create: jest.fn(async (input) => ({ id: 'call-1', ...input })),
    };
    events = {
      assertCanEditManagedEvent: jest.fn().mockResolvedValue(undefined),
      assertCanManageExternalEvent: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      transaction: jest.fn(async (callback) => callback({
        getRepository: jest.fn(() => managerActivationRepo),
      })),
    };
    service = new EventC4pService(
      dataSource as never,
      managedRepo as never,
      activationRepo as never,
      callRepo as never,
      calls as never,
      events as never,
    );
  });

  it('cria C4P para evento próprio com autorização do evento', async () => {
    const result = await service.createForManagedEvent('event-1', dto, actor);

    expect(events.assertCanEditManagedEvent).toHaveBeenCalledWith('event-1', actor);
    expect(calls.create).toHaveBeenCalledWith(
      expect.objectContaining({ managedEventId: 'event-1' }),
      actor,
      expect.anything(),
    );
    expect(result.managedEventId).toBe('event-1');
  });

  it('retorna a chamada existente sem duplicar na repetição', async () => {
    callRepo.findOneBy.mockResolvedValue({ id: 'call-existing', managedEventId: 'event-1' });

    const result = await service.createForManagedEvent('event-1', dto, actor);

    expect(result.id).toBe('call-existing');
    expect(calls.create).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejeita evento próprio inexistente', async () => {
    managedRepo.findOneBy.mockResolvedValue(null);
    await expect(service.createForManagedEvent('missing', dto, actor)).rejects.toThrow(NotFoundException);
  });

  it('exige communityProjectKey somente na primeira ativação externa', async () => {
    await expect(
      service.createForExternalEvent('sympla:devpr:123', dto, actor),
    ).rejects.toThrow(BadRequestException);
    expect(calls.create).not.toHaveBeenCalled();
  });

  it('cria activation e chamada externa na mesma transação', async () => {
    const result = await service.createForExternalEvent(
      'sympla:devpr:123',
      { ...dto, communityProjectKey: 'devparana', title: 'DevPR Conf' },
      actor,
    );

    expect(dataSource.transaction).toHaveBeenCalled();
    expect(managerActivationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'sympla:devpr:123',
        features: ['c4p'],
        communityProjectKey: 'devparana',
      }),
    );
    expect(calls.create).toHaveBeenCalledWith(
      expect.objectContaining({ externalActivationId: 'activation-1' }),
      actor,
      expect.anything(),
    );
    expect(result.externalActivationId).toBe('activation-1');
  });

  it('reutiliza activation existente e preserva suas demais features', async () => {
    activationRepo.findOneBy.mockResolvedValue({
      id: 'activation-1',
      eventKey: 'sympla:devpr:123',
      features: ['checkin'],
      communityProjectKey: 'devparana',
      title: 'DevPR Conf',
    });

    await service.createForExternalEvent('sympla:devpr:123', dto, actor);

    expect(managerActivationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ features: ['checkin', 'c4p'] }),
    );
    expect(calls.create).toHaveBeenCalledWith(
      expect.objectContaining({ externalActivationId: 'activation-1' }),
      actor,
      expect.anything(),
    );
  });

  it('recupera a chamada criada por uma requisição concorrente', async () => {
    dataSource.transaction.mockRejectedValue(
      Object.assign(new Error('duplicate key'), { code: '23505' }),
    );
    callRepo.findOneBy
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'call-race', managedEventId: 'event-1' });

    const result = await service.createForManagedEvent('event-1', dto, actor);

    expect(result.id).toBe('call-race');
  });

  it('propaga slug duplicado sem confirmar uma nova chamada', async () => {
    calls.create.mockRejectedValue(new ConflictException('Já existe uma campanha com este slug.'));
    await expect(
      service.createForManagedEvent('event-1', dto, actor),
    ).rejects.toThrow(ConflictException);
    expect(dataSource.transaction).toHaveBeenCalled();
  });
});

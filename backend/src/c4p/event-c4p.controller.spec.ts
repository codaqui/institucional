import { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EventC4pController } from './event-c4p.controller';
import { EventC4pService } from './event-c4p.service';

const user = { sub: 'actor-1', handle: 'actor', roles: ['event_organizer'] } as any;

describe('EventC4pController', () => {
  let controller: EventC4pController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      createForManagedEvent: jest.fn().mockResolvedValue({ id: 'call-1' }),
      createForExternalEvent: jest.fn().mockResolvedValue({ id: 'call-2' }),
    };
    const module = await Test.createTestingModule({
      controllers: [EventC4pController],
      providers: [{ provide: EventC4pService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = user;
          return true;
        },
      })
      .compile();
    controller = module.get(EventC4pController);
  });

  it('POST /events/:id/c4p repassa evento, DTO e ator', async () => {
    const dto = { slug: 'evento-c4p', name: 'C4P — Evento' };
    await controller.createManaged('event-1', dto, { user });
    expect(service.createForManagedEvent).toHaveBeenCalledWith('event-1', dto, user);
  });

  it('POST /events/external/:eventKey/c4p repassa eventKey, DTO e ator', async () => {
    const dto = { slug: 'evento-c4p', name: 'C4P — Evento', communityProjectKey: 'devparana' };
    await controller.createExternal('sympla:devpr:123', dto, { user });
    expect(service.createForExternalEvent).toHaveBeenCalledWith('sympla:devpr:123', dto, user);
  });
});

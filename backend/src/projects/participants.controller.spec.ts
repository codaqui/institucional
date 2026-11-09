import { ParticipantsController } from './participants.controller';

describe('ParticipantsController', () => {
  it('delegates join, leave, removal and own projects', async () => {
    const service = {
      join: jest.fn(), leave: jest.fn(), remove: jest.fn(), myProjects: jest.fn(), listParticipants: jest.fn(),
    } as any;
    const controller = new ParticipantsController(service);
    const actor = { sub: 'member-1', handle: 'member', roles: ['membro'] } as any;

    await controller.join('project-1', { user: actor });
    await controller.leave('project-1', { user: actor });
    await controller.remove('project-1', 'member-1', { user: actor });
    await controller.myProjects({ user: actor });
    await controller.listParticipants('project-1', { user: actor });

    expect(service.join).toHaveBeenCalledWith('project-1', actor);
    expect(service.leave).toHaveBeenCalledWith('project-1', actor);
    expect(service.remove).toHaveBeenCalledWith('project-1', 'member-1', actor);
    expect(service.myProjects).toHaveBeenCalledWith(actor);
    expect(service.listParticipants).toHaveBeenCalledWith('project-1', actor);
  });
});

import { ProjectHoursController } from './project-hours.controller';

describe('ProjectHoursController', () => {
  it('delegates create and pending edit', async () => {
    const hours = {
      recordExtensionProjectEntry: jest.fn(),
      updateExtensionProjectEntry: jest.fn(),
    } as any;
    const controller = new ProjectHoursController(hours);
    const actor = { sub: 'mentor-1', handle: 'mentor', roles: ['mentor'] } as any;

    await controller.create('project-1', { memberId: 'member-1', hours: 2 } as any, { user: actor });
    await controller.update('project-1', 'hour-1', { hours: 3 } as any, { user: actor });

    expect(hours.recordExtensionProjectEntry).toHaveBeenCalledWith('project-1', { memberId: 'member-1', hours: 2 }, actor);
    expect(hours.updateExtensionProjectEntry).toHaveBeenCalledWith('project-1', 'hour-1', { hours: 3 }, actor);
  });
});

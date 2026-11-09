import { ProjectCertificatesController } from './project-certificates.controller';

describe('ProjectCertificatesController', () => {
  it('delegates issue, verify and owned data', async () => {
    const service = { issue: jest.fn(), verify: jest.fn(), owned: jest.fn() } as any;
    const controller = new ProjectCertificatesController(service);
    const actor = { sub: 'member-1', handle: 'member', roles: ['membro'] } as any;

    await controller.issue('project-1', { kind: 'participant' } as any, { user: actor });
    await controller.verify('PRJ-1');
    await controller.owned('PRJ-1', { user: actor });

    expect(service.issue).toHaveBeenCalledWith('project-1', 'participant', actor);
    expect(service.verify).toHaveBeenCalledWith('PRJ-1');
    expect(service.owned).toHaveBeenCalledWith('PRJ-1', actor);
  });
});

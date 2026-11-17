import { PrivacyController } from './privacy.controller';

describe('PrivacyController', () => {
  const deletion = {
    latestForMember: jest.fn(),
    request: jest.fn(),
    cancel: jest.fn(),
    list: jest.fn(),
    complete: jest.fn(),
  };
  let controller: PrivacyController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PrivacyController(deletion as any);
  });

  it('usa somente o membro autenticado no ciclo da solicitação', async () => {
    const req = { user: { sub: 'member-1', handle: 'octocat' } } as any;

    await controller.getMyDeletionRequest(req);
    await controller.requestMyDeletion(req);
    await controller.cancelMyDeletion(req);

    expect(deletion.latestForMember).toHaveBeenCalledWith('member-1');
    expect(deletion.request).toHaveBeenCalledWith('member-1', 'octocat');
    expect(deletion.cancel).toHaveBeenCalledWith('member-1', 'octocat');
  });

  it('encaminha filtros admin e o revisor autenticado', async () => {
    const query = { status: 'pending' as const, page: 2, limit: 25 };
    await controller.listDeletionRequests(query);
    expect(deletion.list).toHaveBeenCalledWith(query);

    const req = { user: { sub: 'admin-1', handle: 'admin' } } as any;
    await controller.completeDeletionRequest('request-1', req, { reviewNote: 'Offboarding concluído' });
    expect(deletion.complete).toHaveBeenCalledWith('request-1', 'admin-1', 'admin', 'Offboarding concluído');
  });
});

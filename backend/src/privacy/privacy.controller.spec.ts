import { PrivacyController } from './privacy.controller';

describe('PrivacyController', () => {
  const deletion = {
    latestForMember: jest.fn(),
    request: jest.fn(),
    cancel: jest.fn(),
    list: jest.fn(),
    complete: jest.fn(),
  };
  const exportService = { exportMember: jest.fn() };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  let controller: PrivacyController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PrivacyController(deletion as any, exportService as any, audit as any);
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

  it('entrega attachment JSON e audita somente os metadados', async () => {
    const exported = { schemaVersion: 1 as const, generatedAt: '2026-11-16T12:00:00.000Z', account: { name: 'Maria' } };
    exportService.exportMember.mockResolvedValue(exported);
    const response = { setHeader: jest.fn(), send: jest.fn() };
    const req = { user: { sub: 'member-1', handle: 'maria' } } as any;

    await controller.exportMyData(req, response as any);

    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json; charset=utf-8');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringMatching(/^attachment; filename="codaqui-dados-maria-\d{4}-\d{2}-\d{2}\.json"$/));
    expect(response.send).toHaveBeenCalledWith(JSON.stringify(exported, null, 2));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'member.data_exported',
      actorId: 'member-1',
      actorHandle: 'maria',
      details: { schemaVersion: 1 },
    }));
  });
});

import { PrivacyController } from './privacy.controller';

describe('PrivacyController — membro', () => {
  it('usa somente o membro autenticado no ciclo da solicitação', async () => {
    const deletion = {
      latestForMember: jest.fn().mockResolvedValue(null),
      request: jest.fn().mockResolvedValue({ id: 'request-1' }),
      cancel: jest.fn().mockResolvedValue({ id: 'request-1', status: 'canceled' }),
    };
    const controller = new PrivacyController(deletion as any);
    const req = { user: { sub: 'member-1', handle: 'octocat' } } as any;

    await controller.getMyDeletionRequest(req);
    await controller.requestMyDeletion(req);
    await controller.cancelMyDeletion(req);

    expect(deletion.latestForMember).toHaveBeenCalledWith('member-1');
    expect(deletion.request).toHaveBeenCalledWith('member-1', 'octocat');
    expect(deletion.cancel).toHaveBeenCalledWith('member-1', 'octocat');
  });
});

import { ConflictException, NotFoundException } from '@nestjs/common';
import { AccountDeletionService } from './account-deletion.service';
import { AccountDeletionRequest } from './entities/account-deletion-request.entity';

const memberId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function pendingRequest(): AccountDeletionRequest {
  return {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    memberId,
    status: 'pending',
    requestedAt: new Date('2026-11-16T12:00:00Z'),
    reviewedByMemberId: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: new Date('2026-11-16T12:00:00Z'),
    updatedAt: new Date('2026-11-16T12:00:00Z'),
  } as AccountDeletionRequest;
}

describe('AccountDeletionService — membro', () => {
  const repo = {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  let service: AccountDeletionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AccountDeletionService(repo as any, audit as any);
  });

  it('retorna a pendência existente sem criar duplicata', async () => {
    const pending = pendingRequest();
    repo.findOne.mockResolvedValue(pending);

    await expect(service.request(memberId, 'e2e-privacy-member')).resolves.toBe(pending);
    expect(repo.save).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('cria e audita a primeira solicitação sem alterar o membro', async () => {
    const pending = pendingRequest();
    repo.findOne.mockResolvedValue(null);
    repo.create.mockReturnValue(pending);
    repo.save.mockResolvedValue(pending);

    await expect(service.request(memberId, 'e2e-privacy-member')).resolves.toBe(pending);
    expect(repo.save).toHaveBeenCalledWith(pending);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'member.deletion_requested',
      actorId: memberId,
      actorHandle: 'e2e-privacy-member',
      targetType: 'member',
    }));
  });

  it('recupera a pendência quando a unique vence uma concorrência', async () => {
    const pending = pendingRequest();
    repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(pending);
    repo.create.mockReturnValue(pending);
    repo.save.mockRejectedValue({ code: '23505' });

    await expect(service.request(memberId, 'e2e-privacy-member')).resolves.toBe(pending);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('cancela somente uma solicitação pendente do próprio membro', async () => {
    const pending = pendingRequest();
    const canceled = { ...pending, status: 'canceled' };
    repo.findOne.mockResolvedValue(pending);
    repo.update.mockResolvedValue({ affected: 1 });
    repo.findOneOrFail.mockResolvedValue(canceled);

    await expect(service.cancel(memberId, 'e2e-privacy-member')).resolves.toBe(canceled);
    expect(repo.update).toHaveBeenCalledWith(
      { id: pending.id, memberId, status: 'pending' },
      { status: 'canceled' },
    );
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'member.deletion_request_canceled',
      actorId: memberId,
      actorHandle: 'e2e-privacy-member',
    }));
  });

  it('rejeita cancelamento quando não existe pendência', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.cancel(memberId, 'e2e-privacy-member')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejeita cancelamento se a condição perder uma transição concorrente', async () => {
    repo.findOne.mockResolvedValue(pendingRequest());
    repo.update.mockResolvedValue({ affected: 0 });
    await expect(service.cancel(memberId, 'e2e-privacy-member')).rejects.toBeInstanceOf(ConflictException);
  });
});

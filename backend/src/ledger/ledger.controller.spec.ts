import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';
import { AccountType } from './entities/account.entity';

describe('LedgerController', () => {
  let controller: LedgerController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      createAccount: jest.fn(),
      recordTransaction: jest.fn(),
      getAccounts: jest.fn(),
      getCommunityBalances: jest.fn(),
      getTransparencyStats: jest.fn(),
      getAccountBalance: jest.fn(),
      getTransactionById: jest.fn(),
      getAccountTransactions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LedgerController],
      providers: [{ provide: LedgerService, useValue: service }],
    }).compile();

    controller = module.get<LedgerController>(LedgerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('creates account', async () => {
    await controller.createAccount({
      name: 'DevParana',
      type: AccountType.VIRTUAL_WALLET,
      projectKey: 'devparana',
    });
    expect(service.createAccount).toHaveBeenCalledWith(
      'DevParana',
      AccountType.VIRTUAL_WALLET,
      'devparana',
    );
  });

  it('records transaction', async () => {
    await controller.recordTransaction({
      sourceAccountId: 's1',
      destinationAccountId: 'd1',
      amount: 100,
      description: 'Doação',
      referenceId: 'ref-1',
    });
    expect(service.recordTransaction).toHaveBeenCalledWith(
      's1',
      'd1',
      100,
      'Doação',
      'ref-1',
    );
  });

  it('delegates read endpoints', async () => {
    await controller.getAccounts();
    await controller.getCommunityBalances();
    await controller.getTransparencyStats();
    await controller.getAccountBalance('acc-1');
    await controller.getAccountTransactions('acc-1', {
      page: 2,
      limit: 30,
      type: 'donation',
      days: 90,
      search: 'octocat',
    } as any);

    expect(service.getAccounts).toHaveBeenCalled();
    expect(service.getCommunityBalances).toHaveBeenCalled();
    expect(service.getTransparencyStats).toHaveBeenCalled();
    expect(service.getAccountBalance).toHaveBeenCalledWith('acc-1');
    expect(service.getAccountTransactions).toHaveBeenCalledWith('acc-1', 2, 30, {
      type: 'donation',
      days: 90,
      search: 'octocat',
    });
  });

  it('uses default pagination in account transactions query', async () => {
    await controller.getAccountTransactions('acc-1', {} as any);
    expect(service.getAccountTransactions).toHaveBeenCalledWith('acc-1', 1, 10, {
      type: undefined,
      days: undefined,
      search: undefined,
    });
  });

  it('returns transaction by id when found', async () => {
    service.getTransactionById.mockResolvedValue({ id: 'tx-1' });
    await expect(controller.getTransactionById('tx-1')).resolves.toEqual({
      id: 'tx-1',
    });
  });

  it('throws NotFoundException when transaction does not exist', async () => {
    service.getTransactionById.mockResolvedValue(null);
    await expect(controller.getTransactionById('tx-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});

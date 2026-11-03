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
      getAccountTransactionsForExport: jest.fn(),
      getTransactionsForExport: jest.fn(),
      getAccountById: jest.fn(),
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
      undefined,
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
      eventId: 'evt-1',
      ticketTypeId: 'tt-1',
      externalActivationId: 'act-1',
      from: '2026-10-01',
      to: '2026-10-31',
    } as any);

    expect(service.getAccounts).toHaveBeenCalled();
    expect(service.getCommunityBalances).toHaveBeenCalled();
    expect(service.getTransparencyStats).toHaveBeenCalled();
    expect(service.getAccountBalance).toHaveBeenCalledWith('acc-1');
    expect(service.getAccountTransactions).toHaveBeenCalledWith('acc-1', 2, 30, {
      type: 'donation',
      days: 90,
      search: 'octocat',
      eventId: 'evt-1',
      ticketTypeId: 'tt-1',
      externalActivationId: 'act-1',
      from: '2026-10-01',
      to: '2026-10-31',
    });
  });

  it('uses default pagination in account transactions query', async () => {
    await controller.getAccountTransactions('acc-1', {} as any);
    expect(service.getAccountTransactions).toHaveBeenCalledWith('acc-1', 1, 10, {
      type: undefined,
      days: undefined,
      search: undefined,
      eventId: undefined,
      ticketTypeId: undefined,
      externalActivationId: undefined,
      from: undefined,
      to: undefined,
    });
  });

  it('exports only the public account transaction fields with identical filters', async () => {
    service.getAccountById.mockResolvedValue({ id: 'acc-1', name: 'Dev Paraná' });
    service.getAccountTransactionsForExport.mockResolvedValue([
      {
        id: 'tx-1',
        amount: 75,
        description: '=HYPERLINK("https://evil.example")',
        referenceId: 'cs_secret',
        metadata: { private: 'not-visible' },
        createdAt: new Date('2026-10-31T23:59:59.999Z'),
        sourceAccount: { id: 'src', name: 'Stripe' },
        destinationAccount: { id: 'acc-1', name: 'Dev Paraná' },
      },
    ]);
    const res = { setHeader: jest.fn(), send: jest.fn() };
    res.send.mockReturnValue(res);
    const query = {
      type: 'donation', days: 90, search: 'octocat', from: '2026-10-01', to: '2026-10-31',
    } as any;

    const result = await controller.exportAccountTransactions('acc-1', query, res as any);

    expect(result).toBeUndefined();
    expect(service.getAccountTransactionsForExport).toHaveBeenCalledWith('acc-1', {
      type: 'donation', days: 90, search: 'octocat', eventId: undefined,
      ticketTypeId: undefined, externalActivationId: undefined,
      from: '2026-10-01', to: '2026-10-31',
    });
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringMatching(/^attachment; filename="transacoes-dev-parana-\d{4}-\d{2}-\d{2}\.csv"$/),
    );
    const csv = res.send.mock.calls[0][0];
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"Crédito"');
    expect(csv).not.toContain('cs_secret');
    expect(csv).not.toContain('not-visible');
  });

  it('exports all accounts for the authorized admin endpoint', async () => {
    service.getTransactionsForExport.mockResolvedValue([]);
    const res = { setHeader: jest.fn(), send: jest.fn() };
    const query = { search: 'PIX', from: '2026-10-01', to: '2026-10-31' } as any;

    await controller.exportTransactions(query, res as any);

    expect(service.getTransactionsForExport).toHaveBeenCalledWith({
      type: undefined, days: undefined, search: 'PIX', eventId: undefined,
      ticketTypeId: undefined, externalActivationId: undefined,
      from: '2026-10-01', to: '2026-10-31',
    });
    expect(res.send.mock.calls[0][0].startsWith('\ufeff')).toBe(true);
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

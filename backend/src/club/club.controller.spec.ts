import { Test, TestingModule } from '@nestjs/testing';
import { ClubController } from './club.controller';
import { ClubService } from './club.service';
import { RaffleService } from './raffle.service';
import { RaffleOwnerType } from './entities/raffle-entry.entity';

describe('ClubController', () => {
  let controller: ClubController;
  let clubService: Record<string, jest.Mock>;
  let raffleService: Record<string, jest.Mock>;

  const req = (sub = 'member-1') => ({ user: { sub } });

  beforeEach(async () => {
    clubService = {
      getOrCreateWallet: jest.fn(),
      getTransactions: jest.fn(),
      getPublicWalletByHandle: jest.fn(),
      manualAdjust: jest.fn(),
      getAdminAllTransactions: jest.fn(),
    };
    raffleService = {
      listOpen: jest.fn(),
      listMyEntries: jest.fn(),
      getRaffleStats: jest.fn(),
      listAll: jest.fn(),
      listHistory: jest.fn(),
      findOne: jest.fn(),
      listEntries: jest.fn(),
      create: jest.fn(),
      enterRaffle: jest.fn(),
      draw: jest.fn(),
      cancel: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClubController],
      providers: [
        { provide: ClubService, useValue: clubService },
        { provide: RaffleService, useValue: raffleService },
      ],
    }).compile();

    controller = module.get<ClubController>(ClubController);
  });

  it('gets my wallet', async () => {
    await controller.getMyWallet(req());
    expect(clubService.getOrCreateWallet).toHaveBeenCalledWith('member-1');
  });

  it('adjusts wallet via admin endpoint', async () => {
    await controller.adjustWallet({
      memberId: 'member-1',
      amount: 50,
      coinType: 'sort_coin',
      description: 'bonus',
    } as any);
    expect(clubService.manualAdjust).toHaveBeenCalledWith(
      'member-1',
      50,
      'sort_coin',
      'bonus',
    );
  });

  it('gets my transactions parsing page and limit', async () => {
    await controller.getMyTransactions(req(), '3', '25');
    expect(clubService.getTransactions).toHaveBeenCalledWith('member-1', 3, 25);
  });

  it('gets public wallet by handle', async () => {
    await controller.getPublicWallet('mentoriacodaqui', '15');
    expect(clubService.getPublicWalletByHandle).toHaveBeenCalledWith(
      'mentoriacodaqui',
      15,
    );
  });

  it('lists admin all transactions with defaults', async () => {
    await controller.adminAllTransactions(undefined as any, undefined, undefined);
    expect(clubService.getAdminAllTransactions).toHaveBeenCalledWith('all', 1, 50);
  });

  it('creates raffle with authenticated user', async () => {
    await controller.createRaffle({ title: 'R', costInCoins: 10, closesAt: new Date().toISOString() } as any, req());
    expect(raffleService.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'R' }),
      'member-1',
    );
  });

  it('enters raffle with default owner type member', async () => {
    await controller.enterRaffle('raffle-1', {} as any, req());
    expect(raffleService.enterRaffle).toHaveBeenCalledWith(
      'raffle-1',
      'member-1',
      RaffleOwnerType.MEMBER,
    );
  });

  it('enters raffle with provided owner type', async () => {
    await controller.enterRaffle(
      'raffle-1',
      { ownerType: RaffleOwnerType.COMPANY } as any,
      req(),
    );
    expect(raffleService.enterRaffle).toHaveBeenCalledWith(
      'raffle-1',
      'member-1',
      RaffleOwnerType.COMPANY,
    );
  });

  it('falls back to MEMBER when ownerType is null', async () => {
    await controller.enterRaffle(
      'raffle-1',
      { ownerType: null } as any,
      req(),
    );
    expect(raffleService.enterRaffle).toHaveBeenCalledWith(
      'raffle-1',
      'member-1',
      RaffleOwnerType.MEMBER,
    );
  });

  it('draws and cancels raffle', async () => {
    await controller.drawRaffle('raffle-1');
    await controller.cancelRaffle('raffle-1');
    expect(raffleService.draw).toHaveBeenCalledWith('raffle-1');
    expect(raffleService.cancel).toHaveBeenCalledWith('raffle-1');
  });

  it('delegates raffle read endpoints', async () => {
    await controller.listOpenRaffles();
    await controller.listMyRaffleEntries(req());
    await controller.getRaffleStats('raffle-1');
    await controller.listAllRaffles();
    await controller.listRaffleHistory();
    await controller.getRaffle('raffle-1');
    await controller.getRaffleEntries('raffle-1');

    expect(raffleService.listOpen).toHaveBeenCalled();
    expect(raffleService.listMyEntries).toHaveBeenCalledWith('member-1');
    expect(raffleService.getRaffleStats).toHaveBeenCalledWith('raffle-1');
    expect(raffleService.listAll).toHaveBeenCalled();
    expect(raffleService.listHistory).toHaveBeenCalled();
    expect(raffleService.findOne).toHaveBeenCalledWith('raffle-1');
    expect(raffleService.listEntries).toHaveBeenCalledWith('raffle-1');
  });

  it('lists admin transactions with explicit params', async () => {
    await controller.adminAllTransactions('member', '2', '30');
    expect(clubService.getAdminAllTransactions).toHaveBeenCalledWith(
      'member',
      2,
      30,
    );
  });

  it('uses default pagination values for my transactions', async () => {
    await controller.getMyTransactions(req(), undefined, undefined);
    expect(clubService.getTransactions).toHaveBeenCalledWith('member-1', 1, 20);
  });
});

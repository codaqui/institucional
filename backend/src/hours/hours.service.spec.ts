import { ConflictException, ForbiddenException } from '@nestjs/common';
import { HoursService } from './hours.service';
import { HourEntrySource, HourEntryStatus } from './entities/hour-entry.entity';
import { MemberRole } from '../members/entities/member.entity';

const actor = {
  sub: 'director-1',
  handle: 'director',
  roles: ['diretor'],
} as any;

const baseDto = {
  sourceType: HourEntrySource.DIRECTORATE_ACTIVITY,
  sourceId: '11111111-1111-1111-1111-111111111111',
  sourceLabel: 'Diretoria de tecnologia',
  hours: 2.5,
  description: 'Planejamento do programa',
  occurredAt: '2026-10-01T12:00:00.000Z',
  idempotencyKey: 'activity-1',
};

describe('HoursService', () => {
  let service: HoursService;
  let repo: Record<string, jest.Mock>;
  let membersRepo: Record<string, jest.Mock>;
  let designations: Record<string, jest.Mock>;
  let audit: Record<string, jest.Mock>;
  let statementsRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'hour-1', ...value })),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      findOneByOrFail: jest.fn(async () => ({ id: 'hour-1' })),
      find: jest.fn(),
      findAndCount: jest.fn(),
      sum: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    membersRepo = { findOneBy: jest.fn() };
    designations = { hasDesignation: jest.fn().mockResolvedValue(true) };
    audit = { log: jest.fn() };
    statementsRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: '11111111-1111-1111-1111-111111111111', ...value })),
      findOneBy: jest.fn(),
    };
    service = new HoursService(
      repo as any,
      membersRepo as any,
      designations as any,
      audit as any,
      statementsRepo as any,
    );
  });

  it('deduplicates manual entries by member and idempotency key', async () => {
    repo.findOne.mockResolvedValue({ id: 'existing' });
    await expect(service.create(baseDto, actor)).rejects.toThrow(ConflictException);
  });

  it('creates a pending activity for a director of the directorate', async () => {
    repo.findOne.mockResolvedValue(null);
    const result = await service.create(baseDto, actor);
    expect(result.status).toBe(HourEntryStatus.PENDING);
    expect(result.memberId).toBe(actor.sub);
    expect(designations.hasDesignation).toHaveBeenCalledWith(actor.sub, {
      targetType: 'directorate',
      targetId: baseDto.sourceId,
      designation: 'director',
    });
  });

  it('rejects creation outside the director designation', async () => {
    designations.hasDesignation.mockResolvedValue(false);
    await expect(service.create(baseDto, actor)).rejects.toThrow(ForbiddenException);
  });

  it('approves and rejects with governance audit', async () => {
    const entry = { id: 'hour-1', status: HourEntryStatus.PENDING };
    repo.findOneBy.mockResolvedValue(entry);
    const admin = { ...actor, roles: [MemberRole.ADMIN] };

    await service.approve('hour-1', admin);
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'hour-1', status: HourEntryStatus.PENDING },
      expect.objectContaining({ status: HourEntryStatus.APPROVED, approvedById: admin.sub }),
    );
    expect(audit.log).toHaveBeenCalled();

    entry.status = HourEntryStatus.PENDING;
    await service.reject('hour-1', admin, 'Fora do período');
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'hour-1', status: HourEntryStatus.PENDING },
      expect.objectContaining({ status: HourEntryStatus.REJECTED, rejectReason: 'Fora do período' }),
    );
  });

  it('returns no public hours when visibility is disabled', async () => {
    membersRepo.findOneBy.mockResolvedValue({ profileVisibility: { hours: false } });
    await expect(service.publicSummary('member-1')).resolves.toEqual({ totalHours: 0, entries: [] });
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('returns nothing for an inactive or unknown member', async () => {
    membersRepo.findOneBy.mockResolvedValue(null);
    await expect(service.publicSummary('missing')).resolves.toEqual({ totalHours: 0, entries: [] });
    expect(repo.find).not.toHaveBeenCalled();
    expect(repo.sum).not.toHaveBeenCalled();
  });

  it('sums all approved entries and exposes only public fields', async () => {
    membersRepo.findOneBy.mockResolvedValue({ profileVisibility: {} });
    repo.sum.mockResolvedValue(3.75);
    repo.find.mockResolvedValue([{
      id: 'hour-1', sourceType: 'directorate_activity', sourceLabel: 'Diretoria',
      hours: 3.75, description: 'Atividade', occurredAt: new Date('2026-10-01'),
      idempotencyKey: 'private-key', reportedById: 'internal-user',
    }]);
    const result = await service.publicSummary('member-1');
    expect(result.totalHours).toBe(3.75);
    expect(result.entries[0]).not.toHaveProperty('idempotencyKey');
    expect(result.entries[0]).not.toHaveProperty('reportedById');
  });

  it('keeps the statement list limited while summing every approved decimal hour', async () => {
    const entries = Array.from({ length: 101 }, (_, index) => ({
      id: `hour-${index + 1}`,
      memberId: 'member-1',
      hours: index === 100 ? '1000.25' : '0.01',
      status: HourEntryStatus.APPROVED,
    }));
    repo.find.mockImplementation(({ take }) => Promise.resolve(entries.slice(0, take)));
    repo.sum.mockResolvedValue(1001.25);

    const [list, summary] = await Promise.all([
      service.myEntries('member-1'),
      (service as any).myApprovedSummary('member-1'),
    ]);

    expect(list).toHaveLength(100);
    expect(repo.find).toHaveBeenCalledWith({
      where: { memberId: 'member-1' },
      order: { occurredAt: 'DESC' },
      take: 100,
    });
    expect(repo.sum).toHaveBeenCalledWith('hours', {
      memberId: 'member-1',
      status: HourEntryStatus.APPROVED,
    });
    expect(summary).toEqual({ totalHours: 1001.25 });
  });

  it('includes the end of the last statement day and excludes the following day', async () => {
    const entries = [
      {
        id: 'last-day',
        memberId: 'member-1',
        hours: 2.5,
        status: HourEntryStatus.APPROVED,
        occurredAt: new Date('2026-12-31T23:59:59.999Z'),
      },
      {
        id: 'next-day',
        memberId: 'member-1',
        hours: 4,
        status: HourEntryStatus.APPROVED,
        occurredAt: new Date('2027-01-01T00:00:00.000Z'),
      },
    ];
    repo.find.mockImplementation(({ where }) => {
      const condition = where.occurredAt;
      if (condition.type === 'between') {
        const [from, to] = condition.value;
        return Promise.resolve(entries.filter((entry) => entry.occurredAt >= from && entry.occurredAt <= to));
      }
      if (condition.type === 'and') {
        const [from, to] = condition.value;
        return Promise.resolve(entries.filter((entry) =>
          entry.occurredAt >= from.value && entry.occurredAt < to.value));
      }
      throw new Error(`Operador inesperado: ${condition.type}`);
    });

    const statement = await service.statement('member-1', { from: '2026-01-01', to: '2026-12-31' });

    expect(statement.entries.map((entry) => entry.id)).toEqual(['last-day']);
    expect(statement.totalHours).toBe(2.5);
  });

  it('persists immutable statements and verifies their stored snapshot', async () => {
    repo.find.mockResolvedValue([{ hours: 2.5 }]);
    membersRepo.findOneBy.mockResolvedValue({ profileVisibility: {} });
    const statement = await service.statement('member-1', { from: '2026-01-01', to: '2026-12-31' });
    expect(statement.verificationCode).toBe('HRS-11111111-1111-1111-1111-111111111111');
    expect(statementsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ totalHours: 2.5 }));

    statementsRepo.findOneBy.mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111', memberId: 'member-1', from: new Date('2026-01-01'),
      to: new Date('2026-12-31'), totalHours: 2.5,
    });
    await expect(service.verifyStatement('HRS-11111111-1111-1111-1111-111111111111')).resolves.toEqual({
      valid: true, from: new Date('2026-01-01'), to: new Date('2026-12-31'), totalHours: 2.5,
    });
  });

  it('records approved hours for a member check-in and skips guests', async () => {
    const hourRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const manager = { getRepository: jest.fn(() => hourRepo) };
    const registration = {
      id: 'registration-1', memberId: 'member-1', eventId: 'event-1',
      externalActivationId: null, checkedInAt: new Date('2026-01-01T12:00:00Z'),
    };

    await service.recordEventCheckin(registration as any, 90, manager as any, 'Evento X');
    expect(hourRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      memberId: 'member-1', sourceId: 'registration-1', hours: 1.5,
      status: HourEntryStatus.APPROVED,
    }));

    await service.recordEventCheckin({ ...registration, memberId: null } as any, 90, manager as any);
    expect(hourRepo.save).toHaveBeenCalledTimes(1);
  });
});

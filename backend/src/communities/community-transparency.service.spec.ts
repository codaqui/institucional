import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommunityTransparencyService } from './community-transparency.service';

const publicCommunity = {
  id: 'devparana',
  slug: 'devparana',
  name: 'DevParaná',
  responsible: {
    id: 'member-1',
    name: 'Responsável',
    githubHandle: 'responsavel',
    avatarUrl: null,
  },
};

describe('CommunityTransparencyService', () => {
  const communities = { listPublic: jest.fn() };
  const dataSource = { query: jest.fn() };
  let service: CommunityTransparencyService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new CommunityTransparencyService(communities as any, dataSource as any);
  });

  it('rejects an unknown or inactive community before aggregating', async () => {
    communities.listPublic.mockResolvedValue([]);
    await expect(service.get('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it.each([1999, 2101, 2025.5])('rejects invalid year %s', async (year) => {
    await expect(service.get('devparana', year)).rejects.toBeInstanceOf(BadRequestException);
    expect(communities.listPublic).not.toHaveBeenCalled();
  });

  it('returns only public aggregates and activities for the requested event year', async () => {
    communities.listPublic.mockResolvedValue([publicCommunity]);
    dataSource.query.mockResolvedValue([{
      events: '2',
      participations: '3',
      certificates: '1',
      eventHours: '4.50',
      availableYears: [2024, 2026],
      upcomingActivities: [{
        key: 'managed:1', title: 'Próximo', kind: 'managed',
        startAt: '2026-12-01T12:00:00.000Z', attendeeEmail: 'hidden@example.com',
      }],
      recentActivities: [{
        key: 'external:2', title: 'Anterior', kind: 'external',
        startAt: '2026-01-01T12:00:00.000Z', memberId: 'hidden',
      }],
    }]);

    await expect(service.get('devparana', 2026)).resolves.toEqual({
      community: { slug: 'devparana', name: 'DevParaná' },
      responsible: publicCommunity.responsible,
      year: 2026,
      availableYears: [2024, 2026],
      metrics: { events: 2, participations: 3, certificates: 1, eventHours: 4.5 },
      upcomingActivities: [{
        key: 'managed:1', title: 'Próximo', kind: 'managed',
        startAt: '2026-12-01T12:00:00.000Z',
      }],
      recentActivities: [{
        key: 'external:2', title: 'Anterior', kind: 'external',
        startAt: '2026-01-01T12:00:00.000Z',
      }],
    });
    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('WITH eligible_events'), ['devparana', 2026]);
  });

  it('normalizes an empty all-time projection', async () => {
    communities.listPublic.mockResolvedValue([publicCommunity]);
    dataSource.query.mockResolvedValue([{
      events: 0, participations: 0, certificates: 0, eventHours: null,
      availableYears: [], upcomingActivities: [], recentActivities: [],
    }]);
    const result = await service.get('devparana');
    expect(result.year).toBeNull();
    expect(result.metrics.eventHours).toBe(0);
    expect(dataSource.query).toHaveBeenCalledWith(expect.any(String), ['devparana', null]);
  });
});

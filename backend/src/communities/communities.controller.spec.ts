import { CommunitiesController } from './communities.controller';

describe('CommunitiesController public transparency', () => {
  it('delegates the community slug and optional year', async () => {
    const communities = {};
    const transparency = { get: jest.fn().mockResolvedValue({ metrics: {} }) };
    const controller = new CommunitiesController(communities as any, transparency as any);

    await controller.publicTransparency('devparana', { year: 2026 });
    expect(transparency.get).toHaveBeenCalledWith('devparana', 2026);
  });
});

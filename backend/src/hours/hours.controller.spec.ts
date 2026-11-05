import { HoursController } from './hours.controller';

describe('HoursController', () => {
  it('delegates creation to the authenticated actor', async () => {
    const service = { create: jest.fn().mockResolvedValue({ id: 'hour-1' }) };
    const controller = new HoursController(service as any);
    const user = { sub: 'member-1' } as any;
    const dto = { description: 'Atividade' } as any;

    await controller.create(dto, { user });

    expect(service.create).toHaveBeenCalledWith(dto, user);
  });

  it('delegates the approved balance to the authenticated actor', async () => {
    const service = { myApprovedSummary: jest.fn().mockResolvedValue({ totalHours: 1001.25 }) };
    const controller = new HoursController(service as any);
    const user = { sub: 'member-1' } as any;

    await expect((controller as any).mySummary({ user })).resolves.toEqual({ totalHours: 1001.25 });
    expect(service.myApprovedSummary).toHaveBeenCalledWith(user.sub);
  });
});

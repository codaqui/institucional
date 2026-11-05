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
});

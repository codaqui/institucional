import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateHourEntryDto } from './create-hour-entry.dto';
import { RejectHourEntryDto } from './review-hour-entry.dto';
import { HourEntrySource } from '../entities/hour-entry.entity';

describe('hour input DTOs', () => {
  it('rejects blank labels and idempotency keys', async () => {
    const dto = plainToInstance(CreateHourEntryDto, {
      sourceType: HourEntrySource.DIRECTORATE_ACTIVITY,
      sourceId: '11111111-1111-1111-1111-111111111111',
      sourceLabel: '   ',
      hours: 1,
      description: 'Atividade',
      occurredAt: '2026-01-01T00:00:00.000Z',
      idempotencyKey: '   ',
    });
    expect((await validate(dto)).map((error) => error.property)).toEqual(
      expect.arrayContaining(['sourceLabel', 'idempotencyKey']),
    );
  });

  it('rejects a blank rejection reason', async () => {
    const dto = plainToInstance(RejectHourEntryDto, { reason: '   ' });
    await expect(validate(dto)).resolves.toHaveLength(1);
  });
});

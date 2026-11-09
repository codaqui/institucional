import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProjectHourDto } from './project-hour.dto';

describe('CreateProjectHourDto', () => {
  it('requires member, positive hours and idempotency key', async () => {
    const dto = plainToInstance(CreateProjectHourDto, {
      memberId: 'not-uuid', hours: 0, occurredAt: 'invalid', description: '', idempotencyKey: ' ',
    });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining([
      'memberId', 'hours', 'occurredAt', 'description', 'idempotencyKey',
    ]));
  });
});

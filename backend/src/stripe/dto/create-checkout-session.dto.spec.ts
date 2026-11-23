import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateCheckoutSessionDto } from './create-checkout-session.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

function validate(
  payload: Record<string, unknown>,
): Promise<CreateCheckoutSessionDto> {
  return pipe.transform(payload, {
    type: 'body',
    metatype: CreateCheckoutSessionDto,
    data: '',
  }) as Promise<CreateCheckoutSessionDto>;
}

const base = {
  communityId: 'tesouro-geral',
  uiMode: 'embedded_page',
  returnPath: '/participe/apoiar',
};

describe('CreateCheckoutSessionDto', () => {
  it.each([100, 2500, 100_001, 5_000_000])(
    'accepts %p cents',
    async (amount) => {
      await expect(validate({ ...base, amount })).resolves.toMatchObject({
        amount,
      });
    },
  );

  it.each([99, 5_000_001, 0, -100, 150.5, '1000', null, undefined, Number.NaN])(
    'rejects amount %p',
    async (amount) => {
      await expect(validate({ ...base, amount })).rejects.toThrow(
        BadRequestException,
      );
    },
  );

  it('accepts a recurring payload sent by the donation flow', async () => {
    await expect(
      validate({ ...base, amount: 1000, recurring: { interval: 'month' } }),
    ).resolves.toMatchObject({ recurring: { interval: 'month' } });
  });

  it('rejects an unknown recurring interval', async () => {
    await expect(
      validate({ ...base, amount: 1000, recurring: { interval: 'week' } }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects unexpected fields', async () => {
    await expect(
      validate({ ...base, amount: 1000, memberId: 'forjado' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a missing communityId', async () => {
    await expect(validate({ amount: 1000 })).rejects.toThrow(
      BadRequestException,
    );
  });
});

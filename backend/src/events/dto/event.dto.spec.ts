import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateEventDto } from './event.dto';

describe('UpdateEventDto', () => {
  it('rejects adultOnly null with a 400 validation error', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    await expect(
      pipe.transform(
        { adultOnly: null },
        { type: 'body', metatype: UpdateEventDto, data: '' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

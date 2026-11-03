import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateEventDto, UpdateEventDto } from './event.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

describe('event adultOnly validation', () => {
  it('rejects the string "false" on create with a 400 validation error', async () => {
    await expect(
      pipe.transform(
        {
          slug: 'evento-estrito',
          title: 'Evento',
          summary: 'Resumo',
          location: 'Maringá',
          startAt: '2026-12-10T18:00',
          communityProjectKey: 'devparana',
          adultOnly: 'false',
        },
        { type: 'body', metatype: CreateEventDto, data: '' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects the string "false" on update with a 400 validation error', async () => {
    await expect(
      pipe.transform(
        { adultOnly: 'false' },
        { type: 'body', metatype: UpdateEventDto, data: '' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects adultOnly null on update with a 400 validation error', async () => {
    await expect(
      pipe.transform(
        { adultOnly: null },
        { type: 'body', metatype: UpdateEventDto, data: '' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

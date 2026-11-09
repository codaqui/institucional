import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateAssemblyDto, UpdateAssemblyDto } from './assembly.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

const validDiscussionUrl =
  'https://github.com/codaqui/institucional/discussions/42';
const validCreatePayload = {
  entityId: '00000000-0000-4000-8000-000000000001',
  type: 'ordinaria',
  title: 'Assembleia ordinária',
  scheduledAt: '2026-11-10T18:00:00.000Z',
  agendaSummary: 'Resumo curto da pauta.',
  discussionUrl: validDiscussionUrl,
};

function create(payload: Record<string, unknown>): Promise<CreateAssemblyDto> {
  return pipe.transform(payload, {
    type: 'body',
    metatype: CreateAssemblyDto,
    data: '',
  }) as Promise<CreateAssemblyDto>;
}

function update(payload: Record<string, unknown>): Promise<UpdateAssemblyDto> {
  return pipe.transform(payload, {
    type: 'body',
    metatype: UpdateAssemblyDto,
    data: '',
  }) as Promise<UpdateAssemblyDto>;
}

describe('CreateAssemblyDto', () => {
  it('transforms dates and trims bounded text', async () => {
    const dto = await create({
      ...validCreatePayload,
      title: '  Assembleia ordinária  ',
      agendaSummary: '  Resumo curto.  ',
      notaryRegistry: {
        book: '  Livro 01  ',
        page: ' 42 ',
        registeredAt: '2026-11-11T12:00:00.000Z',
      },
    });

    expect(dto.title).toBe('Assembleia ordinária');
    expect(dto.agendaSummary).toBe('Resumo curto.');
    expect(dto.scheduledAt).toEqual(new Date('2026-11-10T18:00:00.000Z'));
    expect(dto.notaryRegistry).toEqual({
      book: 'Livro 01',
      page: '42',
      registeredAt: new Date('2026-11-11T12:00:00.000Z'),
    });
  });

  it.each([
    ['title', '   '],
    ['agendaSummary', '   '],
    ['title', 'a'.repeat(161)],
    ['agendaSummary', 'a'.repeat(1001)],
  ])('rejects invalid bounded text in %s', async (field, value) => {
    await expect(
      create({ ...validCreatePayload, [field]: value }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid type and scheduledAt', async () => {
    await expect(
      create({ ...validCreatePayload, type: 'extra' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      create({ ...validCreatePayload, scheduledAt: 'not-a-date' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    'http://github.com/codaqui/institucional/discussions/42',
    'https://evil.example/codaqui/institucional/discussions/42',
    'https://github.com/codaqui/institucional/discussions/42/',
    'https://github.com/codaqui/institucional/discussions/42?tab=comments',
  ])('rejects invalid Discussion URL %s', async (discussionUrl) => {
    await expect(
      create({ ...validCreatePayload, discussionUrl }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires HTTPS for an optional PDF URL', async () => {
    await expect(
      create({
        ...validCreatePayload,
        ataPdfUrl: 'http://drive.google.com/ata',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects incomplete notary registry data', async () => {
    await expect(
      create({
        ...validCreatePayload,
        notaryRegistry: { book: 'Livro 01', page: '42' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['number', 'status', 'heldAt', 'createdById'])(
    'does not accept server-owned field %s on creation',
    async (field) => {
      await expect(
        create({ ...validCreatePayload, [field]: 'unexpected' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});

describe('UpdateAssemblyDto', () => {
  it('transforms heldAt and accepts a valid status transition payload', async () => {
    const dto = await update({
      status: 'held',
      heldAt: '2026-11-10T20:00:00.000Z',
    });

    expect(dto.status).toBe('held');
    expect(dto.heldAt).toEqual(new Date('2026-11-10T20:00:00.000Z'));
  });

  it.each(['type', 'number', 'discussionUrl', 'createdById'])(
    'does not accept immutable or private field %s',
    async (field) => {
      await expect(update({ [field]: 'unexpected' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it('allows clearing optional PDF and notary data for domain validation', async () => {
    await expect(
      update({ ataPdfUrl: null, notaryRegistry: null }),
    ).resolves.toMatchObject({ ataPdfUrl: null, notaryRegistry: null });
  });

  it('rejects an invalid status', async () => {
    await expect(update({ status: 'scheduled-ish' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each(['title', 'scheduledAt', 'status', 'agendaSummary'])(
    'rejects null in non-nullable field %s',
    async (field) => {
      await expect(update({ [field]: null })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it('accepts null only in nullable transition and notary fields', async () => {
    await expect(
      update({ heldAt: null, ataPdfUrl: null, notaryRegistry: null }),
    ).resolves.toMatchObject({
      heldAt: null,
      ataPdfUrl: null,
      notaryRegistry: null,
    });
  });
});

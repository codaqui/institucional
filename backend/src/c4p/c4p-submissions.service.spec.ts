import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DEFAULT_CRITERIA } from './c4p.constants';
import { C4pSubmissionsService } from './c4p-submissions.service';
import { C4pCall } from './entities/c4p-call.entity';

const makeCall = (overrides: Partial<C4pCall> = {}): C4pCall =>
  ({
    id: 'call-1',
    slug: 'devpr-conf-2026',
    name: 'C4P DevPR Conf 2026',
    status: 'open',
    submissionOpenAt: null,
    submissionCloseAt: null,
    criteria: DEFAULT_CRITERIA,
    ...overrides,
  }) as C4pCall;

const validDto = {
  speakerName: 'Maria Silva',
  speakerEmail: 'maria@example.com',
  title: 'Intro ao TypeScript',
  summary: 'Uma palestra introdutória.',
  consent: true as const,
};

describe('C4pSubmissionsService', () => {
  let callsService: Record<string, jest.Mock>;
  let talksRepo: Record<string, jest.Mock>;
  let emailService: Record<string, jest.Mock>;
  let service: C4pSubmissionsService;

  beforeEach(() => {
    callsService = { getBySlug: jest.fn().mockResolvedValue(makeCall()) };
    talksRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((talk) => Promise.resolve({ id: 'talk-1', ...talk })),
    };
    emailService = { sendTemplate: jest.fn().mockResolvedValue(undefined) };
    service = new C4pSubmissionsService(
      callsService as never,
      talksRepo as never,
      emailService as never,
    );
  });

  it('grava com origin public_form e consentAt, retorna só o id', async () => {
    const result = await service.submit('devpr-conf-2026', validDto);
    expect(result).toEqual({ id: 'talk-1' });
    expect(talksRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        callId: 'call-1',
        origin: 'public_form',
        consentAt: expect.any(Date),
        speakerName: 'Maria Silva',
      }),
    );
  });

  it('envia o e-mail de confirmação fire-and-forget', async () => {
    await service.submit('devpr-conf-2026', validDto);
    expect(emailService.sendTemplate).toHaveBeenCalledWith(
      'c4p-submission-confirmation',
      'maria@example.com',
      expect.objectContaining({
        attendeeName: 'Maria Silva',
        c4pCallName: 'C4P DevPR Conf 2026',
        c4pTalkTitle: 'Intro ao TypeScript',
      }),
      expect.any(Object),
    );
  });

  it('falha de e-mail não derruba a submissão', async () => {
    emailService.sendTemplate.mockRejectedValue(new Error('smtp down'));
    await expect(
      service.submit('devpr-conf-2026', validDto),
    ).resolves.toEqual({ id: 'talk-1' });
  });

  it('propaga 404 da campanha', async () => {
    callsService.getBySlug.mockRejectedValue(
      new NotFoundException('Campanha não encontrada.'),
    );
    await expect(service.submit('nope', validDto)).rejects.toThrow(
      NotFoundException,
    );
  });

  it.each([['draft'], ['closed']])(
    'rejeita submissão em campanha %s com 409',
    async (status) => {
      callsService.getBySlug.mockResolvedValue(makeCall({ status }));
      await expect(service.submit('devpr-conf-2026', validDto)).rejects.toThrow(
        ConflictException,
      );
    },
  );

  it('rejeita submissão fora da janela (encerrada)', async () => {
    callsService.getBySlug.mockResolvedValue(
      makeCall({ submissionCloseAt: new Date('2026-01-01T00:00:00Z') }),
    );
    await expect(service.submit('devpr-conf-2026', validDto)).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejeita submissão antes da abertura da janela', async () => {
    callsService.getBySlug.mockResolvedValue(
      makeCall({
        submissionOpenAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    );
    await expect(service.submit('devpr-conf-2026', validDto)).rejects.toThrow(
      ConflictException,
    );
  });

  it.each([
    ['http://linkedin.com/in/maria'],
    ['https://user:pass@linkedin.com/in/maria'],
  ])('rejeita linkedin inseguro (%s)', async (linkedin) => {
    await expect(
      service.submit('devpr-conf-2026', { ...validDto, linkedin }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejeita photoUrl sem https', async () => {
    await expect(
      service.submit('devpr-conf-2026', {
        ...validDto,
        photoUrl: 'http://img.example.com/x.jpg',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejeita ausência de consentimento', async () => {
    await expect(
      service.submit('devpr-conf-2026', {
        ...validDto,
        consent: false as true,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

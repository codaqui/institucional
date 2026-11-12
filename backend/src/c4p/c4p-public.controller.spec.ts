import { Test } from '@nestjs/testing';
import { TurnstileGuard } from '../common/turnstile/turnstile.guard';
import { C4pPublicController } from './c4p-public.controller';
import { C4pSubmissionsService } from './c4p-submissions.service';

describe('C4pPublicController (submissions)', () => {
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      submit: jest.fn().mockResolvedValue({ id: 'talk-1' }),
    };
    const module = await Test.createTestingModule({
      controllers: [C4pPublicController],
      providers: [
        { provide: C4pSubmissionsService, useValue: service },
      ],
    })
      .overrideGuard(TurnstileGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(C4pPublicController);
  });

  let controller: C4pPublicController;

  it('POST submissions responde apenas o id, sem PII', async () => {
    const body = await controller.submit('devpr-conf-2026', {
      speakerName: 'Maria Silva',
      speakerEmail: 'maria@example.com',
      title: 'Intro ao TypeScript',
      summary: 'Resumo.',
      consent: true,
    });
    expect(Object.keys(body)).toEqual(['id']);
    expect(service.submit).toHaveBeenCalledWith(
      'devpr-conf-2026',
      expect.objectContaining({ consent: true }),
    );
  });
});

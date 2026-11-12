import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TurnstileGuard } from '../common/turnstile/turnstile.guard';
import { C4pCallsService } from './c4p-calls.service';
import { C4pDashboardService } from './c4p-dashboard.service';
import { C4pPublicController } from './c4p-public.controller';
import { C4pSubmissionsService } from './c4p-submissions.service';

describe('C4pPublicController', () => {
  let controller: C4pPublicController;
  let submissions: Record<string, jest.Mock>;
  let calls: Record<string, jest.Mock>;
  let dashboard: Record<string, jest.Mock>;

  beforeEach(async () => {
    submissions = { submit: jest.fn().mockResolvedValue({ id: 'talk-1' }) };
    calls = {
      listPublic: jest.fn().mockResolvedValue([{ slug: 'devpr-conf-2026' }]),
      getPublicBySlug: jest
        .fn()
        .mockResolvedValue({ slug: 'devpr-conf-2026', status: 'open' }),
    };
    dashboard = {
      getPublicResults: jest.fn().mockResolvedValue({
        slug: 'devpr-conf-2026',
        talks: [{ title: 'A', speakerName: 'Maria', track: null, level: null }],
      }),
      getSnapshot: jest.fn().mockResolvedValue({ generatedAt: 'x', calls: [] }),
    };
    const module = await Test.createTestingModule({
      controllers: [C4pPublicController],
      providers: [
        { provide: C4pSubmissionsService, useValue: submissions },
        { provide: C4pCallsService, useValue: calls },
        { provide: C4pDashboardService, useValue: dashboard },
      ],
    })
      .overrideGuard(TurnstileGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(C4pPublicController);
  });

  it('POST submissions responde apenas o id, sem PII', async () => {
    const body = await controller.submit('devpr-conf-2026', {
      speakerName: 'Maria Silva',
      speakerEmail: 'maria@example.com',
      title: 'Intro ao TypeScript',
      summary: 'Resumo.',
      consent: true,
    });
    expect(Object.keys(body)).toEqual(['id']);
    expect(submissions.submit).toHaveBeenCalledWith(
      'devpr-conf-2026',
      expect.objectContaining({ consent: true }),
    );
  });

  it('GET calls retorna a lista pública', async () => {
    const result = await controller.listCalls();
    expect(calls.listPublic).toHaveBeenCalled();
    expect(result).toEqual([{ slug: 'devpr-conf-2026' }]);
  });

  it('GET calls/:slug retorna a campanha pública', async () => {
    const result = await controller.getCall('devpr-conf-2026');
    expect(calls.getPublicBySlug).toHaveBeenCalledWith('devpr-conf-2026');
    expect(result.status).toBe('open');
  });

  it('GET calls/:slug/results propaga 404 quando não publicado', async () => {
    dashboard.getPublicResults.mockRejectedValue(
      new NotFoundException('Resultado não publicado.'),
    );
    await expect(controller.getResults('devpr-conf-2026')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('GET snapshot retorna o payload do snapshot', async () => {
    const result = await controller.getSnapshot();
    expect(dashboard.getSnapshot).toHaveBeenCalled();
    expect(result).toEqual({ generatedAt: 'x', calls: [] });
  });
});

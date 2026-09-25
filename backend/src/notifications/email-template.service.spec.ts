import { BadRequestException } from '@nestjs/common';
import { EmailTemplateService } from './email-template.service';
import { EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION } from './email.service';

// marked v18 e htmlparser2 v12 (dep do sanitize-html) são ESM-only e o
// runtime CJS do Jest não consegue carregá-los. Como o backend roda em
// Node 24+, carregamos os pacotes reais via require(esm) nativo do Node,
// fora do registry do Jest (process.getBuiltinModule contorna o shim que o
// Jest aplica ao builtin 'module').
jest.mock('marked', () => {
  const { createRequire } = process.getBuiltinModule('module');
  return createRequire(__filename)('marked');
});

jest.mock('sanitize-html/node_modules/htmlparser2', () => {
  const { createRequire } = process.getBuiltinModule('module');
  const nodeRequire = createRequire(
    require.resolve('sanitize-html/package.json'),
  );
  return nodeRequire('htmlparser2');
});

const makeOverride = (overrides: Record<string, unknown> = {}) => ({
  id: EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION,
  subject: 'Inscrição ok — {{eventTitle}}',
  bodyMarkdown: 'Oi **{{attendeeName}}**, te esperamos em {{eventTitle}}!',
  updatedAt: new Date('2026-09-01T00:00:00Z'),
  ...overrides,
});

const makeCtx = (overrides: Record<string, unknown> = {}) => ({
  attendeeName: 'Ana',
  eventTitle: 'Evento X',
  eventStartAt: new Date('2026-08-10T13:00:00Z'),
  eventTimeZone: 'America/Sao_Paulo',
  ...overrides,
});

describe('EmailTemplateService.render', () => {
  let repo: Record<string, jest.Mock>;
  let service: EmailTemplateService;

  beforeEach(() => {
    repo = { findOneBy: jest.fn().mockResolvedValue(null) };
    service = new EmailTemplateService(repo as any);
  });

  it('renderiza o template padrão quando não há override', async () => {
    const r = await service.render(EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION, makeCtx());
    expect(r.subject).toBe('Inscrição confirmada — Evento X');
    expect(r.html).toContain('<strong>Evento X</strong>');
    expect(r.text).toContain('Sua inscrição em');
    expect(r.html).not.toContain('token-de-exemplo');
  });

  it('usa subject e Markdown do override quando existe', async () => {
    repo.findOneBy.mockResolvedValue(makeOverride());
    const r = await service.render(EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION, makeCtx());
    expect(r.subject).toBe('Inscrição ok — Evento X');
    expect(r.html).toContain('<strong>Ana</strong>');
  });

  it('rejeita template desconhecido com BadRequestException', async () => {
    await expect(service.render('nope', makeCtx())).rejects.toThrow(BadRequestException);
  });

  it('mantém placeholder desconhecido visível no output', async () => {
    repo.findOneBy.mockResolvedValue(
      makeOverride({ bodyMarkdown: 'Olá {{naoExiste}}!' }),
    );
    const r = await service.render(EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION, makeCtx());
    expect(r.text).toContain('{{naoExiste}}');
  });

  it('remove script e links javascript do HTML sanitizado', async () => {
    repo.findOneBy.mockResolvedValue(
      makeOverride({
        bodyMarkdown:
          'Olá [clique](javascript:alert(1))<script>alert(2)</script><img src=x onerror=alert(3)>',
      }),
    );
    const r = await service.render(EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION, makeCtx());
    expect(r.html).not.toContain('<script>');
    expect(r.html).not.toContain('javascript:');
    expect(r.html).not.toContain('onerror');
  });

  it('cai no template padrão quando o lookup do banco falha', async () => {
    repo.findOneBy.mockRejectedValue(new Error('connection lost'));
    const r = await service.render(EMAIL_TEMPLATE_REGISTRATION_CONFIRMATION, makeCtx());
    expect(r.subject).toBe('Inscrição confirmada — Evento X');
  });
});

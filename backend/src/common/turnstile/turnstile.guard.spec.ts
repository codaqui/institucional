import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TurnstileGuard } from './turnstile.guard';
import { TurnstileService } from './turnstile.service';

describe('TurnstileGuard', () => {
  const originalEnv = { ...process.env };
  let service: jest.Mocked<Pick<TurnstileService, 'verify'>>;
  let guard: TurnstileGuard;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test';
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    process.env.TURNSTILE_ALLOWED_HOSTNAMES =
      'codaqui.dev,www.codaqui.dev,tisocial.org.br';
    service = { verify: jest.fn().mockResolvedValue(true) };
    guard = new TurnstileGuard(service as TurnstileService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  function contextFor(options: {
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
    hostname?: string;
  }): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          body: options.body ?? {},
          headers: options.headers ?? {},
          hostname: options.hostname ?? 'codaqui.dev',
          ip: '192.0.2.1',
        }),
      }),
    } as ExecutionContext;
  }

  it('fails closed in production without a secret', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TURNSTILE_SECRET_KEY;

    await expect(guard.canActivate(contextFor({}))).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(service.verify).not.toHaveBeenCalled();
  });

  it('is a no-op without a secret outside production', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;

    await expect(guard.canActivate(contextFor({}))).resolves.toBe(true);
    expect(service.verify).not.toHaveBeenCalled();
  });

  it('verifies the body token with the validated request hostname', async () => {
    const context = contextFor({ body: { turnstileToken: 'body-token' } });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(service.verify).toHaveBeenCalledWith(
      'body-token',
      '192.0.2.1',
      'codaqui.dev',
    );
  });

  it('reads the token from the Turnstile header when the body has none', async () => {
    const context = contextFor({
      headers: { 'cf-turnstile-token': 'header-token' },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(service.verify).toHaveBeenCalledWith(
      'header-token',
      '192.0.2.1',
      'codaqui.dev',
    );
  });

  it('rejects a missing token when verification is configured', async () => {
    await expect(guard.canActivate(contextFor({}))).rejects.toThrow(
      BadRequestException,
    );
    expect(service.verify).not.toHaveBeenCalled();
  });

  it('rejects a hostname outside the exact allow-list', async () => {
    const context = contextFor({
      body: { turnstileToken: 'token' },
      hostname: 'codaqui.dev.evil.example',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    expect(service.verify).not.toHaveBeenCalled();
  });

  it('rejects a token refused by the verification service', async () => {
    service.verify.mockResolvedValue(false);
    const context = contextFor({ body: { turnstileToken: 'invalid-token' } });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });
});

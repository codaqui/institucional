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

  it.each([
    [{ origin: 'https://codaqui.dev/form' }, 'codaqui.dev'],
    [{ referer: 'https://tisocial.org.br/form' }, 'tisocial.org.br'],
    [{ 'x-forwarded-host': 'www.codaqui.dev:443' }, 'www.codaqui.dev'],
  ])(
    'verifies the frontend hostname from %p when the API hostname differs',
    async (headers, expectedHostname) => {
      const context = contextFor({
        body: { turnstileToken: 'token' },
        headers,
        hostname: 'api.codaqui.dev',
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(service.verify).toHaveBeenCalledWith(
        'token',
        '192.0.2.1',
        expectedHostname,
      );
    },
  );

  it('prefers Origin over Referer and X-Forwarded-Host', async () => {
    const context = contextFor({
      body: { turnstileToken: 'token' },
      headers: {
        origin: 'https://codaqui.dev',
        referer: 'https://tisocial.org.br/form',
        'x-forwarded-host': 'www.codaqui.dev',
      },
      hostname: 'api.codaqui.dev',
    });

    await guard.canActivate(context);

    expect(service.verify).toHaveBeenCalledWith(
      'token',
      '192.0.2.1',
      'codaqui.dev',
    );
  });

  it('rejects an invalid Origin even when the API hostname is allowed', async () => {
    const context = contextFor({
      body: { turnstileToken: 'token' },
      headers: { origin: 'https://codaqui.dev.evil.example' },
      hostname: 'codaqui.dev',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    expect(service.verify).not.toHaveBeenCalled();
  });

  it('rejects a malformed frontend URL', async () => {
    const context = contextFor({
      body: { turnstileToken: 'token' },
      headers: { origin: 'not-a-url' },
      hostname: 'codaqui.dev',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    expect(service.verify).not.toHaveBeenCalled();
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

  it('prefers the body token when the Turnstile header is also present', async () => {
    const context = contextFor({
      body: { turnstileToken: 'body-token' },
      headers: { 'cf-turnstile-token': 'header-token' },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(service.verify).toHaveBeenCalledWith(
      'body-token',
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

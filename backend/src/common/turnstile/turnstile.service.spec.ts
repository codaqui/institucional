import { Logger } from '@nestjs/common';
import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  const originalEnv = { ...process.env };
  let service: TurnstileService;
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test';
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    service = new TurnstileService();
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  function mockVerification(response: object, status = 200): void {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(response), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
  }

  it('accepts a successful verification for the exact hostname', async () => {
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');
    mockVerification({ success: true, hostname: 'codaqui.dev' });

    await expect(
      service.verify('token', '192.0.2.1', 'codaqui.dev'),
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );
    const body = fetchMock.mock.calls[0][1]?.body;
    expect(new URLSearchParams(body as string).toString()).toBe(
      'secret=test-secret&response=token&remoteip=192.0.2.1',
    );
    expect(timeoutSpy).toHaveBeenCalledWith(5000);
  });

  it('rejects a valid token for another hostname', async () => {
    mockVerification({ success: true, hostname: 'other.example' });

    await expect(
      service.verify('token', undefined, 'codaqui.dev'),
    ).resolves.toBe(false);
  });

  it('rejects an unsuccessful verification', async () => {
    mockVerification({ success: false, hostname: 'codaqui.dev' });

    await expect(
      service.verify('token', undefined, 'codaqui.dev'),
    ).resolves.toBe(false);
  });

  it('fails closed when verification times out', async () => {
    fetchMock.mockRejectedValue(new DOMException('Timed out', 'TimeoutError'));

    await expect(
      service.verify('token', undefined, 'codaqui.dev'),
    ).resolves.toBe(false);
  });

  it('rejects a replay of a verified token for five minutes', async () => {
    mockVerification({ success: true, hostname: 'codaqui.dev' });

    await expect(
      service.verify('reused-token', undefined, 'codaqui.dev'),
    ).resolves.toBe(true);
    await expect(
      service.verify('reused-token', undefined, 'codaqui.dev'),
    ).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('verifies a token again after the replay cache expires', async () => {
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    mockVerification({ success: true, hostname: 'codaqui.dev' });

    await expect(
      service.verify('expiring-token', undefined, 'codaqui.dev'),
    ).resolves.toBe(true);
    now += 5 * 60 * 1000 + 1;
    await expect(
      service.verify('expiring-token', undefined, 'codaqui.dev'),
    ).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('is a no-op without a secret outside production', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;

    await expect(service.verify('token')).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed without a secret in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TURNSTILE_SECRET_KEY;

    await expect(service.verify('token')).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

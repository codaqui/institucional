import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';

interface TurnstileVerificationResponse {
  success?: unknown;
  hostname?: unknown;
}

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);
  private readonly verifiedTokens = new Map<string, number>();

  async verify(
    token: string,
    remoteIp?: string,
    expectedHostname?: string,
  ): Promise<boolean> {
    const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
    if (!secret) {
      if (process.env.NODE_ENV === 'production') return false;
      this.logger.warn(
        'TURNSTILE_SECRET_KEY não configurada; verificação ignorada fora de produção.',
      );
      return true;
    }

    const digest = createHash('sha256').update(token).digest('hex');
    const now = Date.now();
    for (const [cachedDigest, expiresAt] of this.verifiedTokens) {
      if (expiresAt <= now) this.verifiedTokens.delete(cachedDigest);
    }
    if (this.verifiedTokens.has(digest)) return false;

    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);

    try {
      const response = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
          signal: AbortSignal.timeout(5000),
        },
      );
      const result = (await response.json()) as TurnstileVerificationResponse;
      if (result.success !== true) return false;
      if (
        expectedHostname !== undefined &&
        result.hostname !== expectedHostname
      ) {
        return false;
      }

      this.verifiedTokens.set(digest, now + 5 * 60 * 1000);
      return true;
    } catch {
      return false;
    }
  }
}

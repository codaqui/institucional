import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TurnstileService } from './turnstile.service';

@Injectable()
export class TurnstileGuard implements CanActivate {
  private readonly logger = new Logger(TurnstileGuard.name);

  constructor(private readonly turnstileService: TurnstileService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!process.env.TURNSTILE_SECRET_KEY?.trim()) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException(
          'Verificação de segurança indisponível.',
        );
      }
      this.logger.warn(
        'TURNSTILE_SECRET_KEY não configurada; guard ignorado fora de produção.',
      );
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      body?: { turnstileToken?: unknown };
      headers: Record<string, string | string[] | undefined>;
      hostname?: string;
      ip?: string;
    }>();
    const bodyToken = request.body?.turnstileToken;
    const headerToken = request.headers['cf-turnstile-token'];
    const token =
      typeof bodyToken === 'string' && bodyToken.length > 0
        ? bodyToken
        : typeof headerToken === 'string' && headerToken.length > 0
          ? headerToken
          : undefined;
    if (!token) {
      throw new BadRequestException('Token Turnstile obrigatório.');
    }

    const allowedHostnames = new Set(
      (process.env.TURNSTILE_ALLOWED_HOSTNAMES ?? '')
        .split(',')
        .map((hostname) => hostname.trim())
        .filter(Boolean),
    );
    const hostname = this.resolveFrontendHostname(request);
    if (!hostname || !allowedHostnames.has(hostname)) {
      throw new ForbiddenException('Hostname não permitido para Turnstile.');
    }

    const verified = await this.turnstileService.verify(
      token,
      request.ip,
      hostname,
    );
    if (!verified) {
      throw new ForbiddenException('Verificação Turnstile recusada.');
    }
    return true;
  }

  private resolveFrontendHostname(request: {
    headers: Record<string, string | string[] | undefined>;
    hostname?: string;
  }): string | undefined {
    const origin = this.headerValue(request.headers.origin);
    if (origin !== undefined) return this.urlHostname(origin);

    const referer = this.headerValue(request.headers.referer);
    if (referer !== undefined) return this.urlHostname(referer);

    const forwardedHost = this.headerValue(
      request.headers['x-forwarded-host'],
    );
    if (forwardedHost !== undefined) {
      return this.urlHostname(`https://${forwardedHost}`);
    }

    return request.hostname;
  }

  private headerValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private urlHostname(value: string): string | undefined {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        return undefined;
      }
      return url.hostname;
    } catch {
      return undefined;
    }
  }
}

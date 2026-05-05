import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard, IAuthModuleOptions } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

/**
 * Guard custom do GitHub OAuth que codifica o `returnTo` no parâmetro `state`
 * do fluxo OAuth (JWT assinado, 5min de validade).
 *
 * Por que `state` em vez de cookie:
 *   - O GitHub redireciona o browser **direto** para `BACKEND_URL/auth/github/callback`
 *     (URL fixa no OAuth App), sem passar pelo Worker da comunidade.
 *   - Cookies setados em `tisocial.org.br` (Worker) não viajam para o domínio do
 *     backend (`api.codaqui.dev`), então um cookie `returnTo` é inacessível
 *     no callback em deploys whitelabel.
 *   - O `state` viaja **dentro da URL** que o GitHub devolve, é signed JWT
 *     (proteção CSRF + integridade), e funciona cross-domain.
 *
 * O cookie do `ReturnToMiddleware` permanece como fallback de defesa em
 * profundidade caso o state falhe a decodificar.
 */
export const STATE_TTL_SECONDS = 5 * 60; // 5 minutos — janela do OAuth

export interface GithubOAuthStatePayload {
  returnTo?: string | null;
}

@Injectable()
export class GithubAuthGuard extends AuthGuard('github') {
  constructor(private readonly jwtService: JwtService) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext): IAuthModuleOptions {
    const req = context.switchToHttp().getRequest<Request>();
    const returnTo = (req.query?.returnTo as string | undefined) ?? null;
    const state = this.jwtService.sign(
      { returnTo } satisfies GithubOAuthStatePayload,
      { expiresIn: STATE_TTL_SECONDS },
    );
    return { state };
  }
}

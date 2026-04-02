import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

export interface JwtPayload {
  sub: string;       // UUID da tabela members (chave primária) — use para FKs
  githubId: string;  // GitHub numeric ID (referência externa)
  handle: string;    // githubHandle
  name: string;
  email: string;     // Email público usado no checkout
  avatarUrl: string;
  role: string;
  iat?: number;
  exp?: number;
}

const COOKIE_NAME = 'codaqui_token';

/**
 * Extrai o JWT de duas fontes, em ordem de prioridade:
 * 1. Cookie httpOnly `codaqui_token` (fluxo normal do frontend)
 * 2. Header `Authorization: Bearer <token>` (Swagger UI / clientes de API)
 */
const cookieExtractor = (req: Request): string | null =>
  req?.cookies?.[COOKIE_NAME] ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production');
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret || 'dev-secret-change-me',
      passReqToCallback: false,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    return payload;
  }
}

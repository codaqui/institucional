import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { isAllowedOrigin } from '../common/allowed-origins';

export const RETURN_TO_COOKIE = 'codaqui_return_to';
const RETURN_TO_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutos — janela do OAuth

/**
 * Captura `?returnTo=<url>` em `/auth/github` e `/auth/logout`, valida contra
 * `ALLOWED_RETURN_ORIGINS` e persiste em cookie httpOnly de curta duração.
 *
 * O cookie é lido no callback / no logout para redirecionar o navegador para a
 * comunidade certa (ex: tisocial.org.br) em vez do `FRONTEND_URL` global.
 */
@Injectable()
export class ReturnToMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const candidate = (req.query?.returnTo ?? '') as string;
    if (!candidate) return next();

    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      return next();
    }

    if (!isAllowedOrigin(parsed.origin)) {
      return next();
    }

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(RETURN_TO_COOKIE, parsed.toString(), {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: RETURN_TO_MAX_AGE_MS,
      path: '/',
    });
    return next();
  }
}

import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import type { Member } from '../members/entities/member.entity';
import { resolveReturnUrl } from '../common/allowed-origins';
import {
  GithubAuthGuard,
  type GithubOAuthStatePayload,
} from './github-auth.guard';
import { RETURN_TO_COOKIE } from './return-to.middleware';

const COOKIE_NAME = 'codaqui_token';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

// JWT efêmero usado **apenas** no handoff cross-domain do callback do GitHub:
// o backend devolve o token no fragment da URL (`#token=...`), o frontend lê
// e troca por um cookie de sessão via POST /auth/finalize (que passa pelo
// Worker, então o Set-Cookie cai no domínio whitelabel correto).
const HANDOFF_TOKEN_TTL = '2m';
const HANDOFF_AUDIENCE = 'auth-handoff';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly jwtService: JwtService) {}

  @Get('github')
  @UseGuards(GithubAuthGuard)
  @ApiOperation({
    summary: 'Iniciar OAuth com GitHub',
    description:
      'Redireciona o navegador para o fluxo OAuth do GitHub. Não chamar diretamente via fetch.',
  })
  @ApiResponse({
    status: 302,
    description: 'Redireciona para github.com/login/oauth.',
  })
  githubLogin() {
    // Passport redireciona automaticamente para github.com
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({
    summary: 'Callback OAuth do GitHub (uso interno do Passport)',
  })
  @ApiResponse({
    status: 302,
    description: 'Redireciona para o frontend com cookie JWT definido.',
  })
  async githubCallback(
    @Req() req: Request & { user: Member },
    @Res() res: Response,
  ) {
    const member = req.user;

    // JWT efêmero (2min) entregue no FRAGMENT da URL — não trafega ao servidor,
    // não vaza em logs/Referer. Será trocado pelo cookie de sessão via
    // POST /auth/finalize (que passa pelo Worker, fixando o cookie no domínio
    // certo). Inclui `aud: auth-handoff` para distinguir do JWT de sessão.
    const handoffToken = this.jwtService.sign(
      {
        sub: member.id,
        githubId: member.githubId,
        handle: member.githubHandle,
        name: member.name,
        email: member.email,
        avatarUrl: member.avatarUrl,
        role: member.role,
      },
      { expiresIn: HANDOFF_TOKEN_TTL, audience: HANDOFF_AUDIENCE },
    );

    // Resolve `returnTo` em duas camadas (defense in depth):
    //   1. `state` JWT (primário) — viaja na URL OAuth, funciona cross-domain.
    //   2. cookie `codaqui_return_to` (fallback) — só funciona quando o login
    //      termina no mesmo domínio onde começou (não é o caso whitelabel).
    let returnToCandidate: string | undefined;
    const stateRaw = req.query?.state as string | undefined;
    if (stateRaw) {
      try {
        const decoded =
          this.jwtService.verify<GithubOAuthStatePayload>(stateRaw);
        if (decoded.returnTo) returnToCandidate = decoded.returnTo;
      } catch {
        /* state inválido/expirado → fallback para cookie */
      }
    }
    if (!returnToCandidate) {
      returnToCandidate = (req.cookies as Record<string, string> | undefined)?.[
        RETURN_TO_COOKIE
      ];
    }
    res.clearCookie(RETURN_TO_COOKIE, { path: '/' });

    // Anexa o token no FRAGMENT — fragments nunca são enviados ao servidor.
    const target = resolveReturnUrl(returnToCandidate, '/auth/callback');
    const finalUrl = new URL(target);
    finalUrl.searchParams.set('status', 'success');
    finalUrl.hash = `token=${encodeURIComponent(handoffToken)}`;
    res.redirect(finalUrl.toString());
  }

  @Post('finalize')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Finaliza o login trocando o token de handoff pelo cookie de sessão',
    description:
      'Recebe o JWT efêmero (audience=auth-handoff) que veio no fragment do callback do GitHub, valida e define o cookie httpOnly de sessão. Necessário para deploys whitelabel onde o cookie precisa ser setado no domínio do Worker.',
  })
  @ApiResponse({ status: 200, description: 'Cookie de sessão definido.' })
  @ApiResponse({ status: 401, description: 'Token de handoff inválido/expirado.' })
  authFinalize(
    @Body() body: { token?: string },
    @Res() res: Response,
  ): Response {
    const handoff = body?.token;
    if (!handoff) {
      return res.status(401).json({ message: 'Token ausente' });
    }

    let payload: {
      sub: string;
      githubId: number;
      handle: string;
      name: string;
      email: string;
      avatarUrl: string;
      role: string;
    };
    try {
      payload = this.jwtService.verify(handoff, {
        audience: HANDOFF_AUDIENCE,
      });
    } catch {
      return res.status(401).json({ message: 'Token inválido ou expirado' });
    }

    // Reassina como token de sessão (sem audience, TTL longo do JwtModule).
    const sessionToken = this.jwtService.sign({
      sub: payload.sub,
      githubId: payload.githubId,
      handle: payload.handle,
      name: payload.name,
      email: payload.email,
      avatarUrl: payload.avatarUrl,
      role: payload.role,
    });

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      maxAge: COOKIE_MAX_AGE_MS,
      path: '/',
    });
    return res.json({ status: 'ok' });
  }

  @Get('me')
  @ApiOperation({
    summary: 'Retorna dados do usuário logado via cookie',
    description:
      'Lê o cookie `codaqui_token` e retorna o payload do JWT. Retorna 401 se não autenticado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payload do JWT do usuário logado.',
    schema: {
      type: 'object',
      properties: {
        sub: {
          type: 'string',
          description: 'Member UUID (chave primária do banco)',
        },
        githubId: { type: 'string', description: 'GitHub numeric ID' },
        handle: { type: 'string', example: 'johndoe' },
        name: { type: 'string', example: 'John Doe' },
        avatarUrl: { type: 'string', format: 'uri' },
        role: { type: 'string', example: 'membro' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  getMe(@Req() req: any, @Res() res: Response) {
    const token: string | undefined = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ message: 'Não autenticado.' });
    }
    try {
      const payload = this.jwtService.verify(token);
      return res.json(payload);
    } catch {
      return res.status(401).json({ message: 'Token inválido ou expirado.' });
    }
  }

  @Get('logout')
  @ApiOperation({
    summary: 'Encerrar sessão',
    description: 'Limpa o cookie JWT e redireciona para o frontend.',
  })
  @ApiResponse({
    status: 302,
    description: 'Cookie removido, redirecionado para o frontend.',
  })
  logout(@Req() req: Request, @Res() res: Response) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    const returnToCookie = (req.cookies as Record<string, string> | undefined)?.[
      RETURN_TO_COOKIE
    ];
    res.clearCookie(RETURN_TO_COOKIE, { path: '/' });
    const target = resolveReturnUrl(returnToCookie, '/');
    const finalUrl = new URL(target);
    finalUrl.searchParams.set('logged_out', 'true');
    res.redirect(finalUrl.toString());
  }
}

import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import type { Member } from '../members/entities/member.entity';

const COOKIE_NAME = 'codaqui_token';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly jwtService: JwtService) {}

  @Get('github')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({
    summary: 'Iniciar OAuth com GitHub',
    description: 'Redireciona o navegador para o fluxo OAuth do GitHub. Não chamar diretamente via fetch.',
  })
  @ApiResponse({ status: 302, description: 'Redireciona para github.com/login/oauth.' })
  githubLogin() {
    // Passport redireciona automaticamente para github.com
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'Callback OAuth do GitHub (uso interno do Passport)' })
  @ApiResponse({ status: 302, description: 'Redireciona para o frontend com cookie JWT definido.' })
  async githubCallback(@Req() req: { user: Member }, @Res() res: Response) {
    const member = req.user;
    const isProd = process.env.NODE_ENV === 'production';

    const token = this.jwtService.sign({
      sub: member.id,          // UUID da tabela members (chave primária)
      githubId: member.githubId, // GitHub numeric ID (referência externa)
      handle: member.githubHandle,
      name: member.name,
      email: member.email,
      avatarUrl: member.avatarUrl,
      role: member.role,
    });

    // Define cookie httpOnly — o JWT nunca toca o JavaScript do cliente.
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      maxAge: COOKIE_MAX_AGE_MS,
      path: '/',
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?status=success`);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Retorna dados do usuário logado via cookie',
    description: 'Lê o cookie `codaqui_token` e retorna o payload do JWT. Retorna 401 se não autenticado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payload do JWT do usuário logado.',
    schema: {
      type: 'object',
      properties: {
        sub: { type: 'string', description: 'Member UUID (chave primária do banco)' },
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
  @ApiResponse({ status: 302, description: 'Cookie removido, redirecionado para o frontend.' })
  logout(@Res() res: Response) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    res.redirect(`${frontendUrl}?logged_out=true`);
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtPayload } from '../jwt.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) return true;

    const { user }: { user?: JwtPayload } = context.switchToHttp().getRequest();
    if (!user) {
      throw new UnauthorizedException('Autenticação requerida.');
    }
    // Multi-role: basta haver interseção entre as roles do usuário e as exigidas
    const userRoles: string[] = user.roles ?? [];
    if (!requiredRoles.some((role) => userRoles.includes(role))) {
      throw new ForbiddenException('Acesso negado: role insuficiente.');
    }
    return true;
  }
}

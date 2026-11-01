import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from '../auth/jwt.strategy';
import { MemberRole } from '../members/entities/member.entity';
import {
  DESIGNATIONS_KEY,
  DesignationRequirement,
} from './designations.decorator';
import { DesignationsService } from './designations.service';

@Injectable()
export class DesignationsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly designationsService: DesignationsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<DesignationRequirement>(
      DESIGNATIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requirement) return true;

    const request = context.switchToHttp().getRequest<{
      user?: JwtPayload;
      params: Record<string, string | undefined>;
    }>();
    const user = request.user;
    if (!user) throw new UnauthorizedException('Autenticação requerida.');
    if (user.roles?.includes(MemberRole.ADMIN)) return true;

    const allowed = await this.designationsService.hasDesignation(user.sub, {
      targetType: requirement.targetType,
      targetId: request.params[requirement.targetIdParam],
      designation: requirement.designation,
    });
    if (!allowed) {
      throw new ForbiddenException('Acesso negado: designação insuficiente.');
    }
    return true;
  }
}

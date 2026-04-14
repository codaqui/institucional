import {
  Controller,
  Get,
  Put,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  BadRequestException,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { MemberRole } from './entities/member.entity';
import { UpdateMemberDto } from './dto/update-member.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

@Controller()
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly auditService: AuditService,
  ) {}

  // ── Público ──────────────────────────────────────────────────────────────
  // IMPORTANTE: rotas estáticas (/me, /admin/*) DEVEM vir antes de /:id
  // para evitar que o parâmetro dinâmico capture strings literais.

  @Get('members')
  findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.membersService.findAllActive(
      page ? Number.parseInt(String(page), 10) : 1,
      limit ? Number.parseInt(String(limit), 10) : 50,
    );
  }

  @Get('members/donors')
  findDonors(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.membersService.findDonors(
      page ? Number.parseInt(String(page), 10) : 1,
      limit ? Number.parseInt(String(limit), 10) : 50,
    );
  }

  // ── Membro logado ─────────────────────────────────────────────────────────
  // Declarado ANTES de GET /members/:id para não ser capturado pelo parâmetro.

  @Get('members/me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: { user: JwtPayload }) {
    // sub é agora o UUID da tabela members (desde a refatoração do JWT)
    return this.membersService.findOne(req.user.sub);
  }

  @Put('members/me')
  @UseGuards(JwtAuthGuard)
  updateMe(
    @Req() req: { user: JwtPayload },
    @Body() body: UpdateMemberDto,
  ) {
    return this.membersService.updateMeById(req.user.sub, body);
  }

  // ── Por ID (público) ──────────────────────────────────────────────────────
  // Deve vir DEPOIS de /members/me.

  private static readonly HANDLE_REGEX = /^[a-zA-Z0-9_-]+$/;

  @Get('members/by-handle/:handle')
  async findByHandle(@Param('handle') handle: string) {
    if (!MembersController.HANDLE_REGEX.test(handle)) {
      throw new BadRequestException('Handle inválido.');
    }
    const member = await this.membersService.findByHandle(handle);
    if (!member) throw new NotFoundException('Membro não encontrado.');
    return member;
  }

  @Get('members/:id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const member = await this.membersService.findOne(id);
    if (!member) throw new NotFoundException('Membro não encontrado.');
    return member;
  }

  @Get('members/:id/donations')
  async findMemberDonations(@Param('id', ParseUUIDPipe) id: string) {
    const member = await this.membersService.findOne(id);
    if (!member) throw new NotFoundException('Membro não encontrado.');
    return this.membersService.findMemberDonations(id);
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  @Get('admin/members')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findAllAdmin() {
    return this.membersService.findAll();
  }

  @Patch('admin/members/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async adminUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: JwtPayload },
    @Body() body: { role?: MemberRole; isActive?: boolean },
  ) {
    const result = await this.membersService.adminUpdate(id, body);

    // Audit trail
    let action: AuditAction | null = null;
    if (body.role) {
      action = AuditAction.ROLE_CHANGE;
    } else if (body.isActive === false) {
      action = AuditAction.MEMBER_DEACTIVATE;
    } else if (body.isActive === true) {
      action = AuditAction.MEMBER_ACTIVATE;
    }

    if (action) {
      void this.auditService.log({
        action,
        actorId: req.user.sub,
        actorHandle: req.user.handle,
        targetId: id,
        targetType: 'member',
        details: body,
      });
    }

    return result;
  }
}

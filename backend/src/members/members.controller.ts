import {
  Controller,
  Get,
  Put,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { MemberRole } from './entities/member.entity';

@Controller()
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  // ── Público ──────────────────────────────────────────────────────────────
  // IMPORTANTE: rotas estáticas (/me, /admin/*) DEVEM vir antes de /:id
  // para evitar que o parâmetro dinâmico capture strings literais.

  @Get('members')
  findAll() {
    return this.membersService.findAllActive();
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
    @Body() body: { bio?: string; linkedinUrl?: string },
  ) {
    return this.membersService.updateMeById(req.user.sub, body);
  }

  // ── Por ID (público) ──────────────────────────────────────────────────────
  // Deve vir DEPOIS de /members/me.

  @Get('members/:id')
  async findOne(@Param('id') id: string) {
    const member = await this.membersService.findOne(id);
    if (!member) throw new NotFoundException('Membro não encontrado.');
    return member;
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
  adminUpdate(
    @Param('id') id: string,
    @Body() body: { role?: MemberRole; isActive?: boolean },
  ) {
    return this.membersService.adminUpdate(id, body);
  }
}

import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberRole } from '../members/entities/member.entity';
import { CompaniesService } from './companies.service';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
} from './dto/company.dto';
import { DistributeCoinsDto } from './dto/distribute-coins.dto';
import { AdjustCompanyWalletDto } from '../club/dto/wallet.dto';
import { JwtPayload } from '../auth/jwt.strategy';

@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  private async assertCompanyAccess(
    companyId: string,
    user: JwtPayload,
  ): Promise<void> {
    if (user.role === MemberRole.ADMIN) return;
    const allowed = await this.companiesService.isMemberOfCompany(companyId, user.sub);
    if (!allowed) throw new ForbiddenException('Sem permissão');
  }

  // ── Empresa do membro autenticado ─────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async register(@Body() dto: CreateCompanyDto, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.companiesService.register(dto, user.sub);
  }

  @Get('my-collaborations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMyCollaborations(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.companiesService.findCollaborations(user.sub);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMyCompany(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.companiesService.findByMember(user.sub);
  }

  // ── Pública: patrocinadores (antes das rotas com :id para não ser capturada) ──

  @Get('sponsors')
  async listSponsors(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.companiesService.listSponsorsPaginated(
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Get('business-members')
  async listBusinessMembers() {
    return this.companiesService.listBusinessMemberIds();
  }

  @Get('member/:handle/public-affiliation')
  async getPublicAffiliationByHandle(@Param('handle') handle: string) {
    return this.companiesService.findPublicAffiliationByHandle(handle);
  }

  @Get(':id/public')
  async getCompanyPublicInfo(@Param('id', ParseUUIDPipe) id: string) {
    return this.companiesService.findPublicInfo(id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getCompany(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    await this.assertCompanyAccess(id, user);
    return this.companiesService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.companiesService.update(id, dto, user.sub);
  }

  // ── Carteira ──────────────────────────────────────────────────────────────

  @Get(':id/wallet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getWallet(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    await this.assertCompanyAccess(id, user);
    return this.companiesService.getOrCreateWallet(id);
  }

  @Get(':id/support-summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getSupportSummary(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    await this.assertCompanyAccess(id, user);
    return this.companiesService.getSupportSummary(id);
  }

  @Get(':id/wallet/transactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getTransactions(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const user = req.user as JwtPayload;
    await this.assertCompanyAccess(id, user);
    return this.companiesService.getTransactions(
      id,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Post(':id/wallet/distribute')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async distributeCoins(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DistributeCoinsDto,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.companiesService.distributeCoins(id, body.distributions, user.sub);
  }

  // ── Colaboradores ─────────────────────────────────────────────────────────

  @Get(':id/members')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getCollaborators(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    await this.assertCompanyAccess(id, user);
    return this.companiesService.getCollaborators(id);
  }

  @Post(':id/members')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async addCollaborator(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { githubHandle: string },
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.companiesService.addCollaborator(id, body.githubHandle, user.sub);
  }

  @Delete(':id/members/:memberId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async removeCollaborator(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    await this.companiesService.removeCollaborator(id, memberId, user.sub);
    return { ok: true };
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @ApiBearerAuth()
  async adminList(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.companiesService.findAllAdminPaginated(
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @ApiBearerAuth()
  async adminUpdateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: string },
  ) {
    return this.companiesService.updateStatus(id, body.status);
  }

  @Post('admin/wallet/adjust')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @ApiBearerAuth()
  async adminAdjust(@Body() dto: AdjustCompanyWalletDto) {
    return this.companiesService.manualAdjust(
      dto.companyId,
      dto.amount,
      dto.coinType,
      dto.description,
    );
  }
}

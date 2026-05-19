import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
import { ClubService } from './club.service';
import { RaffleService } from './raffle.service';
import { CreateRaffleDto } from './dto/create-raffle.dto';
import { EnterRaffleDto } from './dto/enter-raffle.dto';
import { AdjustWalletDto } from './dto/wallet.dto';
import { JwtPayload } from '../auth/jwt.strategy';
import { RaffleOwnerType } from './entities/raffle-entry.entity';

@ApiTags('club')
@Controller('club')
export class ClubController {
  constructor(
    private readonly clubService: ClubService,
    private readonly raffleService: RaffleService,
  ) {}

  // ── Wallet do membro autenticado ──────────────────────────────────────────

  @Get('wallet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMyWallet(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.clubService.getOrCreateWallet(user.sub);
  }

  @Get('wallet/transactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMyTransactions(
    @Req() req: Request,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const user = req.user as JwtPayload;
    return this.clubService.getTransactions(
      user.sub,
      Number.parseInt(page, 10),
      Number.parseInt(limit, 10),
    );
  }

  @Get('public-wallet/:handle')
  async getPublicWallet(
    @Param('handle') handle: string,
    @Query('limit') limit = '10',
  ) {
    return this.clubService.getPublicWalletByHandle(handle, Number.parseInt(limit, 10));
  }

  // ── Admin: ajuste manual de carteira ─────────────────────────────────────

  @Post('admin/wallet/adjust')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @ApiBearerAuth()
  async adjustWallet(@Body() dto: AdjustWalletDto) {
    return this.clubService.manualAdjust(
      dto.memberId,
      dto.amount,
      dto.coinType,
      dto.description,
    );
  }

  // ── Admin: histórico unificado de todas as carteiras ─────────────────────

  @Get('admin/wallet/all-transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @ApiBearerAuth()
  async adminAllTransactions(
    @Query('type') type: 'all' | 'member' | 'company' = 'all',
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.clubService.getAdminAllTransactions(
      type,
      Number.parseInt(page, 10),
      Number.parseInt(limit, 10),
    );
  }

  // ── Sorteios ──────────────────────────────────────────────────────────────

  @Get('raffles')
  async listOpenRaffles() {
    return this.raffleService.listOpen();
  }

  @Get('raffles/my-entries')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async listMyRaffleEntries(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.raffleService.listMyEntries(user.sub);
  }

  @Get('raffles/:id/stats')
  async getRaffleStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.raffleService.getRaffleStats(id);
  }

  @Get('raffles/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @ApiBearerAuth()
  async listAllRaffles() {
    return this.raffleService.listAll();
  }

  @Get('raffles/history')
  async listRaffleHistory() {
    return this.raffleService.listHistory();
  }

  @Get('raffles/:id')
  async getRaffle(@Param('id', ParseUUIDPipe) id: string) {
    return this.raffleService.findOne(id);
  }

  @Get('raffles/:id/entries')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getRaffleEntries(@Param('id', ParseUUIDPipe) id: string) {
    return this.raffleService.listEntries(id);
  }

  @Post('raffles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @ApiBearerAuth()
  async createRaffle(@Body() dto: CreateRaffleDto, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.raffleService.create(dto, user.sub);
  }

  @Post('raffles/:id/enter')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async enterRaffle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnterRaffleDto,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.raffleService.enterRaffle(
      id,
      user.sub,
      dto.ownerType ?? RaffleOwnerType.MEMBER,
    );
  }

  @Post('raffles/:id/draw')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @ApiBearerAuth()
  async drawRaffle(@Param('id', ParseUUIDPipe) id: string) {
    return this.raffleService.draw(id);
  }

  @Delete('raffles/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(MemberRole.ADMIN)
  @ApiBearerAuth()
  async cancelRaffle(@Param('id', ParseUUIDPipe) id: string) {
    return this.raffleService.cancel(id);
  }
}

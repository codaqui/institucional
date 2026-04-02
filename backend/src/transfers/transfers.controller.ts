import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TransfersService } from './transfers.service';
import type {
  CreateTransferRequestDto,
  ReviewTransferRequestDto,
} from './transfers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';

@ApiTags('Transfers')
@Controller('account-transfers')
export class TransfersController {
  constructor(private readonly service: TransfersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('finance-analyzer', 'admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Solicitar transferência entre contas [finance-analyzer | admin]',
    description:
      'Finance-analyzer cria um pedido de transferência entre contas do ledger ' +
      '(ex: do Tesouro para uma carteira comunitária com saldo insuficiente). ' +
      'O Admin precisa aprovar para a transação ser criada no ledger.',
  })
  @ApiResponse({ status: 201, description: 'Pedido criado, aguardando aprovação do Admin.' })
  createTransferRequest(
    @Req() req: { user: JwtPayload },
    @Body() dto: CreateTransferRequestDto,
  ) {
    return this.service.createTransferRequest(req.user.sub, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('finance-analyzer', 'admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Listar pedidos de transferência [finance-analyzer | admin]' })
  getAllRequests(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.getAllRequests(page ?? 1, limit ?? 20);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Aprovar transferência [admin]',
    description: 'Admin aprova o pedido — cria transação no ledger imediatamente.',
  })
  approveRequest(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
    @Body() dto: ReviewTransferRequestDto,
  ) {
    return this.service.approveRequest(id, req.user.sub, dto);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Rejeitar transferência [admin]' })
  rejectRequest(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
    @Body() dto: ReviewTransferRequestDto,
  ) {
    return this.service.rejectRequest(id, req.user.sub, dto);
  }
}

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
import { ReimbursementsService } from './reimbursements.service';
import type {
  CreateReimbursementDto,
  ApproveReimbursementDto,
  RejectReimbursementDto,
} from './reimbursements.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';

@ApiTags('Reimbursements')
@Controller('reimbursements')
export class ReimbursementsController {
  constructor(private readonly service: ReimbursementsService) {}

  // ── Membro ────────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Solicitar reembolso',
    description:
      'Membro cria uma solicitação de reembolso. ' +
      '`receiptUrl` é obrigatório (URL pública do comprovante, ex: Google Drive público).',
  })
  @ApiResponse({ status: 201, description: 'Solicitação criada.' })
  @ApiResponse({ status: 400, description: 'Dados inválidos ou receiptUrl ausente.' })
  createRequest(
    @Req() req: { user: JwtPayload },
    @Body()
    dto: {
      accountId: string;
      amount: number;
      description: string;
      receiptUrl: string;
    },
  ) {
    const createDto: CreateReimbursementDto = {
      accountId: dto.accountId,
      amount: dto.amount,
      description: dto.description,
      receiptUrl: dto.receiptUrl,
    };
    return this.service.createRequest(req.user.sub, createDto);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Minhas solicitações de reembolso' })
  getMyRequests(@Req() req: { user: JwtPayload }) {
    return this.service.getMyRequests(req.user.sub);
  }

  // ── Finance-Analyzer / Admin ──────────────────────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('finance-analyzer', 'admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Listar todas as solicitações [finance-analyzer | admin]' })
  getAllRequests(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.getAllRequests(page ?? 1, limit ?? 20);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('finance-analyzer', 'admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Aprovar reembolso [finance-analyzer | admin]',
    description:
      'Aprova a solicitação. O aprovador é responsável por copiar o comprovante para ' +
      'https://drive.google.com/drive/folders/1z8wP1XzfuTZs8Qp40mVm74UPBbHUWQUY ' +
      'e informar o link interno em `internalReceiptUrl`.\n\n' +
      'Retorna 403 se o saldo da carteira for insuficiente — abrir AccountTransferRequest nesse caso.',
  })
  @ApiResponse({ status: 200, description: 'Aprovado — transação criada no ledger.' })
  @ApiResponse({ status: 400, description: 'internalReceiptUrl ausente ou solicitação já revisada.' })
  @ApiResponse({ status: 403, description: 'Saldo insuficiente na carteira.' })
  approveRequest(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
    @Body() dto: ApproveReimbursementDto,
  ) {
    return this.service.approveRequest(id, req.user.sub, dto);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('finance-analyzer', 'admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Rejeitar reembolso [finance-analyzer | admin]' })
  @ApiResponse({ status: 200, description: 'Rejeitado.' })
  @ApiResponse({ status: 400, description: 'reviewNote ausente ou solicitação já revisada.' })
  rejectRequest(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
    @Body() dto: RejectReimbursementDto,
  ) {
    return this.service.rejectRequest(id, req.user.sub, dto);
  }
}

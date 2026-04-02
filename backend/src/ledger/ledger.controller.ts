import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiSecurity,
} from '@nestjs/swagger';
import { LedgerService } from './ledger.service';
import { AccountType } from './entities/account.entity';
import { GetTransactionsQueryDto } from './dto/get-transactions-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Ledger')
@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // ESCRITA — requer JWT + role admin
  // ──────────────────────────────────────────────────────────────────────────

  @Post('accounts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Criar conta contábil [admin]',
    description:
      'Cria uma nova conta no sistema de contabilidade de dupla partida. Requer role **admin**.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'type'],
      properties: {
        name: { type: 'string', example: 'Dev Paraná' },
        type: {
          type: 'string',
          enum: Object.values(AccountType),
          example: AccountType.VIRTUAL_WALLET,
        },
        projectKey: {
          type: 'string',
          example: 'devparana',
          description: 'Slug único da comunidade (opcional)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Conta criada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  @ApiResponse({ status: 403, description: 'Role insuficiente.' })
  createAccount(
    @Body() dto: { name: string; type: AccountType; projectKey?: string },
  ) {
    return this.ledgerService.createAccount(dto.name, dto.type, dto.projectKey);
  }

  @Post('transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Registrar transação de dupla entrada [admin]',
    description:
      'Registra uma movimentação financeira de dupla entrada. ' +
      'Uso interno — doações são registradas automaticamente pelo webhook do Stripe. Requer role **admin**.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sourceAccountId', 'destinationAccountId', 'amount', 'description'],
      properties: {
        sourceAccountId: { type: 'string', format: 'uuid' },
        destinationAccountId: { type: 'string', format: 'uuid' },
        amount: { type: 'number', minimum: 0.01, example: 75.00, description: 'Valor em reais (ex: 75.50 = R$ 75,50)' },
        description: { type: 'string', example: 'Doação via Stripe — Dev Paraná' },
        referenceId: {
          type: 'string',
          nullable: true,
          example: 'cs_live_abc123',
          description: 'ID externo de referência (Stripe Session, etc.)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Transação registrada com sucesso.' })
  @ApiResponse({ status: 400, description: 'Dados inválidos ou contas não encontradas.' })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  @ApiResponse({ status: 403, description: 'Role insuficiente.' })
  recordTransaction(
    @Body()
    dto: {
      sourceAccountId: string;
      destinationAccountId: string;
      amount: number;
      description: string;
      referenceId?: string;
    },
  ) {
    return this.ledgerService.recordTransaction(
      dto.sourceAccountId,
      dto.destinationAccountId,
      dto.amount,
      dto.description,
      dto.referenceId,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // LEITURA — público (dados de transparência)
  // ──────────────────────────────────────────────────────────────────────────

  @Get('accounts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Listar todas as contas [admin]',
    description: 'Lista todas as contas contábeis, incluindo contas internas. Requer role **admin**.',
  })
  @ApiResponse({ status: 200, description: 'Lista de contas.' })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  @ApiResponse({ status: 403, description: 'Role insuficiente.' })
  getAccounts() {
    return this.ledgerService.getAccounts();
  }

  @Get('community-balances')
  @ApiOperation({
    summary: 'Saldos das carteiras comunitárias',
    description:
      'Retorna o saldo atual de cada carteira virtual associada a uma comunidade parceira da Codaqui. ' +
      'Endpoint público — usado pelo Portal de Transparência.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de saldos por comunidade.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          projectKey: { type: 'string', example: 'devparana' },
          name: { type: 'string', example: 'Dev Paraná' },
          balance: {
            type: 'number',
            example: 150.00,
            description: 'Saldo em reais (ex: 75.50 = R$ 75,50)',
          },
        },
      },
    },
  })
  getCommunityBalances() {
    return this.ledgerService.getCommunityBalances();
  }

  @Get('accounts/:id/balance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Saldo de uma conta [admin]',
    description: 'Retorna o saldo calculado de uma conta específica (créditos − débitos). Requer role **admin**.',
  })
  @ApiParam({ name: 'id', description: 'UUID da conta', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Saldo atual em reais.',
    schema: { type: 'number', example: 75.00 },
  })
  @ApiResponse({ status: 400, description: 'Conta não encontrada.' })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  @ApiResponse({ status: 403, description: 'Role insuficiente.' })
  getAccountBalance(@Param('id') id: string) {
    return this.ledgerService.getAccountBalance(id);
  }

  @Get('accounts/:id/transactions')
  @ApiOperation({
    summary: 'Transações de uma conta (paginado)',
    description:
      'Retorna as transações de uma carteira comunitária em ordem cronológica decrescente. ' +
      'Suporta paginação via `page` e `limit`. Endpoint público — usado pelo Portal de Transparência.',
  })
  @ApiParam({ name: 'id', description: 'UUID da conta', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Resultado paginado de transações.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              amount: { type: 'number', example: 75.00, description: 'Valor em reais' },
              description: { type: 'string', example: 'Doação via Stripe' },
              referenceId: { type: 'string', nullable: true, example: 'cs_live_xxx' },
              createdAt: { type: 'string', format: 'date-time' },
              sourceAccount: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
              destinationAccount: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
            },
          },
        },
        total: { type: 'integer', example: 42 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 10 },
        totalPages: { type: 'integer', example: 5 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Parâmetros inválidos.' })
  getAccountTransactions(
    @Param('id') id: string,
    @Query() query: GetTransactionsQueryDto,
  ) {
    return this.ledgerService.getAccountTransactions(
      id,
      query.page ?? 1,
      query.limit ?? 10,
    );
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/jwt.strategy';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  /**
   * Cria uma despesa. O campo receiptUrl deve ser uma URL pública
   * (Google Drive, Dropbox, etc.) — sem upload gerenciado na v1.
   * O revisor tem a responsabilidade de guardar no Drive da organização ao aprovar.
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  createExpense(
    @Req() req: { user: JwtPayload },
    @Body()
    dto: {
      description: string;
      amount: number;
      targetProjectId: string;
      receiptUrl?: string; // URL pública do comprovante
    },
  ) {
    return this.expensesService.createExpense(
      dto.description,
      dto.amount,
      dto.targetProjectId,
      req.user.sub,
      dto.receiptUrl,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  getExpenses() {
    return this.expensesService.getExpenses();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getExpenseById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.expensesService.getExpenseById(id, req.user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/approve')
  approveExpense(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.expensesService.approveExpense(id, req.user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/pay')
  markAsPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('externalAccountId') externalAccountId: string,
  ) {
    return this.expensesService.markAsPaid(id, externalAccountId);
  }
}

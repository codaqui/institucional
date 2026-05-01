import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense, ExpenseStatus } from './entities/expense.entity';
import { LedgerService } from '../ledger/ledger.service';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    private readonly ledgerService: LedgerService,
  ) {}

  async createExpense(
    description: string,
    amount: number,
    targetProjectId: string,
    submittedByUserId: string,
    receiptUrl?: string,
  ) {
    const expense = this.expenseRepo.create({
      description,
      amount,
      targetProjectId,
      submittedByUserId,
      receiptUrl,
      status: ExpenseStatus.PENDING,
    });
    return this.expenseRepo.save(expense);
  }

  async getExpenses() {
    return this.expenseRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getExpenseById(id: string, requestingUserId?: string) {
    const expense = await this.expenseRepo.findOneBy({ id });
    if (!expense) throw new NotFoundException('Expense not found');
    if (requestingUserId && expense.submittedByUserId !== requestingUserId) {
      throw new NotFoundException('Expense not found');
    }
    return expense;
  }

  async approveExpense(id: string, approvedByUserId: string) {
    const expense = await this.getExpenseById(id);
    if (expense.status !== ExpenseStatus.PENDING) {
      throw new BadRequestException('Can only approve pending expenses');
    }

    if (expense.submittedByUserId === approvedByUserId) {
      throw new BadRequestException(
        'Você não pode aprovar suas próprias despesas.',
      );
    }

    expense.status = ExpenseStatus.APPROVED;
    expense.approvedByUserId = approvedByUserId;
    return this.expenseRepo.save(expense);
  }

  async markAsPaid(id: string, externalAccountId: string) {
    const expense = await this.getExpenseById(id);
    if (expense.status !== ExpenseStatus.APPROVED) {
      throw new BadRequestException(
        'Expense must be APPROVED before it can be marked as PAID',
      );
    }

    // Source is the virtual wallet (decreases balance)
    // Destination is the external account (vendor)
    await this.ledgerService.recordTransaction(
      expense.targetProjectId,
      externalAccountId,
      expense.amount,
      `Payment for expense: ${expense.description}`,
      expense.id,
    );

    expense.status = ExpenseStatus.PAID;
    return this.expenseRepo.save(expense);
  }
}

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  AccountTransferRequest,
  TransferRequestStatus,
} from './entities/account-transfer-request.entity';
import { LedgerService } from '../ledger/ledger.service';
import { CreateTransferRequestDto } from './dto/create-transfer-request.dto';
import { ReviewTransferRequestDto } from './dto/review-transfer-request.dto';

export { CreateTransferRequestDto } from './dto/create-transfer-request.dto';
export { ReviewTransferRequestDto } from './dto/review-transfer-request.dto';

@Injectable()
export class TransfersService {
  constructor(
    @InjectRepository(AccountTransferRequest)
    private readonly repo: Repository<AccountTransferRequest>,
    private readonly ledgerService: LedgerService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Finance-analyzer cria pedido de transferência entre contas */
  async createTransferRequest(
    requestedById: string,
    dto: CreateTransferRequestDto,
  ): Promise<AccountTransferRequest> {
    if (dto.amount <= 0) {
      throw new BadRequestException('O valor deve ser maior que zero.');
    }
    if (dto.sourceAccountId === dto.destinationAccountId) {
      throw new BadRequestException(
        'Contas de origem e destino devem ser diferentes.',
      );
    }
    if (!dto.reason?.trim()) {
      throw new BadRequestException('A justificativa é obrigatória.');
    }

    const request = this.repo.create({
      requestedById,
      sourceAccountId: dto.sourceAccountId,
      destinationAccountId: dto.destinationAccountId,
      amount: dto.amount,
      reason: dto.reason,
      status: TransferRequestStatus.PENDING,
    });

    return this.repo.save(request);
  }

  /** Finance-analyzer / Admin lista todos os pedidos */
  async getAllRequests(
    page = 1,
    limit = 20,
  ): Promise<{
    data: AccountTransferRequest[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [data, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Admin aprova a transferência: cria tx no ledger (source → destination).
   */
  async approveRequest(
    id: string,
    adminId: string,
    dto: ReviewTransferRequestDto,
  ): Promise<AccountTransferRequest> {
    return await this.dataSource.transaction(async (manager) => {
      const request = await manager.findOne(AccountTransferRequest, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) throw new NotFoundException('Solicitação não encontrada.');

      if (request.status !== TransferRequestStatus.PENDING) {
        throw new BadRequestException('Solicitação não está pendente.');
      }

      await this.ledgerService.recordTransaction(
        request.sourceAccountId,
        request.destinationAccountId,
        request.amount,
        `Transferência interna aprovada: ${request.reason}`,
        `transfer:${request.id}`,
      );

      request.status = TransferRequestStatus.APPROVED;
      request.reviewedById = adminId;
      request.reviewNote = dto.reviewNote ?? null;
      request.reviewedAt = new Date();

      return manager.save(request);
    });
  }

  /** Admin rejeita o pedido de transferência */
  async rejectRequest(
    id: string,
    adminId: string,
    dto: ReviewTransferRequestDto,
  ): Promise<AccountTransferRequest> {
    const request = await this.findOrFail(id);

    if (request.status !== TransferRequestStatus.PENDING) {
      throw new BadRequestException('Solicitação não está pendente.');
    }

    if (!dto.reviewNote?.trim()) {
      throw new BadRequestException('A nota de rejeição é obrigatória.');
    }

    request.status = TransferRequestStatus.REJECTED;
    request.reviewedById = adminId;
    request.reviewNote = dto.reviewNote;
    request.reviewedAt = new Date();

    return this.repo.save(request);
  }

  private async findOrFail(id: string): Promise<AccountTransferRequest> {
    const request = await this.repo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Solicitação não encontrada.');
    return request;
  }
}

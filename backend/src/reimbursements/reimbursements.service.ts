import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  ReimbursementRequest,
  ReimbursementStatus,
} from './entities/reimbursement-request.entity';
import { LedgerService } from '../ledger/ledger.service';
import { Account, AccountType } from '../ledger/entities/account.entity';
import { CreateReimbursementDto } from './dto/create-reimbursement.dto';
import { ApproveReimbursementDto } from './dto/approve-reimbursement.dto';
import { RejectReimbursementDto } from './dto/reject-reimbursement.dto';

export {
  CreateReimbursementDto,
  ApproveReimbursementDto,
  RejectReimbursementDto,
};

const REIMBURSEMENTS_ACCOUNT_KEY = 'reembolsos-pagos';

@Injectable()
export class ReimbursementsService {
  constructor(
    @InjectRepository(ReimbursementRequest)
    private readonly repo: Repository<ReimbursementRequest>,
    private readonly ledgerService: LedgerService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Membro cria uma solicitação de reembolso */
  async createRequest(
    memberId: string,
    dto: CreateReimbursementDto,
  ): Promise<ReimbursementRequest> {
    if (!dto.receiptUrl?.trim()) {
      throw new BadRequestException(
        'O comprovante (receiptUrl) é obrigatório.',
      );
    }
    if (dto.amount <= 0) {
      throw new BadRequestException('O valor deve ser maior que zero.');
    }

    const request = this.repo.create({
      memberId,
      accountId: dto.accountId,
      amount: dto.amount,
      description: dto.description,
      receiptUrl: dto.receiptUrl,
      status: ReimbursementStatus.PENDING,
    });

    return this.repo.save(request);
  }

  /** Membro vê suas próprias solicitações */
  getMyRequests(memberId: string): Promise<ReimbursementRequest[]> {
    return this.repo.find({
      where: { memberId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Finance-analyzer / Admin vê todas as solicitações */
  async getAllRequests(
    page = 1,
    limit = 20,
  ): Promise<{
    data: ReimbursementRequest[];
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
   * Finance-analyzer / Admin aprova uma solicitação.
   *
   * Validações:
   *   - Solicitação deve estar pending
   *   - internalReceiptUrl é obrigatório (cópia do comprovante no Drive)
   *   - Saldo da conta deve ser suficiente (bloqueia se insuficiente)
   *
   * Ao aprovar: cria tx no ledger (conta solicitada → "Reembolsos Pagos")
   * O aprovador é responsável por copiar o comprovante para:
   *   https://drive.google.com/drive/folders/1z8wP1XzfuTZs8Qp40mVm74UPBbHUWQUY
   */
  async approveRequest(
    id: string,
    reviewerId: string,
    dto: ApproveReimbursementDto,
    reviewerRole?: string,
  ): Promise<ReimbursementRequest> {
    // Validações que não dependem de estado DB: fail-fast antes de abrir transação
    if (!dto.internalReceiptUrl?.trim()) {
      throw new BadRequestException(
        'O link interno do comprovante (internalReceiptUrl) é obrigatório para aprovar. ' +
          'Copie o comprovante para a pasta do Drive e cole o link aqui.',
      );
    }

    return await this.dataSource.transaction(async (manager) => {
      // FOR UPDATE não pode ser combinado com LEFT JOIN (PostgreSQL restringe).
      // As relações têm eager:true na entidade, o que gera LEFT JOINs automáticos.
      // loadEagerRelations: false desabilita o eager só para esta query de lock.
      const request = await manager.findOne(ReimbursementRequest, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });

      if (!request) throw new NotFoundException('Solicitação não encontrada.');

      // Carrega account separadamente (sem lock — somente leitura)
      const account = request.accountId
        ? await manager.findOne(Account, { where: { id: request.accountId } })
        : null;
      request.account = account!;

      if (request.status !== ReimbursementStatus.PENDING) {
        throw new BadRequestException(
          `Solicitação já foi ${request.status === ReimbursementStatus.APPROVED ? 'aprovada' : 'rejeitada'}.`,
        );
      }

      // Impedir self-approval para finance-analyzer; admin pode aprovar os próprios
      if (request.memberId === reviewerId && reviewerRole !== 'admin') {
        throw new ForbiddenException(
          'Você não pode aprovar seu próprio reembolso. Peça para outro aprovador revisar.',
        );
      }

      // Verificar saldo suficiente dentro da transação (protege contra TOCTOU via lock na requisição)
      const balance = await this.ledgerService.getAccountBalance(
        request.accountId,
      );
      if (balance < request.amount) {
        throw new ForbiddenException(
          `Saldo insuficiente na conta "${request.account?.name ?? request.accountId}". ` +
            `Disponível: R$ ${balance.toFixed(2)}, necessário: R$ ${request.amount.toFixed(2)}. ` +
            `Abra uma solicitação de transferência para o Admin.`,
        );
      }

      // Conta destino: "Reembolsos Pagos" (criada automaticamente se não existir)
      const reimbursementsAccount =
        await this.ledgerService.getOrCreateCommunityAccount(
          REIMBURSEMENTS_ACCOUNT_KEY,
          'Reembolsos Pagos',
          AccountType.EXPENSE,
        );

      // Cria transação no ledger: débito da carteira → crédito em Reembolsos Pagos
      await this.ledgerService.recordTransaction(
        request.accountId,
        reimbursementsAccount.id,
        request.amount,
        `Reembolso aprovado: ${request.description}`,
        `reimbursement:${request.id}`,
      );

      request.status = ReimbursementStatus.APPROVED;
      request.reviewedById = reviewerId;
      request.internalReceiptUrl = dto.internalReceiptUrl;
      request.reviewNote = dto.reviewNote ?? null;
      request.reviewedAt = new Date();

      return manager.save(request);
    });
  }

  /** Finance-analyzer / Admin rejeita uma solicitação */
  async rejectRequest(
    id: string,
    reviewerId: string,
    dto: RejectReimbursementDto,
  ): Promise<ReimbursementRequest> {
    const request = await this.findOrFail(id);

    if (request.status !== ReimbursementStatus.PENDING) {
      throw new BadRequestException('Solicitação não está pendente.');
    }

    if (!dto.reviewNote?.trim()) {
      throw new BadRequestException('A nota de rejeição é obrigatória.');
    }

    request.status = ReimbursementStatus.REJECTED;
    request.reviewedById = reviewerId;
    request.reviewNote = dto.reviewNote;
    request.reviewedAt = new Date();

    return this.repo.save(request);
  }

  private async findOrFail(id: string): Promise<ReimbursementRequest> {
    const request = await this.repo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Solicitação não encontrada.');
    return request;
  }

  /**
   * Dados públicos de um reembolso para exibição no portal de transparência.
   * NÃO expõe: internalReceiptUrl (link do Drive interno).
   * EXPÕE: handle do solicitante, comprovante público, handle do aprovador, nota.
   */
  async getPublicInfo(id: string) {
    const request = await this.repo.findOne({
      where: { id },
      relations: ['member', 'reviewedBy', 'account'],
    });
    if (!request) throw new NotFoundException('Reembolso não encontrado.');

    return {
      id: request.id,
      status: request.status,
      amount: request.amount,
      description: request.description,
      receiptUrl: request.receiptUrl, // URL pública do comprovante
      accountName: request.account?.name ?? null,
      requester: request.member
        ? {
            handle: request.member.githubHandle,
            name: request.member.name,
            avatarUrl: request.member.avatarUrl,
          }
        : null,
      approver: request.reviewedBy
        ? {
            handle: request.reviewedBy.githubHandle,
            name: request.reviewedBy.name,
            avatarUrl: request.reviewedBy.avatarUrl,
          }
        : null,
      reviewNote: request.reviewNote,
      reviewedAt: request.reviewedAt,
      createdAt: request.createdAt,
    };
  }
}

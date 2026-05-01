import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  In,
  ObjectLiteral,
  FindOptionsWhere,
  FindOptionsOrder,
} from 'typeorm';
import { Vendor } from './entities/vendor.entity';
import { VendorPayment } from './entities/vendor-payment.entity';
import { VendorReceipt } from './entities/vendor-receipt.entity';
import { TransactionTemplate } from './entities/transaction-template.entity';
import { Account, AccountType } from '../ledger/entities/account.entity';
import { LedgerService } from '../ledger/ledger.service';
import { Member } from '../members/entities/member.entity';
import { CreateVendorDto, UpdateVendorDto } from './dto/vendor.dto';
import { CreateVendorPaymentDto } from './dto/vendor-payment.dto';
import { CreateVendorReceiptDto } from './dto/vendor-receipt.dto';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
} from './dto/transaction-template.dto';

/** Resumo público de membro (registrante) usado em todas as listagens. */
export interface RegisteredByMember {
  name: string;
  avatarUrl: string;
  githubHandle: string;
}

/** Vendor mínimo para resposta pública (transparência). */
interface PublicVendor {
  name: string;
  document: string | null;
  website: string | null;
}

/** Resposta pública de uma transação de fornecedor (resolver de referenceId). */
export interface PublicVendorTransaction {
  id: string;
  amount: number;
  description: string;
  receiptUrl: string | null;
  internalReceiptUrl: string | null;
  occurredAt: Date;
  vendor?: PublicVendor;
  registeredBy?: RegisteredByMember;
}

@Injectable()
export class VendorsService {
  private readonly logger = new Logger(VendorsService.name);
  constructor(
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(VendorPayment)
    private readonly paymentRepo: Repository<VendorPayment>,
    @InjectRepository(VendorReceipt)
    private readonly receiptRepo: Repository<VendorReceipt>,
    @InjectRepository(TransactionTemplate)
    private readonly templateRepo: Repository<TransactionTemplate>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,
    private readonly ledgerService: LedgerService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS COMPARTILHADOS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Garante que a conta exista e NÃO seja EXTERNAL (para contas community-side). */
  private async assertCommunityAccount(
    accountId: string,
    label: 'origem' | 'destino',
  ): Promise<Account> {
    const account = await this.accountRepo.findOneBy({ id: accountId });
    if (!account)
      throw new BadRequestException(`Conta de ${label} não encontrada.`);
    if (account.type === AccountType.EXTERNAL)
      throw new BadRequestException(
        `Conta de ${label} inválida: não pode ser EXTERNAL.`,
      );
    return account;
  }

  /** Garante que o vendor exista e esteja ativo. */
  private async assertActiveVendor(vendorId: string): Promise<Vendor> {
    const vendor = await this.vendorRepo.findOneBy({
      id: vendorId,
      isActive: true,
    });
    if (!vendor)
      throw new BadRequestException('Fornecedor não encontrado ou inativo.');
    return vendor;
  }

  /**
   * Persiste a entidade e registra a transação no ledger atomicamente.
   * O `makeLedgerArgs` é chamado APÓS o save (quando o ID já foi gerado pelo
   * Postgres) para garantir que o `referenceId` reflita o ID persistido.
   * Se o ledger falhar, faz rollback do registro (delete).
   */
  private async persistWithLedger<T extends ObjectLiteral & { id: string }>(
    repo: Repository<T>,
    entity: T,
    makeLedgerArgs: (saved: T) => {
      sourceAccountId: string;
      destinationAccountId: string;
      amountBrl: number;
      description: string;
      referenceId: string;
    },
  ): Promise<T> {
    const saved = await repo.save(entity);
    const ledgerArgs = makeLedgerArgs(saved);
    try {
      await this.ledgerService.recordTransaction(
        ledgerArgs.sourceAccountId,
        ledgerArgs.destinationAccountId,
        ledgerArgs.amountBrl,
        ledgerArgs.description,
        ledgerArgs.referenceId,
      );
    } catch (error) {
      this.logger.error(
        `Falha ao registrar no ledger, revertendo ${saved.id}: ${error}`,
      );
      await repo.delete(saved.id);
      throw error;
    }
    return saved;
  }

  /**
   * Lista todas as transações de um repositório com `registeredBy` resolvido.
   * Usado para ambos vendor_payments e vendor_receipts (com relations distintos).
   */
  private async findAllWithMembers<
    T extends ObjectLiteral & { registeredByUserId: string },
  >(
    repo: Repository<T>,
    relations: string[],
  ): Promise<(T & { registeredBy?: RegisteredByMember })[]> {
    const rows = await repo.find({
      order: { occurredAt: 'DESC' } as unknown as FindOptionsOrder<T>,
      relations,
    });
    const memberMap = await this.loadMembersMap(
      rows.map((r) => r.registeredByUserId),
    );
    return rows.map((r) => ({
      ...r,
      registeredBy: memberMap.get(r.registeredByUserId),
    }));
  }

  /** Mapeia membros pelo ID em batch. */
  private async loadMembersMap(
    userIds: string[],
  ): Promise<Map<string, RegisteredByMember>> {
    if (userIds.length === 0) return new Map();
    const members = await this.memberRepo.find({
      where: { id: In([...new Set(userIds)]) },
    });
    return new Map(
      members.map((m) => [
        m.id,
        {
          name: m.name,
          avatarUrl: m.avatarUrl,
          githubHandle: m.githubHandle,
        },
      ]),
    );
  }

  /** Monta o resumo público de uma transação de fornecedor. */
  private async toPublicTransaction(tx: {
    id: string;
    amount: number;
    description: string;
    receiptUrl: string | null;
    internalReceiptUrl: string | null;
    occurredAt: Date;
    registeredByUserId: string;
    vendor?: Vendor;
  }): Promise<PublicVendorTransaction> {
    const memberMap = await this.loadMembersMap([tx.registeredByUserId]);
    return {
      id: tx.id,
      amount: tx.amount,
      description: tx.description,
      receiptUrl: tx.receiptUrl,
      internalReceiptUrl: tx.internalReceiptUrl,
      occurredAt: tx.occurredAt,
      vendor: tx.vendor
        ? {
            name: tx.vendor.name,
            document: tx.vendor.document,
            website: tx.vendor.website,
          }
        : undefined,
      registeredBy: memberMap.get(tx.registeredByUserId),
    };
  }

  /**
   * Resolve uma transação por referenceId prefixado.
   * Retorna `null` se o prefixo não bater ou o registro não existir.
   */
  private async resolveByReference<
    T extends ObjectLiteral & {
      id: string;
      amount: number;
      description: string;
      receiptUrl: string | null;
      internalReceiptUrl: string | null;
      occurredAt: Date;
      registeredByUserId: string;
      vendor?: Vendor;
    },
  >(
    repo: Repository<T>,
    refId: string,
    prefix: string,
  ): Promise<PublicVendorTransaction | null> {
    if (!refId.startsWith(prefix)) return null;
    const id = refId.slice(prefix.length);
    const tx = await repo.findOne({
      where: { id } as FindOptionsWhere<T>,
      relations: ['vendor'],
    });
    if (!tx) return null;
    return this.toPublicTransaction(tx);
  }

  /**
   * Exclui uma transação registrando estorno reverso no ledger.
   * `reverse` indica a direção das contas no estorno (oposta ao registro original).
   */
  private async deleteWithReversal<
    T extends ObjectLiteral & {
      id: string;
      amount: number;
      description: string;
      vendor: Vendor;
    },
  >(
    repo: Repository<T>,
    tx: T,
    reversalSourceAccountId: string,
    reversalDestinationAccountId: string,
    reversalRefPrefix: string,
  ): Promise<void> {
    const ts = Date.now();
    await this.ledgerService.recordTransaction(
      reversalSourceAccountId,
      reversalDestinationAccountId,
      tx.amount / 100,
      `Estorno: ${tx.vendor.name} — ${tx.description}`,
      `${reversalRefPrefix}:${tx.id}:${ts}`,
    );
    await repo.delete(tx.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VENDORS
  // ═══════════════════════════════════════════════════════════════════════════

  async createVendor(dto: CreateVendorDto): Promise<Vendor> {
    let accountId = dto.accountId;

    if (accountId) {
      const account = await this.accountRepo.findOneBy({ id: accountId });
      if (!account)
        throw new BadRequestException('Conta informada não encontrada.');
      if (account.type !== AccountType.EXTERNAL)
        throw new BadRequestException(
          'Conta informada deve ser do tipo EXTERNAL.',
        );
    } else {
      const projectKey = `vendor-${dto.name
        .toLowerCase()
        .replaceAll(/\s+/g, '-')
        .replaceAll(/[^a-z0-9-]/g, '')}`;

      const existing = await this.accountRepo.findOneBy({ projectKey });
      if (existing) {
        accountId = existing.id;
      } else {
        const account = this.accountRepo.create({
          name: `Fornecedor: ${dto.name}`,
          type: AccountType.EXTERNAL,
          projectKey,
        });
        const saved = await this.accountRepo.save(account);
        accountId = saved.id;
      }
    }

    const vendor = this.vendorRepo.create({
      name: dto.name,
      document: dto.document ?? null,
      website: dto.website ?? null,
      accountId,
    });

    return this.vendorRepo.save(vendor);
  }

  async findAll(): Promise<Vendor[]> {
    return this.vendorRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findAllPublic(): Promise<
    {
      id: string;
      name: string;
      document: string | null;
      website: string | null;
    }[]
  > {
    const vendors = await this.vendorRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
      select: ['id', 'name', 'document', 'website'],
    });
    return vendors;
  }

  /**
   * Lista vendors com contadores de pagamentos e recebimentos (admin).
   * Usado na página /admin/fornecedores para mostrar a relação bidirecional.
   */
  async findAllWithCounters(): Promise<
    Array<Vendor & { paymentCount: number; receiptCount: number }>
  > {
    const vendors = await this.findAll();
    if (vendors.length === 0) return [];

    const ids = vendors.map((v) => v.id);
    const [paymentCounts, receiptCounts] = await Promise.all([
      this.paymentRepo
        .createQueryBuilder('p')
        .select('p."vendorId"', 'vendorId')
        .addSelect('COUNT(*)', 'count')
        .where('p."vendorId" IN (:...ids)', { ids })
        .groupBy('p."vendorId"')
        .getRawMany<{ vendorId: string; count: string }>(),
      this.receiptRepo
        .createQueryBuilder('r')
        .select('r."vendorId"', 'vendorId')
        .addSelect('COUNT(*)', 'count')
        .where('r."vendorId" IN (:...ids)', { ids })
        .groupBy('r."vendorId"')
        .getRawMany<{ vendorId: string; count: string }>(),
    ]);

    const pMap = new Map(
      paymentCounts.map((r) => [r.vendorId, Number(r.count)]),
    );
    const rMap = new Map(
      receiptCounts.map((r) => [r.vendorId, Number(r.count)]),
    );

    return vendors.map((v) => ({
      ...v,
      paymentCount: pMap.get(v.id) ?? 0,
      receiptCount: rMap.get(v.id) ?? 0,
    }));
  }

  async updateVendor(id: string, dto: UpdateVendorDto): Promise<Vendor> {
    const vendor = await this.vendorRepo.findOneBy({ id, isActive: true });
    if (!vendor) throw new NotFoundException('Fornecedor não encontrado.');

    if (dto.name !== undefined) vendor.name = dto.name;
    if (dto.document !== undefined) vendor.document = dto.document;
    if (dto.website !== undefined) vendor.website = dto.website;

    return this.vendorRepo.save(vendor);
  }

  async softDeleteVendor(id: string): Promise<void> {
    const vendor = await this.vendorRepo.findOneBy({ id, isActive: true });
    if (!vendor) throw new NotFoundException('Fornecedor não encontrado.');

    vendor.isActive = false;
    await this.vendorRepo.save(vendor);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VENDOR PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  async createPayment(
    dto: CreateVendorPaymentDto,
    registeredByUserId: string,
  ): Promise<VendorPayment> {
    const vendor = await this.assertActiveVendor(dto.vendorId);
    await this.assertCommunityAccount(dto.sourceAccountId, 'origem');

    const payment = this.paymentRepo.create({
      vendorId: dto.vendorId,
      sourceAccountId: dto.sourceAccountId,
      amount: dto.amount,
      description: dto.description,
      receiptUrl: dto.receiptUrl ?? null,
      internalReceiptUrl: dto.internalReceiptUrl ?? null,
      registeredByUserId,
    });

    const saved = await this.persistWithLedger(this.paymentRepo, payment, (s) => ({
      sourceAccountId: dto.sourceAccountId,
      destinationAccountId: vendor.accountId,
      amountBrl: dto.amount / 100,
      description: `Pagamento a fornecedor: ${vendor.name} — ${dto.description}`,
      referenceId: `vendor-payment:${s.id}`,
    }));

    return this.paymentRepo.findOneOrFail({ where: { id: saved.id } });
  }

  async findPayments(): Promise<
    (VendorPayment & { registeredBy?: RegisteredByMember })[]
  > {
    return this.findAllWithMembers(this.paymentRepo, [
      'vendor',
      'sourceAccount',
    ]);
  }

  async findPaymentById(id: string): Promise<VendorPayment> {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['vendor', 'sourceAccount'],
    });
    if (!payment) throw new NotFoundException('Pagamento não encontrado.');
    return payment;
  }

  /** Resolver público de referenceId — apenas dados públicos. */
  async findPaymentByReferenceId(
    refId: string,
  ): Promise<PublicVendorTransaction | null> {
    return this.resolveByReference(this.paymentRepo, refId, 'vendor-payment:');
  }

  /**
   * Exclui um pagamento e registra estorno reverso no ledger
   * (vendor → source) com referenceId distinto e timestamp.
   */
  async deletePayment(id: string): Promise<void> {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['vendor', 'sourceAccount'],
    });
    if (!payment) throw new NotFoundException('Pagamento não encontrado.');

    await this.deleteWithReversal(
      this.paymentRepo,
      payment,
      payment.vendor.accountId,
      payment.sourceAccountId,
      'vendor-payment-reversal',
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VENDOR RECEIPTS
  // ═══════════════════════════════════════════════════════════════════════════

  async createReceipt(
    dto: CreateVendorReceiptDto,
    registeredByUserId: string,
  ): Promise<VendorReceipt> {
    const vendor = await this.assertActiveVendor(dto.vendorId);
    await this.assertCommunityAccount(dto.destinationAccountId, 'destino');

    const receipt = this.receiptRepo.create({
      vendorId: dto.vendorId,
      destinationAccountId: dto.destinationAccountId,
      amount: dto.amount,
      description: dto.description,
      receiptUrl: dto.receiptUrl ?? null,
      internalReceiptUrl: dto.internalReceiptUrl ?? null,
      registeredByUserId,
    });

    const saved = await this.persistWithLedger(this.receiptRepo, receipt, (s) => ({
      sourceAccountId: vendor.accountId,
      destinationAccountId: dto.destinationAccountId,
      amountBrl: dto.amount / 100,
      description: `Recebimento de fornecedor: ${vendor.name} — ${dto.description}`,
      referenceId: `vendor-receipt:${s.id}`,
    }));

    return this.receiptRepo.findOneOrFail({ where: { id: saved.id } });
  }

  async findReceipts(): Promise<
    (VendorReceipt & { registeredBy?: RegisteredByMember })[]
  > {
    return this.findAllWithMembers(this.receiptRepo, [
      'vendor',
      'destinationAccount',
    ]);
  }

  async findReceiptById(id: string): Promise<VendorReceipt> {
    const receipt = await this.receiptRepo.findOne({
      where: { id },
      relations: ['vendor', 'destinationAccount'],
    });
    if (!receipt) throw new NotFoundException('Recebimento não encontrado.');
    return receipt;
  }

  async findReceiptByReferenceId(
    refId: string,
  ): Promise<PublicVendorTransaction | null> {
    return this.resolveByReference(this.receiptRepo, refId, 'vendor-receipt:');
  }

  /**
   * Exclui um recebimento e registra estorno reverso no ledger
   * (destination → vendor) com referenceId distinto e timestamp.
   */
  async deleteReceipt(id: string): Promise<void> {
    const receipt = await this.receiptRepo.findOne({
      where: { id },
      relations: ['vendor', 'destinationAccount'],
    });
    if (!receipt) throw new NotFoundException('Recebimento não encontrado.');

    await this.deleteWithReversal(
      this.receiptRepo,
      receipt,
      receipt.destinationAccountId,
      receipt.vendor.accountId,
      'vendor-receipt-reversal',
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTION TEMPLATES
  // ═══════════════════════════════════════════════════════════════════════════

  async createTemplate(
    dto: CreateTemplateDto,
    createdByUserId: string,
  ): Promise<TransactionTemplate> {
    await this.assertActiveVendor(dto.vendorId);
    await this.assertCommunityAccount(dto.sourceAccountId, 'origem');

    const template = this.templateRepo.create({
      ...dto,
      direction: dto.direction ?? 'payment',
      createdByUserId,
    });
    return this.templateRepo.save(template);
  }

  async findTemplates(): Promise<TransactionTemplate[]> {
    return this.templateRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
      relations: ['vendor', 'sourceAccount'],
    });
  }

  async updateTemplate(
    id: string,
    dto: UpdateTemplateDto,
  ): Promise<TransactionTemplate> {
    const template = await this.templateRepo.findOneBy({
      id,
      isActive: true,
    });
    if (!template) throw new NotFoundException('Template não encontrado.');

    Object.assign(template, dto);
    return this.templateRepo.save(template);
  }

  async softDeleteTemplate(id: string): Promise<void> {
    const template = await this.templateRepo.findOneBy({
      id,
      isActive: true,
    });
    if (!template) throw new NotFoundException('Template não encontrado.');

    template.isActive = false;
    await this.templateRepo.save(template);
  }
}

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Vendor } from './entities/vendor.entity';
import { VendorPayment } from './entities/vendor-payment.entity';
import { TransactionTemplate } from './entities/transaction-template.entity';
import { Account, AccountType } from '../ledger/entities/account.entity';
import { LedgerService } from '../ledger/ledger.service';
import { Member } from '../members/entities/member.entity';
import { CreateVendorDto, UpdateVendorDto } from './dto/vendor.dto';
import { CreateVendorPaymentDto } from './dto/vendor-payment.dto';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
} from './dto/transaction-template.dto';

@Injectable()
export class VendorsService {
  private readonly logger = new Logger(VendorsService.name);
  constructor(
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(VendorPayment)
    private readonly paymentRepo: Repository<VendorPayment>,
    @InjectRepository(TransactionTemplate)
    private readonly templateRepo: Repository<TransactionTemplate>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,
    private readonly ledgerService: LedgerService,
  ) {}

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
        throw new BadRequestException('Conta informada deve ser do tipo EXTERNAL.');
    } else {
      const projectKey = `vendor-${dto.name.toLowerCase().replaceAll(/\s+/g, '-').replaceAll(/[^a-z0-9-]/g, '')}`;

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
    { id: string; name: string; document: string | null; website: string | null }[]
  > {
    const vendors = await this.vendorRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
      select: ['id', 'name', 'document', 'website'],
    });
    return vendors;
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
    paidByUserId: string,
  ): Promise<VendorPayment> {
    const vendor = await this.vendorRepo.findOneBy({
      id: dto.vendorId,
      isActive: true,
    });
    if (!vendor)
      throw new BadRequestException('Fornecedor não encontrado ou inativo.');

    const sourceAccount = await this.accountRepo.findOneBy({
      id: dto.sourceAccountId,
    });
    if (!sourceAccount)
      throw new BadRequestException('Conta de origem não encontrada.');
    if (sourceAccount.type === AccountType.EXTERNAL)
      throw new BadRequestException('Conta de origem inválida para pagamento a fornecedor.');

    const payment = this.paymentRepo.create({
      vendorId: dto.vendorId,
      sourceAccountId: dto.sourceAccountId,
      amount: dto.amount,
      description: dto.description,
      receiptUrl: dto.receiptUrl ?? null,
      internalReceiptUrl: dto.internalReceiptUrl ?? null,
      paidByUserId,
    });

    const saved = await this.paymentRepo.save(payment);

    try {
      const amountBrl = dto.amount / 100;
      await this.ledgerService.recordTransaction(
        dto.sourceAccountId,
        vendor.accountId,
        amountBrl,
        `Pagamento a fornecedor: ${vendor.name} — ${dto.description}`,
        `vendor-payment:${saved.id}`,
      );
    } catch (error) {
      this.logger.error(`Falha ao registrar pagamento no ledger, revertendo: ${error}`);
      await this.paymentRepo.delete(saved.id);
      throw error;
    }

    return this.paymentRepo.findOneOrFail({ where: { id: saved.id } });
  }

  async findPayments(): Promise<(VendorPayment & { paidBy?: { name: string; avatarUrl: string; githubHandle: string } })[]> {
    const payments = await this.paymentRepo.find({
      order: { paidAt: 'DESC' },
      relations: ['vendor', 'sourceAccount'],
    });

    const userIds = [...new Set(payments.map((p) => p.paidByUserId))];
    const members = userIds.length > 0
      ? await this.memberRepo.find({ where: { id: In(userIds) } })
      : [];
    const memberMap = new Map(members.map((m) => [m.id, m]));

    return payments.map((p) => {
      const member = memberMap.get(p.paidByUserId);
      return {
        ...p,
        paidBy: member
          ? { name: member.name, avatarUrl: member.avatarUrl, githubHandle: member.githubHandle }
          : undefined,
      };
    });
  }

  async findPaymentById(id: string): Promise<VendorPayment> {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['vendor', 'sourceAccount'],
    });
    if (!payment) throw new NotFoundException('Pagamento não encontrado.');
    return payment;
  }

  /** Busca pagamento pelo referenceId da transação (para transparência — dados públicos apenas) */
  async findPaymentByReferenceId(
    refId: string,
  ): Promise<{
    id: string;
    amount: number;
    description: string;
    receiptUrl: string | null;
    internalReceiptUrl: string | null;
    paidAt: Date;
    vendor?: { name: string; document: string | null; website: string | null };
    paidBy?: { name: string; avatarUrl: string; githubHandle: string };
  } | null> {
    if (!refId.startsWith('vendor-payment:')) return null;
    const paymentId = refId.replace('vendor-payment:', '');
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['vendor'],
    });
    if (!payment) return null;

    let paidBy: { name: string; avatarUrl: string; githubHandle: string } | undefined;
    if (payment.paidByUserId) {
      const member = await this.memberRepo.findOne({ where: { id: payment.paidByUserId } });
      if (member) {
        paidBy = {
          name: member.name,
          avatarUrl: member.avatarUrl,
          githubHandle: member.githubHandle,
        };
      }
    }

    return {
      id: payment.id,
      amount: payment.amount,
      description: payment.description,
      receiptUrl: payment.receiptUrl,
      internalReceiptUrl: payment.internalReceiptUrl,
      paidAt: payment.paidAt,
      vendor: payment.vendor
        ? { name: payment.vendor.name, document: payment.vendor.document, website: payment.vendor.website }
        : undefined,
      paidBy,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTION TEMPLATES
  // ═══════════════════════════════════════════════════════════════════════════

  async createTemplate(
    dto: CreateTemplateDto,
    createdByUserId: string,
  ): Promise<TransactionTemplate> {
    const vendor = await this.vendorRepo.findOneBy({
      id: dto.vendorId,
      isActive: true,
    });
    if (!vendor)
      throw new BadRequestException('Fornecedor não encontrado ou inativo.');

    const sourceAccount = await this.accountRepo.findOneBy({ id: dto.sourceAccountId });
    if (!sourceAccount)
      throw new BadRequestException('Conta de origem não encontrada.');
    if (sourceAccount.type === AccountType.EXTERNAL)
      throw new BadRequestException('Conta de origem inválida para template de pagamento.');

    const template = this.templateRepo.create({
      ...dto,
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

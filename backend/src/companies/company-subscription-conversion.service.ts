import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Stripe from 'stripe';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { JwtPayload } from '../auth/jwt.strategy';
import { validateCnpj } from './companies.service';
import { validateCompanyProfileUrls } from './company-profile';
import { Member, MemberRole } from '../members/entities/member.entity';
import { Company, CompanyStatus } from './entities/company.entity';
import { CompanyWallet } from './entities/company-wallet.entity';
import { CompanySubscriptionConversion } from './entities/company-subscription-conversion.entity';

export interface PersonalSubscriptionOption {
  id: string;
  amountCents: number;
  interval: 'month';
  currentPeriodEnd: string | null;
}

@Injectable()
export class CompanySubscriptionConversionService {
  private readonly stripe: Stripe;

  constructor(
    @InjectRepository(CompanySubscriptionConversion)
    private readonly conversionRepo: Repository<CompanySubscriptionConversion>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,
    @InjectRepository(CompanyWallet)
    private readonly walletRepo: Repository<CompanyWallet>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_fake');
  }

  async listPersonalSubscriptions(
    memberId: string,
  ): Promise<PersonalSubscriptionOption[]> {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        memberId,
      )
    ) {
      throw new BadRequestException('memberId deve ser um UUID válido.');
    }
    const result = await this.stripe.subscriptions.search({
      query: `status:'active' AND metadata['memberId']:'${memberId}'`,
      limit: 100,
    });
    return result.data.flatMap((subscription) => {
      if (subscription.metadata?.entityType === 'business') return [];
      const item = subscription.items.data[0];
      const interval = item?.price?.recurring?.interval;
      if (!item || interval !== 'month') return [];
      const legacyPeriodEnd = (
        subscription as unknown as { current_period_end?: number }
      ).current_period_end;
      const periodEnd = item.current_period_end ?? legacyPeriodEnd ?? null;
      return [
        {
          id: subscription.id,
          amountCents: item.price.unit_amount ?? 0,
          interval: 'month',
          currentPeriodEnd: periodEnd
            ? new Date(periodEnd * 1000).toISOString()
            : null,
        },
      ];
    });
  }

  async convert(
    dto: ConvertCompanySubscriptionInput,
    actor: JwtPayload,
  ): Promise<ConversionResult> {
    if (!actor.roles?.includes(MemberRole.ADMIN)) {
      throw new ForbiddenException('Conversão de assinatura requer admin.');
    }
    const hasNewCompanyFields = [
      dto.name,
      dto.cnpj,
      dto.tradeName,
      dto.logoUrl,
      dto.websiteUrl,
    ].some((value) => value !== undefined);
    if (dto.companyId && hasNewCompanyFields) {
      throw new BadRequestException(
        'Use companyId ou os dados de uma nova empresa, não ambos.',
      );
    }
    const existing = await this.conversionRepo.findOneBy({
      stripeSubscriptionId: dto.subscriptionId,
    });
    if (existing?.status === 'completed') {
      return {
        conversionId: existing.id,
        companyId: existing.companyId,
        subscriptionId: existing.stripeSubscriptionId,
        status: 'already_converted',
      };
    }

    const subscription = await this.stripe.subscriptions.retrieve(
      dto.subscriptionId,
    );
    const item = subscription.items.data[0];
    if (
      subscription.status !== 'active' ||
      item?.price?.recurring?.interval !== 'month' ||
      subscription.metadata?.memberId !== dto.memberId
    ) {
      throw new ConflictException(
        'A assinatura não é pessoal, mensal, ativa e pertencente ao membro.',
      );
    }
    if (
      subscription.metadata?.entityType === 'business' &&
      (!existing || subscription.metadata?.companyId !== existing.companyId)
    ) {
      throw new ConflictException('A assinatura já pertence a uma empresa.');
    }
    const amountCents = item.price.unit_amount ?? 0;
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;
    if (!customerId)
      throw new ConflictException('Assinatura sem customer vinculado.');

    const prepared = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        dto.subscriptionId,
      ]);
      const conversions = manager.getRepository(CompanySubscriptionConversion);
      let conversion = await conversions.findOneBy({
        stripeSubscriptionId: dto.subscriptionId,
      });
      if (conversion?.status === 'completed') {
        return {
          already: true as const,
          conversion,
          companyId: conversion.companyId,
        };
      }

      const member = await manager
        .getRepository(Member)
        .findOneBy({ id: dto.memberId, isActive: true });
      if (!member) throw new NotFoundException('Membro ativo não encontrado.');
      const companies = manager.getRepository(Company);
      const companyId = conversion?.companyId ?? dto.companyId;
      let company: Company;
      if (companyId) {
        const found = await companies.findOne({
          where: { id: companyId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!found) throw new NotFoundException('Empresa não encontrada.');
        if (found.responsibleMemberId !== dto.memberId) {
          throw new ConflictException(
            'A empresa deve pertencer ao membro selecionado.',
          );
        }
        if (
          found.stripeSubscriptionId &&
          found.stripeSubscriptionId !== dto.subscriptionId
        ) {
          throw new ConflictException('A empresa já possui outra assinatura.');
        }
        company = found;
      } else {
        if (!dto.name || !dto.cnpj) {
          throw new BadRequestException(
            'Nome e CNPJ são obrigatórios para criar a empresa.',
          );
        }
        validateCnpj(dto.cnpj);
        validateCompanyProfileUrls(dto);
        if (await companies.findOneBy({ cnpj: dto.cnpj })) {
          throw new ConflictException('CNPJ já cadastrado.');
        }
        if (await companies.findOneBy({ responsibleMemberId: dto.memberId })) {
          throw new ConflictException(
            'O membro já é responsável por uma empresa; selecione-a.',
          );
        }
        company = await companies.save(
          companies.create({
            cnpj: dto.cnpj,
            name: dto.name,
            tradeName: dto.tradeName ?? null,
            logoUrl: dto.logoUrl ?? null,
            websiteUrl: dto.websiteUrl ?? null,
            responsibleMemberId: dto.memberId,
            status: CompanyStatus.PENDING,
            subscriptionAmountCents: amountCents,
          }),
        );
      }

      if (!conversion) {
        conversion = conversions.create({
          stripeSubscriptionId: dto.subscriptionId,
          memberId: dto.memberId,
          companyId: company.id,
          requestedById: actor.sub,
          status: 'pending',
          completedAt: null,
        });
      }
      conversion = await conversions.save(conversion);
      return { already: false as const, conversion, company };
    });
    if (prepared.already) {
      return {
        conversionId: prepared.conversion.id,
        companyId: prepared.companyId,
        subscriptionId: dto.subscriptionId,
        status: 'already_converted',
      };
    }

    if (subscription.metadata?.entityType !== 'business') {
      await this.stripe.subscriptions.update(dto.subscriptionId, {
        metadata: {
          entityType: 'business',
          companyId: prepared.company.id,
          memberId: dto.memberId,
          isSubscription: 'true',
        },
      });
    }

    const completed = await this.dataSource.transaction(async (manager) => {
      const conversions = manager.getRepository(CompanySubscriptionConversion);
      const conversion = await conversions.findOneBy({
        stripeSubscriptionId: dto.subscriptionId,
      });
      if (!conversion) throw new NotFoundException('Conversão não encontrada.');
      if (conversion.status === 'completed')
        return {
          conversion,
          company: prepared.company,
          already: true as const,
        };
      const companies = manager.getRepository(Company);
      const company = await companies.findOne({
        where: { id: conversion.companyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!company) throw new NotFoundException('Empresa não encontrada.');
      await companies.update(company.id, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: dto.subscriptionId,
        subscriptionAmountCents: amountCents,
      });
      const wallets = manager.getRepository(CompanyWallet);
      if (!(await wallets.findOneBy({ companyId: company.id }))) {
        await wallets.save(
          wallets.create({
            companyId: company.id,
            balances: {},
            frozenTypes: [],
          }),
        );
      }
      conversion.status = 'completed';
      conversion.completedAt = new Date();
      await conversions.save(conversion);
      return { conversion, company, already: false as const };
    });
    if (!completed.already) {
      await this.audit.log({
        action: AuditAction.COMPANY_SUBSCRIPTION_CONVERTED,
        actorId: actor.sub,
        actorHandle: actor.handle,
        targetId: completed.company.id,
        targetType: 'company',
        details: {
          conversionId: completed.conversion.id,
          subscriptionId: dto.subscriptionId,
          memberId: dto.memberId,
        },
      });
    }
    return {
      conversionId: completed.conversion.id,
      companyId: completed.company.id,
      subscriptionId: dto.subscriptionId,
      status: completed.already ? 'already_converted' : 'converted',
    };
  }
}

export interface ConvertCompanySubscriptionInput {
  memberId: string;
  subscriptionId: string;
  companyId?: string;
  name?: string;
  cnpj?: string;
  tradeName?: string;
  logoUrl?: string;
  websiteUrl?: string;
}

export interface ConversionResult {
  conversionId: string;
  companyId: string;
  subscriptionId: string;
  status: 'converted' | 'already_converted';
}

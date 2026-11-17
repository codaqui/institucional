import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Stripe from 'stripe';
import { AuditService } from '../audit/audit.service';
import { Member } from '../members/entities/member.entity';
import { Company } from './entities/company.entity';
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

  async listPersonalSubscriptions(memberId: string): Promise<PersonalSubscriptionOption[]> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(memberId)) {
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
      const legacyPeriodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;
      const periodEnd = item.current_period_end ?? legacyPeriodEnd ?? null;
      return [{
        id: subscription.id,
        amountCents: item.price.unit_amount ?? 0,
        interval: 'month',
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      }];
    });
  }
}

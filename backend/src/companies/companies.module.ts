import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Company } from './entities/company.entity';
import { CompanyWallet } from './entities/company-wallet.entity';
import { CompanyWalletTransaction } from './entities/company-wallet-transaction.entity';
import { CompanyMember } from './entities/company-member.entity';
import { CompanySubscriptionTracking } from './entities/company-subscription-tracking.entity';
import { Member } from '../members/entities/member.entity';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { ClubModule } from '../club/club.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      CompanyWallet,
      CompanyWalletTransaction,
      CompanyMember,
      CompanySubscriptionTracking,
      Member,
    ]),
    ScheduleModule.forRoot(),
    forwardRef(() => ClubModule),
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}

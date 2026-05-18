import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { Transaction } from '../ledger/entities/transaction.entity';
import { ClubModule } from '../club/club.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [
    LedgerModule,
    TypeOrmModule.forFeature([Transaction]),
    ClubModule,
    CompaniesModule,
  ],
  controllers: [StripeController],
  providers: [StripeService],
})
export class StripeModule {}

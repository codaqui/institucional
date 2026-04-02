import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { Transaction } from '../ledger/entities/transaction.entity';

@Module({
  imports: [LedgerModule, TypeOrmModule.forFeature([Transaction])],
  controllers: [StripeController],
  providers: [StripeService],
})
export class StripeModule {}

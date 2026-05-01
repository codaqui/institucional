import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendorsService } from './vendors.service';
import { VendorsController } from './vendors.controller';
import { Vendor } from './entities/vendor.entity';
import { VendorPayment } from './entities/vendor-payment.entity';
import { VendorReceipt } from './entities/vendor-receipt.entity';
import { TransactionTemplate } from './entities/transaction-template.entity';
import { Account } from '../ledger/entities/account.entity';
import { Member } from '../members/entities/member.entity';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vendor,
      VendorPayment,
      VendorReceipt,
      TransactionTemplate,
      Account,
      Member,
    ]),
    LedgerModule,
  ],
  providers: [VendorsService],
  controllers: [VendorsController],
  exports: [VendorsService],
})
export class VendorsModule {}

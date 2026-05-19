import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './entities/wallet.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { Raffle } from './entities/raffle.entity';
import { RaffleEntry } from './entities/raffle-entry.entity';
import { Company } from '../companies/entities/company.entity';
import { CompanyWallet } from '../companies/entities/company-wallet.entity';
import { Member } from '../members/entities/member.entity';
import { ClubService } from './club.service';
import { RaffleService } from './raffle.service';
import { ClubController } from './club.controller';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Wallet,
      WalletTransaction,
      Raffle,
      RaffleEntry,
      // Entidades de companies necessárias ao RaffleService
      Company,
      CompanyWallet,
      Member,
    ]),
    forwardRef(() => CompaniesModule),
  ],
  controllers: [ClubController],
  providers: [ClubService, RaffleService],
  exports: [ClubService, RaffleService],
})
export class ClubModule {}

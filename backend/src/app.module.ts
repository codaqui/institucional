import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LedgerModule } from './ledger/ledger.module';
import { ExpensesModule } from './expenses/expenses.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { StripeModule } from './stripe/stripe.module';
import { MembersModule } from './members/members.module';
import { ReimbursementsModule } from './reimbursements/reimbursements.module';
import { TransfersModule } from './transfers/transfers.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'codaqui',
      password: process.env.DB_PASSWORD || 'codaqui_pass',
      database: process.env.DB_NAME || 'codaqui_db',
      autoLoadEntities: true,
      synchronize: true, // Auto-sync schema for MVP
    }),
    LedgerModule,
    ExpensesModule,
    StorageModule,
    AuthModule,
    StripeModule,
    MembersModule,
    ReimbursementsModule,
    TransfersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

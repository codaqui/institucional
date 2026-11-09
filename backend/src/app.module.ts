import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { AuditModule } from './audit/audit.module';
import { VendorsModule } from './vendors/vendors.module';
import { ClubModule } from './club/club.module';
import { CompaniesModule } from './companies/companies.module';
import { GithubDbModule } from './github-db/github-db.module';
import { EventOrganizerModule } from './event-organizer/event-organizer.module';
import { EventsModule } from './events/events.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DesignationsModule } from './designations/designations.module';
import { DirectoratesModule } from './directorates/directorates.module';
import { CommunitiesModule } from './communities/communities.module';
import { SettingsModule } from './settings/settings.module';
import { TurnstileModule } from './common/turnstile/turnstile.module';
import { HoursModule } from './hours/hours.module';
import { AssembliesModule } from './assemblies/assemblies.module';
import { EntitiesModule } from './entities/entities.module';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number.parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'codaqui',
      password:
        process.env.DB_PASSWORD ||
        (process.env.NODE_ENV === 'production'
          ? (() => {
              throw new Error('DB_PASSWORD is required in production');
            })()
          : 'codaqui_pass'),
      database: process.env.DB_NAME || 'codaqui_db',
      autoLoadEntities: true,
      synchronize: false,
      migrations: ['dist/migrations/*.js'],
      migrationsTransactionMode: 'each',
      migrationsRun: process.env.NODE_ENV === 'production',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // janela de 1 minuto
        limit: 30, // máximo 30 requisições por IP por minuto
      },
    ]),
    LedgerModule,
    ExpensesModule,
    StorageModule,
    AuthModule,
    StripeModule,
    MembersModule,
    ReimbursementsModule,
    TransfersModule,
    AuditModule,
    VendorsModule,
    ClubModule,
    CompaniesModule,
    GithubDbModule,
    EventOrganizerModule,
    EventsModule,
    NotificationsModule,
    DesignationsModule,
    DirectoratesModule,
    CommunitiesModule,
    SettingsModule,
    TurnstileModule,
    HoursModule,
    AssembliesModule,
    EntitiesModule,
    ProjectsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

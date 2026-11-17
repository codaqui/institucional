import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AccountDeletionRequest } from './entities/account-deletion-request.entity';
import { AccountDeletionService } from './account-deletion.service';
import { PrivacyController } from './privacy.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AccountDeletionRequest]), AuditModule],
  controllers: [PrivacyController],
  providers: [AccountDeletionService],
  exports: [AccountDeletionService],
})
export class PrivacyModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { Community } from '../communities/entities/community.entity';
import { MemberDesignation } from '../designations/entities/member-designation.entity';
import { Directorate } from '../directorates/entities/directorate.entity';
import { Member } from '../members/entities/member.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { EmailCampaign } from './entities/email-campaign.entity';
import { EmailCampaignRecipient } from './entities/email-campaign-recipient.entity';
import { EmailSuppression } from './entities/email-suppression.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailCampaign,
      EmailCampaignRecipient,
      EmailSuppression,
      Member,
      MemberDesignation,
      Directorate,
      Community,
    ]),
    NotificationsModule,
    AuditModule,
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}

import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CAMPAIGN_PURPOSES,
  CAMPAIGN_SEGMENT_TYPES,
  CAMPAIGN_STATUSES,
  type CampaignPurpose,
  type CampaignSegmentConfig,
  type CampaignSegmentType,
  type CampaignStatus,
} from '../entities/email-campaign.entity';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  bodyMarkdown: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  templateId?: string | null;

  @IsIn(CAMPAIGN_PURPOSES)
  purpose: CampaignPurpose;

  @IsIn(CAMPAIGN_SEGMENT_TYPES)
  segmentType: CampaignSegmentType;

  @IsObject()
  segmentConfig: CampaignSegmentConfig;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey: string;
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  bodyMarkdown?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  templateId?: string | null;

  @IsOptional()
  @IsIn(CAMPAIGN_PURPOSES)
  purpose?: CampaignPurpose;

  @IsOptional()
  @IsIn(CAMPAIGN_SEGMENT_TYPES)
  segmentType?: CampaignSegmentType;

  @IsOptional()
  @IsObject()
  segmentConfig?: CampaignSegmentConfig;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string | null;
}

export class ConfirmCampaignDto {
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string | null;
}

export class ListCampaignsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(CAMPAIGN_STATUSES)
  status?: CampaignStatus;

  @IsOptional()
  @IsIn(CAMPAIGN_PURPOSES)
  purpose?: CampaignPurpose;
}

export class CreateSuppressionDto {
  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  @IsIn(['admin', 'complaint', 'bounce_manual'])
  source: 'admin' | 'complaint' | 'bounce_manual';
}
